import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractSnowflakeId } from "./utils.mjs";

const VALID_MODES = new Set(["accept-edits", "auto", "plan"]);
export const VALID_EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);

export const MEMBER_ALLOWED_COMMANDS = new Set(["/help", "/status", "/new", "/clear", "/delete", "/stop", "/usage", "/play"]);

function uniqueSnowflakes(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const id = String(item || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Normalize per-channel RBAC rules loaded from config.json. */
export function normalizeChannelRules(rawRules) {
  const normalized = {};
  if (!rawRules || typeof rawRules !== "object") return normalized;

  for (const [rawChannelId, rawRule] of Object.entries(rawRules)) {
    const channelId = String(rawChannelId || "").trim();
    if (!channelId || !rawRule || typeof rawRule !== "object") continue;

    const rawCwd = typeof rawRule.cwd === "string" ? rawRule.cwd.trim() : "";
    normalized[channelId] = {
      label: typeof rawRule.label === "string" ? rawRule.label.trim() : "",
      cwd: rawCwd ? path.resolve(rawCwd) : "",
      projectId: typeof rawRule.projectId === "string" ? rawRule.projectId.trim() : "",
      projectName: typeof rawRule.projectName === "string" ? rawRule.projectName.trim() : "",
      onboardedUserId: typeof rawRule.onboardedUserId === "string" ? rawRule.onboardedUserId.trim() : "",
      allowUserIds: uniqueSnowflakes(rawRule.allowUserIds || rawRule.userIds),
      allowRoleIds: uniqueSnowflakes(rawRule.allowRoleIds || rawRule.roleIds),
      allowEveryone: rawRule.allowEveryone === true,
      allowAdminOnly: rawRule.allowAdminOnly === true,
      mode: VALID_MODES.has(rawRule.mode) ? rawRule.mode : "auto",
      sandbox: rawRule.sandbox !== false,
      allowNonWorkspaceAccess: rawRule.allowNonWorkspaceAccess === true,
      allowDesktopTools: rawRule.allowDesktopTools === true,
      allowChrome: rawRule.allowChrome === true,
      allowFirecrawl: rawRule.allowFirecrawl === true,
      allowModelChange: rawRule.allowModelChange === true,
      allowClear: rawRule.allowClear !== undefined ? rawRule.allowClear === true : Boolean(rawRule.onboardedUserId),
      model: typeof rawRule.model === "string" ? rawRule.model.trim() : "",
      effort:
        typeof rawRule.effort === "string" && VALID_EFFORTS.has(rawRule.effort.trim().toLowerCase())
          ? rawRule.effort.trim().toLowerCase()
          : "",
      autoThread: rawRule.autoThread !== undefined ? Boolean(rawRule.autoThread) : undefined,
      dailyMaxTurns:
        rawRule.dailyMaxTurns !== undefined && rawRule.dailyMaxTurns !== null && Number.isFinite(Number(rawRule.dailyMaxTurns))
          ? Math.max(0, Math.floor(Number(rawRule.dailyMaxTurns)))
          : undefined,
      dailyMaxTokens:
        rawRule.dailyMaxTokens !== undefined && rawRule.dailyMaxTokens !== null && Number.isFinite(Number(rawRule.dailyMaxTokens))
          ? Math.max(0, Math.floor(Number(rawRule.dailyMaxTokens)))
          : undefined,
      cooldownSec:
        rawRule.cooldownSec !== undefined && rawRule.cooldownSec !== null && Number.isFinite(Number(rawRule.cooldownSec))
          ? Math.max(0, Math.floor(Number(rawRule.cooldownSec)))
          : undefined,
      workspaceMaxMb:
        rawRule.workspaceMaxMb !== undefined && rawRule.workspaceMaxMb !== null && Number.isFinite(Number(rawRule.workspaceMaxMb))
          ? Math.max(0, Math.floor(Number(rawRule.workspaceMaxMb)))
          : undefined,
    };
  }
  return normalized;
}

/** Normalize automatic member onboarding settings loaded from config.json. */
export function normalizeAutoOnboardConfig(rawOnboard) {
  const raw = rawOnboard && typeof rawOnboard === "object" ? rawOnboard : {};
  const rawRoot = typeof raw.rootDir === "string" && raw.rootDir.trim()
    ? raw.rootDir.trim()
    : path.join(os.homedir(), "DiscordShared");
  return {
    enabled: raw.enabled !== false,
    rootDir: path.resolve(rawRoot),
    categoryName: typeof raw.categoryName === "string" ? raw.categoryName.trim() : "Member Workspaces",
    categoryId: raw.categoryId ? String(raw.categoryId).trim() : "",
    channelPrefix: typeof raw.channelPrefix === "string" && raw.channelPrefix.trim() ? raw.channelPrefix.trim() : "ai-",
    defaultModel: typeof raw.defaultModel === "string" ? raw.defaultModel.trim() : "",
    defaultEffort:
      typeof raw.defaultEffort === "string" && VALID_EFFORTS.has(raw.defaultEffort.trim().toLowerCase())
        ? raw.defaultEffort.trim().toLowerCase()
        : "",
    mode: VALID_MODES.has(raw.mode) ? raw.mode : "auto",
    sandbox: raw.sandbox !== false,
    allowNonWorkspaceAccess: raw.allowNonWorkspaceAccess === true,
    allowDesktopTools: raw.allowDesktopTools === true,
    allowChrome: raw.allowChrome === true,
    allowFirecrawl: raw.allowFirecrawl === true,
    allowModelChange: raw.allowModelChange === true,
    allowClear: raw.allowClear !== false,
    ignoreBots: raw.ignoreBots !== false,
    deleteChannelOnLeave: raw.deleteChannelOnLeave === true,
    allowGuildIds: uniqueSnowflakes(raw.allowGuildIds),
  };
}

/** Return true if userId matches the root owner or any configured co-admin. */
export function isAdminUser(config, userId) {
  const id = String(userId || "").trim();
  if (!id) return false;
  if (id === config.allowedUserId) return true;
  return Array.isArray(config.adminUserIds) && config.adminUserIds.includes(id);
}

/** Build unrestricted execution policy for Admin turns. */
export function createAdminPolicy() {
  return {
    role: "admin",
    isAdmin: true,
    allowDesktopTools: true,
    allowChrome: true,
    allowFirecrawl: true,
    allowNonWorkspaceAccess: true,
    allowModelChange: true,
    allowClear: true,
    fixedCwd: "",
    forcedMode: "",
    forcedSandbox: null,
    forcedModel: "",
    forcedEffort: "",
    allowedMcpTools: null,
  };
}

export const MEMBER_SAFE_MCP_TOOLS = ["send_to_discord", "text_to_speech"];

/** Build restricted execution policy for Member/Team turns based on the channel's RBAC rule. */
export function createMemberPolicy(rule, fallbackSafeCwd) {
  const safeCwd = rule?.cwd && fs.existsSync(rule.cwd) ? rule.cwd : fallbackSafeCwd;
  const allowDesktop = rule?.allowDesktopTools === true;
  return {
    role: "member",
    isAdmin: false,
    allowDesktopTools: allowDesktop,
    allowChrome: rule?.allowChrome === true,
    allowFirecrawl: rule?.allowFirecrawl === true,
    allowNonWorkspaceAccess: rule?.allowNonWorkspaceAccess === true,
    allowModelChange: rule?.allowModelChange === true,
    allowClear: rule?.allowClear === true,
    fixedCwd: safeCwd,
    forcedMode: rule?.mode || "auto",
    forcedSandbox: rule?.sandbox !== false,
    forcedModel: rule?.model || "",
    forcedEffort: rule?.effort || "",
    allowedMcpTools: allowDesktop ? null : [...MEMBER_SAFE_MCP_TOOLS],
  };
}

/** Evaluate whether a user in a DM, guild channel, or thread may interact with the bot and with what policy. */
export function evaluateMessageAccess({
  msg,
  config,
  isDm,
  isThread,
  parentId,
  isGuideChannel,
  isAnnounceChannel = false,
  freeChatChannelIds,
  fallbackSafeCwd,
}) {
  if (!msg || msg.author?.bot) return null;
  if (isGuideChannel) return null;

  const userId = String(msg.author?.id || "").trim();
  const isAdmin = isAdminUser(config, userId);

  if (isAnnounceChannel) {
    if (!isAdmin || isThread) return null;
    return {
      isDm: false,
      isThread: false,
      parentId: null,
      userId,
      isAdmin: true,
      role: "admin",
      isAnnounceChannel: true,
      ruleChannelId: msg.channel_id,
      rule: null,
      policy: createAdminPolicy(),
    };
  }

  if (isDm) {
    if (!isAdmin || config.allowDm === false) return null;
    return {
      isDm: true,
      isThread: false,
      parentId: null,
      userId,
      isAdmin: true,
      role: "admin",
      ruleChannelId: msg.channel_id,
      rule: null,
      policy: createAdminPolicy(),
    };
  }

  const ruleChannelId = isThread && parentId ? parentId : msg.channel_id;
  const rule = config.channelRules?.[ruleChannelId] || null;
  const isBaseAllowedChannel =
    config.allowedChannelIds.includes(ruleChannelId) ||
    freeChatChannelIds.has(ruleChannelId) ||
    Boolean(rule);

  if (!isBaseAllowedChannel) return null;

  if (isAdmin) {
    return {
      isDm: false,
      isThread,
      parentId: isThread ? parentId : null,
      userId,
      isAdmin: true,
      role: "admin",
      ruleChannelId,
      rule,
      policy: createAdminPolicy(),
    };
  }

  if (!rule || rule.allowAdminOnly) return null;

  const memberRoles = Array.isArray(msg.member?.roles) ? msg.member.roles.map(String) : [];
  const matchesUser = rule.allowUserIds.includes(userId);
  const matchesRole = rule.allowRoleIds.some((rid) => memberRoles.includes(rid));
  if (!rule.allowEveryone && !matchesUser && !matchesRole) {
    return null;
  }

  return {
    isDm: false,
    isThread,
    parentId: isThread ? parentId : null,
    userId,
    isAdmin: false,
    role: "member",
    ruleChannelId,
    rule,
    policy: createMemberPolicy(rule, fallbackSafeCwd),
  };
}

/** Check whether a Discord `/` command is permitted for the caller's route policy. */
export function canExecuteDiscordCommand(cmd, route) {
  if (route?.isAnnounceChannel) return Boolean(route.isAdmin && cmd === "/clear");
  if (!route || route.isAdmin) return true;
  if (cmd === "/clear") return Boolean(route.policy?.allowClear);
  if (MEMBER_ALLOWED_COMMANDS.has(cmd)) return true;
  if (cmd === "/model" && route.policy?.allowModelChange) return true;
  return false;
}

/** Resolve per-turn runtime execution parameters (cwd, mode, sandbox, MCP scope) without letting Admin state leak to Members. */
export function resolveTurnExecutionPolicy(routePolicy, chState, fallbackSafeCwd) {
  const policy = routePolicy || createAdminPolicy();
  if (policy.isAdmin) {
    return {
      isAdmin: true,
      role: policy.role || "admin",
      cwd: chState.cwd,
      projectId: chState.projectId,
      model: chState.model,
      effort: chState.effort || "",
      mode: policy.forcedMode || chState.mode,
      sandbox: policy.forcedSandbox !== null ? Boolean(policy.forcedSandbox) : Boolean(chState.sandbox),
      allowNonWorkspaceAccess: policy.allowNonWorkspaceAccess !== false,
      allowDesktopTools: policy.allowDesktopTools !== false,
      allowChrome: policy.allowChrome !== false,
      allowFirecrawl: policy.allowFirecrawl !== false,
      allowedMcpTools: Array.isArray(policy.allowedMcpTools) ? policy.allowedMcpTools : null,
    };
  }

  return {
    isAdmin: false,
    role: policy.role || "member",
    cwd: policy.fixedCwd || fallbackSafeCwd,
    projectId: "",
    model: policy.forcedModel || chState.model,
    effort: policy.forcedEffort || chState.effort || "",
    mode: policy.forcedMode || "auto",
    sandbox: policy.forcedSandbox !== null ? Boolean(policy.forcedSandbox) : true,
    allowNonWorkspaceAccess: Boolean(policy.allowNonWorkspaceAccess),
    allowDesktopTools: Boolean(policy.allowDesktopTools),
    allowChrome: Boolean(policy.allowChrome),
    allowFirecrawl: Boolean(policy.allowFirecrawl),
    allowedMcpTools: Array.isArray(policy.allowedMcpTools) ? policy.allowedMcpTools : [...MEMBER_SAFE_MCP_TOOLS],
  };
}

/** Tokenize command arguments while preserving quoted paths/strings. */
export function splitCommandArgs(argStr) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(String(argStr || ""))) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3]);
  }
  return tokens;
}

/** Parse `/access channel <#ch|id> <cwd> ...` arguments for channel RBAC rules. */
export function parseAccessChannelCommand(argStr) {
  const tokens = splitCommandArgs(argStr);
  if (tokens.length < 2) {
    throw new Error(
      "Cú pháp: `/access channel <#kênh> \"<thư_mục_an_toàn>\"` (tùy chọn `users:@user`, `roles:@role`, `everyone:on`, `mode:auto|plan`, `sandbox:on|off`)"
    );
  }
  const channelId = extractSnowflakeId(tokens[0]);
  if (!channelId) {
    throw new Error(`Channel ID hoặc mention không hợp lệ: \`${tokens[0]}\``);
  }
  const cwd = path.resolve(tokens[1]);
  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
    throw new Error(`Thư mục không tồn tại trên máy: \`${cwd}\``);
  }

  const rule = {
    label: path.basename(cwd) || channelId,
    cwd,
    allowUserIds: [],
    allowRoleIds: [],
    allowEveryone: false,
    allowAdminOnly: false,
    mode: "auto",
    sandbox: true,
    allowNonWorkspaceAccess: false,
    allowDesktopTools: false,
    allowChrome: false,
    allowFirecrawl: false,
    allowModelChange: false,
    model: "",
    effort: "",
  };

  for (let i = 2; i < tokens.length; i++) {
    const tok = tokens[i];
    const colon = tok.indexOf(":");
    if (colon === -1) {
      const uid = extractSnowflakeId(tok);
      if (uid) {
        rule.allowUserIds.push(uid);
        continue;
      }
      throw new Error(`Tham số không hợp lệ: \`${tok}\` (dùng dạng \`key:value\`, vd \`users:@user\`).`);
    }
    const key = tok.slice(0, colon).toLowerCase();
    const val = tok.slice(colon + 1).trim();
    const boolOn = ["on", "true", "yes", "1"].includes(val.toLowerCase());
    if (key === "users" || key === "user") {
      for (const part of val.split(",")) {
        const uid = extractSnowflakeId(part);
        if (!uid) throw new Error(`User ID không hợp lệ trong \`users:\`: \`${part}\``);
        if (!rule.allowUserIds.includes(uid)) rule.allowUserIds.push(uid);
      }
    } else if (key === "roles" || key === "role") {
      for (const part of val.split(",")) {
        const rid = extractSnowflakeId(part);
        if (!rid) throw new Error(`Role ID không hợp lệ trong \`roles:\`: \`${part}\``);
        if (!rule.allowRoleIds.includes(rid)) rule.allowRoleIds.push(rid);
      }
    } else if (key === "everyone") {
      rule.allowEveryone = boolOn;
    } else if (key === "mode") {
      const m = val.toLowerCase();
      if (!VALID_MODES.has(m)) throw new Error(`Mode không hợp lệ: \`${val}\` (dùng \`auto | accept-edits | plan\`).`);
      rule.mode = m;
    } else if (key === "sandbox") {
      rule.sandbox = boolOn;
    } else if (key === "desktop") {
      rule.allowDesktopTools = boolOn;
    } else if (key === "chrome") {
      rule.allowChrome = boolOn;
    } else if (key === "firecrawl") {
      rule.allowFirecrawl = boolOn;
    } else if (key === "model") {
      if (["on", "off", "true", "false", "yes", "no", "1", "0"].includes(val.toLowerCase())) {
        rule.allowModelChange = boolOn;
      } else if (val) {
        rule.model = val;
      }
    } else if (key === "effort") {
      const eff = val.toLowerCase();
      if (!VALID_EFFORTS.has(eff)) {
        throw new Error(`Effort không hợp lệ: \`${val}\` (dùng \`low | medium | high | xhigh | max\`).`);
      }
      rule.effort = eff;
    } else if (key === "nonws") {
      rule.allowNonWorkspaceAccess = boolOn;
    } else if (key === "label") {
      rule.label = val;
    } else {
      throw new Error(`Không rõ tùy chọn \`${key}:\`.`);
    }
  }

  return { channelId, rule };
}

/** Render non-secret RBAC configuration summary for Discord `/access list`. */
export function formatAccessSummary(config) {
  const lines = [
    "**Cấu hình phân quyền (`RBAC`) hiện tại:**",
    `• **Root Admin (Owner):** <@${config.allowedUserId}> (\`${config.allowedUserId}\`)`,
    `• **Co-Admins:** ${
      config.adminUserIds.length > 0
        ? config.adminUserIds.map((id) => `<@${id}> (\`${id}\`)`).join(", ")
        : "*(chưa có)*"
    }`,
    `• **DM riêng:** ${config.allowDm ? "Chỉ Admin" : "Tắt"}`,
    `• **Kênh mặc định Admin (\`allowedChannelIds\`):** ${
      config.allowedChannelIds.length > 0 ? config.allowedChannelIds.map((id) => `<#${id}>`).join(", ") : "*(không có)*"
    }`,
    `• **Auto-Onboard thành viên mới:** ${
      config.autoOnboard?.enabled
        ? `🟢 Bật (\`${config.autoOnboard.channelPrefix}<user>\` → \`${config.autoOnboard.rootDir}\`, category=\`${config.autoOnboard.categoryName || "(none)"}\`, mode=\`${config.autoOnboard.mode || "auto"}\`${
            config.autoOnboard.defaultModel
              ? `, model=\`${config.autoOnboard.defaultModel}${config.autoOnboard.defaultEffort ? ` (${config.autoOnboard.defaultEffort})` : ""}\``
              : ""
          })`
        : "⚪ Tắt (dùng `/access auto on` để bật hoặc `/access onboard @ten` để cấp tay 1 lệnh)"
    }`,
    ...(config.memberLimits
      ? [
          `• **Hạn mức & An toàn Member (\`memberLimits\`):** max \`${config.memberLimits.dailyMaxTurns || "∞"}\` lượt/ngày | cooldown \`${config.memberLimits.cooldownSec || 0}s\` | token/ngày \`${config.memberLimits.dailyMaxTokens || "∞"}\` | dung lượng phòng \`${config.memberLimits.workspaceMaxMb || "∞"}MB\` | chặn \`BypassSandbox\`: \`${config.memberLimits.blockBypassSandbox !== false ? "on" : "off"}\``,
        ]
      : []),
    ...(config.dailyReport
      ? [
          `• **Báo cáo cuối ngày (\`dailyReport\`):** ${config.dailyReport.enabled ? `🟢 Bật (\`${config.dailyReport.time}\`)` : `⚪ Tắt (\`${config.dailyReport.time}\`)`}${config.dailyReport.channelId ? ` → <#${config.dailyReport.channelId}>` : ""}`,
        ]
      : []),
  ];

  const rules = Object.entries(config.channelRules || {});
  if (rules.length === 0) {
    lines.push("• **Kênh phân quyền nhóm (`channelRules`):** *(chưa cấu hình)*");
  } else {
    lines.push("", "**Danh sách kênh phân quyền nhóm (`channelRules`):**");
    for (const [cid, r] of rules) {
      const who = r.allowAdminOnly
        ? "Chỉ Admin"
        : r.allowEveryone
          ? "Mọi thành viên trong kênh"
          : [
              ...r.allowUserIds.map((u) => `<@${u}>`),
              ...r.allowRoleIds.map((roleId) => `<@&${roleId}>`),
            ].join(", ") || "Chỉ Admin";
      const modelSuffix = r.model
        ? `, model=\`${r.model}${r.effort ? ` (${r.effort})` : ""}\``
        : "";
      lines.push(
        `• <#${cid}> (\`${cid}\`) → \`${r.cwd || "(no-project)"}\` | Ai dùng: ${who} | mode=\`${r.mode}\`, sandbox=\`${r.sandbox ? "on" : "off"}\`, desktop=\`${r.allowDesktopTools ? "on" : "off"}\`, chrome=\`${r.allowChrome ? "on" : "off"}\`, firecrawl=\`${r.allowFirecrawl ? "on" : "off"}\`${modelSuffix}`
      );
    }
  }
  return lines.join("\n");
}
