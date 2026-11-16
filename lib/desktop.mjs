import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { formatByteSize, isPathInsideDir, sanitizeAttachmentFilename } from "./utils.mjs";

export const MCP_SERVER_NAME = "discord-bridge-desktop";
export const CHROME_AM_DEBUG_PORT = 9229;
export const CHROME_AM_DEBUG_URL = `http://127.0.0.1:${CHROME_AM_DEBUG_PORT}`;

const ALLOWED_EXPLICIT_APP_EXTS = new Set([".exe", ".lnk", ".appref-ms"]);
const APP_CATALOG_TTL_MS = 5 * 60 * 1000;
const TEMP_RETENTION_MS = 24 * 60 * 60 * 1000;

const PROTECTED_WINDOW_PROCESSES = new Set([
  "explorer",
  "dwm",
  "csrss",
  "wininit",
  "winlogon",
  "lsass",
  "services",
  "svchost",
  "conhost",
  "smss",
  "taskmgr",
  "antigravity",
  "language_server",
  "agy",
  "node",
]);

const APP_ALIASES = {
  chrome: ["google chrome", "chrome"],
  "google chrome": ["google chrome", "chrome"],
  vscode: ["code", "visual studio code"],
  "vs code": ["code", "visual studio code"],
  code: ["code", "visual studio code"],
  "visual studio code": ["visual studio code", "code"],
  notepad: ["notepad"],
  calc: ["calc", "calculator"],
  calculator: ["calculator", "calc"],
  "may tinh": ["calculator", "calc"],
  paint: ["mspaint", "paint"],
  mspaint: ["mspaint", "paint"],
  edge: ["msedge", "microsoft edge"],
  msedge: ["msedge", "microsoft edge"],
  "microsoft edge": ["microsoft edge", "msedge"],
  word: ["winword", "word"],
  winword: ["winword", "word"],
  excel: ["excel"],
  powerpoint: ["powerpnt", "powerpoint"],
  ppt: ["powerpnt", "powerpoint"],
  explorer: ["file explorer", "explorer"],
  "file explorer": ["file explorer", "explorer"],
  tep: ["file explorer", "explorer"],
  terminal: ["wt", "terminal", "windows terminal"],
  "windows terminal": ["wt", "terminal", "windows terminal"],
  wt: ["wt", "terminal", "windows terminal"],
  settings: ["settings"],
  "cai dat": ["settings"],
  snip: ["snippingtool", "snipping tool"],
  "snipping tool": ["snipping tool", "snippingtool"],
  "chup man hinh": ["snipping tool", "snippingtool"],
  "notepad++": ["notepad++"],
  powershell: ["pwsh", "powershell"],
  pwsh: ["pwsh", "powershell"],
  cmd: ["cmd"],
  "task manager": ["taskmgr", "task manager"],
  taskmgr: ["taskmgr", "task manager"],
};

export const MCP_TOOLS = [
  {
    name: "open_in_chrome",
    description:
      "Open a local HTML/file path or http/https/file URL visibly in Chrome AM (dedicated AM Chrome profile on debug port 9229) on the user's Windows desktop via the Discord bridge host process. Always prefer this tool over run_command whenever opening Chrome or viewing files/URLs in Chrome, because terminal commands in agy close spawned browser windows when the turn exits.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Local file path (e.g. C:\\Users\\Admin\\Desktop\\page.html) or http/https/file URL.",
        },
        new_window: {
          type: "boolean",
          description: "Open in a new Chrome AM window (default: true).",
        },
      },
      required: ["target"],
    },
  },
  {
    name: "open_desktop_target",
    description:
      "Open a local file, folder (Windows Explorer), or http/https URL visibly on the user's Windows desktop using the default Windows application via the Discord bridge host process. Prefer this over run_command so Windows does not terminate the opened window when agy exits.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "File path, directory path, or http/https URL.",
        },
      },
      required: ["target"],
    },
  },
  {
    name: "open_app",
    description:
      "Launch any installed Windows application visibly on the user's desktop via the Discord bridge host process (by name/alias such as Chrome AM, Chrome, Notepad, VS Code, Calculator, Edge, Word, Excel, Paint, Terminal, Settings, Discord, Zalo, Spotify, or an explicit .exe / .lnk / shell:AppsFolder path, optionally with a file/folder/URL target). Always prefer this over run_command whenever opening any Windows application so agy does not close it when the turn exits.",
    inputSchema: {
      type: "object",
      properties: {
        app: {
          type: "string",
          description:
            "Application name, alias, executable filename, .exe/.lnk path, or shell:AppsFolder\\<AppID>.",
        },
        target: {
          type: "string",
          description: "Optional file path, directory path, or http/https URL to pass to the application.",
        },
      },
      required: ["app"],
    },
  },
  {
    name: "send_to_discord",
    description:
      "Upload one or more local files or images (screenshots, PNG/JPG/WebP, PDF, CSV, ZIP, logs, audio, video) from this Windows machine directly into the active Discord channel or thread. Use this whenever the user asks to send, show, share, screenshot, or export an image or file back to Discord.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Single local file path (absolute or relative to cwd) or file:// URI to upload to Discord.",
        },
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Multiple local file paths to upload together (split cleanly if > 10 files).",
        },
        message: {
          type: "string",
          description: "Optional short caption text attached to the uploaded file(s) on Discord.",
        },
        delete_after_send: {
          type: "boolean",
          description:
            "Optional cleanup flag: delete temporary scratch/screenshot files after upload succeeds (only allowed inside temporary/no-project folders).",
        },
      },
    },
  },
  {
    name: "capture_desktop",
    description:
      "Capture a screenshot of the real Windows desktop (all monitors or a matching window by title) via the interactive bridge host process, saving a PNG file and optionally uploading it straight to Discord.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Optional case-insensitive window title substring to capture only that window.",
        },
        path: {
          type: "string",
          description: "Optional output PNG file path (defaults to a managed temporary screenshot path).",
        },
        send_to_discord: {
          type: "boolean",
          description: "If true, immediately upload the captured PNG screenshot to the active Discord channel/thread.",
        },
        message: {
          type: "string",
          description: "Optional caption when send_to_discord is true.",
        },
      },
    },
  },
  {
    name: "desktop_clipboard",
    description:
      "Read or write plain text on the user's real Windows desktop clipboard via the interactive bridge host.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get", "set"],
          description: "Read ('get') or write ('set') clipboard text.",
        },
        text: {
          type: "string",
          description: "Text to copy into the Windows clipboard when action='set'.",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "desktop_windows",
    description:
      "Inspect or manage open Windows desktop application windows ('list' open windows, 'focus' a window, 'close' a non-system app window gracefully, or 'close_chrome_am' to shut down Chrome AM without touching personal Chrome).",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["list", "focus", "close", "close_chrome_am"],
          description: "Window management operation.",
        },
        title: {
          type: "string",
          description: "Window title substring match for 'focus' or 'close'.",
        },
        processName: {
          type: "string",
          description: "Process name match (without .exe) for 'focus' or 'close'.",
        },
        pid: {
          type: "number",
          description: "Specific numeric process ID for 'focus' or 'close'.",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "text_to_speech",
    description:
      "Convert text into spoken MP3 audio using fast Cloud TTS (supports vi, en, zh-CN, zh-TW, ja, ko, fr, de, es, th, etc.) without running Python/PowerShell/local models, and optionally upload the MP3 straight to the active Discord channel.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to speak (long texts are chunked automatically).",
        },
        lang: {
          type: "string",
          description: "BCP-47 language code such as 'vi', 'en', 'zh-CN', 'ja', 'ko' (default: 'vi').",
        },
        output_path: {
          type: "string",
          description: "Optional local .mp3 output path inside workspace (defaults to a managed temporary file).",
        },
        send_to_discord: {
          type: "boolean",
          description: "If true (default), immediately upload the generated .mp3 file to Discord.",
        },
        message: {
          type: "string",
          description: "Optional short caption text attached when sending to Discord.",
        },
      },
      required: ["text"],
    },
  },
];

/** Filter MCP tools by an allowlist CSV string or array (null/empty returns full toolset). */
export function filterMcpTools(allowedToolsSpec) {
  if (allowedToolsSpec === null || allowedToolsSpec === undefined) return MCP_TOOLS;
  const list = Array.isArray(allowedToolsSpec)
    ? allowedToolsSpec.map((s) => String(s || "").trim()).filter(Boolean)
    : String(allowedToolsSpec || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  if (list.length === 0) return MCP_TOOLS;
  const allowed = new Set(list);
  return MCP_TOOLS.filter((tool) => allowed.has(tool.name));
}

let appCatalogCache = null;
let appCatalogPromise = null;

/** Normalize app query names with Vietnamese accent folding for fuzzy matching. */
export function normalizeAppToken(raw) {
  const norm = String(raw || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\.(exe|lnk|appref-ms)$/i, "")
    .replace(/[^a-z0-9+.#]+/g, " ")
    .trim();
  return { norm, compact: norm.replace(/\s+/g, "") };
}

function isRunnableExeFile(filePath) {
  if (!filePath || path.extname(filePath).toLowerCase() !== ".exe") return false;
  try {
    const st = fs.lstatSync(filePath);
    if (st.isDirectory()) return false;
    return st.isFile() || st.isSymbolicLink();
  } catch {
    return false;
  }
}

/** Run a PowerShell script with optional UTF-8 stdin payload and parse JSON stdout safely. */
export function runPowerShellJson(script, stdinText = null, timeoutMs = 10000, extraEnv = null) {
  return new Promise((resolve, reject) => {
    const wrapped = `[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)\n[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)\n${script}`;
    const encoded = Buffer.from(wrapped, "utf16le").toString("base64");
    const env = extraEnv ? { ...process.env, ...extraEnv } : process.env;
    const child = spawn("powershell", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], {
      env,
      windowsHide: true,
      stdio: [stdinText !== null ? "pipe" : "ignore", "pipe", "pipe"],
    });
    if (stdinText !== null) {
      child.stdin.write(String(stdinText), "utf8");
      child.stdin.end();
    }

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {}
      reject(new Error("PowerShell operation timed out."));
    }, timeoutMs);

    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`));
      }
      const trimmed = stdout.trim();
      if (!trimmed) return resolve({});
      try {
        resolve(JSON.parse(trimmed));
      } catch (err) {
        reject(new Error(`Invalid JSON from PowerShell: ${err.message}`));
      }
    });
  });
}

/** Return the dedicated Chrome AM profile folder. */
export function getChromeAmUserDataDir() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(localAppData, "Google", "Chrome AM User Data");
}

/** Build Chrome AM launch flags and ensure its dedicated profile folder exists. */
export function getChromeAmLaunchArgs(extraArgs = []) {
  const userDataDir = getChromeAmUserDataDir();
  fs.mkdirSync(userDataDir, { recursive: true });
  return [
    `--remote-debugging-port=${CHROME_AM_DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    ...extraArgs,
  ];
}

/** Locate Google Chrome executable on Windows. */
export function findChromeExecutable() {
  const candidates = [
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.LocalAppData || path.join(os.homedir(), "AppData", "Local"), "Google", "Chrome", "Application", "chrome.exe"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  for (const hive of ["HKLM", "HKCU"]) {
    try {
      const out = execFileSync(
        "reg",
        ["query", `${hive}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe`, "/ve"],
        { encoding: "utf8", windowsHide: true, timeout: 2000 }
      );
      const m = out.match(/REG_(?:EXPAND_)?SZ\s+([^\r\n]+chrome\.exe)/i);
      if (m) {
        const regPath = m[1].trim().replace(/^"|"$/g, "");
        if (fs.existsSync(regPath)) return regPath;
      }
    } catch {
      // Registry entry absent
    }
  }
  return null;
}

/** Check quickly whether Chrome AM remote debugging is live and inspect open page count. */
export async function getChromeAmStatus(timeoutMs = 350) {
  try {
    const verResp = await fetch(`${CHROME_AM_DEBUG_URL}/json/version`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!verResp.ok) {
      return { running: false, debugUrl: CHROME_AM_DEBUG_URL, tabCount: 0, tabs: [], browser: "" };
    }
    const ver = await verResp.json().catch(() => ({}));
    let tabs = [];
    try {
      const listResp = await fetch(`${CHROME_AM_DEBUG_URL}/json/list`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (listResp.ok) {
        const targets = await listResp.json().catch(() => []);
        if (Array.isArray(targets)) {
          tabs = targets
            .filter((t) => t?.type === "page")
            .map((t) => ({
              title: String(t.title || ""),
              url: String(t.url || ""),
            }));
        }
      }
    } catch {}
    return {
      running: true,
      debugUrl: CHROME_AM_DEBUG_URL,
      tabCount: tabs.length,
      tabs,
      browser: String(ver.Browser || "Chrome AM"),
    };
  } catch {
    return { running: false, debugUrl: CHROME_AM_DEBUG_URL, tabCount: 0, tabs: [], browser: "" };
  }
}

/** Check whether Chrome AM DevTools HTTP endpoint responds. */
export async function isChromeAmDebugReady() {
  const st = await getChromeAmStatus(500);
  return st.running;
}

/** Poll Chrome AM DevTools HTTP endpoint until ready or timeoutMs elapses. */
export async function waitForChromeAmDebugReady(timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isChromeAmDebugReady()) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

/** Spawn a detached visible GUI process outside agy's job object and verify startup. */
export function spawnDetachedGui(exePath, args, ignoreExitCode = false) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(exePath, args, {
      detached: true,
      windowsHide: false,
      stdio: "ignore",
      shell: false,
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.unref();
      resolve();
    }, 350);

    child.once("error", (err) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(err);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (!ignoreExitCode && code !== 0 && code !== null) {
        reject(new Error(`${path.basename(exePath)} exited immediately with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

/** Launch (or open a target inside) the dedicated Chrome AM instance and wait for port 9229. */
export async function launchChromeAm(chromePath, extraArgs = []) {
  const fullArgs = getChromeAmLaunchArgs(extraArgs);
  await spawnDetachedGui(chromePath, fullArgs, true);
  const ready = await waitForChromeAmDebugReady(10000);
  return { ready, debugUrl: CHROME_AM_DEBUG_URL, userDataDir: getChromeAmUserDataDir() };
}

/** Close only Chrome AM processes (--user-data-dir=Chrome AM User Data), leaving personal Chrome untouched. */
export async function closeChromeAm() {
  const profileDir = getChromeAmUserDataDir();
  const res = await runPowerShellJson(
    `
$profile = $env:AGY_CHROME_AM_DIR
$procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object {
  $_.CommandLine -and $_.CommandLine.IndexOf($profile, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
}
$killed = @()
foreach ($p in $procs) {
  try {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
    $killed += [int]$p.ProcessId
  } catch {}
}
@{ closedCount = $killed.Count; pids = $killed } | ConvertTo-Json -Compress
`,
    null,
    8000,
    { AGY_CHROME_AM_DIR: profileDir }
  );
  return {
    closedCount: Number(res?.closedCount || 0),
    pids: Array.isArray(res?.pids) ? res.pids : res?.pids ? [res.pids] : [],
  };
}

/** Collect installed desktop apps (App Paths, shortcuts, WindowsApps, System32, StartApps). */
export async function loadAppCatalog(forceRefresh = false) {
  if (!forceRefresh && appCatalogCache && Date.now() - appCatalogCache.loadedAt < APP_CATALOG_TTL_MS) {
    return appCatalogCache;
  }
  if (appCatalogPromise) return appCatalogPromise;

  appCatalogPromise = (async () => {
    const candidates = [];
    const seenKeys = new Set();
    const pushCandidate = (item) => {
      const key = `${item.kind}|${item.norm.norm}|${(item.exePath || item.explorerArg || "").toLowerCase()}`;
      if (!item.norm.norm || seenKeys.has(key)) return;
      seenKeys.add(key);
      candidates.push(item);
    };

    try {
      const psData = await runPowerShellJson(`
$ErrorActionPreference = 'SilentlyContinue'
$appPaths = @()
foreach ($scope in @('HKLM', 'HKCU')) {
  Get-ItemProperty "\${scope}:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\*" | ForEach-Object {
    $raw = [string]$_.'(default)'
    if ($raw) {
      $clean = $raw.Trim().Trim('"')
      if ($clean) {
        $appPaths += [pscustomobject]@{ name = [string]$_.PSChildName; path = $clean; scope = $scope }
      }
    }
  }
}
$lnks = @()
$ws = New-Object -ComObject WScript.Shell
$lnkFiles = @()
foreach ($r in @("$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs", "$env:AppData\\Microsoft\\Windows\\Start Menu\\Programs") | Where-Object { Test-Path $_ }) {
  $lnkFiles += Get-ChildItem -Path $r -Recurse -Depth 3 -Filter '*.lnk'
}
foreach ($d in @("$env:Public\\Desktop", "$env:UserProfile\\Desktop") | Where-Object { Test-Path $_ }) {
  $lnkFiles += Get-ChildItem -Path $d -File -Filter '*.lnk'
}
foreach ($f in $lnkFiles) {
  $target = ''
  $lnkArgs = ''
  try {
    $sc = $ws.CreateShortcut($f.FullName)
    $target = [string]$sc.TargetPath
    $lnkArgs = [string]$sc.Arguments
  } catch {}
  $lnks += [pscustomobject]@{
    name = [System.IO.Path]::GetFileNameWithoutExtension($f.Name)
    lnkPath = $f.FullName
    targetPath = $target
    arguments = $lnkArgs
  }
}
$startApps = @(Get-StartApps | ForEach-Object {
  [pscustomobject]@{ name = [string]$_.Name; appId = [string]$_.AppID }
})
@{ appPaths = $appPaths; lnks = $lnks; startApps = $startApps } | ConvertTo-Json -Compress -Depth 3
`);

      for (const entry of psData.appPaths || []) {
        if (!isRunnableExeFile(entry.path)) continue;
        pushCandidate({
          label: entry.name.replace(/\.exe$/i, ""),
          norm: normalizeAppToken(entry.name),
          kind: "exe",
          exePath: entry.path,
          explorerArg: null,
          priorityBonus: entry.scope === "HKLM" ? 18 : 14,
        });
      }

      for (const entry of psData.lnks || []) {
        if (!entry.lnkPath || !fs.existsSync(entry.lnkPath)) continue;
        const targetExt = entry.targetPath ? path.extname(entry.targetPath).toLowerCase() : "";
        if (targetExt && ![".exe", ".lnk", ".appref-ms", ""].includes(targetExt)) continue;
        const canLaunchExeDirectly =
          !String(entry.arguments || "").trim() &&
          isRunnableExeFile(entry.targetPath) &&
          !/^(?:update|unins\d*)\.exe$/i.test(path.basename(entry.targetPath));
        pushCandidate({
          label: entry.name,
          norm: normalizeAppToken(entry.name),
          kind: canLaunchExeDirectly ? "exe" : "lnk",
          exePath: canLaunchExeDirectly ? entry.targetPath : null,
          explorerArg: entry.lnkPath,
          priorityBonus: canLaunchExeDirectly ? 22 : 12,
        });
      }

      for (const entry of psData.startApps || []) {
        const appId = String(entry.appId || "").trim();
        if (!appId || /[<>|"&;`]/.test(appId)) continue;
        if (/^https?:\/\//i.test(appId) || /\.(?:html?|url|txt|pdf|chm|docx?)$/i.test(appId)) continue;
        if (isRunnableExeFile(appId)) {
          pushCandidate({
            label: entry.name,
            norm: normalizeAppToken(entry.name),
            kind: "exe",
            exePath: appId,
            explorerArg: null,
            priorityBonus: 12,
          });
        } else {
          pushCandidate({
            label: entry.name,
            norm: normalizeAppToken(entry.name),
            kind: "appsfolder",
            exePath: null,
            explorerArg: `shell:AppsFolder\\${appId}`,
            priorityBonus: 8,
          });
        }
      }
    } catch (err) {
      console.warn("[mcp] Failed to scan Windows app catalog:", err.message);
    }

    const winAppsDir = path.join(
      process.env.LocalAppData || path.join(os.homedir(), "AppData", "Local"),
      "Microsoft",
      "WindowsApps"
    );
    if (fs.existsSync(winAppsDir)) {
      try {
        for (const dirent of fs.readdirSync(winAppsDir, { withFileTypes: true })) {
          if (!dirent.name.toLowerCase().endsWith(".exe")) continue;
          const fullPath = path.join(winAppsDir, dirent.name);
          if (!isRunnableExeFile(fullPath)) continue;
          pushCandidate({
            label: dirent.name.replace(/\.exe$/i, ""),
            norm: normalizeAppToken(dirent.name),
            kind: "exe",
            exePath: fullPath,
            explorerArg: null,
            priorityBonus: 16,
          });
        }
      } catch {}
    }

    const system32Dir = path.join(process.env.SystemRoot || "C:\\Windows", "System32");
    for (const exeName of [
      "notepad.exe",
      "calc.exe",
      "mspaint.exe",
      "explorer.exe",
      "cmd.exe",
      "powershell.exe",
      "taskmgr.exe",
      "control.exe",
      "charmap.exe",
      "regedit.exe",
      "resmon.exe",
      "snippingtool.exe",
    ]) {
      const fullPath = path.join(system32Dir, exeName);
      if (!isRunnableExeFile(fullPath)) continue;
      pushCandidate({
        label: exeName.replace(/\.exe$/i, ""),
        norm: normalizeAppToken(exeName),
        kind: "exe",
        exePath: fullPath,
        explorerArg: null,
        priorityBonus: 15,
      });
    }

    appCatalogCache = { loadedAt: Date.now(), candidates };
    return appCatalogCache;
  })();

  try {
    return await appCatalogPromise;
  } finally {
    appCatalogPromise = null;
  }
}

function scoreAppCandidate(cand, queryForms, allowMaintenance, requireExeTarget) {
  const cname = cand.norm.norm;
  if (!cname) return 0;
  if (
    !allowMaintenance &&
    (/\b(?:uninstall|remove|reset settings|release notes|manuals?|module docs|documentation|autostarter|get help|gethelp)\b/.test(
      cname
    ) ||
      /\b(?:unins\d+|ceregreset)\b/.test(cname))
  ) {
    return 0;
  }

  let best = 0;
  for (const q of queryForms) {
    let base = 0;
    if (cname === q.norm) base = 1000;
    else if (q.compact.length >= 2 && cand.norm.compact === q.compact) base = 900;
    else if (cname.startsWith(`${q.norm} `)) base = 720 - Math.min(cname.length, 80);
    else if (cname.startsWith(q.norm)) base = 640 - Math.min(cname.length, 80);
    else if (q.compact.length >= 3 && cand.norm.compact.startsWith(q.compact))
      base = 580 - Math.min(cand.norm.compact.length, 80);
    else if (` ${cname} `.includes(` ${q.norm} `)) base = 460 - Math.min(cname.length, 80);
    else if (q.norm.length >= 3 && cname.includes(q.norm)) base = 260 - Math.min(cname.length, 80);
    if (base > best) best = base;
  }
  if (best <= 0) return 0;
  const targetBonus = requireExeTarget && cand.kind === "exe" ? 200 : 0;
  return best + cand.priorityBonus + targetBonus;
}

function findExeViaWhere(rawToken) {
  if (!/^[a-z0-9._+-]+$/i.test(rawToken)) return null;
  try {
    const out = execFileSync("where.exe", [rawToken], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    for (const line of out.split(/\r?\n/)) {
      const p = line.trim();
      if (isRunnableExeFile(p)) return p;
    }
  } catch {}
  return null;
}

/** Validate and normalize a local file, directory, or web URL for desktop opening. */
export function resolveDesktopTarget(rawTarget, baseCwd, allowDirectories, fallbackCwd = "") {
  if (typeof rawTarget !== "string") throw new Error("Target must be a string.");
  const cleaned = rawTarget.trim().replace(/^['"]|['"]$/g, "");
  if (!cleaned || /[\x00-\x1f\x7f]/.test(cleaned)) {
    throw new Error("Invalid or empty target.");
  }

  if (/^https?:\/\//i.test(cleaned)) {
    const parsed = new URL(cleaned);
    return { kind: "url", launchArg: parsed.href, explorerArg: parsed.href, display: parsed.href };
  }

  if (/^file:\/\//i.test(cleaned)) {
    const localPath = fileURLToPath(new URL(cleaned));
    if (!fs.existsSync(localPath)) throw new Error(`File not found: ${localPath}`);
    if (!allowDirectories && fs.statSync(localPath).isDirectory()) {
      throw new Error("Target is a directory; use open_desktop_target for folders.");
    }
    return {
      kind: "path",
      launchArg: pathToFileURL(localPath).href,
      explorerArg: localPath,
      display: localPath,
    };
  }

  if (/^[a-z]{2,}[a-z0-9+.-]*:/i.test(cleaned)) {
    throw new Error("Unsupported URL scheme; only http, https, file, or local paths are allowed.");
  }

  const rootCwd = baseCwd && fs.existsSync(baseCwd) ? baseCwd : fallbackCwd || os.homedir();
  const resolved = path.resolve(rootCwd, cleaned);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path not found: ${resolved}`);
  }
  if (!allowDirectories && fs.statSync(resolved).isDirectory()) {
    throw new Error("Target is a directory; use open_desktop_target for folders.");
  }
  return {
    kind: "path",
    launchArg: pathToFileURL(resolved).href,
    explorerArg: resolved,
    display: resolved,
  };
}

/** Resolve an application name, alias, executable path, shortcut, or AppsFolder AppID for launching. */
export async function resolveApplication(rawApp, baseCwd, requireExeTarget, fallbackCwd = "") {
  if (typeof rawApp !== "string") throw new Error("Application name must be a string.");
  const cleaned = rawApp.trim().replace(/^['"]|['"]$/g, "");
  if (!cleaned || /[\x00-\x1f\x7f]/.test(cleaned)) {
    throw new Error("Invalid or empty application name.");
  }

  if (/^shell:AppsFolder\\/i.test(cleaned)) {
    if (/[<>|"&;`]|\.\./.test(cleaned) || !/^shell:AppsFolder\\[A-Za-z0-9._!{}\-\s()\\]+$/i.test(cleaned)) {
      throw new Error("Invalid AppsFolder identifier.");
    }
    if (requireExeTarget) {
      throw new Error("Microsoft Store/UWP AppsFolder launches cannot take a file/folder target argument directly.");
    }
    return { label: cleaned, kind: "appsfolder", exePath: null, explorerArg: cleaned };
  }

  if (/^[a-z]{2,}[a-z0-9+.-]*:/i.test(cleaned) && !/^[a-z]:[\\/]/i.test(cleaned)) {
    throw new Error("Unsupported URI scheme for application launch.");
  }

  const looksLikePath = cleaned.includes("\\") || cleaned.includes("/") || /^[a-z]:/i.test(cleaned);
  if (looksLikePath) {
    const rootCwd = baseCwd && fs.existsSync(baseCwd) ? baseCwd : fallbackCwd || os.homedir();
    const resolved = path.resolve(rootCwd, cleaned);
    const ext = path.extname(resolved).toLowerCase();
    if (!ALLOWED_EXPLICIT_APP_EXTS.has(ext)) {
      throw new Error("Explicit application paths must point to a .exe, .lnk, or .appref-ms file.");
    }
    if (ext === ".exe") {
      if (!isRunnableExeFile(resolved)) throw new Error(`Application not found: ${resolved}`);
      return { label: path.basename(resolved, ext), kind: "exe", exePath: resolved, explorerArg: null };
    }
    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      throw new Error(`Shortcut not found: ${resolved}`);
    }
    if (requireExeTarget) {
      throw new Error("Shortcut files cannot accept an external target argument directly; pass the executable name instead.");
    }
    return { label: path.basename(resolved, ext), kind: "lnk", exePath: null, explorerArg: resolved };
  }

  const queryToken = normalizeAppToken(cleaned);
  if (!queryToken.norm) throw new Error("Invalid application query.");

  if (
    queryToken.compact === "chrome" ||
    queryToken.compact === "googlechrome" ||
    queryToken.compact === "chromeam"
  ) {
    const chromePath = findChromeExecutable();
    if (chromePath) {
      return { label: "Chrome AM", kind: "chrome_am", exePath: chromePath, explorerArg: null };
    }
  }

  const aliasList = APP_ALIASES[queryToken.norm] || [];
  const queryForms = [queryToken, ...aliasList.map(normalizeAppToken)].filter(
    (q, idx, arr) => q.norm && arr.findIndex((o) => o.norm === q.norm) === idx
  );
  const allowMaintenance = /\b(?:uninstall|remove|reset|repair|help|manual|docs?|documentation)\b/.test(
    queryToken.norm
  );

  const searchCatalog = (catalog) => {
    const scored = [];
    for (const cand of catalog.candidates) {
      const score = scoreAppCandidate(cand, queryForms, allowMaintenance, requireExeTarget);
      if (score > 0) scored.push({ cand, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
  };

  let catalog = await loadAppCatalog(false);
  let ranked = searchCatalog(catalog);
  if (ranked.length === 0 && Date.now() - catalog.loadedAt > 10_000) {
    catalog = await loadAppCatalog(true);
    ranked = searchCatalog(catalog);
  }

  if (ranked.length > 0) {
    const best = ranked[0].cand;
    if (requireExeTarget && best.kind !== "exe") {
      const exeAlternative = ranked.find((r) => r.score >= ranked[0].score - 250 && r.cand.kind === "exe");
      if (exeAlternative) return exeAlternative.cand;
      throw new Error(
        `${best.label} is launched as a Windows Store/shortcut app and cannot take a file/folder argument directly via open_app; launch it without 'target' or use open_desktop_target.`
      );
    }
    return best;
  }

  const whereMatch = findExeViaWhere(cleaned);
  if (whereMatch) {
    return { label: path.basename(whereMatch, ".exe"), kind: "exe", exePath: whereMatch, explorerArg: null };
  }

  throw new Error(`Installed application not found for "${cleaned}".`);
}

/** Capture the Windows desktop or a matching GUI window into a PNG file with DPI awareness. */
export async function captureDesktopScreenshot(outPath, titleQuery = "") {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class WinCaptureNative {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
[WinCaptureNative]::SetProcessDPIAware() | Out-Null

$outFile = $env:AGY_CAPTURE_OUT
$titleFilter = $env:AGY_CAPTURE_TITLE
$x = 0; $y = 0; $w = 0; $h = 0; $matchedTitle = ""

if ($titleFilter) {
  $win = Get-Process | Where-Object {
    $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle -and
    $_.MainWindowTitle.IndexOf($titleFilter, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
  } | Select-Object -First 1
  if (-not $win) {
    @{ ok = $false; error = "No visible window found matching title '$titleFilter'." } | ConvertTo-Json -Compress
    exit 0
  }
  [WinCaptureNative]::ShowWindowAsync($win.MainWindowHandle, 9) | Out-Null
  [WinCaptureNative]::SetForegroundWindow($win.MainWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 180
  $rect = New-Object WinCaptureNative+RECT
  if (-not [WinCaptureNative]::GetWindowRect($win.MainWindowHandle, [ref]$rect)) {
    @{ ok = $false; error = "Failed to query window bounds." } | ConvertTo-Json -Compress
    exit 0
  }
  $x = $rect.Left; $y = $rect.Top
  $w = $rect.Right - $rect.Left; $h = $rect.Bottom - $rect.Top
  $matchedTitle = [string]$win.MainWindowTitle
} else {
  $vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $x = $vs.X; $y = $vs.Y; $w = $vs.Width; $h = $vs.Height
  $matchedTitle = "VirtualScreen"
}

if ($w -le 0 -or $h -le 0) {
  @{ ok = $false; error = "Captured dimensions are empty (\${w}x\${h})." } | ConvertTo-Json -Compress
  exit 0
}

$bmp = New-Object System.Drawing.Bitmap($w, $h)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
try {
  $gfx.CopyFromScreen($x, $y, 0, 0, [System.Drawing.Size]::new($w, $h))
  $bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $gfx.Dispose()
  $bmp.Dispose()
}
@{ ok = $true; path = $outFile; width = $w; height = $h; target = $matchedTitle } | ConvertTo-Json -Compress
`;
  const res = await runPowerShellJson(psScript, null, 12000, {
    AGY_CAPTURE_OUT: path.resolve(outPath),
    AGY_CAPTURE_TITLE: String(titleQuery || "").trim(),
  });
  if (!res?.ok) {
    throw new Error(res?.error || "Desktop capture failed.");
  }
  return res;
}

/** Read or write plain text on the Windows desktop clipboard using UTF-8 stdin/stdout. */
export async function handleDesktopClipboard(action, text = "") {
  const mode = String(action || "").toLowerCase();
  if (mode === "get") {
    const res = await runPowerShellJson(
      `
$raw = Get-Clipboard -Raw -ErrorAction SilentlyContinue
@{ ok = $true; text = [string]$raw } | ConvertTo-Json -Compress
`,
      null,
      6000
    );
    return { text: String(res?.text || "") };
  }
  if (mode === "set") {
    await runPowerShellJson(
      `
$inputText = [Console]::In.ReadToEnd()
Set-Clipboard -Value $inputText
@{ ok = $true } | ConvertTo-Json -Compress
`,
      String(text ?? ""),
      6000
    );
    return { ok: true, length: String(text ?? "").length };
  }
  throw new Error(`Unsupported clipboard action: ${action}`);
}

/** List, focus, or safely close open GUI windows on the Windows desktop. */
export async function manageDesktopWindows(action, { title = "", processName = "", pid = null, ownPid = process.pid } = {}) {
  const mode = String(action || "").toLowerCase();
  if (mode === "close_chrome_am") {
    return closeChromeAm();
  }

  if (mode === "list") {
    const res = await runPowerShellJson(
      `
$wins = @(Get-Process | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle } |
  Sort-Object ProcessName, Id |
  ForEach-Object { [pscustomobject]@{ pid = [int]$_.Id; processName = [string]$_.ProcessName; title = [string]$_.MainWindowTitle } })
@{ windows = $wins } | ConvertTo-Json -Compress -Depth 3
`,
      null,
      6000
    );
    return { windows: Array.isArray(res?.windows) ? res.windows : [] };
  }

  if (mode !== "focus" && mode !== "close") {
    throw new Error(`Unknown desktop_windows action: ${action}`);
  }

  const targetPid = Number.isInteger(Number(pid)) && Number(pid) > 0 ? Number(pid) : 0;
  const normProc = String(processName || "").trim().replace(/\.exe$/i, "");
  const normTitle = String(title || "").trim();
  if (!targetPid && !normProc && !normTitle) {
    throw new Error(`Provide 'title', 'processName', or 'pid' for '${mode}'.`);
  }

  const { windows } = await manageDesktopWindows("list");
  const matches = windows.filter((w) => {
    if (targetPid && w.pid !== targetPid) return false;
    if (normProc && w.processName.toLowerCase() !== normProc.toLowerCase()) return false;
    if (normTitle && !w.title.toLowerCase().includes(normTitle.toLowerCase())) return false;
    return true;
  });

  if (matches.length === 0) {
    throw new Error("No open GUI window matched the filter.");
  }

  if (mode === "close") {
    const first = matches[0];
    if (first.pid === ownPid || PROTECTED_WINDOW_PROCESSES.has(first.processName.toLowerCase())) {
      throw new Error(
        `Refusing to close protected/bridge process "${first.processName}" (PID ${first.pid}). For Chrome AM, use action="close_chrome_am".`
      );
    }
    const closeRes = await runPowerShellJson(
      `
$p = Get-Process -Id ([int]$env:AGY_WIN_PID) -ErrorAction Stop
$closed = $p.CloseMainWindow()
@{ ok = [bool]$closed; pid = [int]$p.Id; processName = [string]$p.ProcessName; title = [string]$p.MainWindowTitle } | ConvertTo-Json -Compress
`,
      null,
      6000,
      { AGY_WIN_PID: String(first.pid) }
    );
    return { matched: first, closed: Boolean(closeRes?.ok) };
  }

  const first = matches[0];
  await runPowerShellJson(
    `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class WinFocusNative {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$p = Get-Process -Id ([int]$env:AGY_WIN_PID) -ErrorAction Stop
if ($p.MainWindowHandle -eq [IntPtr]::Zero) { throw "Window handle is no longer active." }
[WinFocusNative]::ShowWindowAsync($p.MainWindowHandle, 9) | Out-Null
[WinFocusNative]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
@{ ok = $true } | ConvertTo-Json -Compress
`,
    null,
    6000,
    { AGY_WIN_PID: String(first.pid) }
  );
  return { matched: first, focused: true };
}

/** Delete old files inside the temporary capture/staging directory. */
export function pruneOldTempFiles(tempDir, maxAgeMs = TEMP_RETENTION_MS) {
  if (!tempDir || !fs.existsSync(tempDir)) return 0;
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  try {
    for (const entry of fs.readdirSync(tempDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const fp = path.join(tempDir, entry.name);
      try {
        if (fs.statSync(fp).mtimeMs < cutoff) {
          fs.unlinkSync(fp);
          removed++;
        }
      } catch {}
    }
  } catch {}
  return removed;
}

/** Split text cleanly along sentence/word boundaries so Cloud TTS chunks stay under maxLen characters. */
export function splitTtsChunks(text, maxLen = 180) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= maxLen) return [normalized];

  const chunks = [];
  let remaining = normalized;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    const slice = remaining.slice(0, maxLen);
    let cut = Math.max(
      slice.lastIndexOf(". "),
      slice.lastIndexOf("! "),
      slice.lastIndexOf("? "),
      slice.lastIndexOf("。"),
      slice.lastIndexOf(", "),
      slice.lastIndexOf(" "),
    );
    if (cut < Math.floor(maxLen * 0.4)) cut = maxLen;
    else if (cut < maxLen && /[.,!?。]/.test(slice[cut])) cut += 1;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  return chunks.filter(Boolean);
}

/** Synthesize MP3 audio via Cloud TTS HTTP endpoint with chunked concatenation for longer text. */
export async function synthesizeCloudTtsMp3(text, lang = "vi") {
  const safeLang = String(lang || "vi").trim().replace(/[^a-zA-Z0-9-]/g, "") || "vi";
  const chunks = splitTtsChunks(text, 180);
  if (chunks.length === 0) {
    throw new Error("Provide non-empty 'text' to convert to speech.");
  }
  const buffers = [];
  for (const chunk of chunks.slice(0, 15)) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${encodeURIComponent(safeLang)}&client=tw-ob`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12000),
    });
    if (!resp.ok) {
      throw new Error(`Cloud TTS returned HTTP ${resp.status} for lang=${safeLang}`);
    }
    const arr = await resp.arrayBuffer();
    buffers.push(Buffer.from(arr));
  }
  return Buffer.concat(buffers);
}

/** Build the host-side MCP tool execution handler with per-run RBAC scope enforcement. */
export function createDesktopToolHandler(deps) {
  const {
    getDefaultCwd,
    getFallbackCwd,
    tempDir,
    attachDir,
    noProjectDir,
    deletedChannels,
    getRunScope,
    resolveLocalFilePath,
    sendDiscordAttachments,
  } = deps;

  return async function handleDesktopOpenTool(name, args, reqCwd, ctx = {}) {
    const scope = ctx?.runId ? getRunScope(ctx.runId) : null;
    if (scope && !scope.isAdmin && Array.isArray(scope.allowedMcpTools) && !scope.allowedMcpTools.includes(name)) {
      return {
        isError: true,
        text: `Permission denied: tool "${name}" is disabled for non-admin sessions in this channel.`,
      };
    }

    if (name === "send_to_discord") {
      const channelId = String(ctx?.channelId || "").trim();
      if (!channelId) {
        return { isError: true, text: "No active Discord channel/thread context is attached to this run." };
      }
      if (deletedChannels.has(channelId)) {
        return { isError: true, text: "Target Discord thread/channel no longer exists." };
      }
      const rawInputs = [];
      if (typeof args?.path === "string" && args.path.trim()) rawInputs.push(args.path.trim());
      if (Array.isArray(args?.paths)) {
        for (const item of args.paths) {
          if (typeof item === "string" && item.trim()) rawInputs.push(item.trim());
        }
      }
      if (rawInputs.length === 0) {
        return { isError: true, text: "Provide a file path via 'path' or 'paths'." };
      }

      const resolved = [];
      const effectiveCwd = scope?.cwd || reqCwd;
      const safeChannelDir = path.join(
        attachDir,
        String(channelId || "general").replace(/[^a-zA-Z0-9_-]/g, "") || "general"
      );

      for (const raw of rawInputs) {
        const p = resolveLocalFilePath(raw, effectiveCwd);
        if (!p) return { isError: true, text: `Invalid file path: ${raw}` };
        if (scope && !scope.isAdmin) {
          const allowed =
            isPathInsideDir(p, effectiveCwd) ||
            isPathInsideDir(p, safeChannelDir) ||
            isPathInsideDir(p, tempDir);
          if (!allowed) {
            return {
              isError: true,
              text: `Permission denied: non-admin runs can only send files inside this channel's workspace (${effectiveCwd}).`,
            };
          }
        }
        resolved.push(p);
      }

      const uploaded = await sendDiscordAttachments(channelId, resolved, args?.message || "", ctx?.runId || "");
      let deletedTempCount = 0;
      if (args?.delete_after_send === true) {
        const tmpRoot = os.tmpdir();
        for (const item of uploaded) {
          const isManagedTemp = isPathInsideDir(item.absPath, tempDir);
          const isNoProjectFile = scope?.isAdmin !== false && isPathInsideDir(item.absPath, noProjectDir);
          const isProtectedWorkspace =
            Boolean(effectiveCwd) &&
            isPathInsideDir(item.absPath, effectiveCwd) &&
            !isManagedTemp &&
            !isNoProjectFile;
          const canDeleteTemp =
            !isProtectedWorkspace &&
            (isManagedTemp || isPathInsideDir(item.absPath, tmpRoot) || isNoProjectFile);
          if (canDeleteTemp) {
            try {
              fs.unlinkSync(item.absPath);
              deletedTempCount++;
            } catch {}
          }
        }
      }

      const names = uploaded.map((u) => `${u.filename} (${formatByteSize(u.size)})`).join(", ");
      const suffix = deletedTempCount > 0 ? ` (cleaned ${deletedTempCount} temporary file(s))` : "";
      return { isError: false, text: `Uploaded ${uploaded.length} file(s) to Discord: ${names}${suffix}` };
    }

    if (name === "open_in_chrome") {
      const target = resolveDesktopTarget(args?.target, reqCwd, false, getFallbackCwd());
      const chromePath = findChromeExecutable();
      if (!chromePath) {
        return { isError: true, text: "Google Chrome was not found on this Windows machine." };
      }
      const extraArgs = args?.new_window === false ? [target.launchArg] : ["--new-window", target.launchArg];
      const { ready, debugUrl } = await launchChromeAm(chromePath, extraArgs);
      return {
        isError: false,
        text: ready
          ? `Opened in Chrome AM (${debugUrl}): ${target.display}`
          : `Opened in Chrome AM (${target.display}), waiting for ${debugUrl} to become ready.`,
      };
    }

    if (name === "open_desktop_target") {
      const target = resolveDesktopTarget(args?.target, reqCwd, true, getFallbackCwd());
      await spawnDetachedGui("explorer.exe", [target.explorerArg], true);
      return { isError: false, text: `Opened on desktop: ${target.display}` };
    }

    if (name === "open_app") {
      const rawTarget = args?.target !== undefined && args?.target !== null ? String(args.target).trim() : "";
      const target = rawTarget ? resolveDesktopTarget(rawTarget, reqCwd, true, getFallbackCwd()) : null;
      const resolvedApp = await resolveApplication(args?.app, reqCwd, Boolean(target), getDefaultCwd());
      if (resolvedApp.kind === "chrome_am") {
        const extraArgs = target ? [target.kind === "url" ? target.launchArg : target.explorerArg] : [];
        const { ready, debugUrl } = await launchChromeAm(resolvedApp.exePath, extraArgs);
        const baseMsg = target ? `Launched Chrome AM with: ${target.display}` : "Launched Chrome AM";
        return {
          isError: false,
          text: ready
            ? `${baseMsg} (${debugUrl})`
            : `${baseMsg} (warning: ${debugUrl} did not respond within timeout yet)`,
        };
      }
      if (resolvedApp.kind === "exe") {
        const launchArgs = target ? [target.kind === "url" ? target.launchArg : target.explorerArg] : [];
        await spawnDetachedGui(resolvedApp.exePath, launchArgs, false);
        return {
          isError: false,
          text: target ? `Launched ${resolvedApp.label} with: ${target.display}` : `Launched ${resolvedApp.label}`,
        };
      }
      await spawnDetachedGui("explorer.exe", [resolvedApp.explorerArg], true);
      return { isError: false, text: `Launched ${resolvedApp.label}` };
    }

    if (name === "capture_desktop") {
      const customPath = args?.path ? resolveLocalFilePath(args.path, reqCwd) : "";
      const stamp = sanitizeAttachmentFilename(String(ctx?.runId || Date.now()).slice(0, 12), "cap");
      const outFile = customPath || path.join(tempDir, `desktop-${stamp}-${Date.now()}.png`);
      const cap = await captureDesktopScreenshot(outFile, args?.title || "");

      if (args?.send_to_discord === true) {
        const channelId = String(ctx?.channelId || "").trim();
        if (!channelId) {
          return {
            isError: true,
            text: `Captured screenshot to ${cap.path} (${cap.width}x${cap.height}), but no active Discord channel context was found.`,
          };
        }
        await sendDiscordAttachments(channelId, [cap.path], args?.message || "", ctx?.runId || "");
        return {
          isError: false,
          text: `Captured "${cap.target}" (${cap.width}x${cap.height}) to ${cap.path} and uploaded it to Discord.`,
        };
      }
      return {
        isError: false,
        text: `Captured "${cap.target}" (${cap.width}x${cap.height}) -> ${cap.path}`,
      };
    }

    if (name === "desktop_clipboard") {
      const action = String(args?.action || "").toLowerCase();
      const result = await handleDesktopClipboard(action, args?.text ?? "");
      if (action === "get") {
        const preview = result.text || "(clipboard is empty)";
        return { isError: false, text: preview };
      }
      return { isError: false, text: `Copied ${result.length} character(s) to the Windows clipboard.` };
    }

    if (name === "desktop_windows") {
      const action = String(args?.action || "").toLowerCase();
      const result = await manageDesktopWindows(action, {
        title: args?.title || "",
        processName: args?.processName || "",
        pid: args?.pid ?? null,
      });
      if (action === "list") {
        if (result.windows.length === 0) return { isError: false, text: "No open GUI windows found." };
        const formatted = result.windows
          .slice(0, 40)
          .map((w) => `• [${w.pid}] ${w.processName}: ${w.title}`)
          .join("\n");
        return { isError: false, text: `Open desktop windows (${result.windows.length}):\n${formatted}` };
      }
      if (action === "close_chrome_am") {
        return {
          isError: false,
          text:
            result.closedCount > 0
              ? `Closed Chrome AM (${result.closedCount} process(es): ${result.pids.join(", ")}).`
              : "Chrome AM is not currently running.",
        };
      }
      if (action === "close") {
        return {
          isError: false,
          text: result.closed
            ? `Sent close signal to ${result.matched.processName} (${result.matched.title}).`
            : `Window ${result.matched.processName} (${result.matched.title}) did not accept WM_CLOSE.`,
        };
      }
      return {
        isError: false,
        text: `Focused window: ${result.matched.processName} (${result.matched.title}).`,
      };
    }

    if (name === "text_to_speech") {
      const text = String(args?.text || "").trim();
      if (!text) return { isError: true, text: "Provide non-empty 'text' for text_to_speech." };
      const lang = String(args?.lang || "vi").trim() || "vi";
      const scope = typeof getRunScope === "function" ? getRunScope(ctx?.runId) : null;
      const effectiveCwd = scope?.cwd || reqCwd;

      let outFile = "";
      let isManagedTemp = false;
      if (args?.output_path) {
        outFile = resolveLocalFilePath(args.output_path, effectiveCwd);
        if (!outFile) return { isError: true, text: `Invalid output_path: ${args.output_path}` };
        if (scope && !scope.isAdmin && !isPathInsideDir(outFile, effectiveCwd)) {
          return {
            isError: true,
            text: `Permission denied: non-admin output_path must be inside workspace (${effectiveCwd}).`,
          };
        }
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
      } else {
        fs.mkdirSync(tempDir, { recursive: true });
        const stamp = sanitizeAttachmentFilename(String(ctx?.runId || Date.now()).slice(0, 12), "tts");
        outFile = path.join(tempDir, `tts-${stamp}-${Date.now()}.mp3`);
        isManagedTemp = true;
      }

      const mp3Buf = await synthesizeCloudTtsMp3(text, lang);
      fs.writeFileSync(outFile, mp3Buf);

      const shouldSend = args?.send_to_discord !== false;
      if (shouldSend) {
        const channelId = String(scope?.channelId || ctx?.channelId || "").trim();
        if (!channelId) {
          return {
            isError: true,
            text: `Saved TTS audio (${formatByteSize(mp3Buf.length)}) to ${outFile}, but no active Discord channel context was found.`,
          };
        }
        await sendDiscordAttachments(channelId, [outFile], args?.message || "", ctx?.runId || "");
        if (isManagedTemp) {
          try {
            fs.unlinkSync(outFile);
          } catch {}
        }
        return {
          isError: false,
          text: `Generated Cloud TTS MP3 (${formatByteSize(mp3Buf.length)}, lang=${lang}) and uploaded it to Discord.`,
        };
      }

      return {
        isError: false,
        text: `Generated Cloud TTS MP3 (${formatByteSize(mp3Buf.length)}, lang=${lang}) -> ${outFile}`,
      };
    }

    return { isError: true, text: `Unknown desktop tool: ${name}` };
  };
}
