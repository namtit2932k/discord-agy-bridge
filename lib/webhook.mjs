import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { cleanInlineLabel } from "./utils.mjs";

const VALID_MODES = new Set(["accept-edits", "auto", "plan"]);

function timingSafeEqualUtf8(a, b) {
  const bufA = Buffer.from(String(a || ""), "utf8");
  const bufB = Buffer.from(String(b || ""), "utf8");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Normalize webhook server and hook route definitions from config.json. */
export function normalizeWebhookConfig(rawWebhook) {
  const raw = rawWebhook && typeof rawWebhook === "object" ? rawWebhook : {};
  const defaultSecret = typeof raw.defaultSecret === "string" ? raw.defaultSecret.trim() : "";
  const hooks = {};
  if (raw.hooks && typeof raw.hooks === "object") {
    for (const [rawId, rawHook] of Object.entries(raw.hooks)) {
      const id = String(rawId || "").trim();
      if (!id || !rawHook || typeof rawHook !== "object") continue;
      hooks[id] = {
        id,
        secret: typeof rawHook.secret === "string" ? rawHook.secret.trim() : "",
        hmacHeader: typeof rawHook.hmacHeader === "string" ? rawHook.hmacHeader.trim().toLowerCase() : "",
        channelId: rawHook.channelId ? String(rawHook.channelId).trim() : "",
        createThread: rawHook.createThread !== false,
        threadPrefix: typeof rawHook.threadPrefix === "string" ? rawHook.threadPrefix.trim() : "[Alert]",
        cwd: typeof rawHook.cwd === "string" && rawHook.cwd.trim() ? path.resolve(rawHook.cwd.trim()) : "",
        projectId: typeof rawHook.projectId === "string" ? rawHook.projectId.trim() : "",
        projectName: typeof rawHook.projectName === "string" ? rawHook.projectName.trim() : "",
        mode: VALID_MODES.has(rawHook.mode) ? rawHook.mode : "auto",
        sandbox: rawHook.sandbox !== false,
        allowNonWorkspaceAccess: rawHook.allowNonWorkspaceAccess === true,
        allowDesktopTools: rawHook.allowDesktopTools === true,
        allowChrome: rawHook.allowChrome === true,
        allowFirecrawl: rawHook.allowFirecrawl === true,
        promptPrefix: typeof rawHook.promptPrefix === "string" ? rawHook.promptPrefix.trim() : "",
        dedupWindowSec: Number.isFinite(Number(rawHook.dedupWindowSec))
          ? Math.max(0, Number(rawHook.dedupWindowSec))
          : 0,
      };
    }
  }

  return {
    enabled: raw.enabled === true,
    host: typeof raw.host === "string" && raw.host.trim() ? raw.host.trim() : "127.0.0.1",
    port: Number.isInteger(Number(raw.port)) && Number(raw.port) >= 0 ? Number(raw.port) : 3939,
    defaultSecret,
    maxBodyBytes: Number.isFinite(Number(raw.maxBodyBytes)) ? Math.max(4096, Number(raw.maxBodyBytes)) : 262144,
    rateLimitPerMin: Number.isFinite(Number(raw.rateLimitPerMin)) ? Math.max(1, Number(raw.rateLimitPerMin)) : 20,
    hooks,
  };
}

/** Verify Bearer token, X-Webhook-Secret, or HMAC-SHA256 signature using constant-time comparison. */
export function verifyWebhookRequestAuth(req, rawBody, hook, defaultSecret = "") {
  const effectiveSecret = hook?.secret || defaultSecret || "";
  if (!effectiveSecret) {
    return { ok: false, status: 403, reason: "Webhook secret is not configured" };
  }

  const headers = req.headers || {};
  const authHeader = String(headers.authorization || "");
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const provided = authHeader.slice(7).trim();
    if (timingSafeEqualUtf8(provided, effectiveSecret)) {
      return { ok: true };
    }
  }

  const secretHeader = String(headers["x-webhook-secret"] || "").trim();
  if (secretHeader && timingSafeEqualUtf8(secretHeader, effectiveSecret)) {
    return { ok: true };
  }

  const sigHeaderName = hook?.hmacHeader || "x-hub-signature-256";
  const providedSig = String(headers[sigHeaderName] || headers["x-webhook-signature"] || "").trim();
  if (providedSig) {
    const cleanProvided = providedSig.replace(/^sha256=/i, "").toLowerCase();
    const expectedHex = crypto.createHmac("sha256", effectiveSecret).update(rawBody).digest("hex");
    if (timingSafeEqualUtf8(cleanProvided, expectedHex)) {
      return { ok: true };
    }
  }

  return { ok: false, status: 401, reason: "Unauthorized webhook request" };
}

/** Summarize an incoming webhook payload, staging oversized logs to disk for agy read_file inspection. */
export function prepareWebhookEvent(hook, rawBody, contentType, attachRoot) {
  const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody || "");
  let parsed = null;
  if (contentType.includes("json") || /^\s*[\[{]/.test(bodyStr)) {
    try {
      parsed = JSON.parse(bodyStr);
    } catch {}
  }

  const prettyText = parsed !== null ? JSON.stringify(parsed, null, 2) : bodyStr;
  const titleHint = cleanInlineLabel(
    (parsed && typeof parsed === "object" && (parsed.title || parsed.alertName || parsed.summary || parsed.event)) ||
      hook.id,
    60
  );

  let stagedPath = "";
  let attachDir = "";
  if (prettyText.length > 2500 && attachRoot) {
    const safeChan = String(hook.channelId || hook.id).replace(/[^a-zA-Z0-9_-]/g, "") || "webhook";
    attachDir = path.join(attachRoot, safeChan);
    fs.mkdirSync(attachDir, { recursive: true });
    const ext = parsed !== null ? "json" : "txt";
    stagedPath = path.join(attachDir, `webhook-${sanitizeHookName(hook.id)}-${Date.now()}.${ext}`);
    fs.writeFileSync(stagedPath, prettyText, "utf8");
  }

  const previewText = prettyText.length > 2500 ? `${prettyText.slice(0, 2500)}\n...(truncated)` : prettyText;
  const defaultInstruction =
    "Hệ thống vừa nhận sự kiện/cảnh báo webhook bên dưới. Hãy kiểm tra và chẩn đoán nguyên nhân (nếu có file log/mã nguồn trong workspace hãy đối chiếu cụ thể), đề xuất hướng xử lý an toàn, và gửi file báo cáo qua `send_to_discord` nếu cần.";

  const promptParts = [
    hook.promptPrefix || defaultInstruction,
    `[Webhook Source: ${hook.id}${titleHint && titleHint !== hook.id ? ` | title=${titleHint}` : ""}]`,
    stagedPath
      ? `[Full Webhook Payload saved to: ${stagedPath} — use read_file if needed]\n\`\`\`\n${previewText}\n\`\`\``
      : `\`\`\`json\n${previewText}\n\`\`\``,
  ];

  return {
    titleHint,
    stagedPath,
    attachDir,
    bodyHash: crypto.createHash("sha256").update(bodyStr).digest("hex"),
    dedupKey:
      parsed && typeof parsed === "object" && parsed.dedupKey ? String(parsed.dedupKey) : "",
    prompt: promptParts.join("\n\n"),
    summaryPreview: cleanInlineLabel(previewText, 180),
  };
}

function sanitizeHookName(name) {
  return String(name || "hook").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48) || "hook";
}

/** Create and manage the HTTP webhook automation server. */
export function createWebhookServer({
  getWebhookConfig,
  attachRoot,
  isGatewayReady,
  onTriggerWebhook,
}) {
  let server = null;
  let listeningAddr = null;
  const rateBuckets = new Map();
  const dedupCache = new Map();

  function pruneExpiredCaches(now) {
    for (const [k, tsList] of rateBuckets.entries()) {
      const kept = tsList.filter((t) => now - t < 60_000);
      if (kept.length > 0) rateBuckets.set(k, kept);
      else rateBuckets.delete(k);
    }
    for (const [k, exp] of dedupCache.entries()) {
      if (exp <= now) dedupCache.delete(k);
    }
  }

  function handleHttpRequest(req, res) {
    const cfg = getWebhookConfig();
    const urlObj = new URL(req.url || "/", "http://127.0.0.1");

    if (req.method === "GET" && urlObj.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          ok: true,
          gatewayReady: Boolean(isGatewayReady()),
          hooks: Object.keys(cfg.hooks),
        })
      );
      return;
    }

    const match = urlObj.pathname.match(/^\/webhook\/([^/]+)$/);
    if (req.method !== "POST" || !match) {
      res.writeHead(404, { "Content-Type": "application/json" }).end(
        JSON.stringify({ ok: false, error: "Not found. Use POST /webhook/<hookId>." })
      );
      return;
    }

    const hookId = decodeURIComponent(match[1]);
    const hook = cfg.hooks[hookId];
    if (!hook) {
      // Avoid enumerating configured hook IDs to unauthenticated callers
      const defaultAuth = verifyWebhookRequestAuth(req, Buffer.alloc(0), null, cfg.defaultSecret);
      if (!defaultAuth.ok) {
        res.writeHead(401, { "Content-Type": "application/json" }).end(
          JSON.stringify({ ok: false, error: "Unauthorized webhook request" })
        );
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" }).end(
        JSON.stringify({ ok: false, error: `Unknown webhook '${hookId}'.` })
      );
      return;
    }
    if (!hook.channelId) {
      res.writeHead(500, { "Content-Type": "application/json" }).end(
        JSON.stringify({ ok: false, error: `Webhook '${hookId}' has no target channelId configured.` })
      );
      return;
    }

    const chunks = [];
    let byteCount = 0;
    let aborted = false;

    req.setTimeout(15_000, () => {
      if (aborted || res.writableEnded) return;
      aborted = true;
      res.writeHead(408, { "Content-Type": "application/json" }).end(
        JSON.stringify({ ok: false, error: "Webhook request timed out." })
      );
      req.destroy();
    });

    req.on("data", (chunk) => {
      byteCount += chunk.length;
      if (byteCount > cfg.maxBodyBytes) {
        aborted = true;
        res.writeHead(413, { "Content-Type": "application/json" }).end(
          JSON.stringify({ ok: false, error: "Webhook payload too large." })
        );
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", async () => {
      if (aborted) return;
      const rawBody = Buffer.concat(chunks);
      const auth = verifyWebhookRequestAuth(req, rawBody, hook, cfg.defaultSecret);
      if (!auth.ok) {
        res.writeHead(auth.status, { "Content-Type": "application/json" }).end(
          JSON.stringify({ ok: false, error: auth.reason })
        );
        return;
      }

      const now = Date.now();
      pruneExpiredCaches(now);

      const hits = rateBuckets.get(hookId) || [];
      if (hits.length >= cfg.rateLimitPerMin) {
        res.writeHead(429, { "Content-Type": "application/json" }).end(
          JSON.stringify({ ok: false, error: `Rate limit exceeded (${cfg.rateLimitPerMin}/min) for '${hookId}'.` })
        );
        return;
      }

      const contentType = String(req.headers["content-type"] || "").toLowerCase();
      const event = prepareWebhookEvent(hook, rawBody, contentType, attachRoot);

      if (hook.dedupWindowSec > 0) {
        const headerIdem = String(req.headers["x-idempotency-key"] || "").trim();
        const dedupSig = `${hookId}:${headerIdem || event.dedupKey || event.bodyHash}`;
        if (dedupCache.has(dedupSig)) {
          res.writeHead(202, { "Content-Type": "application/json" }).end(
            JSON.stringify({ ok: true, deduplicated: true, hookId })
          );
          return;
        }
        dedupCache.set(dedupSig, now + hook.dedupWindowSec * 1000);
      }

      hits.push(now);
      rateBuckets.set(hookId, hits);

      res.writeHead(202, { "Content-Type": "application/json" }).end(
        JSON.stringify({ ok: true, queued: true, hookId, channelId: hook.channelId })
      );

      Promise.resolve(onTriggerWebhook(hook, event)).catch((err) => {
        console.error(`[webhook] Dispatch failed for '${hookId}':`, err.message || err);
      });
    });
  }

  return {
    async start() {
      const cfg = getWebhookConfig();
      if (!cfg.enabled) {
        await this.stop();
        return null;
      }
      if (server) return listeningAddr;

      return await new Promise((resolve) => {
        const srv = http.createServer(handleHttpRequest);
        srv.on("error", (err) => {
          console.error(`[webhook] Failed to listen on ${cfg.host}:${cfg.port}:`, err.message);
          resolve(null);
        });
        srv.listen(cfg.port, cfg.host, () => {
          server = srv;
          listeningAddr = srv.address();
          srv.unref?.();
          console.log(`[webhook] Listening on http://${listeningAddr.address}:${listeningAddr.port}`);
          resolve(listeningAddr);
        });
      });
    },
    async stop() {
      if (!server) return;
      const old = server;
      server = null;
      listeningAddr = null;
      await new Promise((resolve) => old.close(() => resolve()));
    },
    async reload() {
      await this.stop();
      return await this.start();
    },
    getAddress() {
      return listeningAddr;
    },
    formatStatus() {
      const cfg = getWebhookConfig();
      const addr = listeningAddr;
      const lines = [
        "**Trạng thái Webhook Automation Hub:**",
        `• **HTTP Server:** ${
          cfg.enabled
            ? addr
              ? `🟢 Đang lắng nghe \`http://${addr.address}:${addr.port}\``
              : `⚠️ Đang bật trong config nhưng chưa bind được cổng \`${cfg.host}:${cfg.port}\``
            : "⚪ Đang tắt (`webhook.enabled = false` trong `config.json`)"
        }`,
        `• **Rate limit:** \`${cfg.rateLimitPerMin}\` req/phút/hook | **Max body:** \`${Math.round(cfg.maxBodyBytes / 1024)}KB\``,
      ];
      const entries = Object.values(cfg.hooks);
      if (entries.length === 0) {
        lines.push("• **Hooks đã cấu hình:** *(chưa có)*");
      } else {
        lines.push("", "**Danh sách Endpoint Hooks:**");
        for (const h of entries) {
          lines.push(
            `• \`POST /webhook/${h.id}\` → <#${h.channelId}> (${h.createThread ? "tạo Thread" : "tại kênh"}) | cwd=\`${h.cwd || "(mặc định kênh)"}\` | mode=\`${h.mode}\` | sandbox=\`${h.sandbox ? "on" : "off"}\``
          );
        }
      }
      return lines.join("\n");
    },
  };
}
