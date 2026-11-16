import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getLocalDateKey } from "../lib/quota.mjs";
import {
  buildDailyReportMessages,
  createDailyReportScheduler,
  normalizeDailyReportConfig,
  parseDailyReportTime,
  recordSecurityAlert,
} from "../lib/report.mjs";

test("parseDailyReportTime and normalizeDailyReportConfig validate HH:MM safely", () => {
  assert.deepEqual(parseDailyReportTime("9:05"), { hour: 9, minute: 5, formatted: "09:05" });
  assert.equal(parseDailyReportTime("24:00"), null);
  assert.equal(parseDailyReportTime("12:60"), null);

  assert.deepEqual(normalizeDailyReportConfig({ enabled: true, time: "8:30", channelId: "123" }), {
    enabled: true,
    time: "08:30",
    channelId: "123",
  });
  assert.deepEqual(normalizeDailyReportConfig({ time: "invalid" }), {
    enabled: false,
    time: "22:00",
    channelId: "",
  });
});

test("buildDailyReportMessages summarizes member turns, disk usage, and sandbox alerts cleanly", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "daily-report-"));
  try {
    fs.writeFileSync(path.join(tmpDir, "data.bin"), Buffer.alloc(1024 * 1024));
    const nowMs = new Date("2026-11-16T21:00:00").getTime();
    const today = getLocalDateKey(nowMs);
    const state = {
      sessionTotals: { turns: 12, total_tokens: 54000, duration_seconds: 120.5 },
      memberUsage: {
        "111": { date: today, turns: 5, tokens: 12345 },
      },
    };
    recordSecurityAlert(state, { userId: "111", channelId: "999", nowMs });

    const chunks = buildDailyReportMessages({
      state,
      config: {
        dailyReport: { enabled: true, time: "22:00" },
        memberLimits: { dailyMaxTurns: 30, workspaceMaxMb: 1 },
        channelRules: {
          "999": { onboardedUserId: "111", cwd: tmpDir },
        },
      },
      nowMs,
    });
    const text = chunks.join("\n");
    assert.match(text, /Báo cáo tổng kết ngày/);
    assert.match(text, /<@111> \(<#999>\): 5\/30 lượt/);
    assert.match(text, /12,345` tokens/);
    assert.match(text, /⚠️/);
    assert.match(text, /1 cảnh báo/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("createDailyReportScheduler triggers once per day after scheduled HH:MM", async () => {
  const nowMorning = new Date("2026-11-16T09:00:00").getTime();
  const nowEvening = new Date("2026-11-16T22:05:00").getTime();
  let curNow = nowMorning;
  let sentCount = 0;
  const state = { channels: {}, memberUsage: {} };

  const sched = createDailyReportScheduler({
    getConfig: () => ({ dailyReport: { enabled: true, time: "22:00" } }),
    state,
    saveState: () => {},
    isReady: () => true,
    sendReport: async () => {
      sentCount += 1;
    },
    nowMsFn: () => curNow,
  });

  assert.equal(await sched.tick(), false);
  assert.equal(sentCount, 0);

  curNow = nowEvening;
  assert.equal(await sched.tick(), true);
  assert.equal(sentCount, 1);

  // Calling again same day should not duplicate
  assert.equal(await sched.tick(), false);
  assert.equal(sentCount, 1);
});
