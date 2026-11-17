import test from "node:test";
import assert from "node:assert/strict";
import { buildMemberWelcomeMessage } from "../lib/onboard.mjs";

test("buildMemberWelcomeMessage lists new Gemini models and excludes default family from alternatives", () => {
  const models = [
    { id: "gemini-4-argon-low", label: "Gemini 4 Argon (Low)" },
    { id: "gemini-4-argon-high", label: "Gemini 4 Argon (High)" },
    { id: "gemini-4-hydrogen-low", label: "Gemini 4 Hydrogen (Low)" },
    { id: "gemini-4-hydrogen-xhigh", label: "Gemini 4 Hydrogen (XHigh)" },
    { id: "gemini-pro-orchestrator-g1-pro", label: "Orchestrator (Argon)" },
    { id: "gemini-3.8-flash-low", label: "Gemini 3.8 Flash (Low)" },
    { id: "claude-opus-5-5-high", label: "Claude Opus 5.5 (High)" },
    { id: "claude-sonnet-5-5-high", label: "Claude Sonnet 5.5 (High)" },
    { id: "gpt-oss-120b-medium", label: "GPT-OSS 120B (Medium)" },
  ];

  const msg = buildMemberWelcomeMessage({
    userId: "1234567890",
    defaultModel: "gemini-3.8-flash-low",
    availableModels: models,
  });

  assert.match(msg, /Chào mừng <@1234567890>/);
  assert.match(msg, /Gemini 3\.8 Flash/);
  assert.match(msg, /Gemini 4 Argon/);
  assert.match(msg, /Gemini 4 Hydrogen/);
  assert.match(msg, /Orchestrator \(Argon\)/);
  assert.match(msg, /Claude Opus 5\.5/);
  assert.match(msg, /GPT-OSS 120B/);
});

test("buildMemberWelcomeMessage falls back cleanly when availableModels is empty", () => {
  const msg = buildMemberWelcomeMessage({
    userId: "999",
    defaultModel: "gemini-3.8-flash-low",
    availableModels: [],
  });

  assert.match(msg, /Gemini 3\.8 Flash/);
  assert.match(msg, /Gemini 4/);
  assert.match(msg, /Claude/);
  assert.match(msg, /GPT-OSS/);
});
