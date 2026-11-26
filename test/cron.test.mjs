import test from "node:test";
import assert from "node:assert/strict";
import {
  computeNextCronTimestamp,
  createCronManager,
  parseCronAddInput,
  parseCronExpression,
  parseScheduleSpec,
} from "../lib/cron.mjs";

test("parseCronExpression and computeNextCronTimestamp handle ranges, steps, and Sunday=7", () => {
  const parsed = parseCronExpression("30 9 * * 1-5");
  assert.equal(parsed.minute.values.has(30), true);
  assert.equal(parsed.hour.values.has(9), true);
  assert.equal(parsed.dow.values.has(0), false);
  assert.equal(parsed.dow.values.has(5), true);

  // Friday 2026-11-27 10:00 local -> next weekday 09:30 is Monday 2026-11-30 09:30
  const friMorning = new Date(2026, 10, 27, 10, 0, 0).getTime();
  const nextTs = computeNextCronTimestamp(parsed, friMorning);
  const nextDate = new Date(nextTs);
  assert.equal(nextDate.getFullYear(), 2026);
  assert.equal(nextDate.getMonth(), 10);
  assert.equal(nextDate.getDate(), 30);
  assert.equal(nextDate.getHours(), 9);
  assert.equal(nextDate.getMinutes(), 30);

  const sundayCron = parseCronExpression("0 8 * * 7");
  assert.equal(sundayCron.dow.values.has(0), true);
  assert.throws(() => parseCronExpression("0 9 * *"), /đúng 5 trường/);
  assert.throws(() => parseCronExpression("60 9 * * *"), /out of range/i);
});

test("parseScheduleSpec and parseCronAddInput parse every/in/daily/POSIX specs and flags", () => {
  const baseNow = new Date(2026, 10, 27, 8, 0, 0).getTime();

  const every = parseScheduleSpec("every 30m", baseNow);
  assert.equal(every.kind, "every");
  assert.equal(every.intervalMs, 30 * 60_000);
  assert.equal(every.nextRunAt, baseNow + 30 * 60_000);

  const once = parseScheduleSpec("in 2h", baseNow);
  assert.equal(once.kind, "once");
  assert.equal(once.nextRunAt, baseNow + 2 * 3_600_000);

  const daily = parseScheduleSpec("daily 08:30", baseNow);
  assert.equal(daily.kind, "daily");
  assert.equal(daily.expr, "daily 08:30");
  assert.equal(new Date(daily.nextRunAt).getHours(), 8);
  assert.equal(new Date(daily.nextRunAt).getMinutes(), 30);

  const added = parseCronAddInput('--here "0 9 * * 1-5" Kiểm tra báo cáo sáng');
  assert.equal(added.createThread, false);
  assert.equal(added.kind, "cron");
  assert.equal(added.prompt, "Kiểm tra báo cáo sáng");

  const unquoted = parseCronAddInput("daily 21:15 Tổng hợp log hôm nay");
  assert.equal(unquoted.createThread, true);
  assert.equal(unquoted.kind, "daily");
  assert.equal(unquoted.prompt, "Tổng hợp log hôm nay");

  assert.throws(() => parseCronAddInput("invalid"), /Cú pháp/);
});

test("createCronManager manages job lifecycle and reconciles missed once jobs on boot", async () => {
  let saved = 0;
  let triggered = [];
  const state = {
    crons: [
      {
        id: "old1",
        kind: "once",
        expr: "in 5m",
        channelId: "123",
        prompt: "missed",
        enabled: true,
        running: true,
        nextRunAt: Date.now() - 300_000,
      },
    ],
  };

  const mgr = createCronManager({
    state,
    saveState: () => {
      saved += 1;
    },
    onTriggerJob: async (job) => {
      triggered.push(job.id);
    },
  });

  // Boot reconciliation marks missed one-shot job disabled & not running
  assert.equal(state.crons[0].running, false);
  assert.equal(state.crons[0].enabled, false);
  assert.ok(saved >= 1);

  const spec = parseCronAddInput("every 1h Ping server");
  const created = mgr.addJob({ spec, channelId: "555", createThread: true, createdBy: "111" });
  assert.equal(mgr.listJobs().length, 2);

  assert.equal(mgr.pauseJob(created.id)?.enabled, false);
  assert.equal(mgr.resumeJob(created.id)?.enabled, true);

  const runRes = await mgr.runNow(created.id);
  assert.equal(runRes.ok, true);
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(triggered, [created.id]);

  assert.equal(mgr.deleteJob(created.id)?.id, created.id);
  assert.equal(mgr.listJobs().length, 1);
});
