import fs from "node:fs";
import path from "node:path";

export const DEFAULT_MEMBER_LIMITS = {
  dailyMaxTurns: 30,
  dailyMaxTokens: 0, // 0 = unlimited
  cooldownSec: 5,
  workspaceMaxMb: 200,
  blockBypassSandbox: true,
};

function clampNonNegativeInt(rawValue, fallback) {
  if (rawValue === undefined || rawValue === null || rawValue === "") return fallback;
  const num = Number(rawValue);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.floor(num);
}

/** Normalize global Member quota & safety settings from config.json. */
export function normalizeMemberLimitsConfig(rawLimits) {
  const raw = rawLimits && typeof rawLimits === "object" ? rawLimits : {};
  return {
    dailyMaxTurns: clampNonNegativeInt(raw.dailyMaxTurns, DEFAULT_MEMBER_LIMITS.dailyMaxTurns),
    dailyMaxTokens: clampNonNegativeInt(raw.dailyMaxTokens, DEFAULT_MEMBER_LIMITS.dailyMaxTokens),
    cooldownSec: clampNonNegativeInt(raw.cooldownSec, DEFAULT_MEMBER_LIMITS.cooldownSec),
    workspaceMaxMb: clampNonNegativeInt(raw.workspaceMaxMb, DEFAULT_MEMBER_LIMITS.workspaceMaxMb),
    blockBypassSandbox: raw.blockBypassSandbox !== false,
  };
}

/** Return YYYY-MM-DD in local machine time for daily quota rollovers. */
export function getLocalDateKey(nowMs = Date.now()) {
  const d = new Date(nowMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Read and auto-reset today's usage bucket for a Member userId. */
export function getMemberDailyUsage(state, userId, nowMs = Date.now()) {
  const uid = String(userId || "").trim();
  const today = getLocalDateKey(nowMs);
  if (!state.memberUsage || typeof state.memberUsage !== "object") {
    state.memberUsage = {};
  }
  const existing = state.memberUsage[uid];
  if (!existing || existing.date !== today) {
    return { date: today, turns: 0, tokens: 0, lastRequestAt: existing?.lastRequestAt || 0 };
  }
  return {
    date: today,
    turns: Number(existing.turns) || 0,
    tokens: Number(existing.tokens) || 0,
    lastRequestAt: Number(existing.lastRequestAt) || 0,
  };
}

/** Prune stale memberUsage entries from previous days except keeping recent timestamps clean. */
export function pruneOldMemberUsage(state, nowMs = Date.now()) {
  if (!state.memberUsage || typeof state.memberUsage !== "object") return;
  const today = getLocalDateKey(nowMs);
  for (const [uid, entry] of Object.entries(state.memberUsage)) {
    if (!entry || entry.date !== today) {
      delete state.memberUsage[uid];
    }
  }
}

/** Resolve effective quota limits for a member (per-rule overrides fall back to global memberLimits). */
export function resolveEffectiveMemberLimits(globalLimits, rule = null) {
  const base = normalizeMemberLimitsConfig(globalLimits);
  if (!rule || typeof rule !== "object") return base;
  return {
    dailyMaxTurns:
      rule.dailyMaxTurns !== undefined && rule.dailyMaxTurns !== null
        ? clampNonNegativeInt(rule.dailyMaxTurns, base.dailyMaxTurns)
        : base.dailyMaxTurns,
    dailyMaxTokens:
      rule.dailyMaxTokens !== undefined && rule.dailyMaxTokens !== null
        ? clampNonNegativeInt(rule.dailyMaxTokens, base.dailyMaxTokens)
        : base.dailyMaxTokens,
    cooldownSec:
      rule.cooldownSec !== undefined && rule.cooldownSec !== null
        ? clampNonNegativeInt(rule.cooldownSec, base.cooldownSec)
        : base.cooldownSec,
    workspaceMaxMb:
      rule.workspaceMaxMb !== undefined && rule.workspaceMaxMb !== null
        ? clampNonNegativeInt(rule.workspaceMaxMb, base.workspaceMaxMb)
        : base.workspaceMaxMb,
    blockBypassSandbox: base.blockBypassSandbox,
  };
}

/** Check whether a non-Admin Member may start a new prompt turn under cooldown & daily limits. */
export function checkMemberQuota({ state, userId, rule = null, globalLimits = null, nowMs = Date.now() }) {
  const uid = String(userId || "").trim();
  const limits = resolveEffectiveMemberLimits(globalLimits, rule);
  const usage = getMemberDailyUsage(state, uid, nowMs);

  if (limits.cooldownSec > 0 && usage.lastRequestAt > 0) {
    const elapsedMs = nowMs - usage.lastRequestAt;
    const cooldownMs = limits.cooldownSec * 1000;
    if (elapsedMs >= 0 && elapsedMs < cooldownMs) {
      const waitSec = Math.max(1, Math.ceil((cooldownMs - elapsedMs) / 1000));
      return {
        allowed: false,
        reason: "cooldown",
        waitSec,
        limits,
        usage,
        message: `⏳ Bạn gửi hơi nhanh, vui lòng đợi **${waitSec}s** nữa rồi thử lại nhé.`,
      };
    }
  }

  if (limits.dailyMaxTurns > 0 && usage.turns >= limits.dailyMaxTurns) {
    return {
      allowed: false,
      reason: "daily_turns",
      limits,
      usage,
      message: `⛔ Bạn đã dùng hết **${usage.turns}/${limits.dailyMaxTurns} lượt** hôm nay. Hạn mức sẽ tự làm mới vào **00:00 ngày mai** *(hoặc nhắn Admin nếu cần mở thêm)*.`,
    };
  }

  if (limits.dailyMaxTokens > 0 && usage.tokens >= limits.dailyMaxTokens) {
    return {
      allowed: false,
      reason: "daily_tokens",
      limits,
      usage,
      message: `⛔ Bạn đã chạm hạn mức token hôm nay (**${usage.tokens.toLocaleString("en-US")} / ${limits.dailyMaxTokens.toLocaleString("en-US")}** tokens). Hạn mức sẽ tự làm mới vào **00:00 ngày mai**.`,
    };
  }

  return {
    allowed: true,
    reason: "ok",
    limits,
    usage,
    remainingTurns: limits.dailyMaxTurns > 0 ? Math.max(0, limits.dailyMaxTurns - usage.turns) : null,
  };
}

/** Increment today's accepted turn count and update lastRequestAt for cooldown tracking. */
export function recordMemberTurnAccepted(state, userId, nowMs = Date.now()) {
  const uid = String(userId || "").trim();
  if (!uid) return null;
  const current = getMemberDailyUsage(state, uid, nowMs);
  current.turns += 1;
  current.lastRequestAt = nowMs;
  state.memberUsage[uid] = current;
  return current;
}

/** Accumulate token usage into today's Member quota bucket after an agy run finishes. */
export function recordMemberTurnTokens(state, userId, totalTokens, nowMs = Date.now()) {
  const uid = String(userId || "").trim();
  const tok = Number(totalTokens) || 0;
  if (!uid || tok <= 0) return null;
  const current = getMemberDailyUsage(state, uid, nowMs);
  current.tokens += tok;
  state.memberUsage[uid] = current;
  return current;
}

/** Compute total file bytes inside a directory (bounded walk to prevent hangs on huge trees). */
export function getDirectorySizeBytes(dirPath, maxEntries = 5000) {
  if (!dirPath || !fs.existsSync(dirPath)) return 0;
  let total = 0;
  let visited = 0;
  const stack = [dirPath];
  while (stack.length > 0 && visited < maxEntries) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (++visited > maxEntries) break;
      if (entry.isSymbolicLink()) continue;
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size;
        } catch {
          // Ignore transient vanished file
        }
      }
    }
  }
  return total;
}
