import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import readline from "node:readline";
import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  cleanInlineLabel,
  extractReplyContext,
  extractSnowflakeId,
  formatByteSize,
  formatNumber,
  isPathInsideDir,
  readJsonSafe,
  resolveCanonicalPath,
  sanitizeAttachmentFilename,
  sanitizeDiscordReplyText,
  shortPathLabel,
  sleep,
  writeJson,
} from "./lib/utils.mjs";
import {
  MEMBER_ALLOWED_COMMANDS,
  canExecuteDiscordCommand,
  createAdminPolicy,
  evaluateMessageAccess,
  formatAccessSummary,
  isAdminUser,
  normalizeAutoOnboardConfig,
  normalizeChannelRules,
  parseAccessChannelCommand,
  resolveTurnExecutionPolicy,
  splitCommandArgs,
} from "./lib/auth.mjs";
import {
  checkMemberQuota,
  getDirectorySizeBytes,
  getMemberDailyUsage,
  normalizeMemberLimitsConfig,
  pruneOldMemberUsage,
  recordMemberTurnAccepted,
  recordMemberTurnTokens,
  resolveEffectiveMemberLimits,
} from "./lib/quota.mjs";
import {
  buildDailyReportMessages,
  createDailyReportScheduler,
  normalizeDailyReportConfig,
  parseDailyReportTime,
  recordSecurityAlert,
} from "./lib/report.mjs";
import { createMemberProvisioner } from "./lib/onboard.mjs";
import {
  SLASH_COMMANDS,
  buildAutocompleteChoices,
  interactionToCommand,
  parseInteractionOptions,
} from "./lib/slash.mjs";
const SLASH_COMMAND_NAME_SET = new Set(SLASH_COMMANDS.map((c) => c.name));
import {
  CHROME_AM_DEBUG_URL,
  MCP_SERVER_NAME,
  closeChromeAm,
  createDesktopToolHandler,
  filterMcpTools,
  getChromeAmStatus,
  loadAppCatalog,
  manageDesktopWindows,
  pruneOldTempFiles,
} from "./lib/desktop.mjs";
import { createCronManager, formatLocalTime, parseCronAddInput } from "./lib/cron.mjs";
import { createWebhookServer, normalizeWebhookConfig, prepareWebhookEvent } from "./lib/webhook.mjs";
import { createMusicManager } from "./lib/music.mjs";
import { buildMemberAvatarUrl, renderAnnouncementCard } from "./lib/announce-card.mjs";
import {
  RUN_PRIORITY_USER,
  RUN_PRIORITY_WEBHOOK,
  RUN_PRIORITY_CRON,
  WEB_BROWSER_HINT_RE,
  buildEffectivePrompt,
  createPrioritySemaphore,
  createSleepInhibitor,
  formatPromptWithReplyContext,
  normalizeMaxConcurrentRuns,
  resolveTurnTimeout,
} from "./lib/runner.mjs";
import { GUILD_MEMBERS_INTENT, DiscordGatewayClient } from "./lib/discord-gateway.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Run as a lightweight MCP stdio proxy for agy turns; returns no tools outside bridge-spawned runs. */
async function runMcpStdioMode() {
  const port = Number(process.env.AGY_DISCORD_MCP_PORT || 0);
  const token = process.env.AGY_DISCORD_MCP_TOKEN || "";
  const activeCwd = process.env.AGY_DISCORD_MCP_CWD || "";
  const allowedToolsSpec = process.env.AGY_DISCORD_ALLOWED_TOOLS ?? "";
  const hasAllowedFilter = String(allowedToolsSpec).trim().length > 0;
  const exposedTools = filterMcpTools(hasAllowedFilter ? allowedToolsSpec : null);
  const exposedToolNames = new Set(exposedTools.map((t) => t.name));
  const isBridgeSession = Number.isInteger(port) && port > 0 && Boolean(token);

  const send = (obj) => {
    process.stdout.write(`${JSON.stringify(obj)}\n`);
  };

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  await new Promise((resolve) => {
    let pending = 0;
    let closed = false;
    const maybeResolve = () => {
      if (closed && pending === 0) resolve();
    };
    const handleLine = async (line) => {
      if (!line.trim()) return;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }

      if (msg.method === "initialize") {
        send({
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            protocolVersion: msg.params?.protocolVersion || "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: MCP_SERVER_NAME, version: "1.1.0" },
          },
        });
        return;
      }
      if (msg.method === "notifications/initialized") return;
      if (msg.method === "ping") {
        if (msg.id !== undefined) send({ jsonrpc: "2.0", id: msg.id, result: {} });
        return;
      }
      if (msg.method === "tools/list") {
        send({
          jsonrpc: "2.0",
          id: msg.id,
          result: { tools: isBridgeSession ? exposedTools : [] },
        });
        return;
      }
      if (msg.method === "tools/call") {
        if (!isBridgeSession) {
          send({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              content: [{ type: "text", text: "Discord bridge desktop host is not active." }],
              isError: true,
            },
          });
          return;
        }
        const requestedTool = String(msg.params?.name || "");
        if (hasAllowedFilter && !exposedToolNames.has(requestedTool)) {
          send({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              content: [{ type: "text", text: `Permission denied: tool "${requestedTool}" is disabled for this session.` }],
              isError: true,
            },
          });
          return;
        }
        try {
          const resp = await fetch(`http://127.0.0.1:${port}/open`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: requestedTool,
              arguments: msg.params?.arguments || {},
              cwd: activeCwd,
              channelId: process.env.AGY_DISCORD_CHANNEL_ID || "",
              runId: process.env.AGY_DISCORD_RUN_ID || "",
            }),
            signal: AbortSignal.timeout(60000),
          });
          const payload = await resp.json().catch(() => ({}));
          send({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              content: [{ type: "text", text: payload.text || (resp.ok ? "Done." : `Bridge HTTP ${resp.status}`) }],
              isError: !resp.ok || Boolean(payload.isError),
            },
          });
        } catch (err) {
          send({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              content: [{ type: "text", text: `Failed to reach Discord bridge host: ${err.message}` }],
              isError: true,
            },
          });
        }
        return;
      }
      if (msg.id !== undefined) {
        send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } });
      }
    };
    rl.on("line", (line) => {
      pending++;
      Promise.resolve(handleLine(line)).finally(() => {
        pending--;
        maybeResolve();
      });
    });
    const markClosed = () => {
      closed = true;
      maybeResolve();
    };
    rl.on("close", markClosed);
    process.stdin.on("error", markClosed);
  });
  process.exit(0);
}

if (process.argv.includes("--mcp-stdio")) {
  await runMcpStdioMode();
}

const CONFIG_PATH = path.join(__dirname, "config.json");
const STATE_PATH = path.join(__dirname, "state.json");
const PID_PATH = path.join(__dirname, "bot.pid");
const LOG_PATH = path.join(__dirname, "bot.log");
const PROJECTS_DIR = path.join(os.homedir(), ".gemini", "config", "projects");
const AGY_CLI_DIR = path.join(os.homedir(), ".gemini", "antigravity-cli");
const AGY_CLI_CONVERSATIONS_DIR = path.join(AGY_CLI_DIR, "conversations");
const AGY_CLI_BRAIN_DIR = path.join(AGY_CLI_DIR, "brain");
const AGY_CLI_NO_PROJECT_DIR = path.join(AGY_CLI_DIR, "no-project");
const DISCORD_ATTACHMENTS_DIR = path.join(AGY_CLI_DIR, "discord-attachments");
const DISCORD_TEMP_DIR = path.join(AGY_CLI_DIR, "discord-temp");
const SHARED_TOOLS_DIR = path.join(process.env.ProgramData || "C:\\ProgramData", "agy-shared-tools");
const SHARED_TOOLS_NODE_MODULES = path.join(SHARED_TOOLS_DIR, "node_modules");
const MAX_INCOMING_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const DISCORD_UPLOAD_HARD_CAP_BYTES = 25 * 1024 * 1024;
const DISCORD_MAX_FILES_PER_MESSAGE = 10;
const ATTACHMENT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const IMAGE_FILE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
const DISCORD_API = "https://discord.com/api/v10";
const DISCORD_EPOCH = 1420070400000n;
const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 - 300_000;
const THREAD_CHANNEL_TYPES = new Set([10, 11, 12]);
const VALID_MODES = new Set(["accept-edits", "auto", "plan"]);
const VALID_EFFORTS = new Set(["low", "medium", "high", "xhigh", "max"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tee console output to bot.log when launched with --log (for hidden background runs). */
function setupLogging() {
  if (!process.argv.includes("--log")) return;
  try {
    if (fs.existsSync(LOG_PATH) && fs.statSync(LOG_PATH).size > 2 * 1024 * 1024) {
      fs.renameSync(LOG_PATH, `${LOG_PATH}.old`);
    }
  } catch {
    // Ignore rotation errors
  }
  const writeLine = (level, args) => {
    const line = `[${new Date().toISOString()}] [${level}] ${args.map(String).join(" ")}\n`;
    try {
      fs.appendFileSync(LOG_PATH, line, "utf8");
    } catch {
      // Ignore file write errors
    }
  };
  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origErr = console.error.bind(console);
  console.log = (...args) => { origLog(...args); writeLine("INFO", args); };
  console.warn = (...args) => { origWarn(...args); writeLine("WARN", args); };
  console.error = (...args) => { origErr(...args); writeLine("ERR", args); };
}

/** Ensure only one bridge instance runs at a time via bot.pid. */
function acquirePidLock() {
  if (fs.existsSync(PID_PATH)) {
    const oldPid = Number(fs.readFileSync(PID_PATH, "utf8").trim());
    if (Number.isInteger(oldPid) && oldPid > 0 && oldPid !== process.pid) {
      try {
        process.kill(oldPid, 0);
        console.error(`[bridge] Another instance is already running (PID ${oldPid}). Exiting.`);
        process.exit(1);
      } catch {
        // Stale PID file; safe to overwrite
      }
    }
  }
  fs.writeFileSync(PID_PATH, `${process.pid}\n`, "utf8");
  const cleanup = () => {
    try {
      if (fs.existsSync(PID_PATH) && Number(fs.readFileSync(PID_PATH, "utf8").trim()) === process.pid) {
        fs.unlinkSync(PID_PATH);
      }
    } catch {
      // Ignore cleanup errors
    }
  };
  process.on("exit", cleanup);
}

setupLogging();
acquirePidLock();

/** Parse and validate bridge configuration; throw on reload errors instead of exiting. */
function loadConfig({ exitOnError = true } = {}) {
  const fail = (message) => {
    if (exitOnError) {
      console.error(message);
      process.exit(1);
    }
    throw new Error(message);
  };

  const raw = readJsonSafe(CONFIG_PATH, null, true);
  if (!raw) {
    fail(`Missing or invalid ${CONFIG_PATH}. Copy config.example.json to config.json and fill in your values.`);
  }
  const adminUserIds = Array.isArray(raw.adminUserIds)
    ? Array.from(new Set(raw.adminUserIds.map((id) => String(id || "").trim()).filter(Boolean)))
    : [];

  const parsed = {
    botToken: process.env.DISCORD_BOT_TOKEN || raw.botToken || "",
    allowedUserId: String(process.env.DISCORD_ALLOWED_USER_ID || raw.allowedUserId || "").trim(),
    adminUserIds,
    allowedChannelIds: Array.isArray(raw.allowedChannelIds) ? raw.allowedChannelIds.map(String) : [],
    channelRules: normalizeChannelRules(raw.channelRules),
    allowDm: raw.allowDm !== false,
    autoThreadInChannel: raw.autoThreadInChannel !== false,
    guideChannelId: raw.guideChannelId ? String(raw.guideChannelId).trim() : "",
    guideChannelName: raw.guideChannelName !== undefined ? String(raw.guideChannelName).trim() : "instructions",
    freeChatChannelId: raw.freeChatChannelId ? String(raw.freeChatChannelId).trim() : "",
    freeChatChannelName: raw.freeChatChannelName !== undefined ? String(raw.freeChatChannelName).trim() : "free-chat",
    announceChannelId: raw.announceChannelId ? String(raw.announceChannelId).trim() : "",
    announceChannelName: raw.announceChannelName !== undefined ? String(raw.announceChannelName).trim() : "announcement",
    announceJoinMessage:
      typeof raw.announceJoinMessage === "string" && raw.announceJoinMessage.trim()
        ? raw.announceJoinMessage.trim()
        : "{mention} yokoso watashi no soul society, nhớ đọc kĩ hướng dẫn sử dụng trước khi dùng ở #instructions",
    announceLeaveMessage:
      typeof raw.announceLeaveMessage === "string" && raw.announceLeaveMessage.trim()
        ? raw.announceLeaveMessage.trim()
        : "{mention} cút ra ngoài",
    agyPath: raw.agyPath || path.join(os.homedir(), "AppData", "Local", "agy", "bin", "agy.exe"),
    defaultCwd: raw.defaultCwd || path.join(os.homedir(), ".gemini", "antigravity", "scratch"),
    defaultProject: raw.defaultProject || "",
    defaultModel: raw.defaultModel || "gemini-3.8-flash-high",
    defaultEffort: raw.defaultEffort || "",
    mode: VALID_MODES.has(raw.mode) ? raw.mode : "auto",
    sandbox: raw.sandbox !== false,
    showFooter: raw.showFooter !== false,
    streamProgress: raw.streamProgress !== false,
    printTimeout: raw.printTimeout || "15m",
    memberPrintTimeout: raw.memberPrintTimeout || "5m",
    maxConcurrentRuns: normalizeMaxConcurrentRuns(raw.maxConcurrentRuns, 2),
    webhook: normalizeWebhookConfig(raw.webhook),
    autoOnboard: normalizeAutoOnboardConfig(raw.autoOnboard),
    memberLimits: normalizeMemberLimitsConfig(raw.memberLimits),
    dailyReport: normalizeDailyReportConfig(raw.dailyReport),
  };

  if (!parsed.botToken || parsed.botToken.includes("PASTE_YOUR")) {
    fail("Invalid botToken in config.json. Please add your Discord Bot Token.");
  }
  if (!parsed.allowedUserId || parsed.allowedUserId.includes("PASTE_YOUR")) {
    fail("Invalid allowedUserId in config.json. Please add your Discord User ID.");
  }
  if (!fs.existsSync(parsed.agyPath)) {
    parsed.agyPath = "agy";
  }
  return parsed;
}

let config = loadConfig({ exitOnError: true });
const state = readJsonSafe(STATE_PATH, { channels: {}, sessionTotals: emptyUsage(), crons: [], memberUsage: {} });
if (!state.channels) state.channels = {};
if (!state.sessionTotals) state.sessionTotals = emptyUsage();
if (!Array.isArray(state.crons)) state.crons = [];
if (!state.memberUsage || typeof state.memberUsage !== "object") state.memberUsage = {};
pruneOldMemberUsage(state);

const channelMetaCache = new Map();
const channelQueues = new Map();
const channelLastPrompts = new Map();
const activeRuns = new Map();
const activeRunSentFiles = new Map();
const activeRunPostedChannels = new Map();
const activeRunScopes = new Map();
const deletedChannels = new Set();
const deletingThreads = new Map();
const clearingChannels = new Set();
const freeChatChannelIds = new Set(config.freeChatChannelId ? [config.freeChatChannelId] : []);
const knownGuildIds = new Set();
const guildMemberCounts = new Map();
const globalRunSemaphore = createPrioritySemaphore({ getMaxConcurrent: () => config.maxConcurrentRuns });
const sleepInhibitor = createSleepInhibitor();
const interactionReplyStorage = new AsyncLocalStorage();
let applicationId = "";
let slashSyncedGuildKey = "";
let cachedAgyModels = [];
let cachedAgyModelsAt = 0;
let agyModelsFetchPromise = null;
let guideSyncPromise = null;
let webhookServer = null;
let cronManager = null;
let dailyReportScheduler = null;
let memberProvisioner = null;
let musicManager = null;
const getBotDisplayName = () => String((typeof gateway !== "undefined" && gateway?.botUser?.username) || "sickyturtlez");

/** Reload config.json safely in memory and refresh webhook & gateway listeners without restarting the bot. */
async function reloadBridgeConfig() {
  const nextConfig = loadConfig({ exitOnError: false });
  config = nextConfig;
  if (config.freeChatChannelId) {
    freeChatChannelIds.add(config.freeChatChannelId);
  }
  if (webhookServer) {
    await webhookServer.reload();
  }
  if (typeof gateway !== "undefined" && gateway?.refreshIntents) {
    gateway.refreshIntents({
      forceRetryMembers: Boolean(config.autoOnboard?.enabled || config.announceChannelId || config.announceChannelName),
    });
  }
  return config;
}

/** Mutate raw config.json atomically without touching or logging secrets, then reload runtime config. */
async function updateConfigFile(mutator) {
  const raw = readJsonSafe(CONFIG_PATH, null, true);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Không thể đọc/parse config.json hiện tại để cập nhật.");
  }
  mutator(raw);
  writeJson(CONFIG_PATH, raw);
  return await reloadBridgeConfig();
}

function emptyUsage() {
  return {
    turns: 0,
    input_tokens: 0,
    output_tokens: 0,
    thinking_tokens: 0,
    cache_read_tokens: 0,
    total_tokens: 0,
    duration_seconds: 0,
  };
}

function saveState() {
  writeJson(STATE_PATH, state);
}

/** Delete local agy CLI conversation artifacts (SQLite DB + brain directory) by UUID. */
function deleteAgyConversation(conversationId) {
  if (!conversationId || !UUID_RE.test(conversationId)) return false;
  const targets = [
    path.join(AGY_CLI_CONVERSATIONS_DIR, `${conversationId}.db`),
    path.join(AGY_CLI_CONVERSATIONS_DIR, `${conversationId}.db-wal`),
    path.join(AGY_CLI_CONVERSATIONS_DIR, `${conversationId}.db-shm`),
    path.join(AGY_CLI_BRAIN_DIR, conversationId),
  ];
  let removedAny = false;
  for (const target of targets) {
    try {
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
        removedAny = true;
      }
    } catch (err) {
      console.error(`[cleanup] Failed to remove ${target}:`, err.message);
    }
  }
  return removedAny;
}

/** Remove downloaded Discord attachments folder for a channel/thread. */
function deleteChannelAttachmentsDir(channelId) {
  const safeId = String(channelId || "").replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeId) return false;
  const dir = path.join(DISCORD_ATTACHMENTS_DIR, safeId);
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      return true;
    }
  } catch (err) {
    console.error(`[cleanup] Failed to remove attachments dir ${dir}:`, err.message);
  }
  return false;
}

/** Delete downloaded Discord attachments older than retention window to prevent disk bloat. */
function pruneOldDiscordAttachments(maxAgeMs = ATTACHMENT_RETENTION_MS) {
  if (!fs.existsSync(DISCORD_ATTACHMENTS_DIR)) return 0;
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  try {
    for (const sub of fs.readdirSync(DISCORD_ATTACHMENTS_DIR, { withFileTypes: true })) {
      const subPath = path.join(DISCORD_ATTACHMENTS_DIR, sub.name);
      if (!sub.isDirectory()) continue;
      for (const entry of fs.readdirSync(subPath, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const filePath = path.join(subPath, entry.name);
        try {
          if (fs.statSync(filePath).mtimeMs < cutoff) {
            fs.unlinkSync(filePath);
            removed++;
          }
        } catch {
          // Ignore individual file errors
        }
      }
      try {
        if (fs.readdirSync(subPath).length === 0) fs.rmdirSync(subPath);
      } catch {
        // Ignore non-empty dir race
      }
    }
  } catch (err) {
    console.warn("[attachments] Prune skipped:", err.message);
  }
  return removed;
}

/** Verify whether a non-admin member created (or triggered auto-creation of) the current Thread. */
async function isThreadOwnedByUser(channelId, route, chState) {
  if (route?.isAdmin) return true;
  if (!route?.userId) return false;
  if (chState?.ownerUserId && String(chState.ownerUserId) === route.userId) return true;
  const meta = await getChannelMeta(channelId).catch(() => null);
  if (meta?.owner_id && String(meta.owner_id) === route.userId) return true;
  const botId = gateway?.botUser?.id || "";
  if (route.parentId && (!meta?.owner_id || String(meta.owner_id) === botId)) {
    const starter = await discordRequest("GET", `/channels/${route.parentId}/messages/${channelId}`).catch(() => null);
    if (starter?.author?.id) {
      return String(starter.author.id) === route.userId;
    }
  }
  return false;
}

/** Delete the parent-channel starter message associated with a deleted Thread, if it still exists. */
async function deleteThreadStarterMessage(parentId, starterMessageId) {
  if (!parentId || !starterMessageId) return false;
  try {
    await discordRequest("DELETE", `/channels/${parentId}/messages/${starterMessageId}`);
    console.log(`[cleanup] Deleted starter message ${starterMessageId} in parent channel ${parentId}`);
    return true;
  } catch (err) {
    if (err.discordCode === 10008 || err.status === 404 || err.status === 403) return false;
    console.warn(`[cleanup] Failed to delete starter message ${starterMessageId} in ${parentId}:`, err.message);
    return false;
  }
}

/** Abort active runs, remove state.json entry, optionally delete parent starter message, and clean up agy conversation files for a deleted Thread. */
function deleteThreadSession(threadId, { parentId = null, deleteStarter = true } = {}) {
  if (!threadId) return Promise.resolve(false);
  if (deletingThreads.has(threadId)) return deletingThreads.get(threadId);

  const task = (async () => {
    const alreadyHandled = deletedChannels.has(threadId);
    deletedChannels.add(threadId);
    const existing = state.channels[threadId];
    const convId = existing?.conversationId || null;
    const cachedMeta = channelMetaCache.get(threadId) || null;
    const resolvedParentId = existing?.parentId || parentId || cachedMeta?.parent_id || null;
    const starterMessageId = existing?.starterMessageId || (resolvedParentId ? String(threadId) : null);

    if (existing) {
      delete state.channels[threadId];
      saveState();
    }

    const running = activeRuns.get(threadId);
    if (running) running.abort();

    const pending = channelQueues.get(threadId);
    if (pending) {
      await pending.catch(() => {});
      channelQueues.delete(threadId);
    }
    channelMetaCache.delete(threadId);

    const removedAttach = deleteChannelAttachmentsDir(threadId);
    let removedFiles = false;
    if (existing || convId || removedAttach) {
      removedFiles = deleteAgyConversation(convId);
      console.log(
        `[cleanup] Thread ${threadId} deleted -> cleared state${convId ? ` & agy conversation ${convId} (files=${removedFiles})` : ""}${removedAttach ? " & attachments" : ""}`
      );
    }

    if (deleteStarter && !alreadyHandled && resolvedParentId && starterMessageId) {
      await deleteThreadStarterMessage(resolvedParentId, starterMessageId);
    }
    return Boolean(existing || convId || removedAttach);
  })().finally(() => {
    deletingThreads.delete(threadId);
  });

  deletingThreads.set(threadId, task);
  return task;
}

/** Clean up local Thread session, delete the Discord Thread channel, and remove its starter message from the parent channel. */
async function deleteDiscordThreadWithCleanup(threadId, parentIdHint = null) {
  if (
    !threadId ||
    config.allowedChannelIds.includes(threadId) ||
    freeChatChannelIds.has(threadId) ||
    Boolean(config.channelRules?.[threadId]) ||
    threadId === (config.guideChannelId || state.guide?.channelId)
  ) {
    throw new Error("Không thể dùng /delete đối với kênh chính; lệnh này chỉ xóa Thread.");
  }
  const meta = await getChannelMeta(threadId).catch(() => null);
  if (!meta || !THREAD_CHANNEL_TYPES.has(meta.type)) {
    throw new Error("Kênh hiện tại không phải là Thread nên không thể xóa bằng /delete.");
  }
  const existing = state.channels[threadId];
  const parentId = existing?.parentId || parentIdHint || meta.parent_id || null;
  const starterMessageId = existing?.starterMessageId || (parentId ? String(threadId) : null);
  await deleteThreadSession(threadId, { parentId, deleteStarter: false });
  await discordRequest("DELETE", `/channels/${threadId}`);
  await deleteThreadStarterMessage(parentId, starterMessageId);
}

/** Ensure the isolated empty workspace folder exists for project-free conversations. */
function ensureNoProjectDir() {
  if (!fs.existsSync(AGY_CLI_NO_PROJECT_DIR)) {
    fs.mkdirSync(AGY_CLI_NO_PROJECT_DIR, { recursive: true });
  }
  return AGY_CLI_NO_PROJECT_DIR;
}

/** Check whether a channel metadata object matches the configured #free-chat channel. */
function matchesFreeChatMeta(meta) {
  if (!meta || (meta.type !== 0 && meta.type !== 5)) return false;
  if (knownGuildIds.size > 0 && meta.guild_id && !knownGuildIds.has(meta.guild_id)) return false;
  if (config.freeChatChannelId && meta.id === config.freeChatChannelId) return true;
  const targetName = (config.freeChatChannelName || "").trim().toLowerCase();
  return Boolean(targetName && meta.name?.toLowerCase() === targetName);
}

/** Mark a channel as project-free chat and initialize its no-project state if absent. */
function registerFreeChatChannel(channelId) {
  freeChatChannelIds.add(channelId);
  getChannelState(channelId);
}

/** Return per-channel state, inheriting channelRules, parent state, or global defaults. */
function getChannelState(channelId, parentId = null) {
  if (!state.channels[channelId]) {
    const isFreeChat = !parentId && freeChatChannelIds.has(channelId);
    const ruleChannelId = parentId || channelId;
    const rule = config.channelRules?.[ruleChannelId] || null;
    const parent = parentId && state.channels[parentId] ? state.channels[parentId] : null;
    const ruleCwdValid = Boolean(rule?.cwd && fs.existsSync(rule.cwd));
    state.channels[channelId] = {
      conversationId: null,
      cwd: isFreeChat
        ? ensureNoProjectDir()
        : ruleCwdValid
          ? rule.cwd
          : parent?.cwd || config.defaultCwd,
      projectId: isFreeChat ? "" : (rule?.projectId || parent?.projectId || config.defaultProject),
      projectName: isFreeChat
        ? ""
        : (rule?.projectName || (ruleCwdValid ? path.basename(rule.cwd) : "") || parent?.projectName || ""),
      model: parent?.model || rule?.model || config.defaultModel,
      effort: parent?.effort ?? (rule?.effort || config.defaultEffort),
      mode: rule?.mode || parent?.mode || config.mode,
      sandbox: rule ? rule.sandbox : (parent?.sandbox ?? config.sandbox),
      showFooter: parent?.showFooter ?? config.showFooter,
      streamProgress: parent?.streamProgress ?? config.streamProgress,
      autoThread: rule?.autoThread !== undefined ? rule.autoThread : config.autoThreadInChannel,
      lastUsage: null,
      totals: emptyUsage(),
    };
    saveState();
  }
  return state.channels[channelId];
}

/** Read Antigravity saved projects from ~/.gemini/config/projects. */
function listSavedProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  const results = [];
  for (const file of fs.readdirSync(PROJECTS_DIR)) {
    if (!file.endsWith(".json")) continue;
    const data = readJsonSafe(path.join(PROJECTS_DIR, file), null);
    if (!data?.id) continue;
    let folderPath = "";
    const resources = data.projectResources?.resources;
    if (Array.isArray(resources)) {
      for (const res of resources) {
        const uri = res?.gitFolder?.folderUri || res?.folderUri || "";
        if (uri.startsWith("file://")) {
          try {
            folderPath = fileURLToPath(uri);
            break;
          } catch {
            // Ignore malformed URI
          }
        }
      }
    }
    results.push({
      id: data.id,
      name: data.name || data.id,
      folderPath,
    });
  }
  return results;
}

/** Execute a Discord REST API request with basic rate-limit retry. */
async function discordRequest(method, apiPath, body = undefined) {
  const url = `${DISCORD_API}${apiPath}`;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  for (let attempt = 0; attempt < 5; attempt++) {
    const headers = {
      Authorization: `Bot ${config.botToken}`,
      "User-Agent": "DiscordBot (agy-discord-bridge, 1.0)",
    };
    if (!isFormData && body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });

    if (res.status === 429) {
      const retryData = await res.json().catch(() => ({}));
      const waitMs = Math.ceil((retryData.retry_after || 1) * 1000) + 150;
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err = new Error(`Discord ${method} ${apiPath} failed (${res.status}): ${text}`);
      err.status = res.status;
      try {
        err.discordCode = JSON.parse(text)?.code;
      } catch {
        // Non-JSON error body
      }
      throw err;
    }
    if (res.status === 204) return null;
    return res.json();
  }
  throw new Error(`Discord ${method} ${apiPath} exceeded retries`);
}

/** Return true if a Discord message snowflake is within the 14-day bulk-delete window. */
function isBulkDeletable(messageId) {
  try {
    const createdAt = Number((BigInt(messageId) >> 22n) + DISCORD_EPOCH);
    return Date.now() - createdAt < BULK_DELETE_MAX_AGE_MS;
  } catch {
    return false;
  }
}

/** Delete a batch of up to 100 message IDs via bulk-delete when eligible, falling back to single DELETE. */
async function deleteMessageIds(channelId, ids, allowBulk) {
  if (ids.length === 0) return 0;
  let deleted = 0;
  const bulkIds = [];
  const singleIds = [];
  for (const id of ids) {
    if (allowBulk && isBulkDeletable(id)) bulkIds.push(id);
    else singleIds.push(id);
  }
  if (bulkIds.length === 1) {
    singleIds.push(bulkIds.pop());
  }
  if (bulkIds.length >= 2) {
    try {
      await discordRequest("POST", `/channels/${channelId}/messages/bulk-delete`, { messages: bulkIds });
      deleted += bulkIds.length;
    } catch (err) {
      if (err.status === 403) throw err;
      singleIds.push(...bulkIds);
    }
  }
  for (let i = 0; i < singleIds.length; i++) {
    try {
      await discordRequest("DELETE", `/channels/${channelId}/messages/${singleIds[i]}`);
      deleted += 1;
    } catch (err) {
      if (err.status === 403) throw err;
      if (err.discordCode === 10008 || err.discordCode === 50021) continue;
      throw err;
    }
    if (i < singleIds.length - 1) await sleep(350);
  }
  return deleted;
}

/** Delete up to maxCount messages prior to triggerMsgId (plus triggerMsgId in server channels). */
async function clearChannelMessages(channelId, maxCount, route, triggerMsgId) {
  const botUserId = gateway.botUser?.id || null;
  let before = triggerMsgId || undefined;
  let remaining = maxCount;
  let deleted = 0;

  while (remaining > 0) {
    const fetchLimit = route.isDm ? 100 : Math.min(100, remaining);
    const qs = before ? `?limit=${fetchLimit}&before=${before}` : `?limit=${fetchLimit}`;
    const batch = await discordRequest("GET", `/channels/${channelId}/messages${qs}`);
    if (!Array.isArray(batch) || batch.length === 0) break;

    before = batch[batch.length - 1].id;
    let candidates = route.isDm
      ? batch.filter((m) => botUserId && m.author?.id === botUserId)
      : batch;
    if (candidates.length > remaining) {
      candidates = candidates.slice(0, remaining);
    }
    const ids = candidates.map((m) => m.id);
    deleted += await deleteMessageIds(channelId, ids, !route.isDm);
    remaining -= ids.length;

    if (batch.length < fetchLimit) break;
  }

  if (!route.isDm && triggerMsgId) {
    try {
      await discordRequest("DELETE", `/channels/${channelId}/messages/${triggerMsgId}`);
    } catch (err) {
      if (err.status === 403) throw err;
    }
  }
  return deleted;
}

async function getChannelMeta(channelId) {
  if (channelMetaCache.has(channelId)) return channelMetaCache.get(channelId);
  const meta = await discordRequest("GET", `/channels/${channelId}`);
  channelMetaCache.set(channelId, meta);
  return meta;
}

/** Check if an incoming message is authorized under Admin or channel RBAC rules and return its routing + policy. */
async function authorizeMessage(msg) {
  if (!msg || msg.author?.bot) return null;

  const isDm = !msg.guild_id;
  const fallbackSafeCwd = ensureNoProjectDir();

  if (isDm) {
    const route = evaluateMessageAccess({
      msg,
      config,
      isDm: true,
      isThread: false,
      parentId: null,
      isGuideChannel: false,
      freeChatChannelIds,
      fallbackSafeCwd,
    });
    if (!route) {
      console.log(`[auth] Ignored unauthorized DM from user ${msg.author?.id}`);
    }
    return route;
  }

  const knownGuideId = config.guideChannelId || state.guide?.channelId || "";
  if (knownGuideId && msg.channel_id === knownGuideId) return null;
  const knownAnnounceId = config.announceChannelId || state.announceChannelId || "";
  const isAnnounceChannel = Boolean(knownAnnounceId && msg.channel_id === knownAnnounceId);

  let isThread = false;
  let parentId = null;

  const knownTopLevel =
    isAnnounceChannel ||
    config.allowedChannelIds.includes(msg.channel_id) ||
    freeChatChannelIds.has(msg.channel_id) ||
    Boolean(config.channelRules?.[msg.channel_id]);

  if (!knownTopLevel) {
    try {
      const meta = await getChannelMeta(msg.channel_id);
      if (knownGuideId && meta.parent_id === knownGuideId) return null;
      if (knownAnnounceId && meta.parent_id === knownAnnounceId) return null;
      if (matchesFreeChatMeta(meta)) {
        registerFreeChatChannel(meta.id);
      } else if (THREAD_CHANNEL_TYPES.has(meta.type)) {
        isThread = true;
        parentId = meta.parent_id || null;
        const knownParent =
          parentId &&
          (config.allowedChannelIds.includes(parentId) ||
            freeChatChannelIds.has(parentId) ||
            Boolean(config.channelRules?.[parentId]));
        if (parentId && !knownParent) {
          const parentMeta = await getChannelMeta(parentId);
          if (matchesFreeChatMeta(parentMeta)) {
            registerFreeChatChannel(parentMeta.id);
          }
        }
      }
    } catch (err) {
      console.error("[auth] Failed to inspect channel metadata:", err.message);
    }
  }

  const route = evaluateMessageAccess({
    msg,
    config,
    isDm: false,
    isThread,
    parentId,
    isGuideChannel: false,
    isAnnounceChannel,
    freeChatChannelIds,
    fallbackSafeCwd,
  });

  if (!route) {
    const ruleChannelId = isThread && parentId ? parentId : msg.channel_id;
    const isKnownChannel =
      config.allowedChannelIds.includes(ruleChannelId) ||
      freeChatChannelIds.has(ruleChannelId) ||
      Boolean(config.channelRules?.[ruleChannelId]);
    if (isKnownChannel || String(msg.author?.id) === config.allowedUserId) {
      console.log(`[auth] Ignored unauthorized message from user ${msg.author?.id} in channel ${msg.channel_id}`);
    }
  }
  return route;
}

/** Allow any server member to run `/play` or music buttons in `#free-chat` and public/voice server channels (except guide/announce/private rules). */
async function authorizeGuildMusicFallback(msg) {
  if (!msg || msg.author?.bot || !msg.guild_id || !msg.author?.id) return null;

  const knownGuideId = config.guideChannelId || state.guide?.channelId || "";
  if (knownGuideId && msg.channel_id === knownGuideId) return null;
  const knownAnnounceId = config.announceChannelId || state.announceChannelId || "";
  if (knownAnnounceId && msg.channel_id === knownAnnounceId) return null;

  let isThread = false;
  let parentId = null;
  let meta = null;
  try {
    meta = await getChannelMeta(msg.channel_id);
    if (knownGuideId && meta?.parent_id === knownGuideId) return null;
    if (knownAnnounceId && meta?.parent_id === knownAnnounceId) return null;
    if (meta && THREAD_CHANNEL_TYPES.has(meta.type)) {
      isThread = true;
      parentId = meta.parent_id || null;
    }
  } catch {
    // Keep top-level channel assumption if metadata fetch fails
  }

  const ruleChannelId = isThread && parentId ? parentId : msg.channel_id;
  let ruleChannelMeta = isThread ? channelMetaCache.get(ruleChannelId) : meta;
  if (isThread && !ruleChannelMeta && parentId) {
    ruleChannelMeta = await getChannelMeta(parentId).catch(() => null);
  }
  const isNamedFreeChat = String(ruleChannelMeta?.name || "").trim().toLowerCase() === "free-chat";
  if (config.channelRules?.[ruleChannelId] && !isNamedFreeChat) return null;

  const isAdmin = isAdminUser(config, msg.author.id);
  return {
    isAdmin,
    isDm: false,
    isThread,
    parentId,
    isAnnounceChannel: false,
    userId: String(msg.author.id),
    rule: null,
    policy: {
      isAdmin,
      allowModelChange: false,
    },
  };
}

/** Allow Admin (and ONLY Admin) to run `/clear` inside `#free-chat` (or threads inside `#free-chat`). */
async function authorizeAdminFreeChatClearFallback(msg) {
  if (!msg || msg.author?.bot || !msg.guild_id || !msg.author?.id) return null;
  if (!isAdminUser(config, msg.author.id)) return null;

  let isThread = false;
  let parentId = null;
  let meta = null;
  try {
    meta = await getChannelMeta(msg.channel_id);
    if (meta && THREAD_CHANNEL_TYPES.has(meta.type)) {
      isThread = true;
      parentId = meta.parent_id || null;
    }
  } catch {
    return null;
  }

  const ruleChannelId = isThread && parentId ? parentId : msg.channel_id;
  let targetMeta = isThread ? channelMetaCache.get(ruleChannelId) : meta;
  if (isThread && !targetMeta && parentId) {
    targetMeta = await getChannelMeta(parentId).catch(() => null);
  }
  const channelName = String(targetMeta?.name || "").trim().toLowerCase();
  if (channelName !== "free-chat") return null;

  return {
    isAdmin: true,
    role: "admin",
    isDm: false,
    isThread,
    parentId,
    isAnnounceChannel: false,
    userId: String(msg.author.id),
    rule: null,
    policy: createAdminPolicy(),
  };
}

/** Split text cleanly under Discord's 2000-char limit while keeping fenced code blocks intact. */
function splitDiscordMessage(text, maxLen = 1850) {
  const normalized = (text || "").trim();
  if (!normalized) return ["*(Không có nội dung phản hồi)*"];
  if (normalized.length <= maxLen) return [normalized];

  const chunks = [];
  let remaining = normalized;
  let openFence = "";

  while (remaining.length > 0) {
    const prefix = openFence ? `${openFence}\n` : "";
    const budget = maxLen - prefix.length - 8;
    if (remaining.length <= budget) {
      chunks.push(prefix + remaining);
      break;
    }

    let cut = remaining.lastIndexOf("\n", budget);
    if (cut < budget * 0.4) cut = remaining.lastIndexOf(" ", budget);
    if (cut < budget * 0.3) cut = budget;

    const part = remaining.slice(0, cut).trimEnd();
    remaining = remaining.slice(cut).trimStart();

    // Track whether we are inside an unclosed ``` fence
    const fences = (prefix + part).match(/```[^\n]*/g) || [];
    let isOpen = false;
    let lastFenceHeader = "```";
    for (const f of fences) {
      if (!isOpen) {
        isOpen = true;
        lastFenceHeader = f;
      } else {
        isOpen = false;
      }
    }

    if (isOpen) {
      chunks.push(`${prefix}${part}\n\`\`\``);
      openFence = lastFenceHeader;
    } else {
      chunks.push(prefix + part);
      openFence = "";
    }
  }
  return chunks;
}

/** Build the Discord button row shown on live streaming progress messages. */
function buildStreamingComponents() {
  return [
    {
      type: 1,
      components: [{ type: 2, style: 4, label: "Dừng ngay", emoji: { name: "⏹️" }, custom_id: "agy:stop" }],
    },
  ];
}

/** Build the Discord button row attached to completed, errored, or stopped agy responses. */
function buildResponseActionComponents({ isThread = false, includeSummarize = true } = {}) {
  const buttons = [{ type: 2, style: 2, label: "Thử lại", emoji: { name: "🔄" }, custom_id: "agy:retry" }];
  if (includeSummarize) {
    buttons.push({ type: 2, style: 2, label: "Tóm tắt ngắn", emoji: { name: "📝" }, custom_id: "agy:summarize" });
  }
  if (isThread) {
    buttons.push({ type: 2, style: 4, label: "Xóa Thread", emoji: { name: "🗑️" }, custom_id: "agy:delete" });
  } else {
    buttons.push({ type: 2, style: 2, label: "Phiên mới", emoji: { name: "🆕" }, custom_id: "agy:new" });
  }
  return [{ type: 1, components: buttons }];
}

async function editDiscordMessage(channelId, messageId, payloadOrContent) {
  const body = typeof payloadOrContent === "string" ? { content: payloadOrContent } : payloadOrContent;
  return discordRequest("PATCH", `/channels/${channelId}/messages/${messageId}`, body);
}

/** Build a Discord CDN avatar URL for embed headers from a user/member object. */
function getDiscordUserAvatarUrl(user, member = null, guildId = "") {
  const uid = String(user?.id || "").trim();
  if (!uid) return "";
  if (member?.avatar && guildId) {
    const ext = String(member.avatar).startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/guilds/${guildId}/users/${uid}/avatars/${member.avatar}.${ext}?size=64`;
  }
  if (user?.avatar) {
    const ext = String(user.avatar).startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${uid}/${user.avatar}.${ext}?size=64`;
  }
  try {
    const idx = Number((BigInt(uid) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}

async function sendOrReplaceDiscordMessages(
  channelId,
  text,
  footer = "",
  existingMessageId = null,
  components = undefined,
  embeds = undefined
) {
  const hasEmbeds = Array.isArray(embeds) && embeds.length > 0;
  const normalizedText = String(text || "").trim();
  const chunks = hasEmbeds && !normalizedText && !footer ? [""] : splitDiscordMessage(text, 1850);
  if (footer) {
    const lastIdx = chunks.length - 1;
    if (chunks[lastIdx].length + footer.length + 2 <= 1990) {
      chunks[lastIdx] = `${chunks[lastIdx]}\n${footer}`;
    } else {
      chunks.push(footer);
    }
  }
  const capture = interactionReplyStorage.getStore();
  if (capture && !existingMessageId && channelId === capture.channelId) {
    capture.chunks.push(...chunks);
    if (components !== undefined) {
      capture.components = components;
    }
    if (hasEmbeds) {
      capture.embeds = embeds;
    }
    return null;
  }
  let lastPosted = null;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isLast = i === chunks.length - 1;
    const chunkComponents = components !== undefined ? (isLast ? components : []) : undefined;
    const chunkEmbeds = hasEmbeds && i === 0 ? embeds : undefined;
    if (i === 0 && existingMessageId) {
      try {
        const patchBody = { content: chunk };
        if (chunkComponents !== undefined) patchBody.components = chunkComponents;
        if (chunkEmbeds !== undefined) patchBody.embeds = chunkEmbeds;
        lastPosted = await editDiscordMessage(channelId, existingMessageId, patchBody);
        continue;
      } catch (err) {
        console.warn(`[discord] Failed to edit progress message ${existingMessageId}, posting new:`, err.message);
      }
    }
    const postBody = { content: chunk };
    if (chunkComponents !== undefined) postBody.components = chunkComponents;
    if (chunkEmbeds !== undefined) postBody.embeds = chunkEmbeds;
    lastPosted = await discordRequest("POST", `/channels/${channelId}/messages`, postBody);
  }
  return lastPosted;
}

async function sendDiscordMessages(channelId, text, footer = "") {
  return sendOrReplaceDiscordMessages(channelId, text, footer, null);
}

/** Finalize turn reply: move below any files sent to the same channel during the run so buttons stay at the bottom, and keep buttons only on the latest reply. */
async function finalizeTurnMessage(channelId, progressMessageId, runId, text, footer = "", components = undefined) {
  const chState = state.channels?.[channelId] || null;
  const prevActionMsgId = chState?.lastActionMessageId ? String(chState.lastActionMessageId) : "";
  const postedInThisChannel = Boolean(runId && activeRunPostedChannels.get(runId)?.has(channelId));
  let targetMessageId = progressMessageId;
  if (progressMessageId && postedInThisChannel && !deletedChannels.has(channelId)) {
    await discordRequest("DELETE", `/channels/${channelId}/messages/${progressMessageId}`).catch(() => {});
    targetMessageId = null;
  }
  const posted = await sendOrReplaceDiscordMessages(channelId, text, footer, targetMessageId, components);
  const nextMsgId = posted?.id ? String(posted.id) : "";
  if (prevActionMsgId && prevActionMsgId !== nextMsgId && !deletedChannels.has(channelId)) {
    await editDiscordMessage(channelId, prevActionMsgId, { components: [] }).catch(() => {});
  }
  if (chState) {
    if (Array.isArray(components) && components.length > 0 && nextMsgId) {
      chState.lastActionMessageId = nextMsgId;
      saveState();
    } else if (prevActionMsgId) {
      delete chState.lastActionMessageId;
      saveState();
    }
  }
  return posted;
}

/** Verify URL belongs to official Discord attachment CDNs before downloading. */
function isAllowedDiscordAttachmentUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ""));
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "cdn.discordapp.com" ||
      host === "media.discordapp.net" ||
      host.endsWith(".discordapp.com") ||
      host.endsWith(".discordapp.net")
    );
  } catch {
    return false;
  }
}

/** Download Discord message attachments locally so agy can inspect images, PDFs, audio/video, and files directly. */
async function downloadIncomingAttachments(channelId, messageId, attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return { downloaded: [], lines: [], channelDir: null };
  }
  const safeChannelId = String(channelId || "general").replace(/[^a-zA-Z0-9_-]/g, "") || "general";
  const channelDir = path.join(DISCORD_ATTACHMENTS_DIR, safeChannelId);
  fs.mkdirSync(channelDir, { recursive: true });

  const downloaded = [];
  const lines = [];
  const stamp = sanitizeAttachmentFilename(String(messageId || Date.now()), String(Date.now()));

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];
    const safeName = sanitizeAttachmentFilename(att?.filename, `file-${i + 1}.bin`);
    const metaInfo = [
      att?.content_type ? `type=${att.content_type}` : "",
      Number.isFinite(att?.size) ? `size=${formatByteSize(att.size)}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    if (!isAllowedDiscordAttachmentUrl(att?.url)) {
      lines.push(`[Attachment: ${safeName}${metaInfo ? ` | ${metaInfo}` : ""} | url=${att?.url || "n/a"} | localDownload=skipped(unrecognized host)]`);
      continue;
    }
    if (Number(att?.size) > MAX_INCOMING_ATTACHMENT_BYTES) {
      lines.push(`[Attachment: ${safeName}${metaInfo ? ` | ${metaInfo}` : ""} | url=${att.url} | localDownload=skipped(exceeds ${formatByteSize(MAX_INCOMING_ATTACHMENT_BYTES)})]`);
      continue;
    }

    const localPath = path.join(channelDir, `${stamp}-${i + 1}-${safeName}`);
    try {
      const resp = await fetch(att.url, { signal: AbortSignal.timeout(30000) });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const arrBuf = await resp.arrayBuffer();
      const buf = Buffer.from(arrBuf);
      if (buf.length > MAX_INCOMING_ATTACHMENT_BYTES) {
        lines.push(`[Attachment: ${safeName}${metaInfo ? ` | ${metaInfo}` : ""} | url=${att.url} | localDownload=skipped(downloaded size ${formatByteSize(buf.length)} exceeds limit)]`);
        continue;
      }
      fs.writeFileSync(localPath, buf);
      downloaded.push(localPath);
      lines.push(`[Attached File from Discord: ${safeName}${metaInfo ? ` | ${metaInfo}` : ""} | localPath=${localPath}]`);
    } catch (err) {
      console.warn(`[attachments] Failed to download ${safeName}:`, err.message);
      lines.push(`[Attachment: ${safeName}${metaInfo ? ` | ${metaInfo}` : ""} | url=${att.url} | localDownload=failed(${err.message})]`);
    }
  }

  return { downloaded, lines, channelDir: downloaded.length > 0 ? channelDir : null };
}

/** Resolve a local file path or file:// URI relative to an active working directory. */
function resolveLocalFilePath(rawPath, cwd = "") {
  const cleaned = String(rawPath || "").trim().replace(/^["']|["']$/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("file://")) {
    try {
      return path.resolve(fileURLToPath(cleaned));
    } catch {
      return "";
    }
  }
  const baseCwd = cwd && fs.existsSync(cwd) ? cwd : os.homedir();
  return path.isAbsolute(cleaned) ? path.resolve(cleaned) : path.resolve(baseCwd, cleaned);
}

/** Upload one or more local files directly to a Discord channel/thread using multipart/form-data. */
async function sendDiscordAttachments(channelId, absPaths, caption = "", runId = "") {
  const uniquePaths = [];
  const seen = new Set();
  for (const p of absPaths) {
    const resolved = path.resolve(String(p || ""));
    const key = resolved.toLowerCase();
    if (!resolved || seen.has(key)) continue;
    seen.add(key);
    uniquePaths.push(resolved);
  }
  if (uniquePaths.length === 0) {
    throw new Error("No valid local file paths were provided.");
  }

  const prepared = [];
  const canonicalConfigPath = resolveCanonicalPath(CONFIG_PATH).toLowerCase();
  for (const absPath of uniquePaths) {
    if (absPath.toLowerCase() === CONFIG_PATH.toLowerCase() || resolveCanonicalPath(absPath).toLowerCase() === canonicalConfigPath) {
      throw new Error("Refusing to upload bridge config.json (contains secrets).");
    }
    if (!fs.existsSync(absPath)) {
      throw new Error(`File not found: ${absPath}`);
    }
    const stat = fs.statSync(absPath);
    if (!stat.isFile()) {
      throw new Error(`Path is not a regular file: ${absPath}`);
    }
    if (stat.size > DISCORD_UPLOAD_HARD_CAP_BYTES) {
      throw new Error(
        `File "${path.basename(absPath)}" (${formatByteSize(stat.size)}) exceeds the ${formatByteSize(DISCORD_UPLOAD_HARD_CAP_BYTES)} cap.`
      );
    }
    prepared.push({ absPath, filename: sanitizeAttachmentFilename(path.basename(absPath)), size: stat.size });
  }

  const trimmedCaption = String(caption || "").trim();
  const captionChunks = trimmedCaption ? splitDiscordMessage(trimmedCaption, 1850) : [];
  if (captionChunks.length > 1) {
    for (let i = 0; i < captionChunks.length - 1; i++) {
      await discordRequest("POST", `/channels/${channelId}/messages`, { content: captionChunks[i] });
    }
  }
  const attachCaption = captionChunks.length > 0 ? captionChunks[captionChunks.length - 1] : "";

  const sentSet = runId ? activeRunSentFiles.get(runId) : null;
  for (let start = 0; start < prepared.length; start += DISCORD_MAX_FILES_PER_MESSAGE) {
    const batch = prepared.slice(start, start + DISCORD_MAX_FILES_PER_MESSAGE);
    const form = new FormData();
    const batchText = start === 0 && attachCaption ? attachCaption : "";
    form.append("payload_json", JSON.stringify({ content: batchText }));

    for (let idx = 0; idx < batch.length; idx++) {
      const item = batch[idx];
      const buf = await fs.promises.readFile(item.absPath);
      form.append(`files[${idx}]`, new Blob([buf]), item.filename);
    }

    try {
      await discordRequest("POST", `/channels/${channelId}/messages`, form);
    } catch (err) {
      if (err.status === 413 || err.discordCode === 40005) {
        const list = batch.map((b) => `${b.filename} (${formatByteSize(b.size)})`).join(", ");
        throw new Error(
          `Discord rejected upload as too large (~10MB limit on standard bots/servers): ${list}. Compress or resize before sending.`
        );
      }
      throw err;
    }

    if (sentSet) {
      for (const item of batch) sentSet.add(item.absPath.toLowerCase());
    }
    if (runId) {
      let postedSet = activeRunPostedChannels.get(runId);
      if (!postedSet) {
        postedSet = new Set();
        activeRunPostedChannels.set(runId, postedSet);
      }
      postedSet.add(channelId);
    }
  }
  return prepared;
}

/** Find local image paths referenced via Markdown `![alt](path)` that were not already uploaded in this turn. */
function extractUnsentMarkdownImages(replyText, cwd, sentSet = null) {
  const results = [];
  const seen = new Set();
  const re = /!\[[^\]]*\]\(([^)\r\n]+)\)/g;
  let match;
  while ((match = re.exec(String(replyText || ""))) !== null) {
    let rawTarget = match[1].trim();
    if (!rawTarget) continue;
    // Strip optional Markdown link title: path "title"
    if (!rawTarget.startsWith("<")) {
      rawTarget = rawTarget.replace(/\s+["'][^"']*["']\s*$/, "").trim();
    } else {
      rawTarget = rawTarget.replace(/^<|>$/g, "").trim();
    }
    if (/^https?:\/\//i.test(rawTarget) || /^data:/i.test(rawTarget)) continue;

    // Strip optional fragment/query like #L10 on file:// paths
    const cleanTarget = rawTarget.replace(/[?#].*$/, "");
    const absPath = resolveLocalFilePath(cleanTarget, cwd);
    if (!absPath) continue;
    const ext = path.extname(absPath).toLowerCase();
    if (!IMAGE_FILE_EXTS.has(ext)) continue;

    const key = absPath.toLowerCase();
    if (seen.has(key) || sentSet?.has(key)) continue;
    try {
      if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
        seen.add(key);
        results.push(absPath);
      }
    } catch {
      // Ignore inaccessible paths
    }
  }
  return results;
}

/** Unwrap a final agy result payload from json or stream-json events. */
function unwrapAgyResultEvent(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.event === "result" && parsed.result && typeof parsed.result === "object") {
    return parsed.result;
  }
  if (!parsed.event && ("response" in parsed || "conversation_id" in parsed || "status" in parsed)) {
    return parsed;
  }
  return null;
}

/** Extract conversation_id from any NDJSON or JSON line emitted by agy. */
function extractConversationIdFromAgyStdout(stdout) {
  const lines = String(stdout || "").trim().split(/\r?\n/).reverse();
  for (const line of lines) {
    const s = line.trim();
    if (!s.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(s);
      const convId = parsed?.conversation_id || parsed?.step_update?.conversation_id || parsed?.result?.conversation_id;
      if (typeof convId === "string" && convId) return convId;
    } catch {
      // Keep scanning
    }
  }
  return null;
}

/** Extract the final JSON payload from agy stdout (supports json & stream-json). */
function parseAgyOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return unwrapAgyResultEvent(JSON.parse(trimmed));
  } catch {
    const lines = trimmed.split(/\r?\n/).reverse();
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith("{")) continue;
      try {
        const res = unwrapAgyResultEvent(JSON.parse(s));
        if (res) return res;
      } catch {
        // Keep scanning
      }
    }
    return null;
  }
}

let mcpBridgeState = null;

const handleDesktopOpenTool = createDesktopToolHandler({
  getDefaultCwd: () => config.defaultCwd,
  getFallbackCwd: () => ensureNoProjectDir(),
  tempDir: DISCORD_TEMP_DIR,
  attachDir: DISCORD_ATTACHMENTS_DIR,
  noProjectDir: AGY_CLI_NO_PROJECT_DIR,
  deletedChannels,
  getRunScope: (runId) => activeRunScopes.get(runId) || null,
  resolveLocalFilePath,
  sendDiscordAttachments,
});

/** Register our stdio MCP proxy idempotently in ~/.gemini/config/mcp_config.json without clobbering user entries. */
function ensureMcpConfigRegistered() {
  const cfgPath = path.join(os.homedir(), ".gemini", "config", "mcp_config.json");
  try {
    fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
    let data = {};
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, "utf8").replace(/^\uFEFF/, "").trim();
      if (raw) {
        data = JSON.parse(raw);
      }
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.warn(`[mcp] Skipping ${cfgPath}: root value is not a JSON object.`);
      return;
    }
    if (!data.mcpServers || typeof data.mcpServers !== "object" || Array.isArray(data.mcpServers)) {
      data.mcpServers = {};
    }
    const desired = {
      command: process.execPath,
      args: [__filename, "--mcp-stdio"],
      disabled: false,
    };
    const existing = data.mcpServers[MCP_SERVER_NAME];
    const matches =
      existing &&
      existing.command === desired.command &&
      existing.disabled === false &&
      Array.isArray(existing.args) &&
      existing.args.length === desired.args.length &&
      existing.args.every((v, i) => v === desired.args[i]);
    if (!matches) {
      data.mcpServers[MCP_SERVER_NAME] = desired;
      writeJson(cfgPath, data);
      console.log(`[mcp] Registered ${MCP_SERVER_NAME} in ${cfgPath}`);
    }
  } catch (err) {
    console.warn(`[mcp] Failed to register ${MCP_SERVER_NAME} in ${cfgPath}:`, err.message);
  }
}

/** Start a loopback-only authenticated HTTP endpoint for --mcp-stdio desktop tool calls. */
function startMcpBridgeServer() {
  const token = crypto.randomBytes(24).toString("hex");
  const expectedAuth = Buffer.from(`Bearer ${token}`, "utf8");

  const server = http.createServer((req, res) => {
    const authHeader = Buffer.from(String(req.headers.authorization || ""), "utf8");
    const authorized = authHeader.length === expectedAuth.length && crypto.timingSafeEqual(authHeader, expectedAuth);
    if (!authorized) {
      res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ isError: true, text: "Unauthorized" }));
      return;
    }
    if (req.method !== "POST" || req.url !== "/open") {
      res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ isError: true, text: "Not found" }));
      return;
    }

    let body = "";
    let tooLarge = false;
    req.on("data", (chunk) => {
      body += chunk.toString("utf8");
      if (body.length > 262144) {
        tooLarge = true;
        req.destroy();
      }
    });
    req.on("end", async () => {
      if (tooLarge) return;
      try {
        const payload = JSON.parse(body || "{}");
        const result = await handleDesktopOpenTool(payload.name, payload.arguments || {}, payload.cwd || "", {
          channelId: payload.channelId || "",
          runId: payload.runId || "",
        });
        res.writeHead(result.isError ? 400 : 200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" }).end(
          JSON.stringify({ isError: true, text: err.message || "Invalid desktop open request." })
        );
      }
    });
  });

  return new Promise((resolve) => {
    server.on("error", (err) => {
      console.warn("[mcp] Failed to start loopback desktop bridge:", err.message);
      resolve(null);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      server.unref();
      mcpBridgeState = { port: addr.port, token, server };
      console.log(`[mcp] Desktop bridge listening on 127.0.0.1:${addr.port}`);
      resolve(mcpBridgeState);
    });
  });
}

/** Run an agy CLI command, optionally streaming stdout lines, and return { code, stdout, stderr, aborted }. */
function runAgy(args, cwd, trackChannelId = null, onStdoutLine = null, extraEnv = null) {
  return new Promise((resolve) => {
    const safeCwd = fs.existsSync(cwd) ? cwd : os.homedir();
    const env = { ...process.env, AGY_DISCORD_MCP_CWD: safeCwd };
    if (trackChannelId) env.AGY_DISCORD_CHANNEL_ID = String(trackChannelId);
    if (extraEnv && typeof extraEnv === "object") {
      Object.assign(env, extraEnv);
    }
    if (mcpBridgeState) {
      env.AGY_DISCORD_MCP_PORT = String(mcpBridgeState.port);
      env.AGY_DISCORD_MCP_TOKEN = mcpBridgeState.token;
    }
    const child = spawn(config.agyPath, args, {
      cwd: safeCwd,
      env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end();
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    let aborted = false;
    if (trackChannelId) {
      activeRuns.set(trackChannelId, {
        abort: () => {
          aborted = true;
          child.kill();
        },
      });
    }

    let stdout = "";
    let stderr = "";
    let lineBuffer = "";
    let settled = false;

    const emitLine = (rawLine) => {
      if (!onStdoutLine) return;
      const trimmed = rawLine.trim();
      if (!trimmed) return;
      try {
        onStdoutLine(trimmed);
      } catch (err) {
        console.error("[agy-stream] Line handler error:", err.message);
      }
    };

    const flushLineBuffer = () => {
      if (!lineBuffer) return;
      const rem = lineBuffer;
      lineBuffer = "";
      emitLine(rem);
    };

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (!onStdoutLine) return;
      lineBuffer += chunk;
      let nlIdx;
      while ((nlIdx = lineBuffer.indexOf("\n")) !== -1) {
        const line = lineBuffer.slice(0, nlIdx);
        lineBuffer = lineBuffer.slice(nlIdx + 1);
        emitLine(line);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const finish = (code, fallbackStderr = "") => {
      if (settled) return;
      settled = true;
      flushLineBuffer();
      if (trackChannelId) activeRuns.delete(trackChannelId);
      resolve({ code, stdout, stderr: stderr || fallbackStderr, aborted });
    };
    child.on("error", (err) => finish(-1, err.message));
    child.on("close", (code) => finish(code ?? -1));
  });
}

function addUsage(target, usage, durationSec) {
  target.turns += 1;
  target.input_tokens += usage?.input_tokens || 0;
  target.output_tokens += usage?.output_tokens || 0;
  target.thinking_tokens += usage?.thinking_tokens || 0;
  target.cache_read_tokens += usage?.cache_read_tokens || 0;
  target.total_tokens += usage?.total_tokens || 0;
  target.duration_seconds += durationSec || 0;
}

function formatFooter(chState, data, durationSec = null, execPolicy = null) {
  if (!chState.showFooter) return "";
  const effectiveDur = typeof durationSec === "number" ? durationSec : data?.duration_seconds;
  const dur = typeof effectiveDur === "number" ? `${effectiveDur.toFixed(1)}s` : "?s";
  const u = data?.usage;
  const tokStr = u
    ? `in ${formatNumber(u.input_tokens)} · out ${formatNumber(u.output_tokens)} · total ${formatNumber(u.total_tokens)}`
    : "usage n/a";
  const modelName = execPolicy?.model || chState.model;
  const effortVal = execPolicy ? execPolicy.effort : chState.effort;
  const effortStr = effortVal ? ` (${effortVal})` : "";
  return `-# \`${modelName}${effortStr}\` | ${dur} | ${tokStr}`;
}

const GUIDE_GROUPS = [
  { key: "work", title: "## 📁 1. Chọn Dự án & AI Model" },
  { key: "chat", title: "## 💬 2. Chat, Kiểm tra & Dọn phòng" },
  { key: "access", title: "## 👥 3. Quản lý Thành viên & Hướng dẫn" },
  { key: "desktop", title: "## 🖥️ 4. Chrome AM, Cửa sổ & Nhật ký" },
  { key: "auto", title: "## ⚙️ 5. Hẹn giờ & Tùy chỉnh hiển thị" },
];

function getCommandDocs() {
  const guideName = config.guideChannelName || "instructions";
  return [
    {
      group: "work",
      cmd: "/projects",
      short: "Xem các dự án đã lưu và thư mục hiện tại của kênh.",
    },
    {
      group: "work",
      cmd: "/project",
      short: "Gắn kênh vào thư mục/dự án (chọn `none` để chat tự do).",
      example: "`/project discord-agy-bridge` • `/project none`",
    },
    {
      group: "work",
      cmd: "/models",
      short: "Xem toàn bộ model AI đang có.",
    },
    {
      group: "work",
      cmd: "/model",
      short: "Xem hoặc đổi model AI cho kênh/Thread hiện tại.",
      example: "`/model gemini-4-hydrogen-high`",
    },
    {
      group: "work",
      cmd: "/mode",
      short: "Đổi quyền hành động của AI: `auto` (làm hết), `accept-edits` (chỉ sửa file), `plan` (chỉ bàn kế hoạch).",
      example: "`/mode plan`",
    },
    {
      group: "work",
      cmd: "/sandbox",
      short: "Bật/tắt chế độ an toàn khi AI chạy lệnh (nên giữ `on`).",
      example: "`/sandbox on` • `/sandbox off`",
    },
    {
      group: "chat",
      cmd: "/new",
      short: "Bắt đầu cuộc trò chuyện mới (AI quên ngữ cảnh cũ, giữ nguyên dự án & model).",
    },
    {
      group: "chat",
      cmd: "/stop",
      short: "Dừng ngay tác vụ AI đang chạy.",
    },
    {
      group: "chat",
      cmd: "/status",
      short: "Xem nhanh cấu hình kênh, model, hàng đợi và trạng thái bot.",
    },
    {
      group: "chat",
      cmd: "/usage",
      short: "Xem số token đã dùng, thời gian chạy và tổng sử dụng toàn bot.",
    },
    {
      group: "chat",
      cmd: "/clear",
      short: "Xóa tin nhắn ngoài kênh (giữ nguyên các Thread con).",
      example: "`/clear 30` • `/clear` *(xóa hết)*",
    },
    {
      group: "chat",
      cmd: "/delete",
      short: "Dùng bên trong Thread để xóa hẳn Thread đó.",
    },
    {
      group: "chat",
      cmd: "/play",
      short: "Phát nhạc hoặc playlist trong kênh Voice (dùng được ở `#free-chat`, chat Voice & phòng riêng) từ link YouTube, YT Music, SoundCloud, Spotify.",
      example: "`/play https://...` • `/play skip` • `/play pause` • `/play stop` • `/play queue`",
    },
    {
      group: "chat",
      cmd: "/help",
      short: "Xem bảng hướng dẫn lệnh.",
    },
    {
      group: "access",
      cmd: "/access",
      short: "Quản lý phòng riêng thành viên, đổi model hộ, hạn mức dùng & bảo mật:",
      example: [
        "`/access list` *(xem quyền & cấu hình hiện tại)*",
        "`/access onboard @ten` • `/access offboard @ten` *(mở/thu hồi phòng riêng)*",
        "`/access model set @ten gemini-4-hydrogen-high` *(đổi model giúp thành viên)*",
        "`/access quota 30 5` *(giới hạn 30 lượt/ngày, chờ 5s)*",
        "`/access report now` • `/access report on 22:00` *(báo cáo tổng kết cuối ngày)*",
        "`/access private #ten-kenh on` *(ẩn kênh khỏi `@everyone`)*",
      ].join("\n    ↳ "),
    },
    {
      group: "access",
      cmd: "/guide",
      short: `Cập nhật lại bài hướng dẫn ở kênh \`#${guideName}\` (thêm \`reset\` để đăng mới).`,
    },
    {
      group: "access",
      cmd: "/reload",
      short: "Áp dụng ngay thay đổi trong `config.json` không cần khởi động lại bot.",
    },
    {
      group: "desktop",
      cmd: "/chrome",
      short: "Xem các tab đang mở trên **Chrome AM** hoặc đóng riêng Chrome AM.",
      example: "`/chrome status` • `/chrome close`",
    },
    {
      group: "desktop",
      cmd: "/windows",
      short: "Xem danh sách cửa sổ Windows đang mở, đưa lên trên hoặc đóng.",
      example: "`/windows list` • `/windows focus Chrome`",
    },
    {
      group: "desktop",
      cmd: "/logs",
      short: "Xem nhanh các dòng nhật ký mới nhất của bot ngay trên Discord.",
      example: "`/logs 30`",
    },
    {
      group: "desktop",
      cmd: "/cleanup",
      short: "Dọn ảnh chụp tạm và file đính kèm cũ quá 7 ngày.",
    },
    {
      group: "auto",
      cmd: "/cron",
      short: "Hẹn giờ cho AI tự chạy định kỳ hoặc chạy 1 lần.",
      example: "`/cron add \"daily 08:30\" \"...\"` • `/cron list`",
    },
    {
      group: "auto",
      cmd: "/webhook",
      short: "Xem trạng thái Webhook và gửi thử sự kiện kiểm tra.",
      example: "`/webhook status` • `/webhook test <id>`",
    },
    {
      group: "auto",
      cmd: "/footer",
      short: "Bật/tắt dòng thống kê nhỏ (model, thời gian, token) dưới câu trả lời.",
      example: "`/footer off` • `/footer off all` • `/footer on all`",
    },
    {
      group: "auto",
      cmd: "/autothread",
      short: "Bật/tắt tự tạo Thread riêng cho mỗi câu hỏi ở kênh chính.",
      example: "`/autothread on` • `/autothread off all`",
    },
    {
      group: "auto",
      cmd: "/stream",
      short: "Bật/tắt hiện từng bước tiến độ trong lúc AI đang làm.",
      example: "`/stream on` • `/stream off all`",
    },
  ];
}

/** Pack markdown sections into Discord-safe message chunks without splitting mid-section unless oversized. */
function packDiscordSections(sections, maxLen = 1850) {
  const messages = [];
  let current = "";
  for (const section of sections) {
    if (!section) continue;
    if (section.length > maxLen) {
      if (current) {
        messages.push(current);
        current = "";
      }
      messages.push(...splitDiscordMessage(section, maxLen));
      continue;
    }
    const candidate = current ? `${current}\n\n${section}` : section;
    if (candidate.length <= maxLen) {
      current = candidate;
    } else {
      if (current) messages.push(current);
      current = section;
    }
  }
  if (current) messages.push(current);
  return messages;
}

/** Build categorized, example-rich `/help` message chunks tailored to Admin or Member access. */
function buildHelpMessages(route) {
  const allowedDocs = getCommandDocs().filter((d) => canExecuteDiscordCommand(d.cmd, route));
  if (!route?.isAdmin) {
    const lines = [
      "**Các lệnh (`/`) bạn có thể dùng trong kênh này:**",
      "*(Gõ `/` vào ô chat rồi bấm chọn trong menu gợi ý của Discord)*",
      "",
      ...allowedDocs.map((d) => {
        const shortText =
          d.cmd === "/usage"
            ? "Xem số token đã dùng, thời gian chạy và hạn mức hôm nay của bạn."
            : d.short;
        return d.example ? `• \`${d.cmd}\` — ${shortText}\n  ↳ ${d.example}` : `• \`${d.cmd}\` — ${shortText}`;
      }),
    ];
    return packDiscordSections([lines.join("\n")], 1850);
  }

  const sections = [
    [
      "# 🛠️ Hướng dẫn nhanh cho Admin (`/`)",
      "Gõ **`/`** trong ô chat rồi chọn lệnh muốn dùng (bấm Tab/Enter để điền nhanh tham số).",
    ].join("\n"),
  ];

  for (const group of GUIDE_GROUPS) {
    const items = allowedDocs.filter((d) => d.group === group.key);
    if (items.length === 0) continue;
    const lines = [group.title];
    for (const d of items) {
      lines.push(d.example ? `• \`${d.cmd}\` — ${d.short}\n  ↳ ${d.example}` : `• \`${d.cmd}\` — ${d.short}`);
    }
    sections.push(lines.join("\n"));
  }

  return packDiscordSections(sections, 1850);
}

/** Build public read-only guide messages for #instructions in plain, non-technical language. */
function buildGuideMessages() {
  const prefix = config.autoOnboard?.channelPrefix || "ai-";

  const simpleCommands = [
    "• `/new` — **Hỏi chuyện mới từ đầu** (quên nội dung cũ để AI không bị lẫn chủ đề).",
    "• `/stop` — **Dừng AI lại ngay** nếu thấy bot đang trả lời quá lâu hoặc chưa đúng ý.",
    "• `/clear` — **Xóa bớt tin nhắn cũ** trong phòng cho gọn gàng *(chỉ xóa tin nhắn ở ngoài, không làm mất các chủ đề con đã tách)*.",
    "• `/delete` — **Xóa hẳn một chủ đề con** *(dùng khi bạn đang ở bên trong chủ đề con đó)*.",
    "• `/status` — **Xem thông tin phòng chat** (đang dùng AI nào, chế độ hiển thị ra sao).",
    "• `/usage` — **Xem thống kê sử dụng** (thời gian trả lời và mức độ đã dùng).",
    "• `/play` — **Phát nhạc/playlist trong kênh Voice** *(dùng được ở `#free-chat` hoặc kênh Voice; hỗ trợ link YouTube, YT Music, SoundCloud, Spotify hoặc gõ tên bài hát; kèm `/play skip`, `/play stop`, `/play queue`; bot tự rời nếu phòng không còn ai)*.",
    "• `/help` — **Xem nhanh danh sách lệnh** bạn có thể dùng.",
  ];

  const botName = getBotDisplayName();
  const sections = [
    [
      `# 🤖 Hướng dẫn dùng Trợ lý AI (**${botName}**)`,
      "",
      `Chào bạn! **${botName}** là trợ lý AI riêng giúp bạn hỏi đáp, viết lách, dịch thuật, tóm tắt tài liệu, đọc ảnh... ngay trên Discord — đơn giản như nhắn tin với một người bạn.`,
      "",
      "## 1. Bắt đầu ở đâu?",
      `• Khi vào server, bot sẽ tự tạo cho bạn **1 phòng chat riêng** tên dạng \`#${prefix}<tên-của-bạn>\` ở cột kênh bên trái.`,
      `• Phòng này **hoàn toàn riêng tư** — chỉ có **bạn**, **Admin** và **bot ${botName}** nhìn thấy, người khác không đọc được.`,
      "",
      "## 2. Cách nói chuyện với AI",
      "• Vào đúng phòng riêng của bạn và **nhắn tin bình thường** bằng tiếng Việt (ví dụ: *\"Viết giúp mình 1 tin nhắn xin nghỉ phép\"*, *\"Giải thích giúp mình ảnh này\"*).",
      "• **Gửi ảnh & tài liệu rất dễ:** Bấm nút **`+`** cạnh ô chat (hoặc kéo thả ảnh, file Word/PDF/văn bản vào) rồi nhắn kèm yêu cầu — AI sẽ đọc được và có thể gửi lại ảnh/file kết quả cho bạn.",
      "• **Hỏi tiếp về 1 tin nhắn/ảnh cũ:** Bấm nút **Reply (Trả lời)** vào tin nhắn đó rồi gõ câu hỏi — AI sẽ đọc lại đúng nội dung & ảnh bạn đang chỉ tới.",
      "• **Nút bấm nhanh:** Khi bot đang chạy, bấm **`⏹️ Dừng ngay`** nếu muốn hủy; khi bot trả lời xong, bấm **`🔄 Thử lại`**, **`📝 Tóm tắt ngắn`**, **`🆕 Phiên mới`** hoặc **`🗑️ Xóa Thread`** ngay dưới tin nhắn mà không cần nhớ lệnh.",
      "• **Tách từng chủ đề cho gọn:** Mỗi câu hỏi mới ở phòng chính sẽ tự mở một **ô thảo luận riêng** *(Thread)*. Muốn hỏi tiếp về **cùng việc đó**, bạn bấm vào ô thảo luận đó để chat tiếp; còn muốn hỏi **việc khác**, hãy quay ra phòng chính nhắn tin mới.",
    ].join("\n"),
    [
      "## 3. Các lệnh hỗ trợ (không bắt buộc nhớ)",
      "Khi cần, bạn chỉ cần gõ dấu **`/`** vào ô nhập chữ là Discord tự hiện danh sách lệnh để bấm chọn:",
      "",
      ...simpleCommands,
    ].join("\n"),
  ];

  return packDiscordSections(sections, 1900);
}

/** Return all guild IDs the bot belongs to, caching them in knownGuildIds. */
async function getBotGuildIds(readyGuildIds = []) {
  for (const id of readyGuildIds) {
    if (id) knownGuildIds.add(id);
  }
  if (knownGuildIds.size === 0) {
    const guilds = await discordRequest("GET", "/users/@me/guilds").catch(() => []);
    for (const g of guilds || []) {
      if (g?.id) knownGuildIds.add(g.id);
    }
  }
  return Array.from(knownGuildIds);
}

/** Locate a guild text/announcement channel by explicit ID, cached ID, or name. */
async function findGuildTextChannel({ explicitId = "", cachedId = "", targetName = "", readyGuildIds = [] }) {
  if (explicitId) {
    return discordRequest("GET", `/channels/${explicitId}`);
  }
  const normalizedName = (targetName || "").trim().toLowerCase();
  if (!normalizedName) return null;

  if (cachedId) {
    try {
      const existing = await discordRequest("GET", `/channels/${cachedId}`);
      if (existing && (existing.type === 0 || existing.type === 5) && existing.name?.toLowerCase() === normalizedName) {
        return existing;
      }
    } catch {
      // Fall through to full guild channel scan if cached channel was deleted or renamed
    }
  }

  const guildIds = await getBotGuildIds(readyGuildIds);
  for (const guildId of guildIds) {
    const channels = await discordRequest("GET", `/guilds/${guildId}/channels`).catch(() => []);
    const match = (channels || []).find(
      (c) => (c.type === 0 || c.type === 5) && c.name?.toLowerCase() === normalizedName
    );
    if (match) return match;
  }
  return null;
}

/** Discover the #announcement channel for member join/leave notices and cache its ID in state.json. */
async function syncAnnounceChannel(readyGuildIds = []) {
  if (!config.announceChannelId && !config.announceChannelName) return null;
  const channel = await findGuildTextChannel({
    explicitId: config.announceChannelId,
    cachedId: state.announceChannelId || "",
    targetName: config.announceChannelName,
    readyGuildIds,
  });
  if (!channel?.id) {
    console.log(`[announce] Channel #${config.announceChannelName || config.announceChannelId} not found yet.`);
    return null;
  }
  if (state.announceChannelId !== channel.id) {
    state.announceChannelId = channel.id;
    saveState();
  }
  if (channel.guild_id && memberProvisioner) {
    await memberProvisioner
      .setChannelReadOnly({
        guildId: channel.guild_id,
        channelId: channel.id,
        existingOverwrites: channel.permission_overwrites,
      })
      .then((res) => {
        if (res?.updated) {
          console.log(`[announce] Enforced read-only permissions for @everyone on #${channel.name} (${channel.id}).`);
        }
      })
      .catch((err) => {
        console.warn(`[announce] Could not enforce read-only permissions on #${channel.name}:`, err.message);
      });
  }
  console.log(`[announce] Ready on #${channel.name} (${channel.id}).`);
  return channel;
}

/** Resolve and cache the member count for a guild (used by #announcement cards). */
async function resolveGuildMemberCount(guildId) {
  if (!guildId) return 0;
  const cached = guildMemberCounts.get(guildId);
  if (typeof cached === "number" && cached > 0) return cached;
  try {
    const guild = await discordRequest("GET", `/guilds/${guildId}?with_counts=true`);
    const count = Number(guild?.approximate_member_count || 0);
    if (count > 0) {
      guildMemberCounts.set(guildId, count);
      return count;
    }
  } catch {
    // Fallback cleanly without blocking announcement delivery
  }
  return 0;
}

/** Format and post a member join or leave embed + avatar banner card to the configured #announcement channel. */
async function sendMemberAnnouncement(kind, data) {
  const userId = String(data?.user?.id || "").trim();
  if (!userId) return false;
  if (data?.user?.bot && config.autoOnboard?.ignoreBots !== false) return false;
  if (!config.announceChannelId && !config.announceChannelName) return false;

  const ch = await findGuildTextChannel({
    explicitId: config.announceChannelId,
    cachedId: state.announceChannelId || "",
    targetName: config.announceChannelName,
    readyGuildIds: data?.guild_id ? [data.guild_id] : [],
  }).catch(() => null);
  if (!ch?.id) return false;
  if (data?.guild_id && ch.guild_id && ch.guild_id !== data.guild_id) return false;

  if (state.announceChannelId !== ch.id) {
    state.announceChannelId = ch.id;
    saveState();
  }

  const template = kind === "join" ? config.announceJoinMessage : config.announceLeaveMessage;
  if (!template) return false;

  const guildId = String(data?.guild_id || ch.guild_id || "").trim();
  const username = data?.nick || data?.user?.global_name || data?.user?.username || userId;
  const mention = `<@${userId}>`;
  const guideChId = String(config.guideChannelId || state.guide?.channelId || "").trim();
  const guideChName = String(config.guideChannelName || state.guide?.name || "instructions").trim();
  let description = template
    .replace(/^\s*(?:\{mention\}|\{user\})[\s,:-]*/i, "")
    .replace(/\{mention\}/g, `**${username}**`)
    .replace(/\{user\}/g, `**${username}**`)
    .replace(/\{username\}/g, username)
    .trim();
  if (guideChId) {
    const escapedGuide = guideChName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    description = description.replace(new RegExp(`#${escapedGuide}(?![\\w-])`, "gi"), `<#${guideChId}>`);
  }

  const memberCount = await resolveGuildMemberCount(guildId);
  const avatarUrl = buildMemberAvatarUrl(data, guildId);
  const cardBuffer = await renderAnnouncementCard({
    kind,
    username,
    memberCount,
    avatarUrl,
  }).catch((err) => {
    console.warn(`[announce] Card render failed, falling back to embed text:`, err.message);
    return null;
  });

  const embed = {
    color: kind === "join" ? 0x7257ff : 0xef4444,
    ...(description ? { description } : {}),
    ...(cardBuffer ? { image: { url: "attachment://announce-card.png" } } : {}),
  };
  const payload = {
    content: mention,
    allowed_mentions: kind === "join" ? { users: [userId] } : { parse: [] },
    embeds: [embed],
  };

  if (cardBuffer) {
    const form = new FormData();
    form.append("payload_json", JSON.stringify(payload));
    form.append("files[0]", new Blob([cardBuffer], { type: "image/png" }), "announce-card.png");
    await discordRequest("POST", `/channels/${ch.id}/messages`, form);
  } else {
    await discordRequest("POST", `/channels/${ch.id}/messages`, payload);
  }
  console.log(`[announce] Sent ${kind} embed for ${username} (${userId}) in #${ch.name || ch.id}.`);
  return true;
}

/** Discover and initialize the configured #free-chat channel as project-free chat. */
async function syncFreeChatChannel(readyGuildIds = []) {
  if (!config.freeChatChannelId && !config.freeChatChannelName) return null;
  const channel = await findGuildTextChannel({
    explicitId: config.freeChatChannelId,
    targetName: config.freeChatChannelName,
    readyGuildIds,
  });
  if (!channel) {
    console.log(`[free-chat] Channel #${config.freeChatChannelName || config.freeChatChannelId} not found yet.`);
    return null;
  }
  registerFreeChatChannel(channel.id);
  console.log(`[free-chat] Ready on #${channel.name} (${channel.id}) (no project).`);
  return channel;
}

/** Synchronize the guide messages into the configured #instructions channel. */
async function syncGuideChannel({ forceReset = false, readyGuildIds = [] } = {}) {
  if (guideSyncPromise) {
    await guideSyncPromise.catch(() => {});
  }
  const run = (async () => {
    if (!config.guideChannelId && !config.guideChannelName) {
      return { status: "disabled" };
    }
    const channel = await findGuildTextChannel({
      explicitId: config.guideChannelId,
      cachedId: state.guide?.channelId || "",
      targetName: config.guideChannelName,
      readyGuildIds,
    });
    if (!channel) {
      console.log(`[guide] Channel #${config.guideChannelName || config.guideChannelId} not found.`);
      return { status: "not_found", expectedName: config.guideChannelName || config.guideChannelId };
    }

    if (channel.guild_id && memberProvisioner) {
      await memberProvisioner
        .setChannelReadOnly({
          guildId: channel.guild_id,
          channelId: channel.id,
          existingOverwrites: channel.permission_overwrites,
        })
        .then((res) => {
          if (res?.updated) {
            console.log(`[guide] Enforced read-only permissions for @everyone on #${channel.name} (${channel.id}).`);
          }
        })
        .catch((err) => {
          console.warn(`[guide] Could not enforce read-only permissions on #${channel.name}:`, err.message);
        });
    }

    const messages = buildGuideMessages();
    const hash = crypto.createHash("sha256").update(messages.join("\n---\n")).digest("hex");
    const recent = await discordRequest("GET", `/channels/${channel.id}/messages?limit=50`);
    const recentList = Array.isArray(recent) ? recent : [];
    const recentMap = new Map(recentList.map((m) => [m.id, m.content]));
    const botUserId = gateway.botUser?.id || null;

    const prevGuide = state.guide && state.guide.channelId === channel.id ? state.guide : null;
    const prevIds = Array.isArray(prevGuide?.messageIds) ? prevGuide.messageIds : [];
    const allPrevPresent = prevIds.length > 0 && prevIds.every((id) => recentMap.has(id));

    if (!forceReset && allPrevPresent && prevGuide?.hash === hash && prevIds.length === messages.length) {
      const exactMatch = prevIds.every((id, idx) => recentMap.get(id) === messages[idx]);
      if (exactMatch) {
        console.log(`[guide] #${channel.name} (${channel.id}) is up to date.`);
        return { status: "unchanged", channelId: channel.id, channelName: channel.name };
      }
    }

    if (!forceReset && allPrevPresent && prevIds.length === messages.length) {
      let patched = 0;
      for (let i = 0; i < prevIds.length; i++) {
        if (recentMap.get(prevIds[i]) !== messages[i]) {
          await discordRequest("PATCH", `/channels/${channel.id}/messages/${prevIds[i]}`, { content: messages[i] });
          patched++;
        }
      }
      state.guide = { channelId: channel.id, name: channel.name, hash, messageIds: prevIds };
      saveState();
      console.log(`[guide] Updated ${patched} guide message(s) in #${channel.name} (${channel.id}).`);
      return { status: "updated", channelId: channel.id, channelName: channel.name, count: messages.length };
    }

    if (recentList.length > 0) {
      if (forceReset || prevIds.length === 0) {
        try {
          await clearChannelMessages(channel.id, Infinity, { isDm: false }, null);
        } catch (err) {
          if (err.status === 403 && botUserId) {
            const ownIds = recentList.filter((m) => m.author?.id === botUserId).map((m) => m.id);
            await deleteMessageIds(channel.id, ownIds, false).catch(() => {});
          } else {
            throw err;
          }
        }
      } else {
        const existingBotIds = prevIds.filter((id) => recentMap.has(id));
        if (existingBotIds.length > 0) {
          await deleteMessageIds(channel.id, existingBotIds, true).catch(() => {});
        }
      }
    }

    const postedIds = [];
    for (const chunk of messages) {
      const sent = await discordRequest("POST", `/channels/${channel.id}/messages`, { content: chunk });
      if (sent?.id) postedIds.push(sent.id);
    }
    state.guide = { channelId: channel.id, name: channel.name, hash, messageIds: postedIds };
    saveState();
    console.log(`[guide] Published ${postedIds.length} guide message(s) to #${channel.name} (${channel.id}).`);
    return { status: "published", channelId: channel.id, channelName: channel.name, count: postedIds.length };
  })().finally(() => {
    guideSyncPromise = null;
  });

  guideSyncPromise = run;
  return run;
}

/** Redact any configured secrets before sharing log tails or diagnostic messages. */
function sanitizeLogOutput(text) {
  let out = String(text || "");
  const secrets = [config.botToken, config.webhook?.defaultSecret];
  for (const h of Object.values(config.webhook?.hooks || {})) {
    if (h?.secret) secrets.push(h.secret);
  }
  for (const s of secrets) {
    if (typeof s === "string" && s.length >= 6) {
      out = out.split(s).join("[REDACTED]");
    }
  }
  return out;
}

/** Resolve a guild member mention, ID, or plain @handle/display-name (useful in private channels where Discord @-autocomplete is hidden). */
async function resolveDiscordMemberToken(rawToken, guildId) {
  const directId = extractSnowflakeId(rawToken);
  if (directId) return { userId: directId, username: "", isBot: false };
  const query = String(rawToken || "").replace(/^@/, "").trim();
  if (!query || !guildId) return null;
  const members = await discordRequest(
    "GET",
    `/guilds/${guildId}/members/search?query=${encodeURIComponent(query)}&limit=5`
  ).catch(() => []);
  if (!Array.isArray(members) || members.length === 0) return null;
  const qLower = query.toLowerCase();
  const exact = members.find(
    (m) =>
      m?.user?.username?.toLowerCase() === qLower ||
      m?.user?.global_name?.toLowerCase() === qLower ||
      m?.nick?.toLowerCase() === qLower
  );
  const picked = exact || (members.length === 1 ? members[0] : null);
  if (!picked?.user?.id) return null;
  return {
    userId: String(picked.user.id),
    username: picked.user.username || "",
    isBot: Boolean(picked.user.bot),
  };
}

/** Resolve a channel mention, ID, or plain #channel-name within a guild. */
async function resolveDiscordChannelToken(rawToken, guildId) {
  const directId = extractSnowflakeId(rawToken);
  if (directId) return directId;
  const name = String(rawToken || "").replace(/^#/, "").trim().toLowerCase();
  if (!name || !guildId) return "";
  const channels = await discordRequest("GET", `/guilds/${guildId}/channels`).catch(() => []);
  const match = (channels || []).find(
    (c) => (c.type === 0 || c.type === 5) && c.name?.toLowerCase() === name
  );
  return match?.id ? String(match.id) : "";
}

/** Handle `/access` subcommands for RBAC rules, auto-onboarding, channel privacy, and co-admins. */
async function handleAccessCommand(channelId, argStr, msg = null) {
  const tokens = splitCommandArgs(argStr);
  const sub = (tokens[0] || "list").toLowerCase();

  if (sub === "list" || sub === "status") {
    await sendDiscordMessages(channelId, formatAccessSummary(config));
    return;
  }

  if (sub === "auto") {
    const modeRaw = (tokens[1] || "").toLowerCase().replace(/^state:/, "");
    const mode = modeRaw;
    if (!mode) {
      const portalActive = typeof gateway !== "undefined" && (gateway.lastRequestedIntents & GUILD_MEMBERS_INTENT) !== 0 && !gateway.memberIntentFallback;
      const intentNote = !config.autoOnboard?.enabled
        ? "Đang tắt"
        : portalActive
          ? "🟢 `GUILD_MEMBERS` đang hoạt động (tự tạo phòng ngay khi có người vào server)"
          : "⚠️ Đã bật trong config nhưng chưa kích hoạt **Server Members Intent** trên Discord Developer Portal (chạy tạm `/access onboard @ten` bằng 1 lệnh)";
      await sendDiscordMessages(
        channelId,
        `**Auto-Onboard thành viên mới:** \`${config.autoOnboard?.enabled ? "on" : "off"}\`\n• **Trạng thái Gateway:** ${intentNote}\n• **Thư mục gốc:** \`${config.autoOnboard?.rootDir}\``
      );
      return;
    }
    if (!["on", "off", "true", "false"].includes(mode)) {
      await sendDiscordMessages(channelId, "Cú pháp: `/access auto on` hoặc `/access auto off`");
      return;
    }
    const nextEnabled = mode === "on" || mode === "true";
    await updateConfigFile((raw) => {
      if (!raw.autoOnboard || typeof raw.autoOnboard !== "object") raw.autoOnboard = {};
      raw.autoOnboard.enabled = nextEnabled;
    });
    await sendDiscordMessages(
      channelId,
      nextEnabled
        ? `✅ Đã bật **Auto-Onboard (\`on\`)**. Nếu bạn đã bật **Server Members Intent** trên Discord Developer Portal + cấp quyền **Manage Channels** cho **${getBotDisplayName()}**, người mới vào server sẽ tự có kênh Private + thư mục sandbox riêng.`
        : "⚪ Đã tắt **Auto-Onboard (`off`)** *(vẫn có thể cấp nhanh 1 lệnh bằng `/access onboard`)*."
    );
    return;
  }

  if (sub === "onboard" || sub === "provision") {
    const guildId = msg?.guild_id || (knownGuildIds.size === 1 ? Array.from(knownGuildIds)[0] : "");
    if (!guildId) {
      await sendDiscordMessages(channelId, "Hãy chạy lệnh `/access onboard` bên trong một kênh của Server Discord.");
      return;
    }
    const resolved = await resolveDiscordMemberToken(tokens[1] || "", guildId);
    if (!resolved?.userId) {
      await sendDiscordMessages(channelId, "Cú pháp: `/access onboard` với `user:@member` hoặc `member_name:<tên>`");
      return;
    }
    const targetUid = resolved.userId;
    const mentioned = Array.isArray(msg?.mentions) ? msg.mentions.find((m) => String(m.id) === targetUid) : null;
    try {
      const res = await memberProvisioner.onboardMember({
        guildId,
        userId: targetUid,
        username: mentioned?.username || resolved.username || "",
        isBot: mentioned ? Boolean(mentioned.bot) : resolved.isBot,
        manual: true,
      });
      await sendDiscordMessages(
        channelId,
        res.alreadyExisted
          ? `ℹ️ <@${targetUid}> đã có sẵn kênh riêng <#${res.channelId}> (khóa trong \`${res.cwd}\`). Đã đồng bộ lại quyền kênh.`
          : `✅ Đã tạo phòng riêng <#${res.channelId}> cho <@${targetUid}> và khóa sandbox tại \`${res.cwd}\`.`
      );
    } catch (err) {
      if (err.status === 403) {
        const botName = getBotDisplayName();
        await sendDiscordMessages(
          channelId,
          `⚠️ Bot **${botName}** thiếu quyền **Manage Channels** trong Server Discord. Hãy vào **Server Settings → Roles → ${botName}** bật **Manage Channels** rồi chạy lại \`/access onboard\`.`
        );
        return;
      }
      throw err;
    }
    return;
  }

  if (sub === "offboard") {
    const guildId = msg?.guild_id || (knownGuildIds.size === 1 ? Array.from(knownGuildIds)[0] : "");
    const resolved = await resolveDiscordMemberToken(tokens[1] || "", guildId);
    const targetUid = resolved?.userId || "";
    if (!targetUid) {
      await sendDiscordMessages(channelId, "Cú pháp: `/access offboard` với `user:@member` hoặc `member_name:<tên>`");
      return;
    }
    const deleteChannel = tokens.some((t) => t.toLowerCase() === "--delete-channel");
    const res = await memberProvisioner.offboardMember({
      userId: targetUid,
      deleteChannel,
      force: true,
    });
    await sendDiscordMessages(
      channelId,
      res.removedChannels.length > 0
        ? `✅ Đã thu hồi quyền của <@${targetUid}> khỏi ${res.removedChannels.map((id) => `<#${id}>`).join(", ")}${res.deletedChannels ? " và xóa kênh trên Discord" : " *(thư mục trên máy được giữ lại an toàn)*"}.`
        : `Không tìm thấy kênh onboarding riêng nào của <@${targetUid}> trong \`channelRules\`.`
    );
    return;
  }

  if (sub === "private") {
    const guildId = msg?.guild_id || (knownGuildIds.size === 1 ? Array.from(knownGuildIds)[0] : "");
    const rawArgs = tokens.slice(1).map((t) => t.replace(/^(?:channel|state):/i, ""));
    let chToken = "";
    let stateTok = "";
    for (const tok of rawArgs) {
      const low = tok.toLowerCase();
      if (low === "on" || low === "off") stateTok = low;
      else if (!chToken) chToken = tok;
    }
    const targetChId = (chToken ? await resolveDiscordChannelToken(chToken, guildId) : "") || (msg?.guild_id ? channelId : "");
    const makePrivate = (stateTok || "on") !== "off";
    if (!guildId || !targetChId) {
      await sendDiscordMessages(channelId, "Cú pháp: `/access private #kênh on` hoặc `/access private #kênh off`");
      return;
    }
    try {
      await memberProvisioner.setChannelPrivacy({ guildId, channelId: targetChId, makePrivate });
      await sendDiscordMessages(
        channelId,
        makePrivate
          ? `🔒 Đã ẩn kênh <#${targetChId}> thành **Private** đối với \`@everyone\` *(vẫn giữ quyền truy cập cho bot **${getBotDisplayName()}**)*.`
          : `🔓 Đã mở lại quyền xem mặc định của \`@everyone\` cho kênh <#${targetChId}>.`
      );
    } catch (err) {
      if (err.status === 403) {
        const botName = getBotDisplayName();
        await sendDiscordMessages(
          channelId,
          `⚠️ Bot **${botName}** bị \`403 Missing Permissions\` trên kênh này (do thiếu quyền **Manage Roles / Manage Permissions** hoặc kênh đã tắt **View Channel** đối với bot **${botName}**).`
        );
        return;
      }
      throw err;
    }
    return;
  }

  if (sub === "model") {
    const cleanModelTokens = tokens
      .slice(1)
      .map((t) => t.replace(/^(?:user|channel|member_name|model_id|effort):/i, ""));
    const offset = cleanModelTokens[0]?.toLowerCase() === "set" ? 1 : 0;
    const targetArg = cleanModelTokens[offset] || "";
    const modelArg = cleanModelTokens[offset + 1] || "";
    const effortArg = (cleanModelTokens[offset + 2] || "").toLowerCase();

    if (!targetArg) {
      const autoM = config.autoOnboard?.defaultModel || "(theo defaultModel toàn cục)";
      const autoE = config.autoOnboard?.defaultEffort ? ` (${config.autoOnboard.defaultEffort})` : "";
      const ruleLines = Object.entries(config.channelRules || {}).map(([cid, r]) => {
        const mLabel = r.model
          ? `\`${r.model}${r.effort ? ` (${r.effort})` : ""}\` *(khóa)*`
          : `\`${state.channels[cid]?.model || config.defaultModel}\` *(mặc định)*`;
        return `• <#${cid}>${r.onboardedUserId ? ` (<@${r.onboardedUserId}>)` : ""}: ${mLabel}`;
      });
      await sendDiscordMessages(
        channelId,
        [
          "**Cấu hình Model cho Thành viên:**",
          `• **Mặc định cho thành viên mới (\`autoOnboard\`):** \`${autoM}\`${autoE}`,
          `• **Mặc định toàn cục (\`defaultModel\`):** \`${config.defaultModel}\`${config.defaultEffort ? ` (${config.defaultEffort})` : ""}`,
          ...(ruleLines.length ? ["", "**Theo từng kênh trong `channelRules`:**", ...ruleLines] : []),
          "",
          "• Đổi mặc định cho người mới: `/access model auto <model_id | clear>`",
          "• Khóa model riêng cho 1 người/kênh: `/access model set <@user | #kênh> <model_id | clear>`",
        ].join("\n")
      );
      return;
    }

    if (!modelArg) {
      await sendDiscordMessages(
        channelId,
        "Cú pháp: `/access model auto <model_id>` hoặc `/access model set @ten <model_id>` *(dùng `/models` để xem danh sách)*"
      );
      return;
    }

    if (effortArg && !VALID_EFFORTS.has(effortArg)) {
      await sendDiscordMessages(channelId, "Effort không hợp lệ. Dùng: `low | medium | high | xhigh | max`.");
      return;
    }

    const isClear = ["clear", "default", "inherit", "none", "reset"].includes(modelArg.toLowerCase());
    if (["auto", "default", "onboard"].includes(targetArg.toLowerCase())) {
      await updateConfigFile((raw) => {
        if (!raw.autoOnboard || typeof raw.autoOnboard !== "object") raw.autoOnboard = { enabled: true };
        if (isClear) {
          delete raw.autoOnboard.defaultModel;
          delete raw.autoOnboard.defaultEffort;
        } else {
          raw.autoOnboard.defaultModel = modelArg;
          if (effortArg) raw.autoOnboard.defaultEffort = effortArg;
          else delete raw.autoOnboard.defaultEffort;
        }
      });
      await sendDiscordMessages(
        channelId,
        isClear
          ? `✅ Đã xóa model riêng của **Auto-Onboard** (thành viên mới sẽ dùng theo \`defaultModel\` toàn cục là \`${config.defaultModel}\`).`
          : `✅ Đã đặt model mặc định cho **thành viên mới (\`autoOnboard\`)** là \`${modelArg}\`${effortArg ? ` (effort: \`${effortArg}\`)` : ""}. *(Không ảnh hưởng kênh Admin \`#admin\`/\`#projects\`.)*`
      );
      return;
    }

    const guildId = msg?.guild_id || (knownGuildIds.size === 1 ? Array.from(knownGuildIds)[0] : "");
    let targetId = extractSnowflakeId(targetArg);
    let isExplicitChannel = targetArg.startsWith("<#") || targetArg.startsWith("#");
    if (!targetId && guildId) {
      if (!isExplicitChannel) {
        const resolvedMember = await resolveDiscordMemberToken(targetArg, guildId);
        if (resolvedMember?.userId) targetId = resolvedMember.userId;
      }
      if (!targetId) {
        const resolvedCh = await resolveDiscordChannelToken(targetArg, guildId);
        if (resolvedCh) {
          targetId = resolvedCh;
          isExplicitChannel = true;
        }
      }
    }
    if (!targetId) {
      await sendDiscordMessages(channelId, `Không nhận diện được mục tiêu \`${targetArg}\`. Dùng \`auto\`, \`@user\`, tên thành viên hoặc \`#kênh\`.`);
      return;
    }

    let matchedChannelIds = [];
    const rules = config.channelRules || {};
    if (!targetArg.startsWith("<@") && !targetArg.startsWith("@") && (isExplicitChannel || rules[targetId])) {
      if (rules[targetId]) matchedChannelIds = [targetId];
    } else {
      matchedChannelIds = Object.entries(rules)
        .filter(
          ([, r]) =>
            r.onboardedUserId === targetId ||
            (r.allowUserIds?.includes(targetId) && !r.allowEveryone)
        )
        .map(([cid]) => cid);
    }

    if (matchedChannelIds.length === 0) {
      await sendDiscordMessages(
        channelId,
        isExplicitChannel
          ? `Kênh <#${targetId}> chưa nằm trong \`channelRules\`. Nếu đây là kênh Admin, hãy vào trực tiếp kênh đó dùng \`/model\`; nếu là kênh thành viên, hãy thêm qua \`/access onboard\` hoặc \`/access channel\`.`
          : `Không tìm thấy kênh thành viên nào trong \`channelRules\` khớp với \`${targetArg}\`.`
      );
      return;
    }

    await updateConfigFile((raw) => {
      if (!raw.channelRules || typeof raw.channelRules !== "object") raw.channelRules = {};
      for (const cid of matchedChannelIds) {
        if (!raw.channelRules[cid]) continue;
        if (isClear) {
          delete raw.channelRules[cid].model;
          delete raw.channelRules[cid].effort;
        } else {
          raw.channelRules[cid].model = modelArg;
          if (effortArg) raw.channelRules[cid].effort = effortArg;
          else delete raw.channelRules[cid].effort;
        }
      }
    });

    for (const cid of matchedChannelIds) {
      if (state.channels[cid]) {
        state.channels[cid].model = isClear ? config.defaultModel : modelArg;
        state.channels[cid].effort = isClear ? config.defaultEffort : effortArg;
      }
      for (const chSt of Object.values(state.channels)) {
        if (chSt && chSt.parentId === cid) {
          chSt.model = isClear ? config.defaultModel : modelArg;
          chSt.effort = isClear ? config.defaultEffort : effortArg;
        }
      }
    }
    saveState();

    const chList = matchedChannelIds.map((cid) => `<#${cid}>`).join(", ");
    const formatModelDisplay = (id) => {
      const hit = cachedAgyModels.find((m) => m.id === id);
      return hit?.label ? `**${hit.label}** (\`${id}\`)` : `\`${id}\``;
    };
    const nextModelLabel = isClear ? formatModelDisplay(config.defaultModel) : formatModelDisplay(modelArg);

    await Promise.all(
      matchedChannelIds
        .filter((cid) => cid !== channelId)
        .map(async (cid) => {
          const rule = rules[cid];
          const ownerId = rule?.onboardedUserId || (rule?.allowUserIds?.length === 1 ? rule.allowUserIds[0] : "");
          const ownerPing = ownerId ? `<@${ownerId}> ` : "";
          const noticeText = isClear
            ? `🔄 ${ownerPing}Admin vừa đưa model kênh này về mặc định (${nextModelLabel}).`
            : `🚀 ${ownerPing}Admin vừa đổi model cho kênh này sang ${nextModelLabel}${effortArg ? ` *(effort: \`${effortArg}\`)*` : ""}. Áp dụng ngay cho tin nhắn tiếp theo!`;
          await discordRequest("POST", `/channels/${cid}/messages`, {
            content: noticeText,
            allowed_mentions: ownerId ? { users: [ownerId] } : { parse: [] },
          }).catch((err) => {
            console.warn(`[access] Could not notify member channel ${cid}:`, err.message);
          });
        })
    );

    await sendDiscordMessages(
      channelId,
      isClear
        ? `✅ Đã gỡ khóa model riêng cho ${chList} (dùng lại mặc định \`${config.defaultModel}\`).`
        : `✅ Đã khóa model \`${modelArg}\`${effortArg ? ` (effort: \`${effortArg}\`)` : ""} cho ${chList} *(áp dụng ngay cho cả các Thread đang mở và Thread mới)*.`
    );
    return;
  }

  if (sub === "channel" || sub === "allow" || sub === "set") {
    const restArgs = argStr.slice(tokens[0].length).trim();
    const { channelId: targetChId, rule } = parseAccessChannelCommand(restArgs);
    await updateConfigFile((raw) => {
      if (!raw.channelRules || typeof raw.channelRules !== "object") raw.channelRules = {};
      raw.channelRules[targetChId] = rule;
    });
    if (state.channels[targetChId]) {
      state.channels[targetChId].cwd = rule.cwd;
      state.channels[targetChId].mode = rule.mode;
      state.channels[targetChId].sandbox = rule.sandbox;
      if (rule.model) state.channels[targetChId].model = rule.model;
      if (rule.effort) state.channels[targetChId].effort = rule.effort;
      state.channels[targetChId].conversationId = null;
      saveState();
    }
    const who = rule.allowEveryone
      ? "mọi người trong kênh"
      : [...rule.allowUserIds.map((u) => `<@${u}>`), ...rule.allowRoleIds.map((r) => `<@&${r}>`)].join(", ") || "chỉ Admin";
    const modelNote = rule.model ? `, model=\`${rule.model}${rule.effort ? ` (${rule.effort})` : ""}\`` : "";
    await sendDiscordMessages(
      channelId,
      `✅ Đã cấp quyền kênh <#${targetChId}> → \`${rule.cwd}\` (Ai dùng: ${who} | mode=\`${rule.mode}\`, sandbox=\`${rule.sandbox ? "on" : "off"}\`, desktop=\`${rule.allowDesktopTools ? "on" : "off"}\`, chrome=\`${rule.allowChrome ? "on" : "off"}\`${modelNote}).`
    );
    return;
  }

  if (sub === "revoke" || sub === "remove" || sub === "del") {
    const targetChId = extractSnowflakeId((tokens[1] || "").replace(/^channel:/i, ""));
    if (!targetChId) {
      await sendDiscordMessages(channelId, "Cú pháp: `/access revoke #kênh`");
      return;
    }
    let removed = false;
    await updateConfigFile((raw) => {
      if (raw.channelRules && targetChId in raw.channelRules) {
        delete raw.channelRules[targetChId];
        removed = true;
      }
    });
    await sendDiscordMessages(
      channelId,
      removed
        ? `✅ Đã thu hồi rule phân quyền cho kênh <#${targetChId}>.`
        : `Không tìm thấy rule phân quyền cho kênh <#${targetChId}> trong \`config.json\`.`
    );
    return;
  }

  if (sub === "admin") {
    const op = (tokens[1] || "").toLowerCase().replace(/^action:/, "");
    const targetUid = extractSnowflakeId((tokens[2] || "").replace(/^user:/i, ""));
    if (!["add", "remove", "del"].includes(op) || !targetUid) {
      await sendDiscordMessages(channelId, "Cú pháp: `/access admin add @user` hoặc `/access admin remove @user`");
      return;
    }
    if (op !== "add" && targetUid === config.allowedUserId) {
      await sendDiscordMessages(channelId, "⛔ Không thể gỡ Root Admin (`allowedUserId`) bằng lệnh này.");
      return;
    }
    await updateConfigFile((raw) => {
      const list = Array.isArray(raw.adminUserIds) ? raw.adminUserIds.map(String) : [];
      if (op === "add") {
        if (!list.includes(targetUid)) list.push(targetUid);
        raw.adminUserIds = list;
      } else {
        raw.adminUserIds = list.filter((id) => id !== targetUid);
      }
    });
    await sendDiscordMessages(
      channelId,
      op === "add" ? `✅ Đã thêm Co-Admin <@${targetUid}> (\`${targetUid}\`).` : `✅ Đã gỡ Co-Admin <@${targetUid}>.`
    );
    return;
  }

  if (sub === "quota") {
    let targetUserId = "";
    let dailyTurns;
    let cooldownSec;
    let dailyTokens;
    const positionalNums = [];
    for (const tok of tokens.slice(1)) {
      const idx = tok.indexOf(":");
      if (idx === -1) {
        const uid = extractSnowflakeId(tok);
        if (uid) {
          targetUserId = uid;
        } else if (/^\d+$/.test(tok)) {
          positionalNums.push(Math.max(0, Math.floor(Number(tok))));
        }
        continue;
      }
      const k = tok.slice(0, idx).toLowerCase();
      const v = tok.slice(idx + 1).trim();
      if (k === "user") targetUserId = extractSnowflakeId(v);
      else if (k === "daily_turns") dailyTurns = Math.max(0, Math.floor(Number(v)));
      else if (k === "cooldown_sec") cooldownSec = Math.max(0, Math.floor(Number(v)));
      else if (k === "daily_tokens") dailyTokens = Math.max(0, Math.floor(Number(v)));
    }
    if (dailyTurns === undefined && positionalNums.length > 0) dailyTurns = positionalNums[0];
    if (cooldownSec === undefined && positionalNums.length > 1) cooldownSec = positionalNums[1];
    if (dailyTokens === undefined && positionalNums.length > 2) dailyTokens = positionalNums[2];

    const hasUpdates =
      Number.isFinite(dailyTurns) || Number.isFinite(cooldownSec) || Number.isFinite(dailyTokens);

    if (!hasUpdates) {
      const lim = config.memberLimits;
      const lines = [
        "**Cấu hình hạn mức Member hiện tại:**",
        `• **Toàn server:** max \`${lim.dailyMaxTurns || "∞"}\` lượt/ngày | cooldown \`${lim.cooldownSec}s\` | token/ngày \`${lim.dailyMaxTokens ? formatNumber(lim.dailyMaxTokens) : "∞"}\``,
      ];
      const todayEntries = Object.entries(state.memberUsage || {});
      if (todayEntries.length > 0) {
        lines.push("", "**Đã dùng hôm nay:**");
        for (const [uid, u] of todayEntries) {
          lines.push(`• <@${uid}>: \`${u.turns || 0}\` lượt | \`${formatNumber(u.tokens || 0)}\` tokens`);
        }
      } else {
        lines.push("• *(Chưa có thành viên nào dùng lượt nào hôm nay)*");
      }
      await sendDiscordMessages(channelId, lines.join("\n"));
      return;
    }

    if (targetUserId) {
      let matchedCount = 0;
      await updateConfigFile((raw) => {
        if (!raw.channelRules || typeof raw.channelRules !== "object") return;
        for (const rule of Object.values(raw.channelRules)) {
          if (
            rule &&
            (rule.onboardedUserId === targetUserId ||
              (Array.isArray(rule.allowUserIds) && rule.allowUserIds.includes(targetUserId) && !rule.allowEveryone))
          ) {
            if (Number.isFinite(dailyTurns)) rule.dailyMaxTurns = dailyTurns;
            if (Number.isFinite(cooldownSec)) rule.cooldownSec = cooldownSec;
            if (Number.isFinite(dailyTokens)) rule.dailyMaxTokens = dailyTokens;
            matchedCount++;
          }
        }
      });
      await sendDiscordMessages(
        channelId,
        matchedCount > 0
          ? `✅ Đã cập nhật hạn mức riêng cho <@${targetUserId}> (${matchedCount} kênh): turns/ngày=\`${Number.isFinite(dailyTurns) ? dailyTurns || "∞" : "giữ nguyên"}\`, cooldown=\`${Number.isFinite(cooldownSec) ? `${cooldownSec}s` : "giữ nguyên"}\`, token/ngày=\`${Number.isFinite(dailyTokens) ? dailyTokens || "∞" : "giữ nguyên"}\`.`
          : `Không tìm thấy kênh riêng của <@${targetUserId}> trong \`channelRules\`.`
      );
      return;
    }

    await updateConfigFile((raw) => {
      if (!raw.memberLimits || typeof raw.memberLimits !== "object") raw.memberLimits = {};
      if (Number.isFinite(dailyTurns)) raw.memberLimits.dailyMaxTurns = dailyTurns;
      if (Number.isFinite(cooldownSec)) raw.memberLimits.cooldownSec = cooldownSec;
      if (Number.isFinite(dailyTokens)) raw.memberLimits.dailyMaxTokens = dailyTokens;
    });
    const lim = config.memberLimits;
    await sendDiscordMessages(
      channelId,
      `✅ Đã cập nhật hạn mức Member toàn server: **${lim.dailyMaxTurns || "∞"}** lượt/ngày | cooldown **${lim.cooldownSec}s** | token/ngày **${lim.dailyMaxTokens ? formatNumber(lim.dailyMaxTokens) : "∞"}**.`
    );
    return;
  }

  if (sub === "security") {
    let memberMode = "";
    let blockBypass = "";
    let workspaceMaxMb;
    for (const tok of tokens.slice(1)) {
      const idx = tok.indexOf(":");
      if (idx === -1) {
        const low = tok.toLowerCase();
        if (low === "auto" || low === "plan") memberMode = low;
        else if (low === "on" || low === "off") blockBypass = low;
        else if (/^\d+$/.test(low)) workspaceMaxMb = Math.max(0, Math.floor(Number(low)));
        continue;
      }
      const k = tok.slice(0, idx).toLowerCase();
      const v = tok.slice(idx + 1).trim().toLowerCase();
      if (k === "member_mode" && (v === "auto" || v === "plan")) memberMode = v;
      else if (k === "block_bypass_sandbox" && (v === "on" || v === "off")) blockBypass = v;
      else if (k === "workspace_max_mb") workspaceMaxMb = Math.max(0, Math.floor(Number(v)));
    }

    if (!memberMode && !blockBypass && !Number.isFinite(workspaceMaxMb)) {
      const lim = config.memberLimits;
      await sendDiscordMessages(
        channelId,
        [
          "**Cấu hình an toàn Member hiện tại:**",
          `• **Mode mặc định phòng thành viên (\`autoOnboard.mode\`):** \`${config.autoOnboard?.mode || "auto"}\``,
          `• **Chặn & báo Admin khi \`BypassSandbox\`:** \`${lim.blockBypassSandbox !== false ? "on" : "off"}\``,
          `• **Giới hạn dung lượng thư mục Member:** \`${lim.workspaceMaxMb ? `${lim.workspaceMaxMb} MB` : "∞"}\``,
        ].join("\n")
      );
      return;
    }

    let updatedRules = 0;
    await updateConfigFile((raw) => {
      if (!raw.autoOnboard || typeof raw.autoOnboard !== "object") raw.autoOnboard = {};
      if (!raw.memberLimits || typeof raw.memberLimits !== "object") raw.memberLimits = {};
      if (memberMode) {
        raw.autoOnboard.mode = memberMode;
        if (raw.channelRules && typeof raw.channelRules === "object") {
          for (const rule of Object.values(raw.channelRules)) {
            if (rule && !rule.allowAdminOnly) {
              rule.mode = memberMode;
              updatedRules++;
            }
          }
        }
      }
      if (blockBypass) raw.memberLimits.blockBypassSandbox = blockBypass === "on";
      if (Number.isFinite(workspaceMaxMb)) raw.memberLimits.workspaceMaxMb = workspaceMaxMb;
    });
    const lim = config.memberLimits;
    await sendDiscordMessages(
      channelId,
      `✅ Đã cập nhật bảo mật Member: mode=\`${config.autoOnboard?.mode || "auto"}\`${memberMode ? ` *(áp dụng cho ${updatedRules} kênh thành viên)*` : ""} | chặn \`BypassSandbox\`=\`${lim.blockBypassSandbox ? "on" : "off"}\` | dung lượng phòng=\`${lim.workspaceMaxMb ? `${lim.workspaceMaxMb} MB` : "∞"}\`.`
    );
    return;
  }

  if (sub === "report") {
    const tokens = splitCommandArgs(argStr);
    let parsedAction = "status";
    let rawTime = "";
    let rawChannelId = "";

    for (const tok of tokens.slice(1)) {
      const idx = tok.indexOf(":");
      if (idx === -1) {
        const low = tok.toLowerCase();
        if (["status", "now", "on", "off"].includes(low)) parsedAction = low;
        else {
          const cid = extractSnowflakeId(tok);
          if (cid) rawChannelId = cid;
          else if (!rawTime) rawTime = tok;
        }
        continue;
      }
      const k = tok.slice(0, idx).toLowerCase();
      const v = tok.slice(idx + 1).trim();
      if (k === "action" && ["status", "now", "on", "off"].includes(v.toLowerCase())) parsedAction = v.toLowerCase();
      else if (k === "time") rawTime = v;
      else if (k === "channel") rawChannelId = extractSnowflakeId(v);
      else if (/^\d{1,2}:\d{2}$/.test(tok)) rawTime = tok;
    }

    if (rawTime && !parseDailyReportTime(rawTime)) {
      await sendDiscordMessages(channelId, "⚠️ Giờ không hợp lệ. Dùng định dạng 24h `HH:MM`, ví dụ `/access report on 22:00`.");
      return;
    }

    if (parsedAction === "now") {
      await sendDailyAdminReport({ channelIdOverride: rawChannelId || channelId });
      return;
    }

    if (parsedAction === "on" || parsedAction === "off" || rawTime || rawChannelId) {
      const nextEnabled = parsedAction === "on" ? true : parsedAction === "off" ? false : config.dailyReport?.enabled === true;
      const normTime = rawTime ? parseDailyReportTime(rawTime).formatted : config.dailyReport?.time || "22:00";
      await updateConfigFile((raw) => {
        if (!raw.dailyReport || typeof raw.dailyReport !== "object") raw.dailyReport = {};
        raw.dailyReport.enabled = nextEnabled;
        raw.dailyReport.time = normTime;
        if (rawChannelId) raw.dailyReport.channelId = rawChannelId;
      });
      const rCfg = config.dailyReport;
      const destNote = rCfg.channelId ? `<#${rCfg.channelId}>` : config.freeChatChannelId ? `<#${config.freeChatChannelId}>` : "#admin / DM";
      await sendDiscordMessages(
        channelId,
        `✅ Báo cáo tổng kết cuối ngày: \`${rCfg.enabled ? "on" : "off"}\` | giờ gửi: \`${rCfg.time}\` | kênh nhận: ${destNote}.`
      );
      return;
    }

    const rCfg = config.dailyReport || normalizeDailyReportConfig({});
    const destNote = rCfg.channelId ? `<#${rCfg.channelId}>` : config.freeChatChannelId ? `<#${config.freeChatChannelId}>` : "#admin / DM";
    const lastSent = state.dailyReport?.lastSentDate ? `Lần gửi gần nhất: \`${state.dailyReport.lastSentDate}\`` : "Chưa gửi tự động lần nào";
    await sendDiscordMessages(
      channelId,
      [
        "**Cấu hình báo cáo tổng kết cuối ngày:**",
        `• Trạng thái: \`${rCfg.enabled ? "on" : "off"}\` | Giờ gửi: \`${rCfg.time}\` | Kênh nhận: ${destNote}`,
        `• ${lastSent}`,
        "• Dùng `/access report now` để xem ngay, hoặc `/access report on 22:00` để bật tự động.",
      ].join("\n")
    );
    return;
  }

  await sendDiscordMessages(
    channelId,
    "Cú pháp `/access`: `list`, `onboard`, `offboard`, `auto`, `private`, `model status|auto|set`, `quota`, `security`, `report status|now|on|off`, `channel`, `revoke`, `admin`"
  );
}

/** Handle `/cron` subcommands for inspecting, adding, pausing, resuming, deleting, and manually running jobs. */
async function handleCronCommand(channelId, argStr, route) {
  const tokens = splitCommandArgs(argStr);
  const sub = (tokens[0] || "list").toLowerCase();

  if (sub === "list") {
    await sendDiscordMessages(channelId, cronManager.formatList());
    return;
  }

  if (sub === "add") {
    const restArgs = argStr.slice(tokens[0].length).trim();
    const parsed = parseCronAddInput(restArgs);
    const targetChannelId = parsed.createThread && route.isThread && route.parentId ? route.parentId : channelId;
    const createThread = !route.isDm && parsed.createThread && !(targetChannelId === channelId && route.isThread);
    const job = cronManager.addJob({
      spec: parsed,
      channelId: targetChannelId,
      parentId: createThread ? null : route.parentId,
      createThread,
      createdBy: route.userId || config.allowedUserId,
    });
    await sendDiscordMessages(
      channelId,
      `✅ Đã tạo Cron \`${job.id}\` (\`${job.expr}\`) tại <#${job.channelId}> (${createThread ? "tự tạo Thread" : "chạy trực tiếp"}) — lần chạy kế tiếp: \`${formatLocalTime(job.nextRunAt)}\`.`
    );
    return;
  }

  const jobId = tokens[1] || "";
  if (!jobId) {
    await sendDiscordMessages(
      channelId,
      "Cú pháp `/cron`: `list`, `add`, `pause`, `resume`, `del`, `run`"
    );
    return;
  }

  if (sub === "pause" || sub === "stop") {
    const job = cronManager.pauseJob(jobId);
    await sendDiscordMessages(channelId, job ? `⏸️ Đã tạm dừng Cron \`${job.id}\`.` : `Không tìm thấy Cron \`${jobId}\`.`);
    return;
  }

  if (sub === "resume" || sub === "start") {
    const job = cronManager.resumeJob(jobId);
    await sendDiscordMessages(
      channelId,
      job
        ? `🟢 Đã bật lại Cron \`${job.id}\` (lần chạy kế tiếp: \`${formatLocalTime(job.nextRunAt)}\`).`
        : `Không tìm thấy Cron \`${jobId}\`.`
    );
    return;
  }

  if (sub === "del" || sub === "delete" || sub === "rm") {
    const job = cronManager.deleteJob(jobId);
    await sendDiscordMessages(channelId, job ? `🗑️ Đã xóa Cron \`${job.id}\`.` : `Không tìm thấy Cron \`${jobId}\`.`);
    return;
  }

  if (sub === "run") {
    const res = await cronManager.runNow(jobId);
    if (!res.ok && res.reason === "not_found") {
      await sendDiscordMessages(channelId, `Không tìm thấy Cron \`${jobId}\`.`);
    } else if (!res.ok && res.reason === "already_running") {
      await sendDiscordMessages(channelId, `⏳ Cron \`${res.job.id}\` đang chạy sẵn.`);
    } else {
      await sendDiscordMessages(channelId, `▶️ Đã kích hoạt chạy ngay Cron \`${res.job.id}\` tại <#${res.job.channelId}>.`);
    }
    return;
  }

  await sendDiscordMessages(channelId, `Không rõ thao tác \`/cron ${sub}\`. Dùng \`/cron list\` hoặc \`/cron add\`.`);
}

/** Handle `/webhook` status inspection and synthetic test dispatches. */
async function handleWebhookCommand(channelId, argStr, route) {
  const tokens = splitCommandArgs(argStr);
  const sub = (tokens[0] || "status").toLowerCase();

  if (sub === "status" || sub === "list") {
    await sendDiscordMessages(channelId, webhookServer.formatStatus());
    return;
  }

  if (sub === "test") {
    const hookId = tokens[1] || "";
    const hook = config.webhook?.hooks?.[hookId];
    if (!hookId || !hook) {
      const avail = Object.keys(config.webhook?.hooks || {});
      await sendDiscordMessages(
        channelId,
        avail.length > 0
          ? `Không tìm thấy webhook \`${hookId || "(trống)"}\`. Hiện có: ${avail.map((id) => `\`${id}\``).join(", ")}`
          : "Chưa có hook nào trong `config.json` (`webhook.hooks`)."
      );
      return;
    }
    if (!hook.channelId) {
      await sendDiscordMessages(channelId, `Webhook \`${hookId}\` chưa cấu hình \`channelId\`.`);
      return;
    }
    const samplePayload = JSON.stringify({
      event: "manual_test",
      title: `Manual test: ${hook.id}`,
      triggeredBy: route.userId,
      timestamp: new Date().toISOString(),
    });
    const event = prepareWebhookEvent(hook, samplePayload, "application/json", DISCORD_ATTACHMENTS_DIR);
    await triggerWebhookDispatch(hook, event);
    await sendDiscordMessages(channelId, `🧪 Đã bắn sự kiện test cho webhook \`${hook.id}\` tới <#${hook.channelId}>.`);
    return;
  }

  await sendDiscordMessages(channelId, "Cú pháp: `/webhook status` hoặc `/webhook test <id>`");
}

/** Handle `/chrome` status and isolated Chrome AM shutdown. */
async function handleChromeCommand(channelId, argStr) {
  const sub = (argStr || "status").trim().toLowerCase();
  if (sub === "close" || sub === "stop") {
    const res = await closeChromeAm();
    await sendDiscordMessages(
      channelId,
      res.closedCount > 0
        ? `✅ Đã đóng riêng **Chrome AM** (${res.closedCount} tiến trình: ${res.pids.join(", ")}). Chrome cá nhân không bị ảnh hưởng.`
        : "⚪ **Chrome AM** hiện không chạy."
    );
    return;
  }

  const status = await getChromeAmStatus(500);
  if (!status.running) {
    await sendDiscordMessages(
      channelId,
      `⚪ **Chrome AM** đang tắt (endpoint kiểm tra: \`${CHROME_AM_DEBUG_URL}\`). Chrome AM sẽ tự bật khi có tác vụ web hoặc gọi \`open_in_chrome\`.`
    );
    return;
  }
  const tabs = Array.isArray(status.tabs) ? status.tabs : [];
  const lines = [`🟢 **Chrome AM** đang chạy tại \`${CHROME_AM_DEBUG_URL}\` (**${status.tabCount}** tab):`];
  for (const t of tabs.slice(0, 8)) {
    lines.push(`• ${cleanInlineLabel(t.title || "(untitled)", 55)} — \`${cleanInlineLabel(t.url || "", 70)}\``);
  }
  if (tabs.length > 8) {
    lines.push(`*(...và ${tabs.length - 8} tab khác)*`);
  }
  await sendDiscordMessages(channelId, lines.join("\n"));
}

/** Handle `/windows` inspection, focus, and WM_CLOSE control. */
async function handleWindowsCommand(channelId, argStr) {
  const tokens = splitCommandArgs(argStr);
  const sub = (tokens[0] || "list").toLowerCase();
  if (sub === "list") {
    const res = await manageDesktopWindows("list");
    if (res.windows.length === 0) {
      await sendDiscordMessages(channelId, "*(Không có cửa sổ GUI nào đang mở.)*");
      return;
    }
    const lines = [`**Cửa sổ ứng dụng đang mở (${res.windows.length}):**`];
    for (const w of res.windows.slice(0, 25)) {
      lines.push(`• \`[${w.pid}]\` **${w.processName}** — ${cleanInlineLabel(w.title, 70)}`);
    }
    if (res.windows.length > 25) lines.push(`*(...và ${res.windows.length - 25} cửa sổ khác)*`);
    await sendDiscordMessages(channelId, lines.join("\n"));
    return;
  }

  if (sub === "focus" || sub === "close") {
    const query = argStr.slice(tokens[0].length).trim().replace(/^target:/i, "").replace(/^["']|["']$/g, "");
    if (!query) {
      await sendDiscordMessages(channelId, `Cú pháp: \`/windows ${sub} <pid | tiêu_đề>\``);
      return;
    }
    const opts = /^\d+$/.test(query) ? { pid: Number(query) } : { title: query };
    const res = await manageDesktopWindows(sub, opts);
    if (sub === "close") {
      await sendDiscordMessages(
        channelId,
        res.closed
          ? `✅ Đã gửi lệnh đóng \`[${res.matched.pid}] ${res.matched.processName}\` (${cleanInlineLabel(res.matched.title, 50)}).`
          : `⚠️ Cửa sổ \`${res.matched.processName}\` chưa chấp nhận đóng qua \`WM_CLOSE\`.`
      );
    } else {
      await sendDiscordMessages(
        channelId,
        `✅ Đã focus cửa sổ \`[${res.matched.pid}] ${res.matched.processName}\` (${cleanInlineLabel(res.matched.title, 50)}).`
      );
    }
    return;
  }

  await sendDiscordMessages(channelId, "Cú pháp: `/windows list`, `/windows focus`, hoặc `/windows close`");
}

/** Handle `/logs [lines]` tail inspection with automatic secret redaction. */
async function handleLogsCommand(channelId, argStr) {
  const cleanArg = String(argStr || "").replace(/^lines:/i, "").trim();
  const count = Math.min(80, Math.max(5, Number.parseInt(cleanArg, 10) || 25));
  if (!fs.existsSync(LOG_PATH)) {
    await sendDiscordMessages(channelId, "Chưa có file `bot.log` *(bot có thể đang chạy không kèm cờ `--log`)*.");
    return;
  }
  const raw = fs.readFileSync(LOG_PATH, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const tail = sanitizeLogOutput(lines.slice(-count).join("\n"));
  const clipped = tail.length > 1750 ? `...\n${tail.slice(-1745)}` : tail;
  await sendDiscordMessages(channelId, `**${Math.min(count, lines.length)} dòng log cuối (\`bot.log\`):**\n\`\`\`\n${clipped || "(empty)"}\n\`\`\``);
}

/** Handle `/play` playback and queue controls in guild voice channels. */
async function handleMusicCommand(channelId, argStr, route, msg) {
  if (!msg?.guild_id) {
    await sendDiscordMessages(channelId, "⛔ Lệnh `/play` chỉ sử dụng được bên trong Server Discord.");
    return;
  }
  if (!musicManager) {
    await sendDiscordMessages(channelId, "⚠️ Trình phát nhạc Voice chưa sẵn sàng.");
    return;
  }

  let explicitVoiceChannelId = "";
  const voiceMatch = argStr.match(/(?:^|\s)voice:(?:<#)?(\d{17,22})>?(?=\s|$)/i);
  if (voiceMatch) {
    explicitVoiceChannelId = voiceMatch[1];
  }
  const cleanQuery = argStr
    .replace(/(?:^|\s)voice:(?:<#)?\d{17,22}>?(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanQuery) {
    await sendDiscordMessages(
      channelId,
      [
        "🎵 **Cách dùng `/play`:**",
        "• `/play <link bài hát hoặc playlist YouTube / YT Music / SoundCloud / Spotify>` hoặc `/play <tên bài hát>` — Bot vào kênh Voice của bạn và phát nhạc *(dùng được cả ở `#free-chat`)*",
        "• `/play queue` — Xem bài đang phát và hàng chờ *(tối đa 5 bài tiếp theo)*",
        "• `/play skip` — Chuyển sang bài tiếp theo",
        "• `/play clear` — Xóa toàn bộ hàng chờ *(giữ bài đang phát)*",
        "• `/play pause` / `/play resume` — Tạm dừng hoặc phát tiếp",
        "• `/play stop` — Dừng nhạc, xóa hàng đợi và rời kênh Voice",
      ].join("\n")
    );
    return;
  }

  const lower = cleanQuery.toLowerCase();
  const guildId = String(msg.guild_id);

  if (lower === "queue" || lower === "status" || lower === "list") {
    const res = musicManager.getStatus({ guildId });
    const posted = await sendOrReplaceDiscordMessages(
      channelId,
      res.message || "",
      "",
      null,
      res.components,
      res.embeds
    );
    if (posted?.id && res.components?.length) {
      await musicManager.registerControlMessage(guildId, posted.channel_id || channelId, posted.id);
    }
    return;
  }

  if (lower === "clear" || lower === "clearqueue" || lower === "clear-queue") {
    const res = musicManager.clearQueue({ guildId });
    const posted = await sendOrReplaceDiscordMessages(
      channelId,
      res.message || "",
      "",
      null,
      res.components,
      res.embeds
    );
    if (posted?.id && res.components?.length) {
      await musicManager.registerControlMessage(guildId, posted.channel_id || channelId, posted.id);
    }
    return;
  }

  const modeAliases = {
    shuffle: "shuffle",
    random: "shuffle",
    repeat: "repeat_all",
    "repeat-all": "repeat_all",
    repeatall: "repeat_all",
    loop: "repeat_all",
    "repeat-one": "repeat_one",
    repeatone: "repeat_one",
    repeat1: "repeat_one",
    sequential: "sequential",
    normal: "sequential",
    order: "sequential",
  };
  if (lower === "mode" || Object.hasOwn(modeAliases, lower)) {
    const res =
      lower === "mode"
        ? musicManager.cyclePlayMode({ guildId })
        : musicManager.setPlayMode({ guildId, mode: modeAliases[lower] });
    const posted = await sendOrReplaceDiscordMessages(
      channelId,
      res.ok ? res.message : res.message,
      "",
      null,
      res.components,
      res.embeds
    );
    if (posted?.id && res.components?.length) {
      await musicManager.registerControlMessage(guildId, posted.channel_id || channelId, posted.id);
    }
    return;
  }

  if (lower === "skip" || lower === "next") {
    const res = await musicManager.skip({ guildId });
    await sendDiscordMessages(channelId, res.message);
    return;
  }

  if (lower === "pause") {
    const res = musicManager.setPaused({ guildId, paused: true });
    const posted = await sendOrReplaceDiscordMessages(
      channelId,
      res.ok ? "" : res.message,
      "",
      null,
      res.components,
      res.embeds
    );
    if (posted?.id && res.components?.length) {
      await musicManager.registerControlMessage(guildId, posted.channel_id || channelId, posted.id);
    }
    return;
  }

  if (lower === "resume" || lower === "unpause") {
    const res = musicManager.setPaused({ guildId, paused: false });
    const posted = await sendOrReplaceDiscordMessages(
      channelId,
      res.ok ? "" : res.message,
      "",
      null,
      res.components,
      res.embeds
    );
    if (posted?.id && res.components?.length) {
      await musicManager.registerControlMessage(guildId, posted.channel_id || channelId, posted.id);
    }
    return;
  }

  if (lower === "toggle") {
    const res = musicManager.togglePause({ guildId });
    const posted = await sendOrReplaceDiscordMessages(
      channelId,
      res.ok ? "" : res.message,
      "",
      null,
      res.components,
      res.embeds
    );
    if (posted?.id && res.components?.length) {
      await musicManager.registerControlMessage(guildId, posted.channel_id || channelId, posted.id);
    }
    return;
  }

  if (lower === "stop" || lower === "leave" || lower === "disconnect") {
    const res = await musicManager.stop({ guildId });
    await sendDiscordMessages(channelId, res.message);
    return;
  }

  const requestedByLabel =
    msg.member?.nick || msg.author?.global_name || msg.author?.username || route.userId || "Member";
  const requestedByAvatarUrl = getDiscordUserAvatarUrl(msg.author, msg.member, guildId);
  const res = await musicManager.play({
    guildId,
    userId: String(route.userId || msg.author?.id || ""),
    requestedByLabel,
    requestedByAvatarUrl,
    textChannelId: channelId,
    query: cleanQuery,
    explicitVoiceChannelId,
  });
  const posted = await sendOrReplaceDiscordMessages(
    channelId,
    res.message || "",
    "",
    null,
    res.components,
    res.embeds
  );
  if (posted?.id && res.components?.length) {
    await musicManager.registerControlMessage(guildId, posted.channel_id || channelId, posted.id);
  }
}

/** Handle `/` commands and return true if handled. */
async function handleCommand(channelId, msgContent, route, triggerMsgId = null, msg = null) {
  const trimmed = msgContent.trim();
  if (!trimmed.startsWith("/")) return false;

  const [rawCmd, ...rest] = trimmed.split(/\s+/);
  const cmd = rawCmd.toLowerCase();
  const argStr = trimmed.slice(rawCmd.length).trim();

  if (!canExecuteDiscordCommand(cmd, route)) {
    const allowedList = Array.from(MEMBER_ALLOWED_COMMANDS)
      .filter((c) => canExecuteDiscordCommand(c, route))
      .map((c) => `\`${c}\``);
    if (route.policy?.allowModelChange) allowedList.push("`/model`");
    await sendDiscordMessages(
      channelId,
      `⛔ Lệnh \`${cmd}\` không được phép hoặc chỉ dành cho Admin tại kênh này. Bạn có thể dùng: ${allowedList.join(", ")}.`
    );
    return true;
  }

  const chState = getChannelState(channelId, route.parentId);

  if (cmd === "/help") {
    const chunks = buildHelpMessages(route);
    for (const chunk of chunks) {
      await sendDiscordMessages(channelId, chunk);
    }
    return true;
  }

  if (cmd === "/status") {
    const execPolicy = resolveTurnExecutionPolicy(route.policy, chState, ensureNoProjectDir());
    const projLabel = execPolicy.isAdmin
      ? chState.projectName ||
        chState.projectId ||
        (chState.cwd === AGY_CLI_NO_PROJECT_DIR ? "(không gắn project — chat tự do)" : "(không gắn project ID, dùng cwd)")
      : route.rule?.label || "(kênh chia sẻ theo RBAC)";
    const lines = [
      "**Trạng thái hiện tại:**",
      `• **Quyền phiên:** \`${execPolicy.isAdmin ? "Admin (đầy đủ)" : "Member (kênh riêng tư)"}\``,
      `• **Project:** \`${projLabel}\``,
      ...(execPolicy.isAdmin ? [`• **Thư mục (cwd):** \`${execPolicy.cwd}\``] : []),
      `• **Model:** \`${execPolicy.model}\`${execPolicy.effort ? ` (effort: \`${execPolicy.effort}\`)` : ""}${!execPolicy.isAdmin && route.rule?.model ? " *(khóa bởi Admin)*" : ""}`,
      ...(execPolicy.isAdmin ? [`• **Mode:** \`${execPolicy.mode}\` | **Sandbox:** \`${execPolicy.sandbox ? "on" : "off"}\``] : []),
      `• **Conversation ID:** \`${chState.conversationId || "(chưa có — sẽ tạo mới)"}\``,
      `• **Footer usage:** \`${chState.showFooter ? "on" : "off"}\` | **Stream:** \`${chState.streamProgress !== false ? "on" : "off"}\` | **Auto-thread:** \`${chState.autoThread ? "on" : "off"}\``,
    ];
    if (execPolicy.isAdmin) {
      const enabledCrons = cronManager ? cronManager.listJobs().filter((j) => j.enabled).length : 0;
      const hookAddr = webhookServer?.getAddress();
      const poolStats = globalRunSemaphore.getStats();
      lines.push(
        `• **Global Pool:** \`${poolStats.active}/${poolStats.maxConcurrent}\` đang chạy *(chờ: \`${poolStats.queued}\`)*`,
        `• **Automation Hub:** Cron \`${enabledCrons}\` job bật | Webhook ${hookAddr ? `\`http://${hookAddr.address}:${hookAddr.port}\`` : "`off`"} | RBAC rules \`${Object.keys(config.channelRules || {}).length}\` kênh`
      );
    }
    await sendDiscordMessages(channelId, lines.join("\n"));
    return true;
  }

  if (cmd === "/new") {
    chState.conversationId = null;
    delete chState.chromeGuideInjected;
    saveState();
    await sendDiscordMessages(channelId, "Đã reset hội thoại cho kênh/thread này. Tin nhắn tiếp theo sẽ mở phiên mới.");
    return true;
  }

  if (cmd === "/play") {
    try {
      await handleMusicCommand(channelId, argStr, route, msg);
    } catch (err) {
      await sendDiscordMessages(channelId, `⚠️ Không thể phát nhạc: \`${sanitizeLogOutput(err.message || err)}\``);
    }
    return true;
  }

  if (cmd === "/clear") {
    if (route.isThread && !route.isAdmin && route.rule?.onboardedUserId !== route.userId) {
      const ownsThread = await isThreadOwnedByUser(channelId, route, chState);
      if (!ownsThread) {
        await sendDiscordMessages(channelId, "⛔ Bạn chỉ có thể dùng `/clear` trong kênh riêng hoặc Thread của chính bạn.");
        return true;
      }
    }
    if (clearingChannels.has(channelId)) {
      await sendDiscordMessages(channelId, "Đang dọn tin nhắn ở kênh này, vui lòng đợi xong...");
      return true;
    }
    let maxCount = Infinity;
    const cleanClearArg = argStr.replace(/^count:/i, "").trim();
    if (cleanClearArg && cleanClearArg.toLowerCase() !== "all") {
      if (!/^\d+$/.test(cleanClearArg) || Number(cleanClearArg) <= 0) {
        await sendDiscordMessages(
          channelId,
          "Cú pháp: `/clear` (xóa toàn bộ tin nhắn) hoặc `/clear <số_lượng>` (vd `/clear 30`)."
        );
        return true;
      }
      maxCount = Number(cleanClearArg);
    }

    clearingChannels.add(channelId);
    try {
      const deleted = await clearChannelMessages(channelId, maxCount, route, triggerMsgId);
      console.log(`[clear] Deleted ${deleted} message(s) in channel ${channelId}`);
      const summary = route.isDm
        ? `✅ Đã xóa **${deleted}** tin nhắn của bot trong DM *(Discord không cho phép bot xóa tin nhắn của bạn trong DM)*.`
        : deleted > 0
          ? `✅ Đã dọn **${deleted}** tin nhắn.`
          : "✅ Kênh đã sạch, không có tin nhắn nào trước đó để xóa.";
      if (interactionReplyStorage.getStore()) {
        await sendDiscordMessages(channelId, summary);
      } else {
        const notice = await discordRequest("POST", `/channels/${channelId}/messages`, { content: summary }).catch(() => null);
        if (notice?.id && !route.isDm) {
          setTimeout(() => {
            discordRequest("DELETE", `/channels/${channelId}/messages/${notice.id}`).catch(() => {});
          }, 4500).unref();
        }
      }
    } catch (err) {
      console.error(`[clear] Failed in channel ${channelId}:`, err.message);
      if (err.status === 403) {
        await sendDiscordMessages(
          channelId,
          `⚠️ Bot thiếu quyền để dọn tin nhắn. Hãy cấp quyền **Manage Messages** (và **Read Message History**) cho bot **${getBotDisplayName()}** trong cài đặt Server/kênh rồi thử lại \`/clear\`.`
        );
      } else {
        await sendDiscordMessages(channelId, `⚠️ Không thể dọn tin nhắn: \`${err.message}\``);
      }
    } finally {
      clearingChannels.delete(channelId);
    }
    return true;
  }

  if (cmd === "/delete") {
    if (!route.isThread) {
      await sendDiscordMessages(
        channelId,
        "⛔ Lệnh `/delete` **chỉ được dùng bên trong Thread** (không dùng ở kênh chính như `#admin`, `#projects`, hay phòng riêng). Để dọn tin nhắn ở kênh chính, hãy dùng `/clear`."
      );
      return true;
    }
    if (!route.isAdmin) {
      const ownsThread = await isThreadOwnedByUser(channelId, route, chState);
      if (!ownsThread) {
        await sendDiscordMessages(channelId, "⛔ Bạn chỉ có thể xóa Thread do chính bạn tạo.");
        return true;
      }
    }
    try {
      await deleteDiscordThreadWithCleanup(channelId, route.parentId);
    } catch (err) {
      console.error(`[cleanup] Failed to delete Discord thread ${channelId}:`, err.message);
      await sendDiscordMessages(channelId, `Đã xóa dữ liệu conversation cục bộ, nhưng không xóa được Thread trên Discord: \`${err.message}\``);
    }
    return true;
  }

  if (cmd === "/stop") {
    const running = activeRuns.get(channelId);
    if (!running) {
      await sendDiscordMessages(channelId, "Hiện không có tác vụ nào đang chạy ở kênh/thread này.");
    } else {
      running.abort();
      await sendDiscordMessages(channelId, "Đã gửi tín hiệu dừng tác vụ đang chạy.");
    }
    return true;
  }

  if (cmd === "/projects") {
    const saved = listSavedProjects();
    const lines = ["**Danh sách Antigravity Projects đã lưu:**"];
    if (saved.length === 0) {
      lines.push("*(Không tìm thấy file project nào trong `~/.gemini/config/projects`)*");
    } else {
      for (const p of saved) {
        lines.push(`• **${p.name}** (\`${p.id}\`)${p.folderPath ? ` → \`${p.folderPath}\`` : ""}`);
      }
    }
    lines.push("", `Đang dùng: \`${chState.cwd}\` — đổi bằng \`/project <tên_hoặc_đường_dẫn>\``);
    await sendDiscordMessages(channelId, lines.join("\n"));
    return true;
  }

  if (cmd === "/project") {
    const cleanTarget = argStr.replace(/^target:/i, "").trim();
    if (!cleanTarget) {
      await sendDiscordMessages(
        channelId,
        `Đang dùng \`${chState.cwd}\`. Gõ \`/project <tên | id | đường_dẫn | none>\` để đổi project hoặc chat tự do.`
      );
      return true;
    }
    if (["none", "off", "clear"].includes(cleanTarget.toLowerCase())) {
      chState.projectId = "";
      chState.projectName = "";
      chState.cwd = ensureNoProjectDir();
      chState.conversationId = null;
      saveState();
      await sendDiscordMessages(
        channelId,
        `Đã gỡ project (chat tự do tại \`${chState.cwd}\`) và reset conversation.`
      );
      return true;
    }
    const saved = listSavedProjects();
    const match = saved.find(
      (p) => p.id.toLowerCase() === cleanTarget.toLowerCase() || p.name.toLowerCase() === cleanTarget.toLowerCase()
    );
    if (match) {
      chState.projectId = match.id;
      chState.projectName = match.name;
      if (match.folderPath && fs.existsSync(match.folderPath)) {
        chState.cwd = match.folderPath;
      }
      chState.conversationId = null;
      saveState();
      await sendDiscordMessages(
        channelId,
        `Đã chuyển sang project **${match.name}** (\`${chState.cwd}\`) và reset conversation.`
      );
      return true;
    }

    const resolved = path.resolve(cleanTarget);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      chState.projectId = "";
      chState.projectName = path.basename(resolved);
      chState.cwd = resolved;
      chState.conversationId = null;
      saveState();
      await sendDiscordMessages(channelId, `Đã chuyển thư mục làm việc sang \`${resolved}\` và reset conversation.`);
      return true;
    }

    await sendDiscordMessages(channelId, `Không tìm thấy project hoặc thư mục: \`${cleanTarget}\``);
    return true;
  }

  if (cmd === "/models") {
    const res = await runAgy(["models"], chState.cwd);
    const lines = (res.stdout + "\n" + res.stderr)
      .split(/\r?\n/)
      .filter((l) => l.includes("\t"))
      .map((l) => {
        const [id, label] = l.split("\t");
        const mark = id === chState.model ? " ✅" : "";
        return `• \`${id}\` — ${label}${mark}`;
      });
    if (lines.length === 0) {
      await sendDiscordMessages(channelId, `Không lấy được danh sách model:\n\`\`\`\n${res.stdout}\n${res.stderr}\n\`\`\``);
    } else {
      await sendDiscordMessages(channelId, `**Danh sách Model khả dụng:**\n${lines.join("\n")}`);
    }
    return true;
  }

  if (cmd === "/model") {
    const execPolicy = resolveTurnExecutionPolicy(route.policy, chState, ensureNoProjectDir());
    if (!execPolicy.isAdmin && route.rule?.model) {
      await sendDiscordMessages(
        channelId,
        `Model của kênh này đang được Admin khóa cố định tại \`${route.rule.model}\`${route.rule.effort ? ` (effort: \`${route.rule.effort}\`)` : ""}.`
      );
      return true;
    }
    const nextModel = (rest[0] || "").replace(/^model_id:/i, "");
    if (!nextModel) {
      await sendDiscordMessages(channelId, `Model hiện tại: \`${chState.model}\`.`);
      return true;
    }
    chState.model = nextModel;
    chState.effort = "";
    saveState();
    await sendDiscordMessages(channelId, `Đã đổi model sang \`${chState.model}\`.`);
    return true;
  }

  if (cmd === "/mode") {
    const next = (rest[0] || "").replace(/^mode:/i, "").toLowerCase();
    if (!VALID_MODES.has(next)) {
      await sendDiscordMessages(channelId, `Mode hiện tại: \`${chState.mode}\`. Hợp lệ: \`accept-edits\`, \`auto\`, \`plan\`.`);
      return true;
    }
    chState.mode = next;
    saveState();
    await sendDiscordMessages(channelId, `Đã đổi mode sang \`${chState.mode}\`.`);
    return true;
  }

  if (cmd === "/sandbox") {
    const val = (rest[0] || "").replace(/^state:/i, "").toLowerCase();
    if (val === "on" || val === "true") chState.sandbox = true;
    else if (val === "off" || val === "false") chState.sandbox = false;
    else {
      await sendDiscordMessages(channelId, `Sandbox hiện tại: \`${chState.sandbox ? "on" : "off"}\`. Dùng \`/sandbox on\` hoặc \`/sandbox off\`.`);
      return true;
    }
    saveState();
    await sendDiscordMessages(channelId, `Đã đặt sandbox = \`${chState.sandbox ? "on" : "off"}\`.`);
    return true;
  }

  if (cmd === "/footer" || cmd === "/autothread" || cmd === "/stream") {
    const toggleSpec =
      cmd === "/footer"
        ? { label: "Footer usage", configKey: "showFooter", stateKey: "showFooter", syncChildren: true }
        : cmd === "/autothread"
          ? { label: "Auto-thread ở kênh chính", configKey: "autoThreadInChannel", stateKey: "autoThread", syncChildren: false }
          : { label: "Stream tiến độ từng bước", configKey: "streamProgress", stateKey: "streamProgress", syncChildren: true };

    let val = "";
    let scope = "channel";
    for (const tok of rest) {
      const lower = tok.toLowerCase();
      if (lower === "on" || lower === "off") val = lower;
      else if (lower === "state:on" || lower === "state:off") val = lower.slice(6);
      else if (lower === "all" || lower === "server" || lower === "global" || lower === "scope:all") scope = "all";
      else if (lower === "scope:channel" || lower === "channel") scope = "channel";
    }

    const currentGlobal = config[toggleSpec.configKey] !== false;
    const currentChannel = chState[toggleSpec.stateKey] !== false;
    const nextVal = val === "on" ? true : val === "off" ? false : scope === "all" ? !currentGlobal : !currentChannel;

    if (scope === "all") {
      await updateConfigFile((raw) => {
        raw[toggleSpec.configKey] = nextVal;
      });
      let updatedCount = 0;
      for (const c of Object.values(state.channels)) {
        if (c && typeof c === "object") {
          c[toggleSpec.stateKey] = nextVal;
          updatedCount += 1;
        }
      }
      saveState();
      await sendDiscordMessages(
        channelId,
        `✅ Đã đặt **${toggleSpec.label}** = \`${nextVal ? "on" : "off"}\` cho **toàn server** *(áp dụng ngay cho ${updatedCount} kênh/Thread hiện có và mặc định các phòng mới)*.`
      );
      return true;
    }

    chState[toggleSpec.stateKey] = nextVal;
    let childCount = 0;
    if (toggleSpec.syncChildren && !route?.isThread) {
      for (const c of Object.values(state.channels)) {
        if (c && c.parentId === channelId) {
          c[toggleSpec.stateKey] = nextVal;
          childCount += 1;
        }
      }
    }
    saveState();
    const childNote = childCount > 0 ? ` *(đã đồng bộ luôn ${childCount} Thread trong kênh)*` : "";
    await sendDiscordMessages(channelId, `${toggleSpec.label}: \`${nextVal ? "on" : "off"}\`${childNote}.`);
    return true;
  }

  if (cmd === "/usage") {
    const t = chState.totals || emptyUsage();
    const s = state.sessionTotals || emptyUsage();
    const last = chState.lastUsage;
    const lines = [
      "**Thống kê Token Usage (từ `agy --output-format json`):**",
      last
        ? `• **Lượt gần nhất:** in \`${formatNumber(last.input_tokens)}\` | out \`${formatNumber(last.output_tokens)}\` | thinking \`${formatNumber(last.thinking_tokens)}\` | cache \`${formatNumber(last.cache_read_tokens)}\` | total \`${formatNumber(last.total_tokens)}\``
        : "• **Lượt gần nhất:** *(chưa có dữ liệu)*",
      `• **Kênh/Thread này (${t.turns} lượt):** total \`${formatNumber(t.total_tokens)}\` tokens (${t.duration_seconds.toFixed(1)}s)`,
      ...(route.isAdmin
        ? [
            `• **Tổng toàn bot (${s.turns} lượt):** total \`${formatNumber(s.total_tokens)}\` tokens (${s.duration_seconds.toFixed(1)}s)`,
            "• *Lưu ý: Để xem % quota tổng theo tài khoản & AI Credits, mở terminal chạy `agy` rồi gõ `/usage`.*",
          ]
        : route.userId
          ? (() => {
              const quota = checkMemberQuota({
                state,
                userId: route.userId,
                rule: route.rule,
                globalLimits: config.memberLimits,
              });
              const lim = quota.limits;
              const turnsNote =
                lim.dailyMaxTurns > 0
                  ? `${quota.usage.turns}/${lim.dailyMaxTurns} lượt (còn **${Math.max(0, lim.dailyMaxTurns - quota.usage.turns)}**)`
                  : `${quota.usage.turns} lượt (không giới hạn)`;
              const tokNote =
                lim.dailyMaxTokens > 0
                  ? ` | ${formatNumber(quota.usage.tokens)}/${formatNumber(lim.dailyMaxTokens)} tokens`
                  : ` | ${formatNumber(quota.usage.tokens)} tokens`;
              const diskLines = [];
              const workspacePath = route.rule?.cwd || chState.cwd || "";
              if (lim.workspaceMaxMb > 0 && workspacePath) {
                const usedBytes = getDirectorySizeBytes(workspacePath);
                const maxBytes = lim.workspaceMaxMb * 1024 * 1024;
                diskLines.push(`• **Dung lượng thư mục riêng:** ${formatByteSize(usedBytes)} / ${formatByteSize(maxBytes)}`);
              }
              return [`• **Hạn mức hôm nay của bạn:** ${turnsNote}${tokNote}`, ...diskLines];
            })()
          : []),
    ];
    await sendDiscordMessages(channelId, lines.join("\n"));
    return true;
  }

  if (cmd === "/guide") {
    const forceReset = rest[0]?.toLowerCase() === "reset";
    try {
      const result = await syncGuideChannel({ forceReset });
      if (result.status === "disabled") {
        await sendDiscordMessages(channelId, "Chức năng đồng bộ kênh hướng dẫn đang tắt (`guideChannelName` trống).");
      } else if (result.status === "not_found") {
        await sendDiscordMessages(
          channelId,
          `Không tìm thấy kênh \`#${result.expectedName}\`. Hãy tạo kênh Text tên \`${result.expectedName}\` trên server (và cấp quyền cho bot **${getBotDisplayName()}**) rồi chạy lại \`/guide\`.`
        );
      } else if (result.status === "unchanged") {
        await sendDiscordMessages(channelId, `✅ Hướng dẫn trong <#${result.channelId}> đã là bản mới nhất.`);
      } else if (result.status === "updated") {
        await sendDiscordMessages(channelId, `✅ Đã cập nhật nội dung hướng dẫn mới nhất trong <#${result.channelId}>.`);
      } else {
        await sendDiscordMessages(channelId, `✅ Đã đăng hướng dẫn (${result.count} phần) sang <#${result.channelId}>.`);
      }
    } catch (err) {
      console.error("[guide] Sync command failed:", err.message);
      if (err.status === 403) {
        const botName = getBotDisplayName();
        await sendDiscordMessages(
          channelId,
          `⚠️ Bot **${botName}** thiếu quyền ghi/dọn trong kênh \`#${config.guideChannelName || "instructions"}\`. Hãy bật **View Channel**, **Send Messages**, **Read Message History**, **Manage Messages** cho **${botName}** trong kênh đó rồi chạy lại \`/guide\`.`
        );
      } else {
        await sendDiscordMessages(channelId, `⚠️ Không thể đồng bộ hướng dẫn: \`${err.message}\``);
      }
    }
    return true;
  }

  try {
    if (cmd === "/reload") {
      await reloadBridgeConfig();
      const addr = webhookServer?.getAddress();
      await sendDiscordMessages(
        channelId,
        `✅ Đã tải lại \`config.json\` (${Object.keys(config.channelRules).length} channel rule, ${Object.keys(config.webhook.hooks).length} webhook, Webhook Server: ${config.webhook.enabled ? (addr ? `\`http://${addr.address}:${addr.port}\`` : "lỗi cổng") : "`off`"}).`
      );
      return true;
    }

    if (cmd === "/access") {
      await handleAccessCommand(channelId, argStr, msg);
      return true;
    }

    if (cmd === "/cron") {
      await handleCronCommand(channelId, argStr, route);
      return true;
    }

    if (cmd === "/webhook") {
      await handleWebhookCommand(channelId, argStr, route);
      return true;
    }

    if (cmd === "/chrome") {
      await handleChromeCommand(channelId, argStr);
      return true;
    }

    if (cmd === "/windows") {
      await handleWindowsCommand(channelId, argStr);
      return true;
    }

    if (cmd === "/cleanup") {
      const removedTemp = pruneOldTempFiles(DISCORD_TEMP_DIR, 0);
      const removedAttach = pruneOldDiscordAttachments();
      channelMetaCache.clear();
      await sendDiscordMessages(
        channelId,
        `🧹 Đã dọn xong: xóa **${removedTemp}** file tạm trong \`discord-temp\`, **${removedAttach}** tệp đính kèm quá hạn (>7 ngày) và làm mới cache kênh.`
      );
      return true;
    }

    if (cmd === "/logs") {
      await handleLogsCommand(channelId, argStr);
      return true;
    }
  } catch (err) {
    await sendDiscordMessages(channelId, `⚠️ Lỗi thực thi \`${cmd}\`: \`${sanitizeLogOutput(err.message || err)}\``);
    return true;
  }

  await sendDiscordMessages(channelId, `Không rõ lệnh \`${cmd}\`. Chọn \`/help\` để xem danh sách lệnh.`);
  return true;
}

/** Run a prompt against agy inside a serialized per-channel queue. */
function enqueuePrompt(channelId, prompt, parentId = null) {
  const prev = channelQueues.get(channelId) || Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(() => processPrompt(channelId, prompt, parentId));
  channelQueues.set(channelId, next);
  return next;
}

const STREAM_EDIT_INTERVAL_MS = 1400;
const STREAM_HEARTBEAT_INTERVAL_MS = 5000;
const STREAM_MAX_VISIBLE_STEPS = 8;

const MCP_ACTION_LABELS = {
  open_in_chrome: "Mở Chrome AM",
  open_app: "Mở ứng dụng",
  open_desktop_target: "Mở trên desktop",
  send_to_discord: "Gửi file lên Discord",
  text_to_speech: "Tạo audio đọc",
  capture_desktop: "Chụp màn hình desktop",
  desktop_clipboard: "Đọc/ghi Clipboard",
  desktop_windows: "Quản lý cửa sổ Desktop",
  list_pages: "Xem danh sách tab Chrome",
  new_page: "Mở tab Chrome mới",
  navigate_page: "Chuyển trang Chrome",
  click: "Click trên trang",
  fill: "Điền ô nhập",
  fill_form: "Điền biểu mẫu",
  type_text: "Gõ văn bản",
  take_screenshot: "Chụp ảnh trang",
  take_snapshot: "Đọc cấu trúc trang",
  evaluate_script: "Chạy script trên trang",
  press_key: "Nhấn phím",
  wait_for: "Đợi phần tử/nội dung",
  hover: "Di chuột trên trang",
};

/** Pick the first non-empty string property among candidate parameter keys. */
function pickToolParam(params, keys) {
  if (!params || typeof params !== "object") return "";
  for (const key of keys) {
    const val = params[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

/** Format elapsed milliseconds concisely as seconds or minutes+seconds. */
function formatElapsedSeconds(elapsedMs) {
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/** Convert an agy tool call event into a concise Vietnamese progress label. */
function describeAgyToolStep(toolName, rawParams = {}) {
  let effectiveName = String(toolName || "tool");
  let params = rawParams && typeof rawParams === "object" ? rawParams : {};

  if (effectiveName === "call_mcp_tool" && params.ToolName) {
    effectiveName = String(params.ToolName);
    if (typeof params.Arguments === "string") {
      try {
        const parsedArgs = JSON.parse(params.Arguments);
        if (parsedArgs && typeof parsedArgs === "object") params = parsedArgs;
      } catch {
        // Keep original params
      }
    } else if (params.Arguments && typeof params.Arguments === "object") {
      params = params.Arguments;
    }
  } else if (effectiveName.startsWith("mcp_")) {
    const stripped = effectiveName.slice(4);
    for (const prefix of ["discord-bridge-desktop_", "chrome-devtools_"]) {
      if (stripped.startsWith(prefix)) {
        effectiveName = stripped.slice(prefix.length);
        break;
      }
    }
  }

  const filePath = pickToolParam(params, ["Path", "path", "AbsolutePath", "TargetFile", "file_path"]);
  const shortFile = shortPathLabel(filePath);
  const startLine = Number.isFinite(params.StartLine) ? params.StartLine : null;
  const endLine = Number.isFinite(params.EndLine) ? params.EndLine : null;
  const lineRange = startLine ? (endLine ? ` (L${startLine}-${endLine})` : ` (L${startLine}+)`) : "";

  if (effectiveName === "read_file" || effectiveName === "view_file") {
    return shortFile ? `Đọc \`${shortFile}\`${lineRange}` : "Đọc file";
  }
  if (
    effectiveName === "edit_file" ||
    effectiveName === "replace_file_content" ||
    effectiveName === "multi_replace_file_content" ||
    effectiveName === "sed_file"
  ) {
    return shortFile ? `Sửa \`${shortFile}\`` : "Sửa file";
  }
  if (effectiveName === "write_file" || effectiveName === "write_to_file") {
    return shortFile ? `Ghi \`${shortFile}\`` : "Ghi file";
  }
  if (effectiveName === "run_command") {
    const cmdText = cleanInlineLabel(pickToolParam(params, ["CommandLine", "command"]), 55);
    return cmdText ? `Chạy \`${cmdText}\`` : "Chạy lệnh terminal";
  }
  if (effectiveName === "command_status") return "Kiểm tra lệnh nền";
  if (effectiveName === "send_command_input") return "Gửi input vào lệnh";
  if (effectiveName === "invoke_subagent") {
    const role = cleanInlineLabel(pickToolParam(params, ["Role", "TypeName"]), 40);
    return role ? `Chạy subagent \`${role}\`` : "Chạy subagent";
  }
  if (effectiveName === "grep_search") {
    const q = cleanInlineLabel(pickToolParam(params, ["Query", "query"]), 35);
    const dir = shortPathLabel(pickToolParam(params, ["SearchPath", "SearchDirectory", "path"]));
    return q ? `Tìm \`${q}\`${dir ? ` trong \`${dir}\`` : ""}` : "Tìm kiếm trong code";
  }
  if (effectiveName === "find_by_name") {
    const pat = cleanInlineLabel(pickToolParam(params, ["Pattern", "pattern"]), 35);
    return pat ? `Tìm file \`${pat}\`` : "Tìm file theo tên";
  }
  if (effectiveName === "list_dir") {
    const dir = shortPathLabel(pickToolParam(params, ["DirectoryPath", "path", "Path"])) || ".";
    return `Xem thư mục \`${dir}\``;
  }
  if (effectiveName === "search_web") {
    const q = cleanInlineLabel(pickToolParam(params, ["query", "Query"]), 45);
    return q ? `Tìm web \`${q}\`` : "Tìm kiếm web";
  }
  if (effectiveName === "read_url_content") {
    const u = cleanInlineLabel(pickToolParam(params, ["Url", "url"]), 45);
    return u ? `Đọc URL \`${u}\`` : "Đọc trang web";
  }
  if (effectiveName in MCP_ACTION_LABELS) {
    let arg = cleanInlineLabel(
      pickToolParam(params, ["action", "path", "url", "app", "target", "selector", "uid", "name", "text"]),
      40
    );
    if (!arg && effectiveName === "send_to_discord" && Array.isArray(params.paths) && params.paths.length > 0) {
      const first = shortPathLabel(params.paths[0]);
      arg = params.paths.length > 1 ? `${params.paths.length} file (${first})` : first;
    } else if (effectiveName === "send_to_discord" && arg) {
      arg = shortPathLabel(arg);
    }
    return arg ? `${MCP_ACTION_LABELS[effectiveName]} \`${arg}\`` : MCP_ACTION_LABELS[effectiveName];
  }
  const cleanName = cleanInlineLabel(effectiveName.replace(/^mcp_/, ""), 40);
  return cleanName ? `Dùng tool \`${cleanName}\`` : "Chạy tool";
}

function normalizeStreamStepStatus(state) {
  const s = String(state || "").toUpperCase();
  if (s === "DONE" || s === "COMPLETED" || s === "SUCCESS") return "done";
  if (s === "ERROR" || s === "FAILED" || s === "CANCELLED" || s === "DENIED") return "error";
  return "active";
}

/** Track NDJSON stream events from agy and render compact Discord progress text. */
function createAgyStreamState(turnStartMs = Date.now(), { onBypassSandbox = null } = {}) {
  let conversationId = null;
  let phase = "đang khởi động";
  const toolSteps = new Map();
  let activeResponseStep = null;
  let responsePreview = "";
  let finalResult = null;
  let bypassReported = false;

  const hasActiveTool = () => {
    for (const step of toolSteps.values()) {
      if (step.status === "active") return true;
    }
    return false;
  };

  return {
    getConversationId: () => conversationId,
    getFinalResult: () => finalResult,
    isCompleted: () => finalResult !== null,
    setPhase(nextPhase) {
      if (!nextPhase || phase === nextPhase) return false;
      phase = nextPhase;
      return true;
    },
    handleLine(rawLine) {
      let ev;
      try {
        ev = typeof rawLine === "string" ? JSON.parse(rawLine) : rawLine;
      } catch {
        return false;
      }
      if (!ev || typeof ev !== "object") return false;

      const convId = ev.conversation_id || ev.step_update?.conversation_id || ev.result?.conversation_id;
      if (typeof convId === "string" && convId) conversationId = convId;

      if (ev.event === "init") {
        if (toolSteps.size === 0 && !responsePreview) phase = "đang suy nghĩ";
        return true;
      }

      if (ev.event === "step_update" && ev.step_update && typeof ev.step_update === "object") {
        const su = ev.step_update;
        if (su.step_type === "user_input") return false;

        if (su.step_type === "tool") {
          const idx = su.step_index ?? `tool-${toolSteps.size}`;
          const prev = toolSteps.get(idx);
          const toolName = su.tool_name || su.tool_info?.name || "tool";
          const params = su.tool_info?.parameters || {};
          const isBypassFlag = (v) => v === true || String(v || "").trim().toLowerCase() === "true";
          if (!bypassReported && (isBypassFlag(params?.BypassSandbox) || isBypassFlag(params?.bypass_sandbox))) {
            bypassReported = true;
            if (typeof onBypassSandbox === "function") {
              onBypassSandbox({ toolName, params });
            }
          }
          const computedLabel = describeAgyToolStep(toolName, params);
          const hasRichParams = params && typeof params === "object" && Object.keys(params).length > 0;
          const label = !prev || hasRichParams ? computedLabel : prev.label;
          const status = normalizeStreamStepStatus(su.state);
          const durationSec = typeof su.duration_seconds === "number" ? su.duration_seconds : prev?.durationSec ?? null;
          toolSteps.set(idx, { stepIndex: idx, label, status, durationSec });

          if (hasActiveTool()) phase = "đang xử lý";
          else if (responsePreview) phase = "đang trả lời";
          else phase = "đang tổng hợp";
          return true;
        }

        if (su.step_type === "agent_response") {
          const delta = typeof su.text_delta === "string" ? su.text_delta : "";
          if (delta) {
            if (su.step_index !== activeResponseStep) {
              if (!delta.trim()) return false;
              activeResponseStep = su.step_index;
              responsePreview = delta;
            } else {
              responsePreview += delta;
            }
            responsePreview = responsePreview.replace(/^\r?\n+/, "");
            phase = "đang trả lời";
            return true;
          }
          if (su.state === "ACTIVE" && !responsePreview && !hasActiveTool()) {
            if (phase !== "đang suy nghĩ") {
              phase = "đang suy nghĩ";
              return true;
            }
          }
          return false;
        }

        return false;
      }

      if (ev.event === "result" && ev.result && typeof ev.result === "object") {
        finalResult = ev.result;
        return false;
      }
      return false;
    },
    render(nowMs = Date.now()) {
      const header = `⏳ **${getBotDisplayName()} ${phase}...** *(${formatElapsedSeconds(nowMs - turnStartMs)})*`;
      const allSteps = [...toolSteps.values()];
      const hiddenCount = Math.max(0, allSteps.length - STREAM_MAX_VISIBLE_STEPS);
      const visibleSteps = hiddenCount > 0 ? allSteps.slice(-STREAM_MAX_VISIBLE_STEPS) : allSteps;

      const stepLines = [];
      if (hiddenCount > 0) stepLines.push(`• *(...và ${hiddenCount} bước trước đó)*`);
      for (const step of visibleSteps) {
        const dur = typeof step.durationSec === "number" ? ` *(${step.durationSec.toFixed(1)}s)*` : "";
        if (step.status === "active") stepLines.push(`⏳ ${step.label}...`);
        else if (step.status === "error") stepLines.push(`⚠️ ${step.label}${dur}`);
        else stepLines.push(`✅ ${step.label}${dur}`);
      }

      const head = [header, ...stepLines].join("\n");
      const trimmedPreview = responsePreview.trim();
      if (!trimmedPreview) return head.slice(0, 1950);

      const budget = 1880 - head.length - 4;
      if (budget < 80) return head.slice(0, 1950);

      let preview = trimmedPreview;
      if (preview.length > budget) {
        const tailBudget = Math.max(20, budget - 10);
        const cutIdx = preview.length - tailBudget;
        const omittedFences = (preview.slice(0, cutIdx).match(/```/g) || []).length;
        const tailBody = preview.slice(cutIdx).trimStart();
        preview = omittedFences % 2 === 1 ? `...\n\`\`\`\n${tailBody}` : `...\n${tailBody}`;
      }
      const fenceCount = (preview.match(/```/g) || []).length;
      if (fenceCount % 2 === 1 && head.length + preview.length + 6 <= 1940) {
        preview += "\n```";
      }
      return `${head}\n\n${preview}`.slice(0, 1950);
    },
  };
}

/** Manage throttled, serialized Discord progress message updates during an agy run. */
function createDiscordStreamTracker(channelId, turnStartMs, { onBypassSandbox = null } = {}) {
  const streamState = createAgyStreamState(turnStartMs, { onBypassSandbox });
  let stopped = false;
  let dirty = true;
  let messageId = null;
  let renderedText = "";
  let lastEditAt = 0;
  let inFlight = null;
  let pendingTimer = null;
  let heartbeatTimer = null;

  const scheduleTimer = (delayMs) => {
    if (stopped || pendingTimer || deletedChannels.has(channelId)) return;
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      triggerFlush();
    }, Math.max(0, delayMs));
    pendingTimer.unref?.();
  };

  const runFlush = async () => {
    if (stopped || deletedChannels.has(channelId)) return;
    const text = streamState.render(Date.now());
    if (messageId && text === renderedText) {
      dirty = false;
      return;
    }
    dirty = false;
    try {
      const components = buildStreamingComponents();
      if (!messageId) {
        const sent = await discordRequest("POST", `/channels/${channelId}/messages`, {
          content: text,
          components,
        });
        if (sent?.id) {
          messageId = sent.id;
          renderedText = text;
          lastEditAt = Date.now();
        }
      } else {
        await editDiscordMessage(channelId, messageId, { content: text, components });
        renderedText = text;
        lastEditAt = Date.now();
      }
    } catch (err) {
      if (String(err.message || "").includes("10008")) {
        messageId = null;
      }
      if (!stopped && !deletedChannels.has(channelId)) {
        console.warn(`[stream] Discord progress update failed in ${channelId}:`, err.message);
      }
    }
  };

  const triggerFlush = () => {
    if (stopped || deletedChannels.has(channelId)) return;
    if (inFlight) {
      dirty = true;
      return;
    }
    if (messageId) {
      const waitMs = STREAM_EDIT_INTERVAL_MS - (Date.now() - lastEditAt);
      if (waitMs > 0) {
        dirty = true;
        scheduleTimer(waitMs);
        return;
      }
    }
    inFlight = runFlush().finally(() => {
      inFlight = null;
      if (!stopped && dirty && !deletedChannels.has(channelId)) {
        const waitMs = messageId ? Math.max(0, STREAM_EDIT_INTERVAL_MS - (Date.now() - lastEditAt)) : 0;
        scheduleTimer(waitMs);
      }
    });
  };

  return {
    start() {
      triggerFlush();
      heartbeatTimer = setInterval(() => {
        if (stopped || deletedChannels.has(channelId) || streamState.isCompleted()) return;
        if (!inFlight && Date.now() - lastEditAt >= STREAM_HEARTBEAT_INTERVAL_MS - 300) {
          dirty = true;
          triggerFlush();
        }
      }, STREAM_HEARTBEAT_INTERVAL_MS);
      heartbeatTimer.unref?.();
    },
    onLine(line) {
      const changed = streamState.handleLine(line);
      if (changed && !stopped && !streamState.isCompleted()) {
        dirty = true;
        triggerFlush();
      }
    },
    setPhase(nextPhase) {
      if (streamState.setPhase(nextPhase) && !stopped && !streamState.isCompleted()) {
        dirty = true;
        triggerFlush();
      }
    },
    async close() {
      stopped = true;
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (inFlight) {
        await inFlight.catch(() => {});
      }
      return {
        messageId,
        conversationId: streamState.getConversationId(),
        finalResult: streamState.getFinalResult(),
      };
    },
  };
}

/** Extract informative failure details, prioritizing stderr and ignoring noisy NDJSON progress events. */
function formatAgyFailureOutput(stdout, stderr, maxLen = 1700) {
  const cleanStderr = String(stderr || "").trim();
  const stdoutLines = String(stdout || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const meaningfulStdoutLines = stdoutLines.filter((line) => {
    if (!line.startsWith("{")) return true;
    try {
      const ev = JSON.parse(line);
      return ev?.event !== "init" && ev?.event !== "step_update";
    } catch {
      return true;
    }
  });
  const extraOut = (meaningfulStdoutLines.length > 0 ? meaningfulStdoutLines : stdoutLines.slice(-3)).join("\n");
  const combined = [cleanStderr, extraOut].filter(Boolean).join("\n");
  if (!combined) return "(no output)";
  return combined.length > maxLen ? `...\n${combined.slice(-(maxLen - 4))}` : combined;
}

/** Send a security or sandbox-bypass alert directly to #admin (or Root Admin DM). */
async function notifyAdminSecurityAlert(message) {
  const adminChId = config.freeChatChannelId || config.allowedChannelIds?.[0] || "";
  if (adminChId) {
    await discordRequest("POST", `/channels/${adminChId}/messages`, { content: message }).catch(() => {});
    return;
  }
  if (!config.allowedUserId) return;
  try {
    const dm = await discordRequest("POST", "/users/@me/channels", { recipient_id: config.allowedUserId });
    if (dm?.id) {
      await discordRequest("POST", `/channels/${dm.id}/messages`, { content: message }).catch(() => {});
    }
  } catch {
    // Ignore DM fallback error
  }
}

/** Build and deliver the zero-token daily admin summary to #admin (or configured target channel). */
async function sendDailyAdminReport({ channelIdOverride = "", nowMs = Date.now() } = {}) {
  let targetChId = channelIdOverride || config.dailyReport?.channelId || config.freeChatChannelId || config.allowedChannelIds?.[0] || "";
  if (!targetChId && config.allowedUserId) {
    const dm = await discordRequest("POST", "/users/@me/channels", { recipient_id: config.allowedUserId }).catch(() => null);
    if (dm?.id) targetChId = dm.id;
  }
  if (!targetChId) return;
  const chunks = buildDailyReportMessages({ state, config, nowMs });
  for (const chunk of chunks) {
    await sendDiscordMessages(targetChId, chunk);
  }
}

/** Check Member cooldown, daily turn/token limits, and workspace disk quota before running agy. */
async function enforceMemberLimits(route, replyChannelId, { silent = false } = {}) {
  if (!route || route.isAdmin || !route.userId) return { allowed: true };

  const quota = checkMemberQuota({
    state,
    userId: route.userId,
    rule: route.rule,
    globalLimits: config.memberLimits,
  });
  if (!quota.allowed) {
    if (!silent) {
      await discordRequest("POST", `/channels/${replyChannelId}/messages`, { content: quota.message }).catch(() => {});
    }
    return { allowed: false, message: quota.message };
  }

  const maxMb = quota.limits.workspaceMaxMb;
  const fixedCwd = route.policy?.fixedCwd;
  if (maxMb > 0 && fixedCwd) {
    const usedBytes = getDirectorySizeBytes(fixedCwd);
    const maxBytes = maxMb * 1024 * 1024;
    if (usedBytes >= maxBytes) {
      const msgText = `⛔ Thư mục phòng riêng đã đạt giới hạn dung lượng (**${formatByteSize(usedBytes)} / ${maxMb} MB**). Vui lòng nhờ Admin dọn bớt file hoặc tăng hạn mức.`;
      if (!silent) {
        await discordRequest("POST", `/channels/${replyChannelId}/messages`, { content: msgText }).catch(() => {});
      }
      return { allowed: false, message: msgText };
    }
  }

  recordMemberTurnAccepted(state, route.userId);
  saveState();
  return { allowed: true };
}

/** Execute a user/automation prompt (with optional attachments & RBAC policy) through agy CLI and reply on Discord. */
async function processPrompt(channelId, input, parentId) {
  if (deletedChannels.has(channelId)) return;
  const chState = getChannelState(channelId, parentId);
  const spec = typeof input === "string" ? { prompt: input, attachments: [], messageId: null } : input || {};
  const rawPrompt = String(spec.prompt || "").trim();
  const rawAttachments = Array.isArray(spec.attachments) ? spec.attachments : [];
  const replyContext = spec.replyContext || null;
  const execPolicy = resolveTurnExecutionPolicy(spec.policy, chState, ensureNoProjectDir());

  if (!spec.skipLastPromptSave && (rawPrompt || rawAttachments.length > 0 || replyContext)) {
    channelLastPrompts.set(channelId, {
      prompt: rawPrompt,
      attachments: rawAttachments,
      replyContext,
      messageId: spec.messageId || null,
    });
    if (rawPrompt) {
      chState.lastPromptText = rawPrompt.slice(0, 1500);
      saveState();
    }
  }

  const streamEnabled = chState.streamProgress !== false;
  const turnStartMs = Date.now();
  const runId = crypto.randomUUID();
  const priority = Number.isFinite(spec.priority) ? spec.priority : RUN_PRIORITY_USER;
  activeRunSentFiles.set(runId, new Set());
  activeRunPostedChannels.set(runId, new Set());
  activeRunScopes.set(runId, {
    isAdmin: execPolicy.isAdmin,
    allowedMcpTools: execPolicy.allowedMcpTools,
    cwd: execPolicy.cwd,
    channelId,
  });

  let tracker = null;
  let typingTimer = null;
  let releaseSlot = null;
  let releaseAwake = null;
  let bypassSandboxReason = "";
  const queueAbortController = new AbortController();

  const onBypassSandbox = ({ toolName, params }) => {
    if (execPolicy.isAdmin) return;
    const cmdLine = cleanInlineLabel(pickToolParam(params, ["CommandLine", "command"]), 120) || toolName;
    const who = spec.userId ? `<@${spec.userId}> (\`${spec.userId}\`)` : "Member";
    const blocked = config.memberLimits?.blockBypassSandbox !== false;
    console.warn(`[security] Member triggered BypassSandbox in ${channelId} (blocked=${blocked}): ${cmdLine}`);
    recordSecurityAlert(state, { userId: spec.userId, channelId, kind: "bypass_sandbox" });
    saveState();
    notifyAdminSecurityAlert(
      `🛡️ **[Cảnh báo Sandbox]** Phiên của ${who} tại <#${channelId}> vừa cố dùng \`BypassSandbox: true\` (\`${cmdLine}\`) → **${blocked ? "Đã tự động chặn & dừng" : "Đang ghi nhận"}**.`
    ).catch(() => {});
    if (blocked) {
      bypassSandboxReason = cmdLine;
      activeRuns.get(channelId)?.abort?.();
    }
  };

  try {
    if (streamEnabled) {
      tracker = createDiscordStreamTracker(channelId, turnStartMs, { onBypassSandbox });
      if (rawAttachments.length > 0 || replyContext?.attachments?.length > 0) {
        tracker.setPhase("đang tải tệp đính kèm");
      }
      tracker.start();
    } else {
      // Keep Discord "typing..." indicator alive while agy works in batch mode
      const triggerTyping = () => discordRequest("POST", `/channels/${channelId}/typing`).catch(() => {});
      await triggerTyping();
      typingTimer = setInterval(triggerTyping, 8000);
    }

    activeRuns.set(channelId, {
      isQueueWaiter: true,
      abort: () => queueAbortController.abort(),
    });
    try {
      releaseSlot = await globalRunSemaphore.acquire({
        priority,
        signal: queueAbortController.signal,
        onWait: ({ active, maxConcurrent }) => {
          if (tracker) {
            tracker.setPhase(`đang chờ slot (${active}/${maxConcurrent} tác vụ AI đang chạy)`);
          }
        },
      });
    } catch (err) {
      if (activeRuns.get(channelId)?.isQueueWaiter) {
        activeRuns.delete(channelId);
      }
      if (err?.message === "ABORTED") {
        const streamSummary = tracker ? await tracker.close() : null;
        if (!deletedChannels.has(channelId)) {
          await sendOrReplaceDiscordMessages(
            channelId,
            "⏹️ Đã dừng tác vụ đang chờ trong hàng đợi.",
            "",
            streamSummary?.messageId || null,
            []
          );
        }
        return;
      }
      throw err;
    }
    if (activeRuns.get(channelId)?.isQueueWaiter) {
      activeRuns.delete(channelId);
    }
    releaseAwake = sleepInhibitor.acquire();
    if (tracker && rawAttachments.length === 0 && !(replyContext?.attachments?.length > 0)) {
      tracker.setPhase("đang khởi động");
    }

    let promptBody = rawPrompt;
    let attachChannelDir = null;
    let replyAttachmentLines = [];
    if (replyContext?.attachments?.length > 0) {
      const replyAttResult = await downloadIncomingAttachments(
        channelId,
        replyContext.messageId || `reply-${spec.messageId || Date.now()}`,
        replyContext.attachments
      );
      if (replyAttResult.channelDir) attachChannelDir = replyAttResult.channelDir;
      replyAttachmentLines = replyAttResult.lines;
      if (deletedChannels.has(channelId)) {
        if (tracker) await tracker.close();
        return;
      }
    }

    promptBody = formatPromptWithReplyContext({
      prompt: rawPrompt,
      replyContext,
      replyAttachmentLines,
    });

    let promptWithAttachments = promptBody;
    if (rawAttachments.length > 0) {
      const attResult = await downloadIncomingAttachments(channelId, spec.messageId, rawAttachments);
      if (attResult.channelDir) attachChannelDir = attResult.channelDir;
      if (deletedChannels.has(channelId)) {
        if (tracker) await tracker.close();
        return;
      }
      const headerNote =
        attResult.downloaded.length > 0 || replyAttachmentLines.length > 0
          ? "[Discord Attachment Note: Use read_file on localPath to inspect images/PDF/audio/video or read text files directly (or inspect spreadsheets/binary files via python/node).]"
          : "";
      const baseText =
        promptBody ||
        "Hãy kiểm tra, mô tả và xử lý các tệp/ảnh đính kèm từ Discord bên dưới.";
      promptWithAttachments = [baseText, ...attResult.lines, headerNote].filter(Boolean).join("\n");
      if (tracker) tracker.setPhase("đang khởi động");
    } else if (replyAttachmentLines.length > 0) {
      promptWithAttachments = `${promptBody}\n[Discord Attachment Note: Use read_file on localPath to inspect replied images/PDF/audio/video or read text files directly.]`;
      if (tracker) tracker.setPhase("đang khởi động");
    }

    let chromeStatus = null;
    if (mcpBridgeState && execPolicy.allowChrome && WEB_BROWSER_HINT_RE.test(rawPrompt)) {
      chromeStatus = await getChromeAmStatus(300).catch(() => null);
    }

    const hasSharedTools = fs.existsSync(SHARED_TOOLS_NODE_MODULES);
    const { effectivePrompt, injectedFullWebGuide } = buildEffectivePrompt({
      execPolicy,
      chState,
      prompt: promptWithAttachments,
      hintText: rawPrompt,
      chromeStatus,
      mcpBridgeEnabled: Boolean(mcpBridgeState),
      chromeAmDebugUrl: CHROME_AM_DEBUG_URL,
      sharedToolsReady: hasSharedTools,
    });
    if (injectedFullWebGuide) {
      chState.chromeGuideInjected = true;
    }
    const outputFormat = streamEnabled ? "stream-json" : "json";
    const args = ["-p", effectivePrompt, "--output-format", outputFormat, "--model", execPolicy.model];
    if (execPolicy.mode === "auto") {
      // --mode auto falls back to default in headless CLI; pass documented session settings instead
      args.push(
        "--settings",
        JSON.stringify({
          toolPermission: "always-proceed",
          allowNonWorkspaceAccess: Boolean(execPolicy.allowNonWorkspaceAccess),
          enableTerminalSandbox: Boolean(execPolicy.sandbox),
        })
      );
    } else {
      args.push("--mode", execPolicy.mode);
    }
    if (execPolicy.sandbox) args.push("--sandbox");
    if (execPolicy.effort) args.push("--effort", execPolicy.effort);
    const turnTimeout = resolveTurnTimeout({ execPolicy, config });
    if (turnTimeout) args.push("--print-timeout", turnTimeout);
    if (attachChannelDir) args.push("--add-dir", attachChannelDir);
    if (spec.extraAttachDir && spec.extraAttachDir !== attachChannelDir) {
      args.push("--add-dir", spec.extraAttachDir);
    }
    if (chState.conversationId) {
      args.push("--conversation", chState.conversationId);
    } else if (execPolicy.projectId) {
      args.push("--project", execPolicy.projectId);
    }

    const extraEnv = { AGY_DISCORD_RUN_ID: runId };
    if (hasSharedTools) {
      extraEnv.NODE_PATH = process.env.NODE_PATH
        ? `${SHARED_TOOLS_NODE_MODULES}${path.delimiter}${process.env.NODE_PATH}`
        : SHARED_TOOLS_NODE_MODULES;
    }
    if (Array.isArray(execPolicy.allowedMcpTools)) {
      extraEnv.AGY_DISCORD_ALLOWED_TOOLS = execPolicy.allowedMcpTools.join(",");
    }

    const res = await runAgy(
      args,
      execPolicy.cwd,
      channelId,
      tracker ? (line) => tracker.onLine(line) : null,
      extraEnv
    );
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = null;
    }

    const streamSummary = tracker ? await tracker.close() : null;
    const progressMessageId = streamSummary?.messageId || null;
    const turnDurationSec = (Date.now() - turnStartMs) / 1000;

    if (deletedChannels.has(channelId)) {
      const convId =
        parseAgyOutput(res.stdout)?.conversation_id ||
        streamSummary?.conversationId ||
        extractConversationIdFromAgyStdout(res.stdout);
      if (convId) deleteAgyConversation(convId);
      return;
    }

    if (res.aborted) {
      chState.lastTurnFailed = true;
      saveState();
      const stopMsg = bypassSandboxReason
        ? `⛔ Tác vụ đã bị tự động dừng vì vượt giới hạn sandbox an toàn (\`BypassSandbox: true\`). Admin đã nhận thông báo.`
        : "⏹️ Đã dừng tác vụ theo yêu cầu.";
      const stopComponents = bypassSandboxReason
        ? []
        : buildResponseActionComponents({ isThread: Boolean(parentId || chState.parentId), includeSummarize: false });
      await finalizeTurnMessage(channelId, progressMessageId, runId, stopMsg, "", stopComponents);
      return;
    }

    const parsed = streamSummary?.finalResult || parseAgyOutput(res.stdout);
    if (parsed) {
      const responseText = typeof parsed.response === "string" ? parsed.response.trim() : "";
      if (parsed.conversation_id) chState.conversationId = parsed.conversation_id;
      chState.lastTurnFailed = !responseText;
      if (parsed.usage) {
        chState.lastUsage = parsed.usage;
        addUsage(chState.totals, parsed.usage, turnDurationSec);
        addUsage(state.sessionTotals, parsed.usage, turnDurationSec);
        if (!execPolicy.isAdmin && spec.userId) {
          recordMemberTurnTokens(state, spec.userId, parsed.usage.total_tokens);
        }
      }
      saveState();

      let replyText;
      if (responseText) {
        replyText = parsed.response;
      } else if (parsed.error) {
        replyText = `⚠️ Lỗi từ \`agy\`: ${parsed.error}`;
      } else {
        const denied = Array.isArray(parsed.denied_actions) && parsed.denied_actions.length
          ? ` Quyền bị chặn: ${parsed.denied_actions.map((d) => d.display_name || d.action).join(", ")}.`
          : "";
        replyText = `⚠️ \`agy\` kết thúc (${parsed.status || "UNKNOWN"}) nhưng không trả về nội dung phản hồi.${denied} (Mode hiện tại: \`${execPolicy.mode}\`).`;
      }
      // Auto-upload any local Markdown image embeds (`![alt](localPath)`) BEFORE final message so reply & buttons sit at the bottom
      let unsentImages = extractUnsentMarkdownImages(replyText, execPolicy.cwd, activeRunSentFiles.get(runId));
      if (!execPolicy.isAdmin && unsentImages.length > 0) {
        const safeAttachDir = path.join(
          DISCORD_ATTACHMENTS_DIR,
          String(channelId || "general").replace(/[^a-zA-Z0-9_-]/g, "") || "general"
        );
        unsentImages = unsentImages.filter(
          (imgPath) =>
            isPathInsideDir(imgPath, execPolicy.cwd) ||
            isPathInsideDir(imgPath, safeAttachDir) ||
            isPathInsideDir(imgPath, DISCORD_TEMP_DIR)
        );
      }
      if (unsentImages.length > 0 && !deletedChannels.has(channelId)) {
        await sendDiscordAttachments(channelId, unsentImages, "", runId).catch((err) => {
          console.warn("[attachments] Auto-upload failed:", err.message);
        });
      }

      const discordReplyText = sanitizeDiscordReplyText(replyText, {
        hideHostPaths: !execPolicy.isAdmin,
        workspaceDir: execPolicy.cwd,
      });
      const footer = formatFooter(chState, parsed, turnDurationSec, execPolicy);
      const actionComponents = buildResponseActionComponents({
        isThread: Boolean(parentId || chState.parentId),
        includeSummarize: Boolean(responseText),
      });
      await finalizeTurnMessage(channelId, progressMessageId, runId, discordReplyText, footer, actionComponents);
      return;
    }

    chState.lastTurnFailed = true;
    saveState();
    const errOutput = formatAgyFailureOutput(res.stdout, res.stderr, 1700);
    await finalizeTurnMessage(
      channelId,
      progressMessageId,
      runId,
      `⚠️ \`agy\` thoát với mã ${res.code}:\n\`\`\`\n${errOutput}\n\`\`\``,
      "",
      buildResponseActionComponents({ isThread: Boolean(parentId || chState.parentId), includeSummarize: false })
    );
  } finally {
    if (typingTimer) clearInterval(typingTimer);
    if (activeRuns.get(channelId)?.isQueueWaiter) {
      activeRuns.delete(channelId);
    }
    releaseSlot?.();
    releaseAwake?.();
    activeRunSentFiles.delete(runId);
    activeRunPostedChannels.delete(runId);
    activeRunScopes.delete(runId);
  }
}

/** Build a Discord thread title (<= 100 chars), prefixed with the active project name when attached. */
function buildThreadTitle(chState, content) {
  const snippet = content.replace(/\s+/g, " ").trim() || "Antigravity Task";
  const rawProj = (
    chState.projectName ||
    chState.projectId ||
    (chState.cwd && chState.cwd !== AGY_CLI_NO_PROJECT_DIR ? path.basename(chState.cwd) : "")
  )
    .replace(/\s+/g, " ")
    .trim();
  if (!rawProj) {
    return snippet.slice(0, 90);
  }
  const projTag = `[${rawProj.slice(0, 32)}] `;
  const maxSnippet = Math.max(20, 95 - projTag.length);
  return `${projTag}${snippet.slice(0, maxSnippet)}`.slice(0, 100);
}

/** Create a starter Discord message + optional Thread for cron jobs and incoming webhooks. */
async function spawnAutomationTarget(baseChannelId, { starterMessage, threadTitle, createThread }) {
  let targetChannelId = baseChannelId;
  let parentId = null;

  if (starterMessage) {
    try {
      const starter = await discordRequest("POST", `/channels/${baseChannelId}/messages`, {
        content: String(starterMessage).slice(0, 1950),
      });
      if (createThread && starter?.id) {
        try {
          const thread = await discordRequest("POST", `/channels/${baseChannelId}/messages/${starter.id}/threads`, {
            name: cleanInlineLabel(threadTitle, 95) || "Automation Task",
            auto_archive_duration: 1440,
          });
          if (thread?.id) {
            targetChannelId = thread.id;
            parentId = baseChannelId;
            channelMetaCache.set(thread.id, thread);
          }
        } catch (err) {
          console.warn("[automation] Failed to create thread, running in channel:", err.message);
        }
      }
    } catch (err) {
      console.warn("[automation] Failed to post starter message:", err.message);
    }
  }

  return { targetChannelId, parentId };
}

/** Execute a scheduled Cron job by spawning a Thread (optional) and queuing an Admin agy prompt. */
async function triggerCronJob(job) {
  if (!job?.channelId || deletedChannels.has(job.channelId)) return;
  const starter = `⏰ **[Cron \`${job.id}\`]** (\`${job.expr}\`)\n> ${cleanInlineLabel(job.prompt, 260)}`;
  const threadTitle = `⏰ [Cron ${job.id}] ${cleanInlineLabel(job.prompt, 70)}`;
  const { targetChannelId, parentId } = await spawnAutomationTarget(job.channelId, {
    starterMessage: starter,
    threadTitle,
    createThread: Boolean(job.createThread),
  });
  await enqueuePrompt(
    targetChannelId,
    { prompt: job.prompt, attachments: [], messageId: null, policy: createAdminPolicy(), priority: RUN_PRIORITY_CRON },
    parentId
  );
}

/** Execute an incoming HTTP Webhook trigger in a scoped diagnosis Thread or target channel. */
async function triggerWebhookDispatch(hook, event) {
  if (!hook?.channelId || deletedChannels.has(hook.channelId)) return;
  const starter = `🚨 **[Webhook \`${hook.id}\`]**${event.titleHint && event.titleHint !== hook.id ? ` — **${event.titleHint}**` : ""}\n> ${cleanInlineLabel(event.summaryPreview, 260)}`;
  const threadTitle = `${hook.threadPrefix || "[Alert]"} ${event.titleHint || hook.id}`;
  const { targetChannelId, parentId } = await spawnAutomationTarget(hook.channelId, {
    starterMessage: starter,
    threadTitle,
    createThread: Boolean(hook.createThread),
  });

  const baseChState = getChannelState(hook.channelId);
  const safeHookCwd = hook.cwd && fs.existsSync(hook.cwd) ? hook.cwd : baseChState.cwd;
  const webhookPolicy = {
    role: "webhook",
    isAdmin: false,
    allowDesktopTools: Boolean(hook.allowDesktopTools),
    allowChrome: Boolean(hook.allowChrome),
    allowNonWorkspaceAccess: Boolean(hook.allowNonWorkspaceAccess),
    allowModelChange: false,
    allowClear: false,
    fixedCwd: safeHookCwd,
    forcedMode: hook.mode || "auto",
    forcedSandbox: hook.sandbox !== false,
    allowedMcpTools: hook.allowDesktopTools ? null : ["send_to_discord"],
  };

  enqueuePrompt(
    targetChannelId,
    {
      prompt: event.prompt,
      attachments: [],
      messageId: null,
      policy: webhookPolicy,
      priority: RUN_PRIORITY_WEBHOOK,
      extraAttachDir: event.attachDir || null,
    },
    parentId
  ).catch((err) => {
    console.error(`[webhook] Unhandled prompt error for '${hook.id}':`, err);
  });
}

/** Handle incoming Discord MESSAGE_CREATE event. */
async function onMessageCreate(msg) {
  const content = (msg.content || "").trim();
  const rawSlashWord = content.startsWith("/") ? content.slice(1).split(/\s+/)[0]?.toLowerCase() || "" : "";
  const route =
    (await authorizeMessage(msg)) ||
    (rawSlashWord === "play" ? await authorizeGuildMusicFallback(msg) : null) ||
    (rawSlashWord === "clear" ? await authorizeAdminFreeChatClearFallback(msg) : null);
  if (!route) return;

  const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
  if (!content && attachments.length === 0) return;

  if (!route.isAnnounceChannel && content.startsWith("!")) {
    const rawBangWord = content.slice(1).split(/\s+/)[0]?.toLowerCase() || "";
    if (SLASH_COMMAND_NAME_SET.has(rawBangWord)) {
      await sendDiscordMessages(
        msg.channel_id,
        "ℹ️ Bot đã chuyển toàn bộ sang **Slash Command (`/`)**. Hãy gõ **`/`** trong ô chat để chọn lệnh có gợi ý tự động."
      );
      return;
    }
  }
  if (content.startsWith("/")) {
    const rawSlashWord = content.slice(1).split(/\s+/)[0]?.toLowerCase() || "";
    if (SLASH_COMMAND_NAME_SET.has(rawSlashWord)) {
      if (route.isAnnounceChannel && rawSlashWord !== "clear") return;
      await handleCommand(msg.channel_id, content, route, msg.id, msg);
      return;
    }
  }
  if (route.isAnnounceChannel) return;

  const limitCheck = await enforceMemberLimits(route, msg.channel_id);
  if (!limitCheck.allowed) return;

  let replyContext = null;
  if (msg.referenced_message) {
    replyContext = extractReplyContext(msg.referenced_message);
  } else if (
    msg.message_reference?.message_id &&
    (!msg.message_reference.channel_id || msg.message_reference.channel_id === msg.channel_id)
  ) {
    const fetchedRef = await discordRequest(
      "GET",
      `/channels/${msg.channel_id}/messages/${msg.message_reference.message_id}`
    ).catch(() => null);
    if (fetchedRef) replyContext = extractReplyContext(fetchedRef);
  }

  // In a top-level server channel, optionally spawn a Thread per prompt for clean context isolation
  let targetChannelId = msg.channel_id;
  let parentId = route.parentId;
  const currentState = getChannelState(msg.channel_id, route.parentId);
  if (!route.isDm && !route.isThread && currentState.autoThread) {
    try {
      const titleSeed = content || attachments.map((a) => a.filename || "attachment").join(", ");
      const titleBase = buildThreadTitle(currentState, titleSeed);
      const thread = await discordRequest("POST", `/channels/${msg.channel_id}/messages/${msg.id}/threads`, {
        name: titleBase,
        auto_archive_duration: 1440,
      });
      if (thread?.id) {
        targetChannelId = thread.id;
        parentId = msg.channel_id;
        channelMetaCache.set(thread.id, thread);
        const threadState = getChannelState(thread.id, msg.channel_id);
        threadState.parentId = msg.channel_id;
        threadState.starterMessageId = String(msg.id);
        if (msg.author?.id) {
          threadState.ownerUserId = String(msg.author.id);
        }
        saveState();
      }
    } catch (err) {
      console.error("[thread] Failed to auto-create thread, replying in channel:", err.message);
    }
  }

  enqueuePrompt(
    targetChannelId,
    { prompt: content, attachments, replyContext, messageId: msg.id, userId: route.userId, policy: route.policy },
    parentId
  ).catch((err) => {
    console.error("[prompt] Unhandled error:", err);
  });
}

/** Fetch and cache `agy models` list for instant Slash Command autocomplete. */
async function getAgyModelsCached(maxAgeMs = 300000) {
  if (cachedAgyModels.length > 0 && Date.now() - cachedAgyModelsAt < maxAgeMs) {
    return cachedAgyModels;
  }
  if (agyModelsFetchPromise) return agyModelsFetchPromise;
  agyModelsFetchPromise = runAgy(["models"], ensureNoProjectDir())
    .then((res) => {
      const list = `${res.stdout || ""}\n${res.stderr || ""}`
        .split(/\r?\n/)
        .filter((l) => l.includes("\t"))
        .map((l) => {
          const [id, label] = l.split("\t");
          return { id: String(id || "").trim(), label: String(label || "").trim() };
        })
        .filter((m) => m.id);
      if (list.length > 0) {
        cachedAgyModels = list;
        cachedAgyModelsAt = Date.now();
      }
      return cachedAgyModels;
    })
    .catch(() => cachedAgyModels)
    .finally(() => {
      agyModelsFetchPromise = null;
    });
  return agyModelsFetchPromise;
}

/** Register/sync Guild Slash Commands (`/`) so Discord clients show instant autocomplete menus. */
async function syncGuildSlashCommands(guildIds, appId, force = false) {
  const effectiveAppId = appId || applicationId || gateway?.botUser?.id || "";
  if (!effectiveAppId) return;
  const targets = (Array.isArray(guildIds) && guildIds.length ? guildIds : Array.from(knownGuildIds)).filter(Boolean);
  if (targets.length === 0) return;
  const syncKey = `${effectiveAppId}:${targets.slice().sort().join(",")}`;
  if (!force && slashSyncedGuildKey === syncKey) return;

  let allOk = true;
  for (const guildId of targets) {
    try {
      const res = await discordRequest(
        "PUT",
        `/applications/${effectiveAppId}/guilds/${guildId}/commands`,
        SLASH_COMMANDS
      );
      const count = Array.isArray(res) ? res.length : SLASH_COMMANDS.length;
      console.log(`[slash] Synced ${count} guild slash command(s) for guild ${guildId}.`);
    } catch (err) {
      allOk = false;
      console.warn(`[slash] Failed to sync guild commands for ${guildId}:`, err.message);
    }
  }
  if (allOk) slashSyncedGuildKey = syncKey;
}

/** Send an immediate Discord Interaction HTTP callback (type 4 message, type 5 defer, or type 8 autocomplete). */
async function replyInteractionCallback(interaction, payload) {
  return discordRequest("POST", `/interactions/${interaction.id}/${interaction.token}/callback`, payload);
}

/** Build a synthetic message object from an Interaction so RBAC/Thread checks share one code path. */
function interactionToSyntheticMessage(interaction) {
  const userObj = interaction.member?.user || interaction.user;
  const resolvedUsers = interaction.data?.resolved?.users
    ? Object.values(interaction.data.resolved.users)
    : [];
  return {
    id: null,
    channel_id: interaction.channel_id,
    guild_id: interaction.guild_id || "",
    author: userObj,
    member: interaction.member || null,
    mentions: resolvedUsers,
  };
}

/** Handle Discord `INTERACTION_CREATE` events for `/` Slash Commands and Autocomplete. */
async function onInteractionCreate(interaction) {
  if (!interaction?.id || !interaction?.token) return;
  const appId = interaction.application_id || applicationId || gateway?.botUser?.id || "";

  if (interaction.type === 4) {
    const { subGroup, subCommand, focused } = parseInteractionOptions(interaction.data);
    const cmdName = String(interaction.data?.name || "").toLowerCase();
    let models = cachedAgyModels;
    if (focused?.name === "model_id" && cachedAgyModels.length === 0) {
      models = await Promise.race([getAgyModelsCached(), sleep(1500).then(() => cachedAgyModels)]);
    }
    const choices = buildAutocompleteChoices({
      commandName: cmdName,
      subGroup,
      subCommand,
      focused,
      models,
      projects: cmdName === "project" ? listSavedProjects() : [],
      cronJobs: cmdName === "cron" && cronManager ? cronManager.listJobs() : [],
      webhookIds: cmdName === "webhook" ? Object.keys(config.webhook?.hooks || {}) : [],
    });
    await replyInteractionCallback(interaction, { type: 8, data: { choices } }).catch(() => {});
    return;
  }

  if (interaction.type === 3) {
    const customId = String(interaction.data?.custom_id || "");
    const syntheticMsg = interactionToSyntheticMessage(interaction);
    const isMusicButton = customId.startsWith("music:");
    const route =
      (await authorizeMessage(syntheticMsg)) ||
      (isMusicButton ? await authorizeGuildMusicFallback(syntheticMsg) : null);
    if (!route || route.isAnnounceChannel) {
      await replyInteractionCallback(interaction, {
        type: 4,
        data: { content: "⛔ Bạn không có quyền dùng nút này tại đây.", flags: 64 },
      }).catch(() => {});
      return;
    }

    const channelId = interaction.channel_id;
    const chState = getChannelState(channelId, route.parentId);

    if (customId === "music:toggle") {
      const guildId = String(interaction.guild_id || "");
      const res = musicManager?.togglePause({ guildId });
      if (!res?.ok) {
        if (interaction.message?.id) {
          editDiscordMessage(channelId, interaction.message.id, { components: [] }).catch(() => {});
        }
        await replyInteractionCallback(interaction, {
          type: 4,
          data: { content: res?.message || "ℹ️ Hiện không có bài hát nào đang phát.", flags: 64 },
        }).catch(() => {});
        return;
      }
      await replyInteractionCallback(interaction, {
        type: 7,
        data: { embeds: res.embeds, components: res.components },
      }).catch(() => {});
      return;
    }

    if (customId === "music:clear") {
      const guildId = String(interaction.guild_id || "");
      const res = musicManager?.clearQueue({ guildId });
      if (!res?.ok) {
        if (interaction.message?.id) {
          editDiscordMessage(channelId, interaction.message.id, { components: [] }).catch(() => {});
        }
        await replyInteractionCallback(interaction, {
          type: 4,
          data: { content: res?.message || "ℹ️ Hiện không có hàng chờ nào.", flags: 64 },
        }).catch(() => {});
        return;
      }
      await replyInteractionCallback(interaction, {
        type: 7,
        data: { embeds: res.embeds, components: res.components },
      }).catch(() => {});
      if (appId) {
        await discordRequest("POST", `/webhooks/${appId}/${interaction.token}`, {
          content: res.message,
          flags: 64,
        }).catch(() => {});
      }
      return;
    }

    if (customId === "music:mode") {
      const guildId = String(interaction.guild_id || "");
      const res = musicManager?.cyclePlayMode({ guildId });
      if (!res?.ok) {
        if (interaction.message?.id) {
          editDiscordMessage(channelId, interaction.message.id, { components: [] }).catch(() => {});
        }
        await replyInteractionCallback(interaction, {
          type: 4,
          data: { content: res?.message || "ℹ️ Hiện không có bài hát nào đang phát.", flags: 64 },
        }).catch(() => {});
        return;
      }
      await replyInteractionCallback(interaction, {
        type: 7,
        data: { embeds: res.embeds, components: res.components },
      }).catch(() => {});
      return;
    }

    if (customId === "music:skip") {
      const guildId = String(interaction.guild_id || "");
      // Acknowledge immediately so yt-dlp resolution never exceeds Discord's 3s interaction window
      await replyInteractionCallback(interaction, {
        type: 7,
        data: { components: [] },
      }).catch(() => {});
      const res = await musicManager?.skip({ guildId }).catch((err) => ({
        ok: false,
        message: `⚠️ Không thể chuyển bài: \`${err.message || err}\``,
      }));
      if (res && !res.ok) {
        if (appId) {
          await discordRequest("POST", `/webhooks/${appId}/${interaction.token}`, {
            content: res.message || "ℹ️ Hiện không có bài hát nào đang phát.",
            flags: 64,
          }).catch(() => {});
        }
      } else if (res?.emptied && res.message) {
        await discordRequest("POST", `/channels/${channelId}/messages`, {
          content: res.message,
        }).catch(() => {});
      }
      return;
    }

    if (customId === "music:stop") {
      const guildId = String(interaction.guild_id || "");
      await replyInteractionCallback(interaction, {
        type: 7,
        data: { components: [] },
      }).catch(() => {});
      const res = await musicManager?.stop({ guildId }).catch(() => null);
      await discordRequest("POST", `/channels/${channelId}/messages`, {
        content: res?.message || "⏹️ Đã dừng phát nhạc, xóa hàng chờ và rời phòng Voice.",
      }).catch(() => {});
      return;
    }

    if (customId === "agy:stop") {
      const running = activeRuns.get(channelId);
      if (!running) {
        await replyInteractionCallback(interaction, {
          type: 4,
          data: { content: "ℹ️ Tác vụ này đã kết thúc rồi.", flags: 64 },
        }).catch(() => {});
        if (interaction.message?.id) {
          editDiscordMessage(channelId, interaction.message.id, { components: [] }).catch(() => {});
        }
        return;
      }
      running.abort();
      await replyInteractionCallback(interaction, {
        type: 4,
        data: { content: "⏹️ Đã gửi tín hiệu dừng tác vụ đang chạy.", flags: 64 },
      }).catch(() => {});
      return;
    }

    if (customId === "agy:new") {
      chState.conversationId = null;
      delete chState.chromeGuideInjected;
      saveState();
      await replyInteractionCallback(interaction, {
        type: 4,
        data: {
          content: "🆕 Đã mở cuộc hội thoại mới. Tin nhắn tiếp theo của bạn sẽ bắt đầu từ đầu.",
        },
      }).catch(() => {});
      return;
    }

    if (customId === "agy:delete") {
      if (!route.isThread) {
        await replyInteractionCallback(interaction, {
          type: 4,
          data: { content: "⛔ Nút này chỉ dùng được bên trong Thread.", flags: 64 },
        }).catch(() => {});
        return;
      }
      if (!route.isAdmin) {
        const owns = await isThreadOwnedByUser(channelId, route, chState);
        if (!owns) {
          await replyInteractionCallback(interaction, {
            type: 4,
            data: { content: "⛔ Bạn chỉ có thể xóa Thread do chính bạn tạo.", flags: 64 },
          }).catch(() => {});
          return;
        }
      }
      await replyInteractionCallback(interaction, {
        type: 4,
        data: { content: "🗑️ Đang xóa Thread và dọn dữ liệu cuộc hội thoại...", flags: 64 },
      }).catch(() => {});
      await deleteDiscordThreadWithCleanup(channelId, route.parentId).catch((err) => {
        console.error(`[cleanup] Failed to delete Discord thread ${channelId}:`, err.message);
      });
      return;
    }

    if (customId === "agy:retry" || customId === "agy:summarize") {
      if (customId === "agy:retry") {
        const saved = channelLastPrompts.get(channelId);
        const promptText = saved?.prompt ?? chState.lastPromptText ?? "";
        const hasAttachments = Array.isArray(saved?.attachments) && saved.attachments.length > 0;
        if (!promptText && !hasAttachments && !saved?.replyContext) {
          await replyInteractionCallback(interaction, {
            type: 4,
            data: { content: "ℹ️ Không tìm thấy câu hỏi gần nhất để thử lại.", flags: 64 },
          }).catch(() => {});
          return;
        }
        const limitCheck = await enforceMemberLimits(route, channelId, { silent: true });
        if (!limitCheck.allowed) {
          await replyInteractionCallback(interaction, {
            type: 4,
            data: { content: limitCheck.message || "⛔ Đã chạm hạn mức sử dụng.", flags: 64 },
          }).catch(() => {});
          return;
        }
        if (chState.lastTurnFailed) {
          chState.conversationId = null;
          delete chState.chromeGuideInjected;
          saveState();
        }
        await replyInteractionCallback(interaction, {
          type: 4,
          data: { content: "🔄 Đang gửi lại yêu cầu gần nhất...", flags: 64 },
        }).catch(() => {});
        enqueuePrompt(
          channelId,
          {
            prompt: promptText,
            attachments: saved?.attachments || [],
            replyContext: saved?.replyContext || null,
            messageId: saved?.messageId || null,
            userId: route.userId,
            policy: route.policy,
          },
          route.parentId
        ).catch((err) => console.error("[button] Retry failed:", err));
        return;
      }

      if (customId === "agy:summarize") {
        const limitCheck = await enforceMemberLimits(route, channelId, { silent: true });
        if (!limitCheck.allowed) {
          await replyInteractionCallback(interaction, {
            type: 4,
            data: { content: limitCheck.message || "⛔ Đã chạm hạn mức sử dụng.", flags: 64 },
          }).catch(() => {});
          return;
        }
        await replyInteractionCallback(interaction, {
          type: 4,
          data: { content: "📝 Đang tóm tắt ngắn gọn câu trả lời...", flags: 64 },
        }).catch(() => {});
        enqueuePrompt(
          channelId,
          {
            prompt:
              "Hãy tóm tắt ngắn gọn, súc tích những ý chính quan trọng nhất của câu trả lời vừa rồi bằng gạch đầu dòng.",
            attachments: [],
            messageId: null,
            userId: route.userId,
            policy: route.policy,
            skipLastPromptSave: true,
          },
          route.parentId
        ).catch((err) => console.error("[button] Summarize failed:", err));
        return;
      }
    }

    await replyInteractionCallback(interaction, {
      type: 4,
      data: { content: "ℹ️ Nút bấm này không còn hiệu lực.", flags: 64 },
    }).catch(() => {});
    return;
  }

  if (interaction.type !== 2) return;

  const slashCommandText = interactionToCommand(interaction.data);
  const cmdWord = slashCommandText.split(/\s+/)[0].toLowerCase();
  const syntheticMsg = interactionToSyntheticMessage(interaction);
  const route =
    (await authorizeMessage(syntheticMsg)) ||
    (cmdWord === "/play" ? await authorizeGuildMusicFallback(syntheticMsg) : null) ||
    (cmdWord === "/clear" ? await authorizeAdminFreeChatClearFallback(syntheticMsg) : null);
  if (!route) {
    await replyInteractionCallback(interaction, {
      type: 4,
      data: {
        content: `⛔ Bot **${getBotDisplayName()}** không hoạt động hoặc bạn chưa được cấp quyền sử dụng lệnh tại kênh này.`,
        flags: 64,
      },
    }).catch(() => {});
    return;
  }
  if (!canExecuteDiscordCommand(cmdWord, route)) {
    const blockedMsg = route.isAnnounceChannel
      ? "⛔ Kênh `#announcement` chỉ dùng để nhận thông báo tự động; Admin chỉ được dùng `/clear` tại đây."
      : `⛔ Lệnh \`/${String(interaction.data?.name || "")}\` chỉ dành cho Admin.`;
    await replyInteractionCallback(interaction, {
      type: 4,
      data: {
        content: blockedMsg,
        flags: 64,
      },
    }).catch(() => {});
    return;
  }

  // Handle /delete before removing the Thread so Discord always receives an interaction ACK cleanly
  if (cmdWord === "/delete") {
    if (!route.isThread) {
      await replyInteractionCallback(interaction, {
        type: 4,
        data: {
          content:
            "⛔ Lệnh `/delete` **chỉ được dùng bên trong Thread** (không dùng ở kênh chính như `#admin`, `#projects`, hay phòng riêng). Để dọn tin nhắn ở kênh chính, hãy dùng `/clear`.",
          flags: 64,
        },
      }).catch(() => {});
      return;
    }
    if (!route.isAdmin) {
      const chState = getChannelState(interaction.channel_id, route.parentId);
      const owns = await isThreadOwnedByUser(interaction.channel_id, route, chState);
      if (!owns) {
        await replyInteractionCallback(interaction, {
          type: 4,
          data: { content: "⛔ Bạn chỉ có thể xóa Thread do chính bạn tạo.", flags: 64 },
        }).catch(() => {});
        return;
      }
    }
    await replyInteractionCallback(interaction, {
      type: 4,
      data: { content: "🗑️ Đang xóa Thread và dọn dữ liệu cuộc hội thoại...", flags: 64 },
    }).catch(() => {});
    await deleteDiscordThreadWithCleanup(interaction.channel_id, route.parentId).catch((err) => {
      console.error(`[cleanup] Failed to delete Discord thread ${interaction.channel_id}:`, err.message);
    });
    return;
  }

  const ephemeral = cmdWord === "/clear";
  await replyInteractionCallback(interaction, {
    type: 5,
    data: ephemeral ? { flags: 64 } : {},
  });

  const capture = { channelId: interaction.channel_id, chunks: [], ephemeral };
  try {
    await interactionReplyStorage.run(capture, async () => {
      await handleCommand(interaction.channel_id, slashCommandText, route, null, syntheticMsg);
    });
    const outChunks =
      capture.chunks.length > 0
        ? capture.chunks
        : capture.embeds?.length
          ? [""]
          : ["✅ Đã thực hiện."];
    if (appId) {
      const firstBody = { content: outChunks[0] };
      if (Array.isArray(capture.embeds) && capture.embeds.length > 0) {
        firstBody.embeds = capture.embeds;
      }
      if (outChunks.length === 1 && capture.components !== undefined) {
        firstBody.components = capture.components;
      }
      const sentMsg = await discordRequest("PATCH", `/webhooks/${appId}/${interaction.token}/messages/@original`, firstBody);
      if (cmdWord === "/play" && sentMsg?.id && capture.components?.length) {
        await musicManager?.registerControlMessage(
          String(interaction.guild_id || ""),
          String(sentMsg.channel_id || interaction.channel_id),
          String(sentMsg.id)
        );
      }
      for (let i = 1; i < outChunks.length; i++) {
        const extraBody = {
          content: outChunks[i],
          flags: ephemeral ? 64 : 0,
        };
        if (i === outChunks.length - 1 && capture.components !== undefined) {
          extraBody.components = capture.components;
        }
        const extraMsg = await discordRequest("POST", `/webhooks/${appId}/${interaction.token}`, extraBody);
        if (cmdWord === "/play" && i === outChunks.length - 1 && extraMsg?.id && capture.components?.length) {
          await musicManager?.registerControlMessage(
            String(interaction.guild_id || ""),
            String(extraMsg.channel_id || interaction.channel_id),
            String(extraMsg.id)
          );
        }
      }
    }
  } catch (err) {
    console.error("[slash] Command failed:", err.message || err);
    if (appId) {
      await discordRequest("PATCH", `/webhooks/${appId}/${interaction.token}/messages/@original`, {
        content: `⚠️ Lỗi xử lý lệnh: \`${err.message || err}\``,
      }).catch(() => {});
    }
  }
}

/** Handle Discord Gateway dispatch events routed from DiscordGatewayClient. */
function handleGatewayDispatch(eventName, data, gw) {
  if (eventName === "READY") {
    console.log(`[gateway] Ready as ${data.user.username}#${data.user.discriminator || "0"} (${data.user.id})`);
    console.log(`[bridge] Allowed User ID: ${config.allowedUserId}`);
    console.log(
      `[bridge] Allowed Channels: ${config.allowedChannelIds.length ? config.allowedChannelIds.join(", ") : "(DM only)"}`
    );
    console.log(
      `[onboard] Auto-onboard: ${
        config.autoOnboard?.enabled
          ? gw.memberIntentFallback
            ? "chế độ dự phòng (cần bật Server Members Intent trên Discord Developer Portal)"
            : "bật (GUILD_MEMBERS active)"
          : "tắt"
      }`
    );
    const readyGuildIds = Array.isArray(data.guilds) ? data.guilds.map((g) => g.id).filter(Boolean) : [];
    for (const gid of readyGuildIds) knownGuildIds.add(gid);
    applicationId = String(data.application?.id || data.user?.id || applicationId || "");
    syncFreeChatChannel(readyGuildIds).catch((err) => {
      console.error("[free-chat] Discovery failed:", err.message);
    });
    syncAnnounceChannel(readyGuildIds).catch((err) => {
      console.error("[announce] Discovery failed:", err.message);
    });
    syncGuideChannel({ readyGuildIds }).catch((err) => {
      console.error("[guide] Auto-sync failed:", err.message);
    });
    syncGuildSlashCommands(readyGuildIds, applicationId).catch((err) => {
      console.error("[slash] Sync error:", err.message);
    });
    getAgyModelsCached().catch(() => {});
    return;
  }
  if (eventName === "RESUMED") {
    console.log("[gateway] Session resumed.");
    return;
  }
    if (eventName === "GUILD_CREATE") {
      if (data?.id) {
        knownGuildIds.add(data.id);
        if (typeof data.member_count === "number" && data.member_count > 0) {
          guildMemberCounts.set(data.id, data.member_count);
        }
      }
      musicManager?.handleGuildCreate(data);
      return;
    }
    if (eventName === "VOICE_STATE_UPDATE" || eventName === "VOICE_SERVER_UPDATE") {
      musicManager?.handleGatewayEvent(eventName, data);
      return;
    }
    if (eventName === "CHANNEL_UPDATE") {
      if (data?.id) {
        channelMetaCache.set(data.id, data);
        if (matchesFreeChatMeta(data)) {
          registerFreeChatChannel(data.id);
        } else {
          freeChatChannelIds.delete(data.id);
        }
      }
      return;
    }
    if (eventName === "CHANNEL_DELETE") {
      if (data?.id) {
        channelMetaCache.delete(data.id);
        freeChatChannelIds.delete(data.id);
      }
      return;
    }
    if (eventName === "MESSAGE_CREATE") {
      onMessageCreate(data).catch((err) => console.error("[message] Handler error:", err));
      return;
    }
    if (eventName === "INTERACTION_CREATE") {
      onInteractionCreate(data).catch((err) => console.error("[slash] Interaction error:", err));
      return;
    }
    if (eventName === "GUILD_MEMBER_ADD") {
      if (data?.guild_id && guildMemberCounts.has(data.guild_id)) {
        guildMemberCounts.set(data.guild_id, guildMemberCounts.get(data.guild_id) + 1);
      }
      sendMemberAnnouncement("join", data).catch((err) =>
        console.error("[announce] Join announcement failed:", err.message || err)
      );
      memberProvisioner
        ?.onboardMember({
          guildId: data?.guild_id,
          userId: data?.user?.id,
          username: data?.user?.username || data?.nick || "",
          isBot: Boolean(data?.user?.bot),
          manual: false,
        })
        .then((res) => {
          if (res && !res.skipped) {
            console.log(
              `[onboard] Provisioned ${res.username || data?.user?.id} -> <#${res.channelId}> (${res.cwd})`
            );
          }
        })
        .catch((err) => console.error("[onboard] GUILD_MEMBER_ADD failed:", err.message || err));
      return;
    }
    if (eventName === "GUILD_MEMBER_REMOVE") {
      if (data?.guild_id && guildMemberCounts.has(data.guild_id)) {
        guildMemberCounts.set(data.guild_id, Math.max(0, guildMemberCounts.get(data.guild_id) - 1));
      }
      sendMemberAnnouncement("leave", data).catch((err) =>
        console.error("[announce] Leave announcement failed:", err.message || err)
      );
      memberProvisioner
        ?.offboardMember({
          userId: data?.user?.id,
        })
        .then((res) => {
          if (res && !res.skipped && res.removedChannels?.length) {
            console.log(
              `[onboard] Offboarded user ${data?.user?.id} -> removed ${res.removedChannels.length} rule(s)`
            );
          }
        })
        .catch((err) => console.error("[onboard] GUILD_MEMBER_REMOVE failed:", err.message || err));
      return;
    }
    if (eventName === "THREAD_DELETE") {
      if (data?.id && !config.allowedChannelIds.includes(data.id)) {
        const isTracked = Boolean(state.channels[data.id]);
        const isAllowedParent = Boolean(
          data.parent_id &&
            (config.allowedChannelIds.includes(data.parent_id) ||
              freeChatChannelIds.has(data.parent_id) ||
              Boolean(config.channelRules?.[data.parent_id]))
        );
        if (isTracked || isAllowedParent) {
          deleteThreadSession(data.id, { parentId: data.parent_id || null, deleteStarter: true }).catch((err) =>
            console.error("[cleanup] Thread delete error:", err)
          );
        }
      }
    }
}

const gateway = new DiscordGatewayClient({
  getToken: () => config.botToken,
  getConfig: () => config,
  discordRequest,
  onDispatch: handleGatewayDispatch,
});

musicManager = createMusicManager({
  getGateway: () => gateway,
  getBotUserId: () => gateway?.botUser?.id || "",
  sendNotice: async (targetChannelId, payload, components) => {
    if (!targetChannelId) return null;
    const body = typeof payload === "string" ? { content: payload } : { ...payload };
    if (components !== undefined) body.components = components;
    return discordRequest("POST", `/channels/${targetChannelId}/messages`, body);
  },
  clearControlButtons: async (targetChannelId, targetMessageId) => {
    if (!targetChannelId || !targetMessageId) return;
    await editDiscordMessage(targetChannelId, targetMessageId, { components: [] });
  },
});

memberProvisioner = createMemberProvisioner({
  getConfig: () => config,
  getBotUserId: () => gateway?.botUser?.id || "",
  getBotName: getBotDisplayName,
  isAdminUser,
  discordRequest,
  updateConfigFile,
  getAvailableModels: () => getAgyModelsCached(),
});

cronManager = createCronManager({
  state,
  saveState,
  onTriggerJob: triggerCronJob,
});

dailyReportScheduler = createDailyReportScheduler({
  getConfig: () => config,
  state,
  saveState,
  isReady: () => Boolean(gateway?.sessionId),
  sendReport: ({ nowMs }) => sendDailyAdminReport({ nowMs }),
});

webhookServer = createWebhookServer({
  getWebhookConfig: () => config.webhook,
  attachRoot: DISCORD_ATTACHMENTS_DIR,
  isGatewayReady: () => Boolean(gateway?.sessionId),
  onTriggerWebhook: triggerWebhookDispatch,
});

const shutdownBridge = () => {
  cronManager?.stop();
  dailyReportScheduler?.stop();
  musicManager?.destroyAll();
  Promise.resolve(webhookServer?.stop())
    .catch(() => {})
    .finally(() => process.exit(0));
};
process.on("SIGINT", shutdownBridge);
process.on("SIGTERM", shutdownBridge);

ensureMcpConfigRegistered();
await startMcpBridgeServer();
loadAppCatalog().catch(() => {});
pruneOldDiscordAttachments();
pruneOldTempFiles(DISCORD_TEMP_DIR);
cronManager.start();
dailyReportScheduler.start();
await webhookServer.start();

gateway.connect(false).catch((err) => {
  console.error("[gateway] Initial connect failed:", err.message || err);
  gateway.scheduleReconnect(gateway.backoffMs, false);
});
