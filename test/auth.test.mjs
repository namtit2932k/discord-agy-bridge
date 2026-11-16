import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  canExecuteDiscordCommand,
  evaluateMessageAccess,
  normalizeChannelRules,
  resolveTurnExecutionPolicy,
} from "../lib/auth.mjs";

const baseConfig = {
  allowedUserId: "111111111111111111",
  adminUserIds: ["222222222222222222"],
  allowDm: true,
  allowedChannelIds: ["333333333333333333"],
  channelRules: normalizeChannelRules({
    "444444444444444444": {
      label: "Member: tester",
      cwd: os.tmpdir(),
      onboardedUserId: "555555555555555555",
      allowUserIds: ["555555555555555555"],
      model: "gemini-3.8-flash-low",
      sandbox: true,
      allowNonWorkspaceAccess: false,
      allowDesktopTools: false,
      allowChrome: false,
      allowClear: true,
    },
  }),
};

test("evaluateMessageAccess handles DM, #announcement, and member RBAC channels", () => {
  const freeChat = new Set();
  const safeFallback = os.tmpdir();

  const adminDm = evaluateMessageAccess({
    msg: { author: { id: "111111111111111111" }, channel_id: "dm1" },
    config: baseConfig,
    isDm: true,
    isThread: false,
    parentId: null,
    isGuideChannel: false,
    freeChatChannelIds: freeChat,
    fallbackSafeCwd: safeFallback,
  });
  assert.equal(adminDm?.isAdmin, true);

  const memberDm = evaluateMessageAccess({
    msg: { author: { id: "555555555555555555" }, channel_id: "dm2" },
    config: baseConfig,
    isDm: true,
    isThread: false,
    parentId: null,
    isGuideChannel: false,
    freeChatChannelIds: freeChat,
    fallbackSafeCwd: safeFallback,
  });
  assert.equal(memberDm, null);

  const adminAnnounce = evaluateMessageAccess({
    msg: { author: { id: "111111111111111111" }, channel_id: "999999999999999999" },
    config: baseConfig,
    isDm: false,
    isThread: false,
    parentId: null,
    isGuideChannel: false,
    isAnnounceChannel: true,
    freeChatChannelIds: freeChat,
    fallbackSafeCwd: safeFallback,
  });
  assert.equal(adminAnnounce?.isAnnounceChannel, true);
  assert.equal(canExecuteDiscordCommand("/clear", adminAnnounce), true);
  assert.equal(canExecuteDiscordCommand("/new", adminAnnounce), false);

  const memberAnnounce = evaluateMessageAccess({
    msg: { author: { id: "555555555555555555" }, channel_id: "999999999999999999" },
    config: baseConfig,
    isDm: false,
    isThread: false,
    parentId: null,
    isGuideChannel: false,
    isAnnounceChannel: true,
    freeChatChannelIds: freeChat,
    fallbackSafeCwd: safeFallback,
  });
  assert.equal(memberAnnounce, null);
});

test("canExecuteDiscordCommand and resolveTurnExecutionPolicy isolate members from Admin state", () => {
  const memberWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "agy-auth-test-"));
  try {
    const cfg = {
      ...baseConfig,
      channelRules: normalizeChannelRules({
        "444444444444444444": {
          cwd: memberWorkspace,
          onboardedUserId: "555555555555555555",
          allowUserIds: ["555555555555555555"],
          model: "gemini-3.8-flash-low",
          allowClear: true,
        },
      }),
    };
    const route = evaluateMessageAccess({
      msg: { author: { id: "555555555555555555" }, channel_id: "thread1", member: { roles: [] } },
      config: cfg,
      isDm: false,
      isThread: true,
      parentId: "444444444444444444",
      isGuideChannel: false,
      freeChatChannelIds: new Set(),
      fallbackSafeCwd: os.tmpdir(),
    });
    assert.equal(route?.isAdmin, false);
    assert.equal(canExecuteDiscordCommand("/clear", route), true);
    assert.equal(canExecuteDiscordCommand("/play", route), true);
    assert.equal(canExecuteDiscordCommand("/music", route), false);
    assert.equal(canExecuteDiscordCommand("/help", route), true);
    assert.equal(canExecuteDiscordCommand("/access", route), false);
    assert.equal(canExecuteDiscordCommand("/model", route), false);

    const exec = resolveTurnExecutionPolicy(
      route.policy,
      { cwd: "C:\\AdminSecret", projectId: "proj-secret", model: "gemini-3.8-flash-high", sandbox: false },
      os.tmpdir()
    );
    assert.equal(exec.isAdmin, false);
    assert.equal(exec.cwd, path.resolve(memberWorkspace));
    assert.equal(exec.projectId, "");
    assert.equal(exec.model, "gemini-3.8-flash-low");
    assert.equal(exec.sandbox, true);
    assert.equal(exec.allowDesktopTools, false);
    assert.equal(exec.allowChrome, false);
    assert.deepEqual(exec.allowedMcpTools, ["send_to_discord", "text_to_speech"]);
  } finally {
    fs.rmSync(memberWorkspace, { recursive: true, force: true });
  }
});
