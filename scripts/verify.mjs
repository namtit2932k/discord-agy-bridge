import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readJsonSafe } from "../lib/utils.mjs";
import { GUARD_HOOK_NAME } from "../lib/guard.mjs";
import { MCP_SERVER_NAME } from "../lib/desktop.mjs";

const __filename = fileURLToPath(import.meta.url);
const REPO_DIR = path.resolve(path.dirname(__filename), "..");

let failures = 0;
let warnings = 0;

function pass(label, detail = "") {
  console.log(`[PASS] ${label}${detail ? ` — ${detail}` : ""}`);
}
function warn(label, detail = "") {
  warnings += 1;
  console.log(`[WARN] ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail = "") {
  failures += 1;
  console.log(`[FAIL] ${label}${detail ? ` — ${detail}` : ""}`);
}

function listMjsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".mjs"))
    .map((d) => path.join(dir, d.name));
}

// 1. Syntax check all .mjs source files
const sourceFiles = [
  path.join(REPO_DIR, "bot.mjs"),
  ...listMjsFiles(path.join(REPO_DIR, "lib")),
  ...listMjsFiles(path.join(REPO_DIR, "scripts")),
];
const syntaxErrors = [];
for (const fp of sourceFiles) {
  const res = spawnSync(process.execPath, ["--check", fp], { encoding: "utf8" });
  if (res.status !== 0) {
    syntaxErrors.push(`${path.relative(REPO_DIR, fp)}: ${(res.stderr || res.stdout || "").trim()}`);
  }
}
if (syntaxErrors.length === 0) {
  pass("Syntax check", `${sourceFiles.length} .mjs files OK`);
} else {
  fail("Syntax check", syntaxErrors.join(" | "));
}

// 2. Unit tests
const testRes = spawnSync(process.execPath, ["--test"], { cwd: REPO_DIR, encoding: "utf8" });
const combinedTestOut = `${testRes.stdout || ""}\n${testRes.stderr || ""}`;
const passMatch = combinedTestOut.match(/ℹ pass (\d+)/);
const failMatch = combinedTestOut.match(/ℹ fail (\d+)/);
if (testRes.status === 0) {
  pass("Unit tests", `${passMatch ? passMatch[1] : "all"} passing (0 failed)`);
} else {
  fail("Unit tests", `exit=${testRes.status}, fail=${failMatch ? failMatch[1] : "?"}`);
}

// 3. Config structure check (NEVER prints botToken or secrets)
const cfgPath = path.join(REPO_DIR, "config.json");
if (!fs.existsSync(cfgPath)) {
  warn("config.json", "Not found (copy config.example.json to config.json)");
} else {
  const cfg = readJsonSafe(cfgPath, null, true);
  if (!cfg || typeof cfg !== "object") {
    fail("config.json", "Failed to parse JSON");
  } else {
    const hasToken = typeof cfg.botToken === "string" && cfg.botToken.length > 20 && !cfg.botToken.includes("PASTE_YOUR");
    const ruleCount = Object.keys(cfg.channelRules || {}).length;
    const hookCount = Object.keys(cfg.webhook?.hooks || {}).length;
    if (hasToken) {
      pass("config.json", `valid (token redacted, ${ruleCount} channelRule(s), ${hookCount} webhook hook(s))`);
    } else {
      warn("config.json", "botToken looks missing or placeholder");
    }
  }
}

// 4. Global Antigravity MCP & Security Hook registration
const mcpCfgPath = path.join(os.homedir(), ".gemini", "config", "mcp_config.json");
const mcpCfg = readJsonSafe(mcpCfgPath, null);
if (mcpCfg?.mcpServers?.[MCP_SERVER_NAME]?.disabled === false) {
  pass("Global MCP config", `${MCP_SERVER_NAME} registered in mcp_config.json`);
} else {
  warn("Global MCP config", `${MCP_SERVER_NAME} not active in ${mcpCfgPath}`);
}

const hooksCfgPath = path.join(os.homedir(), ".gemini", "config", "hooks.json");
const hooksCfg = readJsonSafe(hooksCfgPath, null);
if (hooksCfg?.[GUARD_HOOK_NAME]?.enabled === true) {
  pass("Global Security Hook", `${GUARD_HOOK_NAME} enabled in hooks.json`);
} else {
  warn("Global Security Hook", `${GUARD_HOOK_NAME} not enabled in ${hooksCfgPath}`);
}

// 5. Daemon PID & live check
const pidPath = path.join(REPO_DIR, "bot.pid");
if (!fs.existsSync(pidPath)) {
  warn("Daemon PID", "bot.pid not found (daemon may be stopped)");
} else {
  const pid = Number(fs.readFileSync(pidPath, "utf8").trim());
  if (!Number.isInteger(pid) || pid <= 0) {
    fail("Daemon PID", `Invalid PID in bot.pid: ${pid}`);
  } else {
    try {
      process.kill(pid, 0);
      pass("Daemon PID", `running (PID ${pid})`);
    } catch {
      warn("Daemon PID", `stale PID ${pid} in bot.pid (process not running)`);
    }
  }
}

// 6. Zero node_modules inside repo check
if (fs.existsSync(path.join(REPO_DIR, "node_modules"))) {
  warn("Repo hygiene", "node_modules directory exists inside repo (keep external deps in C:\\ProgramData\\agy-shared-tools)");
} else {
  pass("Repo hygiene", "zero node_modules inside repo");
}

console.log(`\nSummary: ${failures} failed, ${warnings} warning(s).`);
process.exit(failures > 0 ? 1 : 0);
