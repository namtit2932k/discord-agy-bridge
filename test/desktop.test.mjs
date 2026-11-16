import test from "node:test";
import assert from "node:assert/strict";
import { MEMBER_SAFE_MCP_TOOLS } from "../lib/auth.mjs";
import { MCP_TOOLS, filterMcpTools, getChromeAmStatus, splitTtsChunks } from "../lib/desktop.mjs";

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
