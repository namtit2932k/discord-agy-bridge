import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  extractReplyContext,
  extractSnowflakeId,
  isPathInsideDir,
  quoteSnowflakeLiterals,
  resolveCanonicalPath,
  sanitizeAttachmentFilename,
  sanitizeDiscordReplyText,
} from "../lib/utils.mjs";

test("quoteSnowflakeLiterals preserves 64-bit Snowflake IDs as strings", () => {
  const raw = `{
    "allowedUserId": 442318925703938058,
    "announceChannelId": 1570370595332300810,
    "onboardedUserId": 695586472966750240,
    "categoryId": 1570349327572803715,
    "allowedChannelIds": [1570090646138790022],
    "allowGuildIds": [1570090644200755220]
  }`;
  const parsed = JSON.parse(quoteSnowflakeLiterals(raw));
  assert.equal(parsed.allowedUserId, "442318925703938058");
  assert.equal(parsed.announceChannelId, "1570370595332300810");
  assert.equal(parsed.onboardedUserId, "695586472966750240");
  assert.equal(parsed.categoryId, "1570349327572803715");
  assert.deepEqual(parsed.allowedChannelIds, ["1570090646138790022"]);
  assert.deepEqual(parsed.allowGuildIds, ["1570090644200755220"]);
});

test("isPathInsideDir allows children and blocks traversal escapes", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agy-utils-test-"));
  const subDir = path.join(tempRoot, "workspace");
  const siblingDir = path.join(tempRoot, "workspace-secret");
  fs.mkdirSync(subDir, { recursive: true });
  fs.mkdirSync(siblingDir, { recursive: true });

  try {
    assert.equal(isPathInsideDir(subDir, subDir), true);
    assert.equal(isPathInsideDir(path.join(subDir, "nested", "file.txt"), subDir), true);
    assert.equal(isPathInsideDir(path.join(subDir, "..", "workspace-secret", "leak.txt"), subDir), false);
    assert.equal(isPathInsideDir(siblingDir, subDir), false);
    assert.equal(resolveCanonicalPath(path.join(subDir, "nonexistent.txt")).endsWith("nonexistent.txt"), true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("extractSnowflakeId and sanitizeAttachmentFilename normalize inputs", () => {
  assert.equal(extractSnowflakeId("<@!695586472966750240>"), "695586472966750240");
  assert.equal(extractSnowflakeId("<#1570370595332300810>"), "1570370595332300810");
  assert.equal(extractSnowflakeId("1570088887156604992"), "1570088887156604992");
  assert.equal(extractSnowflakeId("not-an-id"), "");

  assert.equal(sanitizeAttachmentFilename("..\\..\\evil:file?.png "), "evil_file_.png");
  assert.equal(sanitizeAttachmentFilename(""), "attachment.bin");
});

test("extractReplyContext extracts text, embeds, attachments, and truncates safely", () => {
  assert.equal(extractReplyContext(null), null);
  assert.equal(extractReplyContext({ content: "   ", attachments: [] }), null);

  const ctx = extractReplyContext({
    id: "999",
    content: "  Nội dung gốc  ",
    author: { username: "bakemono", bot: false },
    attachments: [{ filename: "photo.png", url: "https://cdn.discordapp.com/photo.png" }],
  });
  assert.deepEqual(ctx, {
    messageId: "999",
    authorLabel: "bakemono",
    isBot: false,
    text: "Nội dung gốc",
    attachments: [{ filename: "photo.png", url: "https://cdn.discordapp.com/photo.png" }],
  });

  const embedCtx = extractReplyContext(
    {
      id: "1000",
      content: "",
      author: { username: "AM", bot: true },
      embeds: [{ title: "Thông báo", description: "Chi tiết rất dài" }],
    },
    18
  );
  assert.equal(embedCtx.isBot, true);
  assert.equal(embedCtx.text.endsWith("..."), true);
  assert.equal(embedCtx.text.length <= 18, true);
});

test("sanitizeDiscordReplyText cleans unusable file:// links and hides member host paths", () => {
  const input =
    "Đã gửi [deck.pptx](file:///C:/Users/Admin/DiscordShared/alice/deck.pptx) tại C:\\Users\\Admin\\DiscordShared\\alice\\deck.pptx ![chart](C:/Users/Admin/DiscordShared/alice/chart.png)";
  const cleanedMember = sanitizeDiscordReplyText(input, {
    hideHostPaths: true,
    workspaceDir: "C:\\Users\\Admin\\DiscordShared\\alice",
  });
  assert.equal(cleanedMember.includes("file:///"), false);
  assert.equal(cleanedMember.includes("C:\\Users\\Admin"), false);
  assert.equal(cleanedMember.includes("`deck.pptx`"), true);
  assert.equal(cleanedMember.includes("![chart]"), true);

  const cleanedAdmin = sanitizeDiscordReplyText(
    "Xem [notes.md](file:///C:/repo/notes.md)",
    { hideHostPaths: false }
  );
  assert.equal(cleanedAdmin, "Xem `notes.md`");
});
