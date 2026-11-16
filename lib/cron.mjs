import crypto from "node:crypto";
import { cleanInlineLabel } from "./utils.mjs";

const TICK_INTERVAL_MS = 15_000;
const MIN_INTERVAL_MS = 60_000;

function parseCronField(expr, min, max, isDow = false) {
  const trimmed = String(expr || "").trim();
  if (!trimmed) throw new Error("Empty cron field");
  const isWildcard = trimmed === "*";
  const values = new Set();

  for (const part of trimmed.split(",")) {
    const seg = part.trim();
    if (!seg) throw new Error(`Invalid cron segment in "${expr}"`);
    const slashParts = seg.split("/");
    if (slashParts.length > 2) throw new Error(`Invalid step syntax "${seg}"`);

    const rangePart = slashParts[0];
    const step = slashParts[1] !== undefined ? Number(slashParts[1]) : 1;
    if (!Number.isInteger(step) || step <= 0) {
      throw new Error(`Invalid cron step "${seg}"`);
    }

    let start;
    let end;
    if (rangePart === "*") {
      start = min;
      end = max;
    } else if (rangePart.includes("-")) {
      const bounds = rangePart.split("-");
      if (bounds.length !== 2) throw new Error(`Invalid range "${seg}"`);
      start = Number(bounds[0]);
      end = Number(bounds[1]);
    } else {
      start = Number(rangePart);
      end = slashParts[1] !== undefined ? max : start;
    }

    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      throw new Error(`Cron value out of range [${min}..${max}] in "${seg}"`);
    }

    for (let v = start; v <= end; v += step) {
      values.add(isDow && v === 7 ? 0 : v);
    }
  }

  return { isWildcard, values };
}

/** Parse a 5-field POSIX cron expression (`m h dom mon dow`). */
export function parseCronExpression(expr) {
  const fields = String(expr || "").trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error("Biểu thức cron phải có đúng 5 trường: `phút giờ ngày tháng thứ` (vd `0 9 * * *`).");
  }
  return {
    minute: parseCronField(fields[0], 0, 59, false),
    hour: parseCronField(fields[1], 0, 23, false),
    dom: parseCronField(fields[2], 1, 31, false),
    month: parseCronField(fields[3], 1, 12, false),
    dow: parseCronField(fields[4], 0, 7, true),
  };
}

/** Find the next local timestamp (> afterMs) matching a parsed 5-field cron expression. */
export function computeNextCronTimestamp(parsedCron, afterMs = Date.now()) {
  const start = new Date(afterMs);
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);

  const cursor = new Date(start.getTime());
  const maxYear = cursor.getFullYear() + 2;

  while (cursor.getFullYear() <= maxYear) {
    const mon = cursor.getMonth() + 1;
    if (!parsedCron.month.values.has(mon)) {
      cursor.setMonth(cursor.getMonth() + 1, 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }

    const dom = cursor.getDate();
    const dow = cursor.getDay();
    const dayMatches =
      parsedCron.dom.isWildcard && parsedCron.dow.isWildcard
        ? true
        : parsedCron.dom.isWildcard
          ? parsedCron.dow.values.has(dow)
          : parsedCron.dow.isWildcard
            ? parsedCron.dom.values.has(dom)
            : parsedCron.dom.values.has(dom) || parsedCron.dow.values.has(dow);

    if (!dayMatches) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }

    const hour = cursor.getHours();
    if (!parsedCron.hour.values.has(hour)) {
      cursor.setHours(hour + 1, 0, 0, 0);
      continue;
    }

    const minute = cursor.getMinutes();
    if (!parsedCron.minute.values.has(minute)) {
      cursor.setMinutes(minute + 1, 0, 0);
      continue;
    }

    return cursor.getTime();
  }

  throw new Error("Không tìm thấy thời điểm chạy tiếp theo hợp lệ trong vòng 2 năm tới.");
}

function parseDurationToken(rawDur) {
  const m = String(rawDur || "").trim().match(/^(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i);
  if (!m) return null;
  const num = Number(m[1]);
  if (!Number.isFinite(num) || num <= 0) return null;
  const unit = m[2][0].toLowerCase();
  const mult = unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  const ms = num * mult;
  if (ms < MIN_INTERVAL_MS) throw new Error("Khoảng thời gian tối thiểu là `1m`.");
  return { ms, canonical: `${num}${unit}` };
}

/** Parse schedule spec: `every 30m`, `in 15m`, `daily 08:30`, or 5-field cron `0 9 * * *`. */
export function parseScheduleSpec(rawSpec, nowMs = Date.now()) {
  const clean = String(rawSpec || "").trim();
  if (!clean) {
    throw new Error("Thiếu lịch chạy. Ví dụ: `\"every 1h\"`, `\"daily 08:30\"`, `\"in 15m\"`, hoặc `\"0 9 * * 1-5\"`.");
  }

  const everyMatch = clean.match(/^every\s+(.+)$/i);
  if (everyMatch) {
    const dur = parseDurationToken(everyMatch[1]);
    if (!dur) throw new Error(`Chu kỳ không hợp lệ: \`${clean}\` (vd \`every 30m\`, \`every 2h\`, \`every 1d\`).`);
    return { kind: "every", expr: `every ${dur.canonical}`, intervalMs: dur.ms, nextRunAt: nowMs + dur.ms };
  }

  const inMatch = clean.match(/^in\s+(.+)$/i);
  if (inMatch) {
    const dur = parseDurationToken(inMatch[1]);
    if (!dur) throw new Error(`Thời gian hẹn không hợp lệ: \`${clean}\` (vd \`in 15m\`, \`in 2h\`).`);
    return { kind: "once", expr: `in ${dur.canonical}`, intervalMs: dur.ms, nextRunAt: nowMs + dur.ms };
  }

  const dailyMatch = clean.match(/^daily\s+(\d{1,2}):(\d{2})$/i);
  if (dailyMatch) {
    const hh = Number(dailyMatch[1]);
    const mm = Number(dailyMatch[2]);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      throw new Error(`Giờ \`daily\` không hợp lệ: \`${clean}\` (dùng HH:MM từ 00:00 đến 23:59).`);
    }
    const cronExpr = `${mm} ${hh} * * *`;
    const parsed = parseCronExpression(cronExpr);
    return {
      kind: "daily",
      expr: `daily ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      cronExpr,
      nextRunAt: computeNextCronTimestamp(parsed, nowMs),
    };
  }

  const parsed = parseCronExpression(clean);
  return {
    kind: "cron",
    expr: clean.replace(/\s+/g, " "),
    cronExpr: clean.replace(/\s+/g, " "),
    nextRunAt: computeNextCronTimestamp(parsed, nowMs),
  };
}

/** Compute next run timestamp after a trigger or reload. */
export function computeNextRunAt(job, afterMs = Date.now()) {
  if (!job || !job.enabled) return null;
  if (job.kind === "once") {
    return job.nextRunAt && job.nextRunAt > afterMs ? job.nextRunAt : null;
  }
  if (job.kind === "every") {
    const interval = Number(job.intervalMs || 0);
    return interval >= MIN_INTERVAL_MS ? afterMs + interval : null;
  }
  const expr = job.cronExpr || job.expr;
  const parsed = parseCronExpression(expr);
  return computeNextCronTimestamp(parsed, afterMs);
}

/** Parse `/cron add [--thread|--here] ("<schedule>" | unquoted every/in/daily) <prompt>`. */
export function parseCronAddInput(rawArgStr) {
  let rest = String(rawArgStr || "").trim();
  let createThread = true;

  while (true) {
    if (rest.startsWith("--thread")) {
      createThread = true;
      rest = rest.slice("--thread".length).trim();
      continue;
    }
    if (rest.startsWith("--here")) {
      createThread = false;
      rest = rest.slice("--here".length).trim();
      continue;
    }
    break;
  }

  let scheduleStr = "";
  let prompt = "";

  const quoted = rest.match(/^(?:"([^"]+)"|'([^']+)')\s+([\s\S]+)$/);
  if (quoted) {
    scheduleStr = (quoted[1] ?? quoted[2] ?? "").trim();
    prompt = quoted[3].trim();
  } else {
    const shortMatch = rest.match(/^((?:every|in)\s+\d+[a-z]+|daily\s+\d{1,2}:\d{2})\s+([\s\S]+)$/i);
    if (shortMatch) {
      scheduleStr = shortMatch[1].trim();
      prompt = shortMatch[2].trim();
    }
  }

  if (!scheduleStr || !prompt) {
    throw new Error(
      "Cú pháp: `/cron add schedule:\"<lịch>\" prompt:\"<nội dung>\"` (tùy chọn `here:True`)\nVí dụ: `/cron add schedule:\"every 1h\" prompt:\"Kiểm tra log server\"` hoặc `schedule:\"0 9 * * 1-5\"`"
    );
  }

  const parsed = parseScheduleSpec(scheduleStr);
  return { ...parsed, createThread, prompt };
}

/** Format timestamp concisely in local time. */
export function formatLocalTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Create and run a persistent cron/scheduler manager backed by state.json. */
export function createCronManager({ state, saveState, onTriggerJob }) {
  if (!Array.isArray(state.crons)) state.crons = [];
  let timer = null;

  function reconcileJobsOnBoot() {
    const now = Date.now();
    let dirty = false;
    for (const job of state.crons) {
      if (job.running) {
        job.running = false;
        dirty = true;
      }
      if (job.enabled && (!job.nextRunAt || job.nextRunAt < now - 120_000)) {
        if (job.kind === "once") {
          job.enabled = false;
          job.nextRunAt = null;
          job.lastStatus = job.lastStatus || "skipped (missed while offline)";
        } else {
          try {
            job.nextRunAt = computeNextRunAt(job, now);
          } catch {
            job.enabled = false;
            job.nextRunAt = null;
          }
        }
        dirty = true;
      }
    }
    if (dirty) saveState();
  }

  async function executeJob(job) {
    job.running = true;
    job.lastRunAt = new Date().toISOString();
    job.runCount = Number(job.runCount || 0) + 1;
    if (job.kind === "once") {
      job.enabled = false;
      job.nextRunAt = null;
    } else {
      try {
        job.nextRunAt = computeNextRunAt(job, Date.now());
      } catch {
        job.enabled = false;
        job.nextRunAt = null;
      }
    }
    saveState();

    try {
      await onTriggerJob(job);
      job.lastStatus = "ok";
    } catch (err) {
      job.lastStatus = `error: ${err.message || err}`;
      console.error(`[cron] Job ${job.id} failed:`, err.message || err);
    } finally {
      job.running = false;
      saveState();
    }
  }

  function tick() {
    const now = Date.now();
    for (const job of state.crons) {
      if (!job.enabled || job.running || !job.nextRunAt) continue;
      if (job.nextRunAt <= now) {
        executeJob(job).catch((err) => {
          console.error(`[cron] Unhandled trigger error for ${job.id}:`, err);
        });
      }
    }
  }

  function findJob(id) {
    const key = String(id || "").trim().toLowerCase();
    return state.crons.find((j) => j.id.toLowerCase() === key) || null;
  }

  reconcileJobsOnBoot();

  return {
    start() {
      if (timer) return;
      timer = setInterval(tick, TICK_INTERVAL_MS);
      timer.unref?.();
      console.log(`[cron] Scheduler active (${state.crons.filter((j) => j.enabled).length} enabled job(s)).`);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
    listJobs() {
      return state.crons;
    },
    addJob({ spec, channelId, parentId = null, createThread = true, createdBy = "" }) {
      const id = crypto.randomBytes(3).toString("hex");
      const job = {
        id,
        kind: spec.kind,
        expr: spec.expr,
        cronExpr: spec.cronExpr || null,
        intervalMs: spec.intervalMs || null,
        channelId,
        parentId: parentId || null,
        createThread: Boolean(createThread),
        prompt: spec.prompt,
        enabled: true,
        running: false,
        createdBy,
        createdAt: new Date().toISOString(),
        lastRunAt: null,
        nextRunAt: spec.nextRunAt,
        lastStatus: null,
        runCount: 0,
      };
      state.crons.push(job);
      saveState();
      return job;
    },
    pauseJob(id) {
      const job = findJob(id);
      if (!job) return null;
      job.enabled = false;
      saveState();
      return job;
    },
    resumeJob(id) {
      const job = findJob(id);
      if (!job) return null;
      job.enabled = true;
      job.nextRunAt =
        job.kind === "once"
          ? Date.now() + Number(job.intervalMs || MIN_INTERVAL_MS)
          : computeNextRunAt(job, Date.now());
      saveState();
      return job;
    },
    deleteJob(id) {
      const idx = state.crons.findIndex((j) => j.id.toLowerCase() === String(id || "").trim().toLowerCase());
      if (idx === -1) return null;
      const [removed] = state.crons.splice(idx, 1);
      saveState();
      return removed;
    },
    async runNow(id) {
      const job = findJob(id);
      if (!job) return { ok: false, reason: "not_found" };
      if (job.running) return { ok: false, reason: "already_running", job };
      executeJob(job).catch(() => {});
      return { ok: true, job };
    },
    formatList() {
      if (state.crons.length === 0) {
        return "Chưa có lịch tự động nào. Thêm bằng `/cron add \"every 1h\" \"<nội dung>\"` hoặc `/cron add \"0 9 * * *\" \"<nội dung>\"`.";
      }
      const lines = [`**Danh sách Cron Jobs (${state.crons.length}):**`];
      for (const j of state.crons) {
        const st = j.running ? "⏳ running" : j.enabled ? "🟢 on" : "⏸️ paused";
        const nextStr = j.enabled && j.nextRunAt ? formatLocalTime(j.nextRunAt) : "—";
        const preview = cleanInlineLabel(j.prompt, 65);
        lines.push(
          `• \`${j.id}\` [${st}] | \`${j.expr}\` | Kênh <#${j.channelId}> (${j.createThread ? "tạo Thread" : "tại kênh"}) | Kế tiếp: \`${nextStr}\` | Chạy: ${j.runCount || 0} lần\n  ↳ *${preview}*`
        );
      }
      return lines.join("\n");
    },
    tick,
  };
}
