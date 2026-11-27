import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeJson } from "./utils.mjs";

export const GUARD_HOOK_NAME = "discord-bridge-rbac-guard";

export const GUARD_HOOK_MATCHER =
  "call_mcp_tool|list_resources|read_resource|list_plugin_accounts|browser_subagent|open_browser_url|schedule|run_workflow|mcp_.*|run_command|desktop_.*|firecrawl_.*|alexandria_.*|people_company_.*|jobs_search|list_pages|new_page|navigate_page|take_snapshot|take_screenshot|evaluate_script|click|fill|fill_form|type_text|press_key|hover|drag|emulate|handle_dialog|list_network_requests|get_network_request|list_console_messages|get_console_message|lighthouse_audit|performance_.*|screencast_.*|upload_file|wait_for|close_page|select_page|resize_page|get_css_styles|set_logpoints|take_heapsnapshot";

export const PROTECTED_APP_NAMES = new Set([
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

const CHROME_DEVTOOLS_TOOLS = new Set([
  "click",
  "close_page",
  "drag",
  "emulate",
  "evaluate_script",
  "fill",
  "fill_form",
  "get_console_message",
  "get_css_styles",
  "get_network_request",
  "handle_dialog",
  "hover",
  "lighthouse_audit",
  "list_console_messages",
  "list_network_requests",
  "list_pages",
  "navigate_page",
  "new_page",
  "performance_analyze_insight",
  "performance_start_trace",
  "performance_stop_trace",
  "press_key",
  "resize_page",
  "screencast_start",
  "screencast_stop",
  "select_page",
  "set_logpoints",
  "take_heapsnapshot",
  "take_screenshot",
  "take_snapshot",
  "type_text",
  "upload_file",
  "wait_for",
]);

const BRIDGE_DESKTOP_TOOLS = new Set([
  "open_in_chrome",
  "open_desktop_target",
  "open_app",
  "send_to_discord",
  "capture_desktop",
  "desktop_clipboard",
  "desktop_windows",
  "text_to_speech",
]);

const FIRECRAWL_EXTRA_TOOLS = new Set([
  "alexandria_library_search",
  "alexandria_library_read",
  "people_company_search",
  "people_company_enrich",
  "jobs_search",
]);

function parseJsonObjectSafe(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      return {};
    }
  }
  return {};
}

function isTruthyFlag(val) {
  return val === true || String(val || "").trim().toLowerCase() === "true" || String(val || "").trim() === "1";
}

function normalizeProcessToken(raw) {
  return String(raw || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\.exe$/i, "")
    .toLowerCase();
}

/** Extract normalized { serverName, toolName, toolArgs, rawToolName } from a PreToolUse hook payload or stream step. */
export function normalizeToolInvocation(toolCall) {
  const rawName = String(toolCall?.name || toolCall?.tool_name || "").trim();
  const rawArgs = parseJsonObjectSafe(toolCall?.args ?? toolCall?.parameters);

  if (rawName === "call_mcp_tool") {
    const serverName = String(rawArgs.ServerName || rawArgs.serverName || rawArgs.server_name || "").trim();
    const toolName = String(rawArgs.ToolName || rawArgs.toolName || rawArgs.tool_name || "").trim();
    const toolArgs = parseJsonObjectSafe(rawArgs.Arguments ?? rawArgs.arguments);
    return { rawToolName: rawName, serverName, toolName, toolArgs };
  }

  if (rawName === "list_resources" || rawName === "read_resource") {
    const serverName = String(rawArgs.ServerName || rawArgs.serverName || rawArgs.server_name || "").trim();
    return { rawToolName: rawName, serverName, toolName: rawName, toolArgs: rawArgs };
  }

  if (rawName.startsWith("mcp_")) {
    const rest = rawName.slice(4);
    for (const prefix of [
      "agent-desktop_agent-desktop_",
      "agent-desktop_",
      "firecrawl_firecrawl_",
      "firecrawl_",
      "discord-bridge-desktop_",
      "chrome-devtools_",
    ]) {
      if (rest.startsWith(prefix)) {
        return {
          rawToolName: rawName,
          serverName: prefix.slice(0, -1),
          toolName: rest.slice(prefix.length),
          toolArgs: rawArgs,
        };
      }
    }
  }

  return { rawToolName: rawName, serverName: "", toolName: rawName, toolArgs: rawArgs };
}

/** Classify which MCP server family a normalized tool invocation belongs to. */
export function classifyMcpFamily({ serverName = "", toolName = "" }) {
  const srv = String(serverName || "").trim().toLowerCase();
  const tool = String(toolName || "").trim().toLowerCase();

  if (srv.includes("agent-desktop")) return "agent-desktop";
  if (srv.includes("firecrawl")) return "firecrawl";
  if (srv.includes("chrome-devtools")) return "chrome-devtools";
  if (srv === "discord-bridge-desktop") return "discord-bridge-desktop";

  if (!srv) {
    if (BRIDGE_DESKTOP_TOOLS.has(tool)) return "discord-bridge-desktop";
    if (tool.startsWith("desktop_")) return "agent-desktop";
    if (tool.startsWith("firecrawl_") || FIRECRAWL_EXTRA_TOOLS.has(tool)) return "firecrawl";
    if (CHROME_DEVTOOLS_TOOLS.has(tool)) return "chrome-devtools";
  }

  return "";
}

/** Build the environment variables passed into bridge-spawned agy runs for the PreToolUse guard hook. */
export function buildGuardEnv({ execPolicy, blockBypassSandbox = true }) {
  const env = {
    AGY_DISCORD_GUARD_ACTIVE: "1",
    AGY_DISCORD_IS_ADMIN: execPolicy?.isAdmin ? "1" : "0",
    AGY_DISCORD_ALLOW_DESKTOP: execPolicy?.allowDesktopTools ? "1" : "0",
    AGY_DISCORD_ALLOW_CHROME: execPolicy?.allowChrome ? "1" : "0",
    AGY_DISCORD_ALLOW_FIRECRAWL: execPolicy?.allowFirecrawl ? "1" : "0",
    AGY_DISCORD_BLOCK_BYPASS_SANDBOX: blockBypassSandbox !== false ? "1" : "0",
  };
  if (Array.isArray(execPolicy?.allowedMcpTools)) {
    env.AGY_DISCORD_ALLOWED_TOOLS = execPolicy.allowedMcpTools.join(",");
  }
  return env;
}

/** Evaluate a PreToolUse hook payload against the active Discord bridge RBAC & safety policy. */
export function evaluateToolGuard(hookInput, env = process.env) {
  if (String(env?.AGY_DISCORD_GUARD_ACTIVE || "") !== "1") {
    return { decision: "allow" };
  }

  const invocation = normalizeToolInvocation(hookInput?.toolCall);
  const { rawToolName, serverName, toolName, toolArgs } = invocation;
  if (!rawToolName && !toolName) return { decision: "allow" };

  const family = classifyMcpFamily({ serverName, toolName });
  const isAdmin = String(env.AGY_DISCORD_IS_ADMIN || "") === "1";

  // Protect bridge & core Windows system processes from accidental close in BOTH Admin and Member sessions
  if (family === "agent-desktop" && toolName.toLowerCase() === "desktop_close_app") {
    const candidate = normalizeProcessToken(toolArgs.app || toolArgs.name || toolArgs.processName || toolArgs.target);
    if (candidate && PROTECTED_APP_NAMES.has(candidate)) {
      return {
        decision: "deny",
        reason: `Blocked: refusing to close protected system/bridge process "${candidate}" via agent-desktop.`,
      };
    }
  }

  if (isAdmin) {
    return { decision: "allow" };
  }

  // Non-admin (Member / Webhook) hard restrictions
  const allowDesktop = String(env.AGY_DISCORD_ALLOW_DESKTOP || "") === "1";
  const allowChrome = String(env.AGY_DISCORD_ALLOW_CHROME || "") === "1";
  const allowFirecrawl = String(env.AGY_DISCORD_ALLOW_FIRECRAWL || "") === "1";
  const blockBypassSandbox = String(env.AGY_DISCORD_BLOCK_BYPASS_SANDBOX ?? "1") !== "0";

  if (rawToolName === "list_plugin_accounts") {
    return {
      decision: "deny",
      reason: "Permission denied: listing host plugin accounts is disabled for non-admin sessions.",
    };
  }

  if (rawToolName === "schedule" || rawToolName === "run_workflow") {
    return {
      decision: "deny",
      reason: `Permission denied: "${rawToolName}" is disabled for non-admin sessions.`,
    };
  }

  if ((rawToolName === "browser_subagent" || rawToolName === "open_browser_url") && !allowChrome) {
    return {
      decision: "deny",
      reason: `Permission denied: "${rawToolName}" is disabled for non-admin sessions without allowChrome.`,
    };
  }

  if (
    rawToolName === "run_command" &&
    blockBypassSandbox &&
    (isTruthyFlag(toolArgs.BypassSandbox) || isTruthyFlag(toolArgs.bypass_sandbox))
  ) {
    return {
      decision: "deny",
      reason: "Permission denied: BypassSandbox is strictly prohibited in non-admin Discord sessions.",
    };
  }

  const isMcpInvocation =
    rawToolName === "call_mcp_tool" ||
    rawToolName === "list_resources" ||
    rawToolName === "read_resource" ||
    rawToolName.startsWith("mcp_");

  if (family === "agent-desktop") {
    if (!allowDesktop) {
      return {
        decision: "deny",
        reason: `Permission denied: agent-desktop MCP tool "${toolName}" is disabled for non-admin sessions.`,
      };
    }
    return { decision: "allow" };
  }

  if (family === "firecrawl") {
    if (!allowFirecrawl) {
      return {
        decision: "deny",
        reason: `Permission denied: Firecrawl Cloud MCP tool "${toolName}" is disabled for non-admin sessions.`,
      };
    }
    return { decision: "allow" };
  }

  if (family === "chrome-devtools") {
    if (!allowChrome) {
      return {
        decision: "deny",
        reason: `Permission denied: chrome-devtools MCP tool "${toolName}" is disabled for non-admin sessions.`,
      };
    }
    return { decision: "allow" };
  }

  if (family === "discord-bridge-desktop") {
    const allowedCsv = String(env.AGY_DISCORD_ALLOWED_TOOLS || "").trim();
    const allowedSet = new Set(
      (allowedCsv || "send_to_discord,text_to_speech")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    if (!allowDesktop && !allowedSet.has(toolName)) {
      return {
        decision: "deny",
        reason: `Permission denied: discord-bridge-desktop tool "${toolName}" is not allowed in this scoped session.`,
      };
    }
    return { decision: "allow" };
  }

  // Default-deny any unrecognized MCP server or plugin tool for non-admin sessions (fail-closed)
  if (isMcpInvocation) {
    const label = serverName ? `${serverName}/${toolName || rawToolName}` : toolName || rawToolName;
    return {
      decision: "deny",
      reason: `Permission denied: unrecognized MCP tool "${label}" is blocked by default for non-admin sessions.`,
    };
  }

  return { decision: "allow" };
}

/** Build the platform shell command string for ~/.gemini/config/hooks.json with zero Node.js overhead outside Discord bridge runs. */
export function buildGuardHookCommand(nodeExecPath, botScriptPath) {
  if (process.platform === "win32") {
    const cmdPath = path.join(path.dirname(botScriptPath), "hook-guard.cmd");
    return /\s/.test(cmdPath) ? `"${cmdPath}"` : cmdPath;
  }
  return `if [ -z "$AGY_DISCORD_GUARD_ACTIVE" ]; then exit 0; else "${nodeExecPath}" "${botScriptPath}" --hook-guard; fi`;
}

/** Idempotently register the PreToolUse RBAC guard hook in ~/.gemini/config/hooks.json without overwriting unrelated user hooks. */
export function ensureSecurityHookRegistered(botScriptPath, nodeExecPath = process.execPath) {
  const hooksPath = path.join(os.homedir(), ".gemini", "config", "hooks.json");
  try {
    fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
    let data = {};
    if (fs.existsSync(hooksPath)) {
      const raw = fs.readFileSync(hooksPath, "utf8").replace(/^\uFEFF/, "").trim();
      if (raw) {
        data = JSON.parse(raw);
      }
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.warn(`[guard] Skipping ${hooksPath}: root value is not a JSON object.`);
      return false;
    }

    const desired = {
      enabled: true,
      PreToolUse: [
        {
          matcher: GUARD_HOOK_MATCHER,
          hooks: [
            {
              type: "command",
              command: buildGuardHookCommand(nodeExecPath, botScriptPath),
              timeout: 5,
            },
          ],
        },
      ],
    };

    const existing = data[GUARD_HOOK_NAME];
    if (JSON.stringify(existing) !== JSON.stringify(desired)) {
      data[GUARD_HOOK_NAME] = desired;
      writeJson(hooksPath, data);
      console.log(`[guard] Registered ${GUARD_HOOK_NAME} in ${hooksPath}`);
    }
    return true;
  } catch (err) {
    console.warn(`[guard] Failed to register ${GUARD_HOOK_NAME} in ${hooksPath}:`, err.message);
    return false;
  }
}
