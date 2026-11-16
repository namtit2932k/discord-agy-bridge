import fs from "node:fs";
import path from "node:path";

/** Preserve 64-bit Discord Snowflake literals as JSON strings even if left unquoted by hand. */
export function quoteSnowflakeLiterals(jsonText) {
  let text = String(jsonText || "");
  text = text.replace(
    /("(?:allowedUserId|guideChannelId|freeChatChannelId|announceChannelId|targetChannelId|channelId|guildId|onboardedUserId|categoryId)"\s*:\s*)(\d{15,22})(?=\s*[,}\r\n])/g,
    '$1"$2"'
  );
  text = text.replace(
    /("(?:allowedChannelIds|adminUserIds|allowUserIds|allowRoleIds|allowGuildIds)"\s*:\s*\[)([^\]]*)(\])/g,
    (_, open, inner, close) => {
      return open + inner.replace(/(?<!")\b(\d{15,22})\b(?!")/g, '"$1"') + close;
    }
  );
  return text;
}

/** Read and parse a JSON file safely, returning fallback on missing/invalid content. */
export function readJsonSafe(filePath, fallback, quoteSnowflakes = false) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    let text = fs.readFileSync(filePath, "utf8");
    if (quoteSnowflakes) {
      text = quoteSnowflakeLiterals(text);
    }
    return JSON.parse(text);
  } catch (err) {
    console.error(`[config] Failed to read ${filePath}:`, err.message);
    return fallback;
  }
}

/** Persist JSON data using a temp file rename to reduce corruption risk on interruption. */
export function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const content = JSON.stringify(data, null, 2) + "\n";
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tmpPath, content, "utf8");
    fs.renameSync(tmpPath, filePath);
  } catch {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {}
    fs.writeFileSync(filePath, content, "utf8");
  }
}

/** Promise-based delay helper. */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Format numeric token counts with thousands separators. */
export function formatNumber(n) {
  return Number(n || 0).toLocaleString("en-US");
}

/** Format byte counts concisely for prompt notes, progress UI, and error messages. */
export function formatByteSize(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(2)}MB`;
}

/** Collapse whitespace, neutralize backticks, and clip inline label text. */
export function cleanInlineLabel(value, maxLen = 50) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").replace(/`/g, "'").trim();
  if (!normalized) return "";
  return normalized.length > maxLen ? `${normalized.slice(0, maxLen - 3)}...` : normalized;
}

/** Compact a file/directory path to its trailing 1-2 segments. */
export function shortPathLabel(rawPath) {
  const normalized = String(rawPath || "").replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) return "";
  const parts = normalized.split("/").filter(Boolean);
  const compact = parts.length > 2 ? parts.slice(-2).join("/") : normalized;
  return cleanInlineLabel(compact, 55);
}

/** Strip path components and Windows-illegal filename characters. */
export function sanitizeAttachmentFilename(rawName, fallback = "attachment.bin") {
  const base = path.basename(String(rawName || "").trim());
  const cleaned = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/, "").slice(0, 120);
  return cleaned || fallback;
}

/** Resolve symlinks/junctions along the longest existing ancestor to prevent path traversal escapes. */
export function resolveCanonicalPath(targetPath) {
  const abs = path.resolve(String(targetPath || ""));
  const tailSegments = [];
  let probe = abs;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) return abs;
    tailSegments.unshift(path.basename(probe));
    probe = parent;
  }
  try {
    const realBase = fs.realpathSync.native(probe);
    return path.join(realBase, ...tailSegments);
  } catch {
    return abs;
  }
}

/** Return true if targetPath resides inside rootDir (case-insensitive on Windows). */
export function isPathInsideDir(targetPath, rootDir) {
  if (!targetPath || !rootDir) return false;
  const realTarget = resolveCanonicalPath(targetPath);
  const realRoot = resolveCanonicalPath(rootDir);
  const cmpTarget = process.platform === "win32" ? realTarget.toLowerCase() : realTarget;
  const cmpRoot = process.platform === "win32" ? realRoot.toLowerCase() : realRoot;
  const rel = path.relative(cmpRoot, cmpTarget);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** Normalize a Discord mention (<#123>, <@!123>, <@&123>) or raw Snowflake string into digits. */
export function extractSnowflakeId(rawToken) {
  const trimmed = String(rawToken || "").trim();
  const mention = trimmed.match(/^<(?:@!?|@&|#)(\d{15,22})>$/);
  if (mention) return mention[1];
  return /^\d{15,22}$/.test(trimmed) ? trimmed : "";
}

/** Extract clean text, author label, and attachments from a Discord referenced_message (Reply target). */
export function extractReplyContext(referencedMessage, maxTextLen = 2000) {
  if (!referencedMessage || typeof referencedMessage !== "object") return null;

  const rawContent = typeof referencedMessage.content === "string" ? referencedMessage.content.trim() : "";
  const embedParts = [];
  if (!rawContent && Array.isArray(referencedMessage.embeds)) {
    for (const emb of referencedMessage.embeds.slice(0, 3)) {
      if (!emb || typeof emb !== "object") continue;
      if (emb.title) embedParts.push(String(emb.title).trim());
      if (emb.description) embedParts.push(String(emb.description).trim());
    }
  }

  let text = (rawContent || embedParts.join("\n")).trim();
  if (text.length > maxTextLen) {
    text = `${text.slice(0, Math.max(0, maxTextLen - 3)).trimEnd()}...`;
  }

  const attachments = Array.isArray(referencedMessage.attachments) ? referencedMessage.attachments : [];
  if (!text && attachments.length === 0) return null;

  const authorObj = referencedMessage.author || {};
  const authorLabel =
    referencedMessage.member?.nick ||
    authorObj.global_name ||
    authorObj.username ||
    (authorObj.id ? `user:${authorObj.id}` : "người dùng");

  return {
    messageId: referencedMessage.id ? String(referencedMessage.id) : "",
    authorLabel: String(authorLabel).trim(),
    isBot: Boolean(authorObj.bot),
    text,
    attachments,
  };
}

/** Clean unusable `file://` links for Discord and optionally strip host workspace paths for Members. */
export function sanitizeDiscordReplyText(text, { hideHostPaths = false, workspaceDir = "" } = {}) {
  let out = String(text || "");
  if (!out) return out;
  // Discord does not render file:// URLs as clickable links; show the clean filename instead (keeping ![img](...) intact)
  out = out.replace(/(?<!!)\[([^\]]+)\]\(file:\/\/[^)\s]+\)/g, (_, label) => `\`${label.replace(/`/g, "")}\``);

  if (hideHostPaths && workspaceDir) {
    const absNorm = path.resolve(String(workspaceDir)).replace(/\\/g, "/").replace(/\/+$/, "");
    const absWin = absNorm.replace(/\//g, "\\");
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const variants = [
      `file:///${absNorm}/`,
      `file:///${absNorm}`,
      `${absNorm}/`,
      `${absWin}\\`,
      absNorm,
      absWin,
    ].filter(Boolean);
    for (const prefix of variants) {
      const re = new RegExp(esc(prefix), process.platform === "win32" ? "gi" : "g");
      out = out.replace(re, "");
    }
  }
  return out;
}
