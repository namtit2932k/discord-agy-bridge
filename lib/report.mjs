import { getDirectorySizeBytes, getLocalDateKey, resolveEffectiveMemberLimits } from "./quota.mjs";
import { formatByteSize, formatNumber } from "./utils.mjs";

export const DEFAULT_DAILY_REPORT = {
  enabled: false,
  time: "22:00",
  channelId: "",
};

/** Parse HH:MM (24-hour) into normalized { hour, minute, formatted } or null if invalid. */
export function parseDailyReportTime(rawTime) {
  const m = String(rawTime || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return {
    hour,
    minute,
    formatted: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

/** Normalize dailyReport settings from config.json. */
export function normalizeDailyReportConfig(rawReport) {
  const raw = rawReport && typeof rawReport === "object" ? rawReport : {};
  const parsedTime = parseDailyReportTime(raw.time) || parseDailyReportTime(DEFAULT_DAILY_REPORT.time);
  return {
    enabled: raw.enabled === true,
    time: parsedTime.formatted,
    channelId: raw.channelId ? String(raw.channelId).trim() : "",
  };
}

/** Record a daily member security alert (e.g. BypassSandbox attempt) cleanly in state. */
export function recordSecurityAlert(state, { userId = "", channelId = "", kind = "bypass_sandbox", nowMs = Date.now() } = {}) {
  const today = getLocalDateKey(nowMs);
  if (!state.dailyAlerts || state.dailyAlerts.date !== today) {
    state.dailyAlerts = { date: today, total: 0, byUser: {}, byKind: {} };
  }
  state.dailyAlerts.total += 1;
  if (userId) {
    const uid = String(userId);
    state.dailyAlerts.byUser[uid] = (Number(state.dailyAlerts.byUser[uid]) || 0) + 1;
  }
  if (kind) {
    state.dailyAlerts.byKind[kind] = (Number(state.dailyAlerts.byKind[kind]) || 0) + 1;
  }
  if (channelId) {
    state.dailyAlerts.lastChannelId = String(channelId);
  }
  return state.dailyAlerts;
}

/** Pack report lines into Discord-safe 1900-char chunks without splitting lines. */
function packReportLines(lines, maxLen = 1900) {
  const chunks = [];
  let cur = "";
  for (const line of lines) {
    const next = cur ? `${cur}\n${line}` : line;
    if (next.length <= maxLen) {
      cur = next;
    } else {
      if (cur) chunks.push(cur);
      cur = line.length > maxLen ? `${line.slice(0, maxLen - 3)}...` : line;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** Build a zero-token daily admin summary from state & disk stats. */
export function buildDailyReportMessages({ state, config, nowMs = Date.now() }) {
  const today = getLocalDateKey(nowMs);
  const memberUsage = state?.memberUsage && typeof state.memberUsage === "object" ? state.memberUsage : {};
  const channelRules = config?.channelRules && typeof config.channelRules === "object" ? config.channelRules : {};
  const globalLimits = config?.memberLimits;

  // Map member userId -> { channelId, rule } from channelRules (prefer onboardedUserId, fall back to allowedUserIds)
  const memberRuleMap = new Map();
  for (const [cid, rule] of Object.entries(channelRules)) {
    if (!rule || rule.allowAdminOnly) continue;
    const ownerIds = rule.onboardedUserId
      ? [String(rule.onboardedUserId)]
      : Array.isArray(rule.allowedUserIds)
        ? rule.allowedUserIds.map(String)
        : [];
    for (const uid of ownerIds) {
      if (!memberRuleMap.has(uid)) {
        memberRuleMap.set(uid, { channelId: cid, rule });
      }
    }
  }

  const allUserIds = new Set([...memberRuleMap.keys()]);
  for (const [uid, entry] of Object.entries(memberUsage)) {
    if (entry && entry.date === today) allUserIds.add(uid);
  }

  let todayMemberTurns = 0;
  let todayMemberTokens = 0;
  const memberRows = [];

  for (const uid of allUserIds) {
    const usage = memberUsage[uid]?.date === today ? memberUsage[uid] : { turns: 0, tokens: 0 };
    const turns = Number(usage.turns) || 0;
    const tokens = Number(usage.tokens) || 0;
    todayMemberTurns += turns;
    todayMemberTokens += tokens;

    const info = memberRuleMap.get(uid) || null;
    const limits = resolveEffectiveMemberLimits(globalLimits, info?.rule || null);
    const maxBytes = limits.workspaceMaxMb > 0 ? limits.workspaceMaxMb * 1024 * 1024 : 0;
    const usedBytes = info?.rule?.cwd ? getDirectorySizeBytes(info.rule.cwd) : 0;
    const diskWarn = maxBytes > 0 && usedBytes >= maxBytes * 0.8;

    memberRows.push({
      uid,
      channelId: info?.channelId || "",
      turns,
      dailyMaxTurns: limits.dailyMaxTurns,
      tokens,
      usedBytes,
      maxBytes,
      diskWarn,
      alerts: state?.dailyAlerts?.date === today ? Number(state.dailyAlerts.byUser?.[uid]) || 0 : 0,
    });
  }

  memberRows.sort((a, b) => b.turns - a.turns || b.tokens - a.tokens || b.usedBytes - a.usedBytes);

  const alertTotal = state?.dailyAlerts?.date === today ? Number(state.dailyAlerts.total) || 0 : 0;
  const totals = state?.sessionTotals || { turns: 0, total_tokens: 0, duration_seconds: 0 };
  const reportCfg = normalizeDailyReportConfig(config?.dailyReport);

  const lines = [
    `📊 **Báo cáo tổng kết ngày ${today}**`,
    `• **Hoạt động Member hôm nay:** \`${todayMemberTurns}\` lượt | \`${formatNumber(todayMemberTokens)}\` tokens`,
    `• **Cảnh báo Sandbox hôm nay:** ${alertTotal > 0 ? `⚠️ **${alertTotal}** lần` : "✅ 0"}`,
    `• **Tổng tích lũy toàn bot:** \`${totals.turns || 0}\` lượt | \`${formatNumber(totals.total_tokens || 0)}\` tokens (${Number(totals.duration_seconds || 0).toFixed(1)}s)`,
  ];

  if (memberRows.length === 0) {
    lines.push("• **Chi tiết thành viên:** *(chưa có dữ liệu thành viên/kênh riêng)*");
  } else {
    lines.push("", "**Chi tiết theo thành viên:**");
    for (const r of memberRows) {
      const chTag = r.channelId ? ` (<#${r.channelId}>)` : "";
      const turnStr = r.dailyMaxTurns > 0 ? `${r.turns}/${r.dailyMaxTurns} lượt` : `${r.turns} lượt`;
      const diskStr =
        r.channelId && r.maxBytes > 0
          ? ` | Thư mục: ${formatByteSize(r.usedBytes)}/${formatByteSize(r.maxBytes)}${r.diskWarn ? " ⚠️" : ""}`
          : r.channelId
            ? ` | Thư mục: ${formatByteSize(r.usedBytes)}`
            : "";
      const alertStr = r.alerts > 0 ? ` | 🛡️ ${r.alerts} cảnh báo` : "";
      lines.push(`• <@${r.uid}>${chTag}: ${turnStr} | \`${formatNumber(r.tokens)}\` tokens${diskStr}${alertStr}`);
    }
  }

  if (reportCfg.enabled) {
    lines.push("", `*-# Tự động gửi mỗi ngày lúc \`${reportCfg.time}\` · Tắt/đổi giờ bằng \`/access report\`*`);
  }

  return packReportLines(lines, 1900);
}

/** Manage the daily admin summary timer cleanly without LLM usage. */
export function createDailyReportScheduler({
  getConfig,
  state,
  saveState,
  isReady,
  sendReport,
  nowMsFn = () => Date.now(),
  intervalMs = 30000,
}) {
  let timer = null;
  let running = false;

  async function tick() {
    if (running) return false;
    const cfg = normalizeDailyReportConfig(getConfig()?.dailyReport);
    if (!cfg.enabled || !isReady()) return false;

    const nowMs = nowMsFn();
    const today = getLocalDateKey(nowMs);
    if (state.dailyReport?.lastSentDate === today) return false;

    const parsed = parseDailyReportTime(cfg.time);
    if (!parsed) return false;

    const d = new Date(nowMs);
    const curMinutes = d.getHours() * 60 + d.getMinutes();
    const targetMinutes = parsed.hour * 60 + parsed.minute;
    if (curMinutes < targetMinutes) return false;

    running = true;
    try {
      state.dailyReport = { ...(state.dailyReport || {}), lastSentDate: today, lastSentAt: new Date(nowMs).toISOString() };
      saveState();
      await sendReport({ nowMs, manual: false, config: getConfig() });
      return true;
    } catch (err) {
      console.error("[report] Daily report failed:", err?.message || err);
      return false;
    } finally {
      running = false;
    }
  }

  return {
    tick,
    start() {
      if (timer) return;
      timer = setInterval(() => {
        tick().catch(() => {});
      }, intervalMs);
      timer.unref?.();
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
  };
}
