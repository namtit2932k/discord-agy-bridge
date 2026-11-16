import test from "node:test";
import assert from "node:assert/strict";
import { SLASH_COMMANDS, interactionToCommand } from "../lib/slash.mjs";

test("/model and /access model commands omit redundant effort parameter", () => {
  const modelCmd = SLASH_COMMANDS.find((c) => c.name === "model");
  assert.ok(modelCmd);
  assert.deepEqual(
    modelCmd.options.map((o) => o.name),
    ["model_id"]
  );

  const accessCmd = SLASH_COMMANDS.find((c) => c.name === "access");
  const accessModelGroup = accessCmd.options.find((o) => o.name === "model");
  for (const sub of accessModelGroup.options) {
    const optNames = (sub.options || []).map((o) => o.name);
    assert.equal(optNames.includes("effort"), false, `/access model ${sub.name} should not define effort`);
  }

  assert.equal(
    interactionToCommand({
      name: "model",
      options: [{ name: "model_id", value: "gemini-4-hydrogen-high" }],
    }),
    "/model gemini-4-hydrogen-high"
  );
});

test("/access quota and /access security convert interaction options cleanly", () => {
  assert.equal(
    interactionToCommand({
      name: "access",
      options: [
        {
          type: 1,
          name: "quota",
          options: [
            { name: "daily_turns", value: 25 },
            { name: "cooldown_sec", value: 10 },
            { name: "user", value: "695586472966750240" },
          ],
        },
      ],
    }),
    "/access quota user:<@695586472966750240> daily_turns:25 cooldown_sec:10"
  );

  assert.equal(
    interactionToCommand({
      name: "access",
      options: [
        {
          type: 1,
          name: "security",
          options: [
            { name: "member_mode", value: "plan" },
            { name: "block_bypass_sandbox", value: "on" },
            { name: "workspace_max_mb", value: 150 },
          ],
        },
      ],
    }),
    "/access security member_mode:plan block_bypass_sandbox:on workspace_max_mb:150"
  );

  assert.equal(
    interactionToCommand({
      name: "access",
      options: [
        {
          type: 1,
          name: "report",
          options: [
            { name: "action", value: "on" },
            { name: "time", value: "21:30" },
          ],
        },
      ],
    }),
    "/access report on 21:30"
  );

  assert.equal(
    interactionToCommand({
      name: "footer",
      options: [
        { name: "state", value: "off" },
        { name: "scope", value: "all" },
      ],
    }),
    "/footer off all"
  );

  assert.equal(
    interactionToCommand({
      name: "autothread",
      options: [
        { name: "state", value: "on" },
        { name: "scope", value: "all" },
      ],
    }),
    "/autothread on all"
  );

  const playCmd = SLASH_COMMANDS.find((c) => c.name === "play");
  assert.ok(playCmd);
  assert.equal(SLASH_COMMANDS.some((c) => c.name === "music"), false);
  assert.equal(playCmd.default_member_permissions, undefined);

  const checkDescriptions = (nodes) => {
    for (const node of nodes || []) {
      assert.ok(node.description && node.description.length >= 1 && node.description.length <= 100, `Description length out of 1..100 for ${node.name}: ${node.description?.length}`);
      if (Array.isArray(node.options)) checkDescriptions(node.options);
    }
  };
  checkDescriptions(SLASH_COMMANDS);
  assert.equal(
    interactionToCommand({
      name: "play",
      options: [{ name: "link-media", value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }],
    }),
    "/play https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  );
  assert.equal(
    interactionToCommand({
      name: "play",
      options: [
        { name: "link-media", value: "skip" },
        { name: "voice", value: "777777777777777777" },
      ],
    }),
    "/play skip voice:777777777777777777"
  );
});
