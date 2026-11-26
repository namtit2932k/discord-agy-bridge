import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MEMBER_SAFE_MCP_TOOLS } from "../lib/auth.mjs";
import {
  MCP_TOOLS,
  createDesktopToolHandler,
  filterMcpTools,
  getChannelTempDir,
  getChromeAmStatus,
  pruneOldTempFiles,
  splitTtsChunks,
} from "../lib/desktop.mjs";

test("splitTtsChunks preserves short text and splits long text cleanly on boundaries", () => {
  assert.deepEqual(splitTtsChunks("   "), []);
  assert.deepEqual(splitTtsChunks("Xin chào mọi người"), ["Xin chào mọi người"]);

  const longText = Array.from({ length: 12 }, (_, i) => `Câu số ${i + 1} rất là dài để kiểm tra cách ngắt đoạn.`).join(" ");
  const chunks = splitTtsChunks(longText, 120);
  assert.equal(chunks.length > 2, true);
  for (const chunk of chunks) {
    assert.equal(chunk.length <= 120, true);
  }
});

test("filterMcpTools exposes text_to_speech and send_to_discord for safe Member scopes", () => {
  const memberTools = filterMcpTools(MEMBER_SAFE_MCP_TOOLS);
  assert.deepEqual(
    memberTools.map((t) => t.name).sort(),
    ["send_to_discord", "text_to_speech"]
  );
  assert.equal(MCP_TOOLS.some((t) => t.name === "text_to_speech"), true);
});

test("getChromeAmStatus always returns an array tabs field", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/json/version")) {
      return { ok: true, json: async () => ({ Browser: "Chrome/131" }) };
    }
    if (String(url).endsWith("/json/list")) {
      return {
        ok: true,
        json: async () => [
          { type: "page", title: "Discord", url: "https://discord.com/app" },
          { type: "service_worker", title: "sw", url: "https://discord.com/sw.js" },
        ],
      };
    }
    return { ok: false };
  };
  try {
    const st = await getChromeAmStatus(200);
    assert.equal(st.running, true);
    assert.equal(st.tabCount, 1);
    assert.deepEqual(st.tabs, [{ title: "Discord", url: "https://discord.com/app" }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("send_to_discord isolates per-channel discord-temp directories across tenants and prunes subdirs", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agy-desktop-iso-"));
  const tempDir = path.join(root, "discord-temp");
  const attachDir = path.join(root, "discord-attachments");
  const memberCwd = path.join(root, "member-ws");
  const adminTempDir = getChannelTempDir(tempDir, "111111111111111111");
  const memberTempDir = getChannelTempDir(tempDir, "222222222222222222");
  fs.mkdirSync(adminTempDir, { recursive: true });
  fs.mkdirSync(memberTempDir, { recursive: true });
  fs.mkdirSync(memberCwd, { recursive: true });

  const adminSecretShot = path.join(adminTempDir, "desktop-secret.png");
  const memberTempFile = path.join(memberTempDir, "member-tts.mp3");
  fs.writeFileSync(adminSecretShot, "admin-desktop-png");
  fs.writeFileSync(memberTempFile, "member-audio");

  const uploaded = [];
  const handler = createDesktopToolHandler({
    getDefaultCwd: () => root,
    getFallbackCwd: () => root,
    tempDir,
    attachDir,
    noProjectDir: path.join(root, "no-project"),
    deletedChannels: new Set(),
    getRunScope: () => ({
      isAdmin: false,
      allowedMcpTools: MEMBER_SAFE_MCP_TOOLS,
      cwd: memberCwd,
      channelId: "222222222222222222",
    }),
    resolveLocalFilePath: (raw, cwd) => (path.isAbsolute(raw) ? raw : path.resolve(cwd, raw)),
    sendDiscordAttachments: async (_ch, paths) => {
      uploaded.push(...paths);
      return paths.map((p) => ({ absPath: p, filename: path.basename(p), size: 12 }));
    },
  });

  try {
    // Member trying to send Admin's screenshot from another channel's temp subdir must be denied
    const denied = await handler(
      "send_to_discord",
      { path: adminSecretShot },
      memberCwd,
      { channelId: "222222222222222222", runId: "run-1" }
    );
    assert.equal(denied.isError, true);
    assert.match(denied.text, /Permission denied/i);

    // Member sending their own channel's temp file succeeds
    const ok = await handler(
      "send_to_discord",
      { path: memberTempFile, delete_after_send: true },
      memberCwd,
      { channelId: "222222222222222222", runId: "run-1" }
    );
    assert.equal(ok.isError, false);
    assert.equal(uploaded.length, 1);
    assert.equal(fs.existsSync(memberTempFile), false);

    // Prune cleans files inside nested channel subdirs and removes empty subdirs
    const removed = pruneOldTempFiles(tempDir, -1000);
    assert.equal(removed, 1);
    assert.equal(fs.existsSync(adminTempDir), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
