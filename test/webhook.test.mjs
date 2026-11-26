import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createWebhookServer,
  normalizeWebhookConfig,
  prepareWebhookEvent,
  verifyWebhookRequestAuth,
} from "../lib/webhook.mjs";

test("verifyWebhookRequestAuth validates Bearer, X-Webhook-Secret, and HMAC-SHA256 signatures", () => {
  const secret = "super-secret-webhook-key";
  const body = Buffer.from(JSON.stringify({ event: "deploy", ok: true }), "utf8");
  const hook = { id: "ci", secret: "", hmacHeader: "" };

  // Reject when no secret is configured at all
  assert.equal(verifyWebhookRequestAuth({ headers: {} }, body, hook, "").status, 403);

  // Bearer token
  assert.equal(
    verifyWebhookRequestAuth({ headers: { authorization: `Bearer ${secret}` } }, body, hook, secret).ok,
    true
  );

  // X-Webhook-Secret header
  assert.equal(
    verifyWebhookRequestAuth({ headers: { "x-webhook-secret": secret } }, body, hook, secret).ok,
    true
  );

  // HMAC-SHA256 X-Hub-Signature-256
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(
    verifyWebhookRequestAuth({ headers: { "x-hub-signature-256": `sha256=${sig}` } }, body, hook, secret).ok,
    true
  );

  // Wrong signature / wrong token
  assert.equal(
    verifyWebhookRequestAuth({ headers: { "x-hub-signature-256": "sha256=deadbeef" } }, body, hook, secret).status,
    401
  );
  assert.equal(
    verifyWebhookRequestAuth({ headers: { authorization: "Bearer wrong" } }, body, hook, secret).status,
    401
  );
});

test("prepareWebhookEvent stages oversized payloads to disk and normalizes allowFirecrawl default false", () => {
  const cfg = normalizeWebhookConfig({
    enabled: true,
    hooks: {
      alerts: { channelId: "123456789012345678" },
      crawler: { channelId: "123456789012345678", allowFirecrawl: true },
    },
  });
  assert.equal(cfg.hooks.alerts.allowFirecrawl, false);
  assert.equal(cfg.hooks.crawler.allowFirecrawl, true);

  const tmpAttach = fs.mkdtempSync(path.join(os.tmpdir(), "agy-webhook-test-"));
  try {
    const bigPayload = JSON.stringify({ title: "OOM Alert", log: "x".repeat(3200) });
    const ev = prepareWebhookEvent(cfg.hooks.alerts, bigPayload, "application/json", tmpAttach);
    assert.equal(ev.titleHint, "OOM Alert");
    assert.ok(ev.stagedPath && fs.existsSync(ev.stagedPath));
    assert.match(ev.prompt, /Full Webhook Payload saved to:/);
  } finally {
    fs.rmSync(tmpAttach, { recursive: true, force: true });
  }
});

test("createWebhookServer returns 401 for unauthenticated unknown hooks and deduplicates valid calls", async () => {
  const secret = "live-test-secret-123";
  const dispatches = [];
  const cfg = normalizeWebhookConfig({
    enabled: true,
    host: "127.0.0.1",
    port: 0,
    defaultSecret: secret,
    hooks: {
      alerts: {
        channelId: "123456789012345678",
        dedupWindowSec: 60,
      },
    },
  });

  const srv = createWebhookServer({
    getWebhookConfig: () => cfg,
    attachRoot: "",
    isGatewayReady: () => true,
    onTriggerWebhook: (hook, event) => {
      dispatches.push({ hookId: hook.id, title: event.titleHint });
    },
  });

  const addr = await srv.start();
  assert.ok(addr && addr.port > 0);
  try {
    const base = `http://127.0.0.1:${addr.port}`;

    // Unauthenticated request to unknown hook must return 401 (no hook enumeration)
    const unauthUnknown = await fetch(`${base}/webhook/does-not-exist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(unauthUnknown.status, 401);

    // Authenticated request to unknown hook returns 404
    const authUnknown = await fetch(`${base}/webhook/does-not-exist`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(authUnknown.status, 404);

    // Valid hook request + deduplicated repeat
    const payload = JSON.stringify({ title: "Disk 95%" });
    const first = await fetch(`${base}/webhook/alerts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: payload,
    });
    assert.equal(first.status, 202);
    assert.equal((await first.json()).queued, true);

    const dup = await fetch(`${base}/webhook/alerts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: payload,
    });
    assert.equal(dup.status, 202);
    assert.equal((await dup.json()).deduplicated, true);
    assert.equal(dispatches.length, 1);
  } finally {
    await srv.stop();
  }
});
