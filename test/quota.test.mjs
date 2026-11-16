import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  checkMemberQuota,
  getDirectorySizeBytes,
  normalizeMemberLimitsConfig,
  pruneOldMemberUsage,
  recordMemberTurnAccepted,
  recordMemberTurnTokens,
} from "../lib/quota.mjs";

test("checkMemberQuota enforces cooldown, daily turns, and resets across days", () => {
  const state = { memberUsage: {} };
  const limits = normalizeMemberLimitsConfig({ dailyMaxTurns: 2, cooldownSec: 10, dailyMaxTokens: 5000 });
  const day1 = new Date(2026, 10, 16, 10, 0, 0).getTime();

  const ok1 = checkMemberQuota({ state, userId: "u1", globalLimits: limits, nowMs: day1 });
  assert.equal(ok1.allowed, true);
  assert.equal(ok1.remainingTurns, 2);
  recordMemberTurnAccepted(state, "u1", day1);

  const tooFast = checkMemberQuota({ state, userId: "u1", globalLimits: limits, nowMs: day1 + 3000 });
  assert.equal(tooFast.allowed, false);
  assert.equal(tooFast.reason, "cooldown");
  assert.equal(tooFast.waitSec, 7);

  const ok2 = checkMemberQuota({ state, userId: "u1", globalLimits: limits, nowMs: day1 + 11000 });
  assert.equal(ok2.allowed, true);
  recordMemberTurnAccepted(state, "u1", day1 + 11000);

  const cappedTurns = checkMemberQuota({ state, userId: "u1", globalLimits: limits, nowMs: day1 + 30000 });
  assert.equal(cappedTurns.allowed, false);
  assert.equal(cappedTurns.reason, "daily_turns");

  // Next local day resets turns automatically
  const day2 = new Date(2026, 10, 17, 0, 5, 0).getTime();
  const nextDayOk = checkMemberQuota({ state, userId: "u1", globalLimits: limits, nowMs: day2 });
  assert.equal(nextDayOk.allowed, true);
  assert.equal(nextDayOk.remainingTurns, 2);
});

test("checkMemberQuota enforces daily token cap and pruneOldMemberUsage cleans old days", () => {
  const state = { memberUsage: {} };
  const limits = normalizeMemberLimitsConfig({ dailyMaxTurns: 0, cooldownSec: 0, dailyMaxTokens: 1000 });
  const day1 = new Date(2026, 10, 16, 12, 0, 0).getTime();
  const day2 = new Date(2026, 10, 17, 12, 0, 0).getTime();

  recordMemberTurnAccepted(state, "u2", day1);
  recordMemberTurnTokens(state, "u2", 1200, day1);
  const blocked = checkMemberQuota({ state, userId: "u2", globalLimits: limits, nowMs: day1 + 1000 });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "daily_tokens");

  pruneOldMemberUsage(state, day2);
  assert.equal(state.memberUsage.u2, undefined);
});

test("getDirectorySizeBytes computes total bytes and skips symlinks", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-quota-test-"));
  try {
    fs.writeFileSync(path.join(dir, "a.bin"), Buffer.alloc(1024));
    fs.mkdirSync(path.join(dir, "sub"));
    fs.writeFileSync(path.join(dir, "sub", "b.bin"), Buffer.alloc(512));
    assert.equal(getDirectorySizeBytes(dir), 1536);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
