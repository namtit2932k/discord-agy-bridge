import fs from "node:fs";
import path from "node:path";

export const DISCORD_PERM_VIEW_CHANNEL = 1n << 10n; // 1024
const PERM_ADD_REACTIONS = 1n << 6n;
const PERM_SEND_MESSAGES = 1n << 11n;
const PERM_MANAGE_MESSAGES = 1n << 13n;
const PERM_ATTACH_FILES = 1n << 15n;
const PERM_READ_MESSAGE_HISTORY = 1n << 16n;
const PERM_MANAGE_THREADS = 1n << 34n;
const PERM_CREATE_PUBLIC_THREADS = 1n << 35n;
const PERM_CREATE_PRIVATE_THREADS = 1n << 36n;
const PERM_SEND_MESSAGES_IN_THREADS = 1n << 38n;
const PERM_SEND_VOICE_MESSAGES = 1n << 46n;
const PERM_SEND_POLLS = 1n << 49n;

export const MEMBER_CHANNEL_ALLOW_MASK = (
  DISCORD_PERM_VIEW_CHANNEL |
  PERM_SEND_MESSAGES |
  PERM_ATTACH_FILES |
  PERM_READ_MESSAGE_HISTORY |
  PERM_CREATE_PUBLIC_THREADS |
  PERM_SEND_MESSAGES_IN_THREADS
).toString();

export const BOT_MIN_CHANNEL_ALLOW_MASK = (
  DISCORD_PERM_VIEW_CHANNEL |
  PERM_SEND_MESSAGES |
  PERM_ATTACH_FILES |
  PERM_READ_MESSAGE_HISTORY
).toString();

export const BOT_CHANNEL_ALLOW_MASK = (
  DISCORD_PERM_VIEW_CHANNEL |
  PERM_SEND_MESSAGES |
  PERM_MANAGE_MESSAGES |
  PERM_ATTACH_FILES |
  PERM_READ_MESSAGE_HISTORY |
  PERM_MANAGE_THREADS |
  PERM_CREATE_PUBLIC_THREADS |
  PERM_SEND_MESSAGES_IN_THREADS
).toString();

export const READ_ONLY_DENY_MASK = (
  PERM_ADD_REACTIONS |
  PERM_SEND_MESSAGES |
  PERM_CREATE_PUBLIC_THREADS |
  PERM_CREATE_PRIVATE_THREADS |
  PERM_SEND_MESSAGES_IN_THREADS |
  PERM_SEND_VOICE_MESSAGES |
  PERM_SEND_POLLS
).toString();

export const READ_ONLY_MIN_DENY_MASK = (
  PERM_SEND_MESSAGES |
  PERM_CREATE_PUBLIC_THREADS |
  PERM_CREATE_PRIVATE_THREADS |
  PERM_SEND_MESSAGES_IN_THREADS
).toString();

/** Normalize a Discord username into a clean cross-platform folder/channel slug. */
export function sanitizeMemberSlug(username, userId = "") {
  const base = String(username || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  if (base) return base;
  const tail = String(userId || "").replace(/\D/g, "").slice(-6) || "user";
  return `member-${tail}`;
}

/** Normalize a Discord text channel prefix into a valid lowercase prefix. */
function normalizeChannelPrefix(prefix) {
  const clean = String(prefix || "ai-")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");
  return clean || "ai-";
}

const EFFORT_SUFFIX_RE = /\s+\((Low|Medium|High|XHigh|Minimal)\)\s*$/i;
const FALLBACK_ALT_MODELS = [
  "Gemini 4 Argon",
  "Gemini 4 Hydrogen",
  "Orchestrator (Argon)",
  "Gemini 3.8 Flash",
  "Claude Opus 5.5",
  "Claude Sonnet 5.5",
  "GPT-OSS 120B",
];

/** Build the welcome message posted to a newly provisioned private member channel. */
export function buildMemberWelcomeMessage({
  userId,
  defaultModel = "gemini-3.8-flash-low",
  availableModels = [],
  botName = "sickyturtlez",
}) {
  const models = Array.isArray(availableModels) ? availableModels : [];
  const defaultHit = models.find((m) => m?.id === defaultModel);
  const defaultLabel =
    defaultHit?.label ||
    (defaultModel === "gemini-3.8-flash-low" ? "Gemini 3.8 Flash (Low)" : String(defaultModel || "Gemini 3.8 Flash (Low)"));
  const defaultBaseLower = defaultLabel.replace(EFFORT_SUFFIX_RE, "").trim().toLowerCase();

  const families = [];
  const seen = new Set();
  const sourceNames =
    models.length > 0
      ? models.map((m) => String(m?.label || m?.id || "").replace(EFFORT_SUFFIX_RE, "").trim())
      : FALLBACK_ALT_MODELS;

  for (const name of sourceNames) {
    if (!name) continue;
    const key = name.toLowerCase();
    if (key === defaultBaseLower || seen.has(key)) continue;
    seen.add(key);
    families.push(name);
  }

  const altLine =
    families.length > 0
      ? `muốn dùng model khác (${families.map((n) => `**${n}**`).join(", ")}) hay nâng thinking level thì bảo nó đổi cho (bank 50k).`
      : `muốn đổi model hay nâng thinking level thì bảo nó đổi cho (bank 50k).`;

  return [
    `👋 Chào mừng <@${userId}> đến channel AI Agent riêng của bạn!`,
    `Hiện tại thằng Admin đang default cho bạn dùng model **${defaultLabel}**, ${altLine}`,
    `• **Bảo mật:** Kênh này ở chế độ riêng tư (chỉ bạn, Admin và bot **${botName}** nhìn thấy).`,
    `• **Lệnh hỗ trợ:** Gõ \`/\` để chọn nhanh \`/help\`, \`/status\`, \`/new\`, \`/clear\`, \`/delete\`, \`/stop\`, \`/usage\`. Gửi tin nhắn hoặc đính kèm file trực tiếp tại đây để bắt đầu.`,
  ].join("\n");
}

/** Build a provisioner managing 100%-automatic member channel + sandbox folder lifecycle. */
export function createMemberProvisioner({
  getConfig,
  getBotUserId,
  getBotName = () => "sickyturtlez",
  isAdminUser,
  discordRequest,
  updateConfigFile,
  getAvailableModels = null,
}) {
  const pendingByMember = new Map();

  async function resolveCategoryId(guildId, autoCfg, guildChannels) {
    if (autoCfg.categoryId) {
      const matchById = guildChannels.find((c) => c.id === autoCfg.categoryId && c.type === 4);
      if (matchById) return matchById.id;
    }
    if (!autoCfg.categoryName) return null;
    const matchByName = guildChannels.find(
      (c) => c.type === 4 && c.name?.toLowerCase() === autoCfg.categoryName.toLowerCase()
    );
    if (matchByName) return matchByName.id;

    try {
      const created = await discordRequest("POST", `/guilds/${guildId}/channels`, {
        name: autoCfg.categoryName.slice(0, 90),
        type: 4,
      });
      return created?.id || null;
    } catch (err) {
      console.warn("[onboard] Could not create category:", err.message);
      return null;
    }
  }

  async function ensureBotChannelAccess(channelId, botUserId) {
    if (!botUserId) return;
    try {
      await discordRequest("PUT", `/channels/${channelId}/permissions/${botUserId}`, {
        type: 1,
        allow: BOT_CHANNEL_ALLOW_MASK,
        deny: "0",
      });
    } catch (err) {
      if (err?.status !== 403) throw err;
      await discordRequest("PUT", `/channels/${channelId}/permissions/${botUserId}`, {
        type: 1,
        allow: BOT_MIN_CHANNEL_ALLOW_MASK,
        deny: "0",
      });
    }
  }

  async function ensurePrivatePermissions(channelId, guildId, userId, botUserId) {
    // Grant bot and member explicit VIEW_CHANNEL access BEFORE denying @everyone so the bot never locks itself out
    await ensureBotChannelAccess(channelId, botUserId);
    await discordRequest("PUT", `/channels/${channelId}/permissions/${userId}`, {
      type: 1,
      allow: MEMBER_CHANNEL_ALLOW_MASK,
      deny: "0",
    });
    await discordRequest("PUT", `/channels/${channelId}/permissions/${guildId}`, {
      type: 0,
      allow: "0",
      deny: DISCORD_PERM_VIEW_CHANNEL.toString(),
    });
  }

  async function onboardMember({ guildId, userId, username = "", isBot = false, manual = false }) {
    const cfg = getConfig();
    const autoCfg = cfg.autoOnboard;
    if (!guildId || !userId) throw new Error("Thiếu guildId hoặc userId để cấp quyền.");
    if (!manual && !autoCfg?.enabled) return { skipped: true, reason: "disabled" };
    if (isBot && autoCfg?.ignoreBots !== false) return { skipped: true, reason: "bot" };
    if (Array.isArray(autoCfg?.allowGuildIds) && autoCfg.allowGuildIds.length > 0 && !autoCfg.allowGuildIds.includes(guildId)) {
      return { skipped: true, reason: "guild_filtered" };
    }
    if (isAdminUser(cfg, userId)) {
      if (manual) throw new Error("Người dùng này đã là Admin (có toàn quyền sẵn).");
      return { skipped: true, reason: "admin" };
    }

    const lockKey = `${guildId}:${userId}`;
    if (pendingByMember.has(lockKey)) return pendingByMember.get(lockKey);

    const task = (async () => {
      const botUserId = getBotUserId();
      const guildChannels = (await discordRequest("GET", `/guilds/${guildId}/channels`).catch(() => [])) || [];

      // Look for an already-provisioned rule whose Discord channel still exists in this guild
      const existingEntry = Object.entries(getConfig().channelRules || {}).find(
        ([, rule]) =>
          rule.onboardedUserId === userId ||
          (rule.allowUserIds?.includes(userId) && rule.allowUserIds.length === 1 && !rule.allowEveryone)
      );
      if (existingEntry) {
        const [existingChId, existingRule] = existingEntry;
        const stillExists = guildChannels.some((c) => c.id === existingChId);
        if (stillExists) {
          if (existingRule.cwd) fs.mkdirSync(existingRule.cwd, { recursive: true });
          await ensurePrivatePermissions(existingChId, guildId, userId, botUserId).catch(() => {});
          return {
            alreadyExisted: true,
            channelId: existingChId,
            cwd: existingRule.cwd,
            username,
          };
        }
      }

      // Resolve unique display handle if username was omitted
      let effectiveName = username;
      if (!effectiveName) {
        const member = await discordRequest("GET", `/guilds/${guildId}/members/${userId}`).catch(() => null);
        effectiveName = member?.user?.username || "";
        if (member?.user?.bot && autoCfg?.ignoreBots !== false && !manual) {
          return { skipped: true, reason: "bot" };
        }
      }

      const slug = sanitizeMemberSlug(effectiveName, userId);
      const rootDir = autoCfg?.rootDir || path.resolve("C:\\Users\\Admin\\DiscordShared");
      fs.mkdirSync(rootDir, { recursive: true });

      let folderName = slug;
      let targetCwd = path.join(rootDir, folderName);
      const cwdConflict = Object.values(getConfig().channelRules || {}).some(
        (r) =>
          r.cwd &&
          r.cwd.toLowerCase() === targetCwd.toLowerCase() &&
          r.onboardedUserId &&
          r.onboardedUserId !== userId
      );
      if (cwdConflict) {
        folderName = `${slug}-${userId.slice(-4)}`;
        targetCwd = path.join(rootDir, folderName);
      }
      fs.mkdirSync(targetCwd, { recursive: true });

      const prefix = normalizeChannelPrefix(autoCfg?.channelPrefix || "ai-");
      let channelName = `${prefix}${slug}`.slice(0, 90);
      if (guildChannels.some((c) => c.type === 0 && c.name?.toLowerCase() === channelName.toLowerCase())) {
        channelName = `${prefix}${slug}-${userId.slice(-4)}`.slice(0, 90);
      }

      const categoryId = await resolveCategoryId(guildId, autoCfg, guildChannels);
      const permissionOverwrites = [
        { id: guildId, type: 0, allow: "0", deny: DISCORD_PERM_VIEW_CHANNEL.toString() },
        { id: userId, type: 1, allow: MEMBER_CHANNEL_ALLOW_MASK, deny: "0" },
      ];
      if (botUserId) {
        permissionOverwrites.push({ id: botUserId, type: 1, allow: BOT_CHANNEL_ALLOW_MASK, deny: "0" });
      }

      const payload = {
        name: channelName,
        type: 0,
        topic: `Kênh AI riêng cho @${effectiveName || userId}`,
        permission_overwrites: permissionOverwrites,
      };
      if (categoryId) payload.parent_id = categoryId;

      const created = await discordRequest("POST", `/guilds/${guildId}/channels`, payload);
      if (!created?.id) {
        throw new Error("Discord không trả về channel ID khi tạo kênh mới.");
      }

      const newRule = {
        label: `Member: ${effectiveName || slug}`,
        cwd: targetCwd,
        onboardedUserId: userId,
        allowUserIds: [userId],
        allowRoleIds: [],
        allowEveryone: false,
        allowAdminOnly: false,
        mode: autoCfg?.mode || "auto",
        sandbox: autoCfg?.sandbox !== false,
        allowNonWorkspaceAccess: autoCfg?.allowNonWorkspaceAccess === true,
        allowDesktopTools: autoCfg?.allowDesktopTools === true,
        allowChrome: autoCfg?.allowChrome === true,
        allowModelChange: autoCfg?.allowModelChange === true,
        allowClear: autoCfg?.allowClear !== false,
      };
      if (autoCfg?.defaultModel) newRule.model = autoCfg.defaultModel;
      if (autoCfg?.defaultEffort) newRule.effort = autoCfg.defaultEffort;

      await updateConfigFile((raw) => {
        if (!raw.channelRules || typeof raw.channelRules !== "object") raw.channelRules = {};
        if (existingEntry) {
          delete raw.channelRules[existingEntry[0]];
        }
        raw.channelRules[created.id] = newRule;
      });

      let availableModels = [];
      if (typeof getAvailableModels === "function") {
        let timer = null;
        try {
          availableModels = await Promise.race([
            Promise.resolve(getAvailableModels()).catch(() => []),
            new Promise((resolve) => {
              timer = setTimeout(() => resolve([]), 1500);
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      }
      const welcome = buildMemberWelcomeMessage({
        userId,
        defaultModel: autoCfg?.defaultModel || cfg?.defaultModel || "gemini-3.8-flash-low",
        availableModels,
        botName: getBotName?.() || "sickyturtlez",
      });
      await discordRequest("POST", `/channels/${created.id}/messages`, { content: welcome }).catch(() => {});

      console.log(`[onboard] Provisioned #${created.name} (${created.id}) -> ${targetCwd} for ${effectiveName || userId} (${userId})`);
      return {
        alreadyExisted: false,
        channelId: created.id,
        channelName: created.name,
        cwd: targetCwd,
        username: effectiveName || slug,
      };
    })().finally(() => {
      pendingByMember.delete(lockKey);
    });

    pendingByMember.set(lockKey, task);
    return task;
  }

  async function offboardMember({ userId, deleteChannel = false, force = false }) {
    const cfg = getConfig();
    if (!force && !cfg.autoOnboard?.enabled) return { skipped: true, removedChannels: [] };

    const matchingChannelIds = [];
    for (const [cid, rule] of Object.entries(cfg.channelRules || {})) {
      if (
        rule.onboardedUserId === userId ||
        (rule.allowUserIds?.includes(userId) && rule.allowUserIds.length === 1 && !rule.allowEveryone && (!rule.allowRoleIds || rule.allowRoleIds.length === 0))
      ) {
        matchingChannelIds.push(cid);
      }
    }
    if (matchingChannelIds.length === 0) return { removedChannels: [] };

    await updateConfigFile((raw) => {
      if (!raw.channelRules) return;
      for (const cid of matchingChannelIds) {
        delete raw.channelRules[cid];
      }
    });

    const shouldDeleteCh = deleteChannel || cfg.autoOnboard?.deleteChannelOnLeave === true;
    for (const cid of matchingChannelIds) {
      if (shouldDeleteCh) {
        await discordRequest("DELETE", `/channels/${cid}`).catch((err) => {
          console.warn(`[onboard] Failed to delete channel ${cid} on offboard:`, err.message);
        });
      } else {
        await discordRequest("DELETE", `/channels/${cid}/permissions/${userId}`).catch(() => {});
      }
    }

    console.log(`[onboard] Offboarded user ${userId} from channel(s): ${matchingChannelIds.join(", ")}`);
    return { removedChannels: matchingChannelIds, deletedChannels: shouldDeleteCh };
  }

  async function setChannelPrivacy({ guildId, channelId, makePrivate = true }) {
    if (!guildId || !channelId) throw new Error("Thiếu guildId hoặc channelId.");
    const botUserId = getBotUserId();
    if (makePrivate) {
      // Grant bot access BEFORE denying @everyone so the bot does not lock itself out on the second call
      await ensureBotChannelAccess(channelId, botUserId);
      await discordRequest("PUT", `/channels/${channelId}/permissions/${guildId}`, {
        type: 0,
        allow: "0",
        deny: DISCORD_PERM_VIEW_CHANNEL.toString(),
      });
    } else {
      await discordRequest("DELETE", `/channels/${channelId}/permissions/${guildId}`).catch(async () => {
        await discordRequest("PUT", `/channels/${channelId}/permissions/${guildId}`, {
          type: 0,
          allow: "0",
          deny: "0",
        });
      });
    }
    return { channelId, private: makePrivate };
  }

  async function setChannelReadOnly({ guildId, channelId, existingOverwrites = null }) {
    if (!guildId || !channelId) throw new Error("Thiếu guildId hoặc channelId.");
    const botUserId = getBotUserId();
    if (Array.isArray(existingOverwrites)) {
      const everyoneOw = existingOverwrites.find((ow) => ow?.id === guildId && ow?.type === 0);
      const botOw = botUserId
        ? existingOverwrites.find((ow) => ow?.id === botUserId && ow?.type === 1)
        : null;
      const everyoneDeny = BigInt(everyoneOw?.deny || "0");
      const botAllow = BigInt(botOw?.allow || "0");
      const requiredBot = BigInt(BOT_MIN_CHANNEL_ALLOW_MASK);
      const requiredDeny = BigInt(READ_ONLY_MIN_DENY_MASK);
      if (
        (everyoneDeny & requiredDeny) === requiredDeny &&
        (!botUserId || (botAllow & requiredBot) === requiredBot)
      ) {
        return { channelId, readOnly: true, updated: false };
      }
    }
    await ensureBotChannelAccess(channelId, botUserId);
    try {
      await discordRequest("PUT", `/channels/${channelId}/permissions/${guildId}`, {
        type: 0,
        allow: "0",
        deny: READ_ONLY_DENY_MASK,
      });
    } catch (err) {
      if (err?.status !== 403) throw err;
      await discordRequest("PUT", `/channels/${channelId}/permissions/${guildId}`, {
        type: 0,
        allow: "0",
        deny: READ_ONLY_MIN_DENY_MASK,
      });
    }
    return { channelId, readOnly: true, updated: true };
  }

  return {
    onboardMember,
    offboardMember,
    setChannelPrivacy,
    setChannelReadOnly,
  };
}
