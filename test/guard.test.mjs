import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGuardEnv,
  classifyMcpFamily,
  evaluateToolGuard,
  normalizeToolInvocation,
} from "../lib/guard.mjs";
import { createAdminPolicy, createMemberPolicy } from "../lib/auth.mjs";

test("evaluateToolGuard allows tools outside Discord bridge runs", () => {
  const res = evaluateToolGuard(
    {
      toolCall: {
        name: "call_mcp_tool",
        args: { ServerName: "agent-desktop_agent-desktop", ToolName: "desktop_snapshot", Arguments: {} },
      },
    },
    {}
  );
  assert.deepEqual(res, { decision: "allow" });
});

test("evaluateToolGuard hard-blocks agent-desktop, firecrawl, chrome-devtools, and BypassSandbox for Members", () => {
  const memberPolicy = createMemberPolicy({ cwd: "C:\\SafeMember" }, "C:\\Fallback");
  const env = buildGuardEnv({ execPolicy: memberPolicy, blockBypassSandbox: true });

  // Block agent-desktop via call_mcp_tool
  const rDesktop = evaluateToolGuard(
    {
      toolCall: {
        name: "call_mcp_tool",
        args: { ServerName: "agent-desktop_agent-desktop", ToolName: "desktop_list_windows", Arguments: {} },
      },
    },
    env
  );
  assert.equal(rDesktop.decision, "deny");
  assert.match(rDesktop.reason, /agent-desktop/i);

  // Block agent-desktop via direct tool name
  const rDesktopDirect = evaluateToolGuard(
    { toolCall: { name: "desktop_clipboard_get", args: {} } },
    env
  );
  assert.equal(rDesktopDirect.decision, "deny");

  // Block firecrawl via call_mcp_tool & extra tool names
  const rFirecrawl = evaluateToolGuard(
    {
      toolCall: {
        name: "call_mcp_tool",
        args: { ServerName: "firecrawl_firecrawl", ToolName: "firecrawl_scrape", Arguments: { url: "https://example.com" } },
      },
    },
    env
  );
  assert.equal(rFirecrawl.decision, "deny");
  assert.match(rFirecrawl.reason, /firecrawl/i);

  const rFirecrawlExtra = evaluateToolGuard(
    { toolCall: { name: "alexandria_library_search", args: { query: "test" } } },
    env
  );
  assert.equal(rFirecrawlExtra.decision, "deny");

  // Block chrome-devtools
  const rChrome = evaluateToolGuard(
    {
      toolCall: {
        name: "call_mcp_tool",
        args: { ServerName: "chrome-devtools", ToolName: "list_pages", Arguments: {} },
      },
    },
    env
  );
  assert.equal(rChrome.decision, "deny");
  assert.match(rChrome.reason, /chrome-devtools/i);

  // Block unsafe discord-bridge-desktop tools, allow send_to_discord and text_to_speech
  const rOpenApp = evaluateToolGuard(
    {
      toolCall: {
        name: "call_mcp_tool",
        args: { ServerName: "discord-bridge-desktop", ToolName: "open_app", Arguments: { app: "notepad" } },
      },
    },
    env
  );
  assert.equal(rOpenApp.decision, "deny");

  const rSendFile = evaluateToolGuard(
    {
      toolCall: {
        name: "call_mcp_tool",
        args: { ServerName: "discord-bridge-desktop", ToolName: "send_to_discord", Arguments: { path: "out.pdf" } },
      },
    },
    env
  );
  assert.deepEqual(rSendFile, { decision: "allow" });

  const rTts = evaluateToolGuard(
    {
      toolCall: {
        name: "call_mcp_tool",
        args: { ServerName: "discord-bridge-desktop", ToolName: "text_to_speech", Arguments: { text: "xin chao" } },
      },
    },
    env
  );
  assert.deepEqual(rTts, { decision: "allow" });

  // Block BypassSandbox: true, allow normal sandboxed run_command
  const rBypass = evaluateToolGuard(
    { toolCall: { name: "run_command", args: { CommandLine: "dir", BypassSandbox: true } } },
    env
  );
  assert.equal(rBypass.decision, "deny");
  assert.match(rBypass.reason, /BypassSandbox/i);

  const rNormalCmd = evaluateToolGuard(
    { toolCall: { name: "run_command", args: { CommandLine: "node script.js" } } },
    env
  );
  assert.deepEqual(rNormalCmd, { decision: "allow" });

  // Block resource reads on restricted MCP servers, plugin accounts, and browser_subagent
  const rReadRes = evaluateToolGuard(
    { toolCall: { name: "read_resource", args: { ServerName: "agent-desktop_agent-desktop", Uri: "desktop://x" } } },
    env
  );
  assert.equal(rReadRes.decision, "deny");

  const rAccounts = evaluateToolGuard(
    { toolCall: { name: "list_plugin_accounts", args: {} } },
    env
  );
  assert.equal(rAccounts.decision, "deny");

  const rBrowserSub = evaluateToolGuard(
    { toolCall: { name: "browser_subagent", args: { Task: "open site" } } },
    env
  );
  assert.equal(rBrowserSub.decision, "deny");
});

test("evaluateToolGuard respects selective Member allowFirecrawl while still blocking agent-desktop", () => {
  const scopedPolicy = createMemberPolicy({ cwd: "C:\\SafeMember", allowFirecrawl: true }, "C:\\Fallback");
  const env = buildGuardEnv({ execPolicy: scopedPolicy, blockBypassSandbox: true });

  const rFirecrawl = evaluateToolGuard(
    {
      toolCall: {
        name: "call_mcp_tool",
        args: { ServerName: "firecrawl_firecrawl", ToolName: "firecrawl_scrape", Arguments: { url: "https://example.com" } },
      },
    },
    env
  );
  assert.deepEqual(rFirecrawl, { decision: "allow" });

  const rDesktop = evaluateToolGuard(
    {
      toolCall: {
        name: "call_mcp_tool",
        args: { ServerName: "agent-desktop_agent-desktop", ToolName: "desktop_snapshot", Arguments: {} },
      },
    },
    env
  );
  assert.equal(rDesktop.decision, "deny");
});

test("evaluateToolGuard allows Admin MCP calls but protects bridge/system processes from desktop_close_app", () => {
  const adminEnv = buildGuardEnv({ execPolicy: createAdminPolicy(), blockBypassSandbox: true });

  const rAdminDesktop = evaluateToolGuard(
    {
      toolCall: {
        name: "call_mcp_tool",
        args: { ServerName: "agent-desktop_agent-desktop", ToolName: "desktop_snapshot", Arguments: {} },
      },
    },
    adminEnv
  );
  assert.deepEqual(rAdminDesktop, { decision: "allow" });

  const rAdminFirecrawl = evaluateToolGuard(
    {
      toolCall: {
        name: "call_mcp_tool",
        args: { ServerName: "firecrawl_firecrawl", ToolName: "firecrawl_credit_usage", Arguments: {} },
      },
    },
    adminEnv
  );
  assert.deepEqual(rAdminFirecrawl, { decision: "allow" });

  const rCloseNode = evaluateToolGuard(
    {
      toolCall: {
        name: "call_mcp_tool",
        args: {
          ServerName: "agent-desktop_agent-desktop",
          ToolName: "desktop_close_app",
          Arguments: { app: "node.exe" },
        },
      },
    },
    adminEnv
  );
  assert.equal(rCloseNode.decision, "deny");
  assert.match(rCloseNode.reason, /protected/i);

  const rCloseNotepad = evaluateToolGuard(
    {
      toolCall: {
        name: "call_mcp_tool",
        args: {
          ServerName: "agent-desktop_agent-desktop",
          ToolName: "desktop_close_app",
          Arguments: { app: "notepad" },
        },
      },
    },
    adminEnv
  );
  assert.deepEqual(rCloseNotepad, { decision: "allow" });
});

test("normalizeToolInvocation and classifyMcpFamily handle prefixed and direct MCP tool names", () => {
  const inv = normalizeToolInvocation({
    name: "mcp_firecrawl_firecrawl_firecrawl_scrape",
    args: { url: "https://example.com" },
  });
  assert.equal(inv.serverName, "firecrawl_firecrawl");
  assert.equal(inv.toolName, "firecrawl_scrape");
  assert.equal(classifyMcpFamily(inv), "firecrawl");
});
