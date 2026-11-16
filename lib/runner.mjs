import { execFile } from "node:child_process";

export const RUN_PRIORITY_USER = 1;
export const RUN_PRIORITY_WEBHOOK = 2;
export const RUN_PRIORITY_CRON = 3;

export const WEB_BROWSER_HINT_RE =
  /(?:^|\P{L})(?:chrome|edge|browser|trình duyệt|web|trang|tab|url|link|website|youtube|yt|livestream|stream|video|kênh|channel|facebook|fb|tiktok|google|gmail|github|reddit|comment|bình luận|nhập|gõ|đăng|submit|click|bấm|cuộn|scroll|snapshot|screenshot|chụp màn hình|scrape|dom|html)(?=$|\P{L})|\.html?\b|https?:\/\/|localhost:\d+|\b[a-z0-9-]+\.(?:com|org|net|io|vn|dev|ai|tv|gg)\b/iu;

export const DESKTOP_OPEN_HINT_RE = new RegExp(
  `${WEB_BROWSER_HINT_RE.source}|(?:^|\\P{L})(?:app|ứng dụng|phần mềm|chương trình|notepad|vscode|vs code|calc|calculator|paint|word|excel|powerpoint|pptx|xlsx|docx|slide|thuyết trình|báo cáo|tài liệu|hợp đồng|tiểu luận|bảng tính|danh sách|sơ yếu lý lịch|cv|flashcard|dashboard|tông màu|màu sắc|style|theme|audio|tts|mp3|voice|phát âm|giọng|terminal|cmd|powershell|discord|zalo|spotify|settings|cài đặt|mở|bật|chạy|khởi động|xem|đọc|lấy|tìm|chụp|gửi|xuất|nén|tạo ảnh|ảnh|hình|file|tệp|pdf|csv|zip|svg|biểu đồ|đồ thị|clipboard|cửa sổ|window|open|launch|start|run|preview|explorer|read|send|upload|export|image|chart)(?=$|\\P{L})`,
  "iu"
);

const FILE_PPTX_HINT_RE = /(?:^|\P{L})(?:pptx|powerpoint|slide|thuyết trình|bài giảng|presentation|deck)(?=$|\P{L})/iu;
const FILE_SHEET_HINT_RE = /(?:^|\P{L})(?:xlsx|xls|excel|csv|bảng tính|trang tính|sheet|spreadsheet|bảng lương|bảng điểm|thống kê|danh sách)(?=$|\P{L})/iu;
const FILE_DOCX_HINT_RE = /(?:^|\P{L})(?:docx|word|hợp đồng|tiểu luận|đơn từ|văn bản|sơ yếu lý lịch|cv|báo cáo|tài liệu)(?=$|\P{L})/iu;
const FILE_PDF_HINT_RE = /(?:^|\P{L})pdf(?=$|\P{L})/iu;
const FILE_HTML_HINT_RE = /(?:^|\P{L})(?:html|trang web|dashboard|landing|flashcard|web tĩnh)(?=$|\P{L})|\.html?\b/iu;
const FILE_PACK_HINT_RE = /(?:^|\P{L})(?:zip|nén|gói file|archive|svg|biểu đồ|đồ thị|chart)(?=$|\P{L})/iu;

/** Build concise NODE_PATH helper instructions tailored to the file formats mentioned in the prompt. */
export function buildSharedToolsHint(hintSource = "") {
  const text = String(hintSource || "");
  const snippets = [
    "Pre-installed CommonJS modules on NODE_PATH (NEVER probe Python/global dirs or run npm/pnpm install; write ONE .js script using require(...) -> node script.js -> send_to_discord): `quick-files` (`quick-deck` .pptx, `quick-sheet` .xlsx/.csv, `quick-doc` .docx, `quick-pdf` .pdf, `quick-html` .html, `buildZip` .zip, `buildChartSvg` .svg; raw libs: `pptxgenjs`, `exceljs`, `xlsx`, `docx`, `pdfkit`, `archiver`). All quick-* helpers accept `theme` ('clean-light'|'navy'|'dark-gold'|'emerald'), custom `colors: { bg, accent, surface?, surfaceAlt?, title?, text? }` (supports ANY hex OR CSS color name like 'pink', 'white', 'purple', 'mint', 'cream', 'black' and auto-derives contrast), and `font`. If the user asks for an unconventional custom layout outside quick-* helpers, use the raw libraries directly.",
  ];
  if (FILE_PPTX_HINT_RE.test(text)) {
    snippets.push(
      "PPTX helper: `const { buildDeck } = require('quick-deck'); await buildDeck({ title, subtitle, theme, colors?: { bg, accent, ... }, slides: [{ type: 'section', title, subtitle } | { title, subtitle, bullets, cards: [{ title, body }], table: { headers, rows }, quote }], outPath })`."
    );
  }
  if (FILE_SHEET_HINT_RE.test(text)) {
    snippets.push(
      "Excel/CSV helper: `const { buildWorkbook, buildCsv } = require('quick-sheet'); await buildWorkbook({ title, theme: 'navy'|'emerald'|'clean-light', sheets: [{ name, title, subtitle, headers, rows, totalRow, notes }], outPath })` (supports `{ formula }` cells & auto-fits columns) or `await buildCsv({ headers, rows, outPath })`."
    );
  }
  if (FILE_DOCX_HINT_RE.test(text)) {
    snippets.push(
      "Word DOCX helper: `const { buildDoc } = require('quick-doc'); await buildDoc({ title, subtitle, meta, theme: 'navy'|'clean-light', footer, sections: [{ heading, level, paragraphs, bullets, numbered, callout: { title, text }, quote, table: { headers, rows } }], outPath })`."
    );
  }
  if (FILE_PDF_HINT_RE.test(text)) {
    snippets.push(
      "PDF helper (Vietnamese Unicode Arial + auto page-break ready): `const { buildPdf } = require('quick-pdf'); await buildPdf({ title, subtitle, meta, theme: 'navy'|'clean-light', footer, sections: [{ heading, level, paragraphs, bullets, numbered, callout: { title, text }, quote, code, table: { headers, rows } }], outPath })`."
    );
  }
  if (FILE_HTML_HINT_RE.test(text)) {
    snippets.push(
      "HTML report/page helper: `const { buildHtml } = require('quick-html'); await buildHtml({ title, subtitle, meta, theme, stats: [{ label, value, note }], charts: [{ title, items: [{ label, value }] }], sections: [{ heading, paragraphs, bullets, callout, table: { headers, rows }, code, html }], outPath })`."
    );
  }
  if (FILE_PACK_HINT_RE.test(text)) {
    snippets.push(
      "ZIP/Chart SVG helper: `const { buildZip, buildChartSvg } = require('quick-files'); await buildZip({ files: [...], dir?, outPath })`; `await buildChartSvg({ title, type: 'bar'|'pie'|'donut', items: [{ label, value }], outPath })`."
    );
  }
  return ` ${snippets.join(" ")}`;
}

export const CHROME_DEVTOOLS_FAST_GUIDE = [
  "chrome-devtools quick signatures (call directly via call_mcp_tool without read_file unless an unlisted tool or validation error occurs):",
  '- list_pages({}), select_page({pageId, bringToFront?}), new_page({url, background?, timeout?}), navigate_page({pageId, type:"url"|"back"|"forward"|"reload", url?})',
  "- take_snapshot({pageId, verbose?}), wait_for({pageId, text:[...], visible?, timeout?}), take_screenshot({pageId, filePath?, format?, uid?, fullPage?})",
  "- click({pageId, uid, dblClick?, includeSnapshot?}), fill({pageId, uid, value, includeSnapshot?}), type_text({pageId, text, submitKey?}), press_key({pageId, key, includeSnapshot?})",
  '- evaluate_script({pageId, function:"async () => { ... }" /* return JSON; omit format (defaults to "function") */, args?, waitForStableDom?})',
  "Chrome speed rules: (1) Combine multi-step page work into ONE async evaluate_script call with a brief internal wait/scroll polling loop (for (let i=0; i<20; i++) { ... await new Promise(r=>setTimeout(r,300)); }) instead of separate micro-calls to scroll, probe selectors, focus, type, and click submit. (2) Minimize take_snapshot on heavy SPAs (e.g. YouTube): pass includeSnapshot:true on click/fill/press_key only when you still need the updated DOM, and skip a trailing confirmation take_snapshot when the action or evaluate_script return value already confirms success. (3) When capturing a screenshot to send to Discord, pass a local filePath to take_screenshot and then call send_to_discord({path}).",
].join("\n");

/** Clamp the configured global max concurrent agy runs to a safe range. */
export function normalizeMaxConcurrentRuns(rawValue, fallback = 2) {
  const num = Number(rawValue);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.max(1, Math.min(10, Math.floor(num)));
}

/** Resolve --print-timeout value for Admin vs restricted Member/Webhook runs. */
export function resolveTurnTimeout({ execPolicy, config }) {
  if (execPolicy?.isAdmin) {
    return String(config?.printTimeout || "15m").trim();
  }
  return String(config?.memberPrintTimeout || config?.printTimeout || "5m").trim();
}

/** Build a priority-ordered global semaphore limiting concurrent agy processes across channels, webhooks, and cron jobs. */
export function createPrioritySemaphore({ getMaxConcurrent = () => 2 } = {}) {
  let active = 0;
  let seqCounter = 0;
  const waiters = [];

  const maxCap = () => normalizeMaxConcurrentRuns(getMaxConcurrent(), 2);

  const pump = () => {
    while (active < maxCap() && waiters.length > 0) {
      waiters.sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : a.seq - b.seq));
      const next = waiters.shift();
      if (!next || next.settled) continue;
      next.settled = true;
      next.cleanup();
      active += 1;
      let released = false;
      next.resolve(() => {
        if (released) return;
        released = true;
        active = Math.max(0, active - 1);
        pump();
      });
    }
  };

  function acquire({ priority = RUN_PRIORITY_USER, signal = null, onWait = null } = {}) {
    if (signal?.aborted) {
      return Promise.reject(new Error("ABORTED"));
    }
    if (active < maxCap() && waiters.length === 0) {
      active += 1;
      let released = false;
      return Promise.resolve(() => {
        if (released) return;
        released = true;
        active = Math.max(0, active - 1);
        pump();
      });
    }

    return new Promise((resolve, reject) => {
      const waiter = {
        priority: Number.isFinite(priority) ? priority : RUN_PRIORITY_USER,
        seq: ++seqCounter,
        settled: false,
        resolve,
        reject,
        cleanup: () => {},
      };

      const onAbort = () => {
        if (waiter.settled) return;
        waiter.settled = true;
        const idx = waiters.indexOf(waiter);
        if (idx !== -1) waiters.splice(idx, 1);
        waiter.cleanup();
        reject(new Error("ABORTED"));
      };

      if (signal) {
        signal.addEventListener("abort", onAbort, { once: true });
        waiter.cleanup = () => signal.removeEventListener("abort", onAbort);
      }

      waiters.push(waiter);
      if (typeof onWait === "function") {
        try {
          onWait({ active, queued: waiters.length, maxConcurrent: maxCap() });
        } catch {
          // Ignore callback notification errors
        }
      }
    });
  }

  return {
    acquire,
    getStats() {
      return {
        active,
        queued: waiters.length,
        maxConcurrent: maxCap(),
      };
    },
  };
}

/** Format an incoming user prompt with any replied-to message context & attachments. */
export function formatPromptWithReplyContext({ prompt, replyContext = null, replyAttachmentLines = [] }) {
  const cleanPrompt = String(prompt || "").trim();
  if (!replyContext) return cleanPrompt;

  const who = replyContext.isBot ? `bot ${replyContext.authorLabel}` : replyContext.authorLabel;
  const replyLines = [`[Tin nhắn được Reply từ ${who}]:`];
  if (replyContext.text) replyLines.push(replyContext.text);
  if (Array.isArray(replyAttachmentLines) && replyAttachmentLines.length > 0) {
    replyLines.push(...replyAttachmentLines);
  }
  const replyBlock = replyLines.join("\n");
  if (!cleanPrompt) return replyBlock;
  return `${replyBlock}\n\n[Yêu cầu hiện tại]:\n${cleanPrompt}`;
}

/** Append lightweight desktop/Chrome MCP notes + live Chrome AM pre-check respecting per-turn RBAC policy. */
export function buildEffectivePrompt({
  execPolicy,
  chState,
  prompt,
  hintText = prompt,
  chromeStatus = null,
  mcpBridgeEnabled = false,
  chromeAmDebugUrl = "http://127.0.0.1:9229",
  sharedToolsReady = false,
}) {
  if (!mcpBridgeEnabled) return { effectivePrompt: prompt, injectedFullWebGuide: false };
  const hintSource = String(hintText ?? "");
  const sharedLibsNote = sharedToolsReady ? buildSharedToolsHint(hintSource) : "";

  if (!execPolicy.allowDesktopTools && !execPolicy.allowChrome) {
    const needsSendNote = !chState.conversationId || DESKTOP_OPEN_HINT_RE.test(hintSource);
    const securityRule =
      "Security rules: NEVER set BypassSandbox: true in run_command, NEVER run package managers (npm install, pip install) or fetch/execute external scripts outside the sandbox, and NEVER read or write paths outside your workspace.";
    if (!needsSendNote) return { effectivePrompt: prompt, injectedFullWebGuide: false };
    return {
      effectivePrompt: `${prompt}\n\n[Discord Bridge Runtime Note (Scoped Session): Stay strictly inside workspace "${execPolicy.cwd}". Allowed MCP tools on discord-bridge-desktop via call_mcp_tool: send_to_discord({path | paths, message?, delete_after_send?}) to upload files back to Discord, and text_to_speech({text, lang?, output_path?, send_to_discord?, message?}) for instant Cloud TTS MP3 audio (NEVER probe python/PowerShell/system TTS for audio).${sharedLibsNote} Desktop app launching, screenshots, clipboard, and Chrome browser control are disabled in this session. ${securityRule}]`,
      injectedFullWebGuide: false,
    };
  }

  const needsWebGuide = execPolicy.allowChrome && WEB_BROWSER_HINT_RE.test(hintSource);
  const needsDesktopNote = !chState.conversationId || needsWebGuide || DESKTOP_OPEN_HINT_RE.test(hintSource);
  if (!needsDesktopNote) return { effectivePrompt: prompt, injectedFullWebGuide: false };

  const parts = [
    `[Discord Bridge Runtime Note: Use discord-bridge-desktop via call_mcp_tool for Windows/Discord actions: open_in_chrome({target, new_window?}), open_app({app, target?}), open_desktop_target({target}) to open apps/files/folders/Chrome AM visibly on desktop (DO NOT use run_command or browser subagent); capture_desktop({path?, title?, send_to_discord?, message?}) for screenshots, desktop_clipboard({action:"get"|"set", text?}), desktop_windows({action:"list"|"focus"|"close"|"close_chrome_am", ...}); send_to_discord({path | paths, message?, delete_after_send?}) to upload local files back to Discord; text_to_speech({text, lang?, output_path?, send_to_discord?, message?}) for instant Cloud TTS MP3 audio.${sharedLibsNote} To read or interact with web pages in Chrome AM (dedicated Chrome profile on ${chromeAmDebugUrl}, no consent popup), use chrome-devtools via call_mcp_tool.]`,
  ];
  let injectedFullWebGuide = false;
  if (needsWebGuide) {
    if (chromeStatus?.running) {
      parts.push(
        `[Chrome AM Pre-check: RUNNING on ${chromeAmDebugUrl} (${chromeStatus.tabCount} open tab(s)). Call chrome-devtools directly via call_mcp_tool.]`
      );
    } else if (chromeStatus && chromeStatus.running === false) {
      parts.push(
        `[Chrome AM Pre-check: NOT RUNNING on ${chromeAmDebugUrl}. Call open_in_chrome({target}) or open_app({app:"Chrome AM"}) FIRST before calling chrome-devtools (DO NOT call list_pages first or fall back to curl/run_command/browser subagent).]`,
      );
    }
    if (chState.conversationId && chState.chromeGuideInjected) {
      parts.push(
        "[Chrome Quick Tip: Keep multi-step browser actions batched inside ONE async evaluate_script polling loop via call_mcp_tool.]"
      );
    } else {
      parts.push(`[${CHROME_DEVTOOLS_FAST_GUIDE}]`);
      injectedFullWebGuide = true;
    }
  }
  return {
    effectivePrompt: `${prompt}\n\n${parts.join("\n")}`,
    injectedFullWebGuide,
  };
}

const SLEEP_PING_PS_SCRIPT =
  "$sig='[DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint f);'; " +
  "$k=Add-Type -MemberDefinition $sig -Name K32 -Namespace W -PassThru; " +
  "$null=$k::SetThreadExecutionState(0x00000001)";

/** Periodically reset Windows idle-sleep timer ONLY while at least one agy turn is active. */
export function createSleepInhibitor({ intervalMs = 55000 } = {}) {
  let activeHoldCount = 0;
  let timer = null;

  const pingWindowsAwake = () => {
    if (process.platform !== "win32" || activeHoldCount <= 0) return;
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", SLEEP_PING_PS_SCRIPT],
      { windowsHide: true, timeout: 4000 },
      () => {}
    );
  };

  return {
    acquire() {
      activeHoldCount += 1;
      if (process.platform === "win32" && activeHoldCount === 1) {
        pingWindowsAwake();
        timer = setInterval(pingWindowsAwake, intervalMs);
        timer.unref?.();
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        activeHoldCount = Math.max(0, activeHoldCount - 1);
        if (activeHoldCount === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    getActiveCount() {
      return activeHoldCount;
    },
  };
}
