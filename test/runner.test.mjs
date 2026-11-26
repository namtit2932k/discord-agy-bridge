import test from "node:test";
import assert from "node:assert/strict";
import {
  RUN_PRIORITY_CRON,
  RUN_PRIORITY_USER,
  RUN_PRIORITY_WEBHOOK,
  buildEffectivePrompt,
  buildSharedToolsHint,
  createPrioritySemaphore,
  createSleepInhibitor,
  formatPromptWithReplyContext,
  normalizeMaxConcurrentRuns,
  resolveTurnTimeout,
} from "../lib/runner.mjs";

test("createPrioritySemaphore enforces cap, priority ordering, and cancellation", async () => {
  const sem = createPrioritySemaphore({ getMaxConcurrent: () => 2 });
  const r1 = await sem.acquire({ priority: RUN_PRIORITY_USER });
  const r2 = await sem.acquire({ priority: RUN_PRIORITY_USER });
  assert.equal(sem.getStats().active, 2);

  const order = [];
  let waitNotified = false;
  const pCron = sem
    .acquire({ priority: RUN_PRIORITY_CRON, onWait: () => (waitNotified = true) })
    .then((rel) => {
      order.push("cron");
      rel();
    });
  const pHook = sem.acquire({ priority: RUN_PRIORITY_WEBHOOK }).then((rel) => {
    order.push("webhook");
    rel();
  });
  const pUser = sem.acquire({ priority: RUN_PRIORITY_USER }).then((rel) => {
    order.push("user");
    rel();
  });

  const ac = new AbortController();
  const pCancelled = sem.acquire({ priority: RUN_PRIORITY_USER, signal: ac.signal });
  ac.abort();
  await assert.rejects(pCancelled, /ABORTED/);
  assert.equal(waitNotified, true);
  assert.equal(sem.getStats().queued, 3);

  r1();
  r1();
  r2();
  await Promise.all([pCron, pHook, pUser]);
  assert.deepEqual(order, ["user", "webhook", "cron"]);
  assert.equal(sem.getStats().active, 0);
  assert.equal(sem.getStats().queued, 0);
});

test("resolveTurnTimeout and normalizeMaxConcurrentRuns apply safe defaults", () => {
  assert.equal(normalizeMaxConcurrentRuns(0), 2);
  assert.equal(normalizeMaxConcurrentRuns(99), 10);
  assert.equal(
    resolveTurnTimeout({ execPolicy: { isAdmin: true }, config: { printTimeout: "15m", memberPrintTimeout: "5m" } }),
    "15m"
  );
  assert.equal(
    resolveTurnTimeout({ execPolicy: { isAdmin: false }, config: { printTimeout: "15m", memberPrintTimeout: "5m" } }),
    "5m"
  );
});

test("buildEffectivePrompt isolates members, splits Desktop/agent-desktop roles, and routes Firecrawl vs Chrome AM", () => {
  const memberRes = buildEffectivePrompt({
    execPolicy: { isAdmin: false, allowDesktopTools: false, allowChrome: false, allowFirecrawl: false, cwd: "C:\\safe" },
    chState: { conversationId: null },
    prompt: "tạo file powerpoint giới thiệu triết gia",
    mcpBridgeEnabled: true,
    sharedToolsReady: true,
  });
  assert.equal(memberRes.injectedFullWebGuide, false);
  assert.equal(memberRes.effectivePrompt.includes("chrome-devtools quick signatures"), false);
  assert.equal(memberRes.effectivePrompt.includes("BypassSandbox: true"), true);
  assert.equal(memberRes.effectivePrompt.includes("agent-desktop, firecrawl, or chrome-devtools"), true);
  assert.equal(memberRes.effectivePrompt.includes("text_to_speech"), true);
  assert.equal(memberRes.effectivePrompt.includes("quick-deck"), true);
  assert.equal(memberRes.effectivePrompt.includes("pptxgenjs"), true);

  const adminTurn1 = buildEffectivePrompt({
    execPolicy: { isAdmin: true, allowDesktopTools: true, allowChrome: true, allowFirecrawl: true, cwd: "C:\\admin" },
    chState: { conversationId: null, chromeGuideInjected: false },
    prompt: "check google.com",
    mcpBridgeEnabled: true,
  });
  assert.equal(adminTurn1.injectedFullWebGuide, true);
  assert.equal(adminTurn1.effectivePrompt.includes("chrome-devtools quick signatures"), true);
  assert.equal(adminTurn1.effectivePrompt.includes("Windows Desktop role split"), true);
  assert.equal(adminTurn1.effectivePrompt.includes("agent-desktop_agent-desktop"), true);
  assert.equal(adminTurn1.effectivePrompt.includes("firecrawl_scrape"), true);

  const adminTurn2 = buildEffectivePrompt({
    execPolicy: { isAdmin: true, allowDesktopTools: true, allowChrome: true, allowFirecrawl: true, cwd: "C:\\admin" },
    chState: { conversationId: "conv-1", chromeGuideInjected: true },
    prompt: "check youtube.com",
    mcpBridgeEnabled: true,
  });
  assert.equal(adminTurn2.injectedFullWebGuide, false);
  assert.equal(adminTurn2.effectivePrompt.includes("chrome-devtools quick signatures"), false);
  assert.equal(adminTurn2.effectivePrompt.includes("Chrome Quick Tip"), true);
});

test("createSleepInhibitor reference counts active holds", () => {
  const inhibitor = createSleepInhibitor({ intervalMs: 999999 });
  const rel1 = inhibitor.acquire();
  const rel2 = inhibitor.acquire();
  assert.equal(inhibitor.getActiveCount(), 2);
  rel1();
  rel1();
  assert.equal(inhibitor.getActiveCount(), 1);
  rel2();
  assert.equal(inhibitor.getActiveCount(), 0);
});

test("formatPromptWithReplyContext formats replied text and attachments", () => {
  assert.equal(formatPromptWithReplyContext({ prompt: "hỏi bình thường" }), "hỏi bình thường");

  const formatted = formatPromptWithReplyContext({
    prompt: "dịch đoạn này",
    replyContext: {
      authorLabel: "bakemono",
      isBot: false,
      text: "Hello world",
    },
    replyAttachmentLines: ["[Attached File from Discord: sample.png | localPath=C:\\tmp\\sample.png]"],
  });
  assert.match(formatted, /\[Tin nhắn được Reply từ bakemono\]:/);
  assert.match(formatted, /Hello world/);
  assert.match(formatted, /sample\.png/);
  assert.match(formatted, /\[Yêu cầu hiện tại\]:\ndịch đoạn này/);
});

test("buildSharedToolsHint injects format-specific helper APIs only when relevant", () => {
  const generic = buildSharedToolsHint("hôm nay thời tiết thế nào");
  assert.equal(generic.includes("quick-files"), true);
  assert.equal(generic.includes("buildWorkbook"), false);
  assert.equal(generic.includes("buildDoc"), false);

  const excelHint = buildSharedToolsHint("tạo file excel danh sách tổng thống");
  assert.equal(excelHint.includes("buildWorkbook"), true);
  assert.equal(excelHint.includes("buildDoc"), false);

  const docPdfHint = buildSharedToolsHint("xuất báo cáo word và pdf");
  assert.equal(docPdfHint.includes("buildDoc"), true);
  assert.equal(docPdfHint.includes("buildPdf"), true);

  const webZipHint = buildSharedToolsHint("tạo trang html dashboard và nén zip gửi tôi");
  assert.equal(webZipHint.includes("buildHtml"), true);
  assert.equal(webZipHint.includes("buildZip"), true);
});
