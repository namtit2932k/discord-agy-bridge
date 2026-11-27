<div align="center">
  <img src="assets/logo-white.png" alt="sickyturtlez logo" width="120" />
  <h1>discord-agy-bridge</h1>
  <p><strong>Turn a Windows machine running Antigravity CLI (<code>agy</code>) into an all-in-one Discord AI Assistant, Server Management Bot &amp; Automation Hub.</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Node.js-v22%2B%20(zero%20node__modules)-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Commands-26%20Slash%20(%2F)-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord Slash Commands" />
    <img src="https://img.shields.io/badge/Tests-50%2F50%20Passing-2ea44f?style=flat-square" alt="Tests" />
    <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6?style=flat-square&logo=windows&logoColor=white" alt="Windows" />
  </p>
  <p>
    English &nbsp;·&nbsp; <a href="./README.vi.md">Tiếng Việt</a>
  </p>
</div>

---

## 1. Overview & What Problems It Solves

### The Problems
1. **Antigravity has no standalone chat/mobile app:** While Antigravity supports remote workflows, it lacks a dedicated messaging app you can open quickly on your phone or desktop to chat naturally, drop screenshots/documents, and receive structured replies or files in one familiar place.
2. **Sharing AI safely with multiple people is hard:** Letting friends or community members run `agy` directly on your Windows host risks exposing private folders, leaking secrets (`config.json`), executing unsandboxed commands (`BypassSandbox`), or exhausting daily quota/storage.
3. **Fragmented Discord server management bots:** Once a Discord bot is already online to serve AI, installing half a dozen third-party bots for welcome cards, private member channels, guide syncing, channel cleanup, scheduled tasks, webhook alerts, and Voice music creates clutter and permission headaches. Why not unify all large-server management utilities right inside one lightweight bot?

### How `discord-agy-bridge` Solves Them
* **Discord as Antigravity's native UI (`bot.mjs`, `lib/runner.mjs`):** Connects directly to `agy.exe` headless mode (`~74 MB` idle RAM, zero `node_modules` inside the repo) and turns Discord DM, channels, and auto-created Threads into an interactive AI workspace with `26` native `/` Slash Commands, live step streaming, latest-message Action Buttons, Reply context, two-way `25 MB` media attachments, Office/PDF generation (`quick-files`), Cloud TTS, and 4-MCP routing (**`discord-bridge-desktop`**, **`agent-desktop`** headless Windows UIA, **`firecrawl`** Cloud scraping/PDF parsing, and isolated **Chrome AM** on port `9229`).
* **Two-layer multi-user isolation (RBAC + `PreToolUse` Default-Deny Guard + Sandbox):** Automatically provisions each new server member a private `#ai-<username>` channel, locked workspace (`--sandbox`), and per-channel `discord-attachments/<channelId>` + `discord-temp/<channelId>` directories. A `PreToolUse` hook (`lib/guard.mjs` + `hook-guard.cmd`) enforces **default-deny** for all unrecognized MCP servers/plugins, blocks `agent-desktop`, `firecrawl`, `chrome-devtools`, `browser_subagent`, `schedule`, `run_workflow`, `list_plugin_accounts`, and `BypassSandbox: true` for non-admin sessions, while protecting host bridge/system processes (`node`, `agy`, `antigravity`, `explorer`) from accidental close.
* **Full-featured Discord Server Management Bot (`0` AI tokens for server utilities):** Built like a complete community server bot — auto-onboard/offboard (`GUILD_MEMBERS`), transparent PNG join/leave cards in `#announcement`, read-only member guide synced to `#instructions`, channel privacy & Admin `/clear`, zero-token daily admin reports, Cron & HTTP Webhook Automation Hub, and a multi-platform Discord Voice music player (`/play`) with resource-saving Opus passthrough.

---

## 2. Architecture

```text
Discord (DM / Server Channels / Threads / Voice)
   │
   ▼  WebSocket Gateway + Slash Commands + Action Buttons (lib/discord-gateway.mjs, lib/slash.mjs)
┌──────────────────────────────────────────────────────────────────────┐
│                         bot.mjs (Central Orchestrator)               │
│  ├─ Access Control & RBAC Quotas (lib/auth.mjs, lib/quota.mjs)       │
│  ├─ Server Ops: Auto-Onboard, Cards, Guides (onboard, announce-card) │
│  ├─ Automation Hub: Cron & HTTP Webhook (lib/cron.mjs, webhook.mjs)  │
│  └─ Priority Queue Semaphore: User > Webhook > Cron (lib/runner.mjs) │
└───────┬───────────────────────────────┬──────────────────────┬───────┘
        │                               │                      │
        ▼                               ▼                      ▼
 Antigravity CLI (`agy`)      MCP Desktop Bridge        Discord Voice Engine
 - Per-channel model/mode     - Chrome AM (9229)        - yt-dlp (--no-cache-dir)
 - Real-time stream-json      - Windows App/Clipboard   - ffmpeg (-c:a copy Opus)
 - `--sandbox` for Members    - Screenshot & Cloud TTS  - @discordjs/voice + DAVE
 - Shared quick-files libs    - send_to_discord (25MB)  - Auto-leave on empty room
```

---

## 3. Core Feature Groups

### A. AI Assistant & Two-Way File Pipeline (`bot.mjs`, `lib/runner.mjs`)
* **26 Slash Commands (`/`) + Latest-Message Action Buttons:** Native `/` menu with descriptions and dynamic autocomplete for models, projects, cron jobs, webhooks, and `/play` actions. Action buttons (`[🔄 Thử lại]`, `[📝 Tóm tắt ngắn]`, `[🆕 Phiên mới]`, `[🗑️ Xóa Thread]`) automatically strip themselves from older replies so only the latest message holds active buttons.
* **Live Step Streaming & Thread Isolation:** Streams tool progress (`Read`, `Edit`, `Run`, `Chrome AM`) with an instant `[⏹️ Dừng ngay]` cancel button and Windows sleep inhibitor during active AI turns. Supports `/autothread on`, synced deletion between Discord Threads and `agy` conversations, and full **Reply** context + attachments extraction.
* **Multimedia & Office Exports:** Accepts up to `25 MB` attachments from Discord; AI can generate and return `.pptx`, `.xlsx`, `.docx`, `.pdf`, `.html`, `.zip`, `.svg`, Markdown images, and Cloud TTS `.mp3` files (`delete_after_send` supported for temp files).

### B. Multi-Purpose Discord Server Bot: Management, Announcements & Voice (`/play`)
* **Auto-Onboard & Private Workspaces (`lib/onboard.mjs`, `lib/auth.mjs`):** On `GUILD_MEMBER_ADD` (or `/access onboard`), creates a private `#ai-<user>` channel (hidden from `@everyone`) + sandbox folder, sends a tailored welcome message, and revokes access on leave (`GUILD_MEMBER_REMOVE` / `/access offboard`). Includes `/access private`, per-member model locking (`/access model`), and Admin-only `/clear` in `#free-chat` and `#announcement`.
* **Announcement Cards & Guide Sync (`lib/announce-card.mjs`, `/guide`):** Renders transparent PNG join/leave banners with circular green/red-bordered avatars and live member counts into `#announcement`, and maintains a plain-language read-only guide for members in `#instructions`.
* **Quotas, Security & Daily Reports (`lib/quota.mjs`, `lib/report.mjs`):** Enforces daily turns/tokens, cooldowns, and workspace MB limits; kills and alerts `#admin` if a non-admin session tries `BypassSandbox: true`; sends zero-token end-of-day usage & disk summaries to `#admin`.
* **Voice Playback Utility (`/play`, `lib/music.mjs`):** Available to all members in `#free-chat`, Voice text chats, and private rooms (`0` AI tokens). Supports single links and playlists from **YouTube**, **YouTube Music**, **SoundCloud**, **Spotify** (with per-track URLs and durations parsed from embed metadata), direct audio URLs, and song search. Displays a compact Embed with source links, up to `5` upcoming tracks, and `5` live buttons (`⏸️ Pause` · `⏭️ Skip` · `➡️ Sequential / 🔀 Shuffle / 🔂 Repeat 1 / 🔁 Repeat All` · `🧹 Clear Queue` · `⏹️ Stop & Leave`) kept strictly on the newest card. Uses `--no-cache-dir`, `-hwaccel none -threads 1 -c:a copy` Opus passthrough, and auto-leaves empty rooms (`1m`), finished queues (`2m`), or long pauses (`10m`).

### C. Windows Desktop, `agent-desktop`, Firecrawl Cloud & Isolated Chrome AM (`lib/desktop.mjs`, `lib/runner.mjs`)
* **`discord-bridge-desktop` (`lib/desktop.mjs`):** Exposes **8 authenticated MCP host tools** (`open_in_chrome`, `open_app`, `open_desktop_target`, `send_to_discord`, `text_to_speech`, `capture_desktop`, `desktop_clipboard`, `desktop_windows`) over an ephemeral loopback bridge (`127.0.0.1:0` + per-session Bearer token) for persistent GUI launches, file uploads, Cloud TTS, and safe Chrome AM shutdown.
* **`agent-desktop` & `Firecrawl Cloud` routing (`lib/runner.mjs`):** Automatically splits Admin desktop tasks (`discord-bridge-desktop` for persistent launches/uploads vs `agent-desktop` for headless UI inspection/clicks/notifications) and routes public URLs/docs/PDFs to `firecrawl_scrape`/`firecrawl_parse`/`firecrawl_search` without popping up Chrome AM, reserving **Chrome AM** (`%LOCALAPPDATA%\Google\Chrome AM User Data`, port `9229`) for logged-in or interactive SPA workflows.

### D. Automation Hub — Cron & HTTP Webhook (`lib/cron.mjs`, `lib/webhook.mjs`)
* **Persistent Cron Scheduler:** Schedules recurring or one-shot AI tasks (`every 30m`, `in 15m`, `daily 08:30`, or 5-field POSIX cron) stored in `state.json` — e.g. `/cron add "daily 08:30" "Use firecrawl_search to summarize top tech news today"`.
* **Local HTTP Webhook Server:** Binds to `127.0.0.1:3939` by default, accepts `POST /webhook/<hookId>` with Bearer / `X-Webhook-Secret` / HMAC-SHA256 (`X-Hub-Signature-256`) authentication, minimal unauthenticated `GET /health` (`{"ok":true}`), request timeouts (`15s`), rate limiting, deduplication (`dedupWindowSec`), untrusted payload delimiters (`<untrusted_webhook_payload>`), and scoped non-admin diagnosis Threads.

### E. Security Model & Boundaries (`lib/auth.mjs`, `lib/guard.mjs`)
* **Default-deny MCP guard:** Non-admin sessions (Members & Webhooks) are governed by a `PreToolUse` hook (`hook-guard.cmd` → `bot.mjs --hook-guard`) that blocks unrecognized MCP servers/plugins by default, rejects `BypassSandbox: true`, `schedule`, `run_workflow`, `list_plugin_accounts`, and `browser_subagent`, while remaining a zero-overhead no-op outside Discord bridge runs.
* **Path & temp isolation:** Rejects Windows UNC/device paths (`\\server\share`, `\\?\...`, `\\.\...`), symlink/junction escapes, and cross-channel temp access via per-channel `discord-attachments/<channelId>` and `discord-temp/<channelId>` directories.
* **Scope of application-level sandboxing:** `--sandbox`, workspace path checks, and `PreToolUse` hooks provide strong application-level isolation suited for friends, family, and trusted groups sharing a personal Windows host. Because all sessions run under the same Windows user account, do **not** treat this as OS/VM-level isolation for completely untrusted public internet users; keep `webhook.host` bound to `127.0.0.1` unless fronted by an authenticated reverse proxy/tunnel.

---

## 4. Repository Structure & Agent Handoff Files

> **For developers & AI Agents taking over this repo:**
> Read [`AGENTS.md`](./AGENTS.md), [`CLAUDE.md`](./CLAUDE.md), and the top of [`CHANGELOG.md`](./CHANGELOG.md) before modifying any code.

```text
discord-agy-bridge/
├── assets/
│   ├── logo-white.png        # Active logo (white ink, transparent PNG)
│   └── logo-black.png        # Alternate logo (black ink, transparent PNG)
├── bot.mjs                   # Main entrypoint: Gateway dispatch, slash/button handlers, --mcp-stdio, --hook-guard
├── hook-guard.cmd            # Zero-overhead Windows PreToolUse wrapper (no-op outside Discord bridge)
├── lib/
│   ├── announce-card.mjs     # Transparent PNG join/leave banner generator (.NET System.Drawing)
│   ├── auth.mjs              # RBAC authorization, MEMBER_ALLOWED_COMMANDS, allowFirecrawl & MCP scoping
│   ├── cron.mjs              # Persistent cron scheduler & /cron parser
│   ├── desktop.mjs           # MCP desktop bridge (Chrome AM, Windows GUI, per-channel temp, capture, TTS)
│   ├── discord-gateway.mjs   # Custom WebSocket Gateway client (Heartbeat, Resume, Watchdog, Intents)
│   ├── guard.mjs             # Default-deny PreToolUse RBAC guard & protected-process shield
│   ├── music.mjs             # Discord Voice player, playlist resolver, 4 modes, stream TTL & resource tuning
│   ├── onboard.mjs           # Auto-onboard/offboard private channels + sandbox folders
│   ├── quota.mjs             # Daily turns/tokens, cooldown & disk quota enforcement
│   ├── report.mjs            # Zero-token daily admin summary & security alert recorder
│   ├── runner.mjs            # Priority queue semaphore, sleep inhibitor, 4-MCP prompt routing
│   ├── slash.mjs             # 26 Slash Command definitions, parser & dynamic autocomplete
│   ├── utils.mjs             # 64-bit Snowflake preservation, atomic JSON, UNC/symlink path safety
│   └── webhook.mjs           # Authenticated HTTP webhook server (untrusted payload framing, /health guard)
├── scripts/
│   └── verify.mjs            # One-command health check (syntax, 50 tests, config/MCP/hook/PID/hygiene)
├── test/                     # Zero-dependency Node test suite (`node --test`, 50 tests)
├── config.example.json       # Template config (copy to config.json locally, NEVER commit)
├── .gitignore                # Ignores config.json, state.json, bot.log, bot.pid, node_modules/, workspaces/
├── run-hidden.vbs            # Hidden Windows Task Scheduler launcher
├── start.bat / stop.bat      # Foreground terminal runner / daemon + Task Scheduler stopper
├── AGENTS.md                 # Master multi-agent handoff & operations playbook
├── CLAUDE.md / GEMINI.md     # Auto-loaded agent context pointers
└── CHANGELOG.md              # Chronological change log (newest at top)
```

---

## 5. Fresh Machine Setup

### Prerequisites
* **OS:** Windows 10 / 11 *(Desktop/Chrome AM/Task Scheduler features target Windows; Gateway & Voice run on standard Node.js)*.
* **Node.js:** `v22+` (`v24.6.0` verified, built-in native `aes-256-gcm` for Discord Voice).
* **Antigravity CLI:** `agy.exe` installed and OAuth-authenticated.
* **FFmpeg:** Installed at `C:\ffmpeg\ffmpeg.exe` (or on `PATH`) for `/play` Voice audio.

### Step 1: Clone & Create `config.json`
```powershell
git clone https://github.com/namtit2932k/discord-agy-bridge.git
cd discord-agy-bridge
Copy-Item config.example.json config.json
```
Edit `config.json` *(keep all Discord Snowflake IDs as strings `"..."`)*:
* `botToken`: Discord Bot token from the [Discord Developer Portal](https://discord.com/developers/applications) with **Privileged Gateway Intents** (`Message Content Intent`, `Server Members Intent`) enabled and server permissions (`View Channel`, `Send Messages`, `Read Message History`, `Manage Messages`, `Manage Channels`, `Manage Roles`, `Connect`, `Speak`).
* `allowedUserId`: Root Admin's Discord User ID.
* `allowedChannelIds`, `agyPath`, `defaultCwd`, `autoOnboard.rootDir`: Paths and channel IDs matching your machine/server.

### Step 2: Install External Shared Tools (`C:\ProgramData\agy-shared-tools`)
The repository stays clean with zero `node_modules`. Voice dependencies and shared Office/PDF libraries live outside the repo so Windows sandboxed `agy` runs can read them safely:

```powershell
New-Item -ItemType Directory -Force -Path "C:\ProgramData\agy-shared-tools\bin" | Out-Null
cd "C:\ProgramData\agy-shared-tools"
npm init -y
npm install @discordjs/voice @snazzah/davey prism-media opusscript
# Optional for sandboxed AI document generation: npm install pptxgenjs exceljs xlsx docx pdfkit archiver

# Download yt-dlp.exe to C:\ProgramData\agy-shared-tools\bin\yt-dlp.exe
Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile "C:\ProgramData\agy-shared-tools\bin\yt-dlp.exe"

# Grant read & execute permissions for sandboxed Windows runs:
icacls "C:\ProgramData\agy-shared-tools" /grant "*S-1-15-2-1:(OI)(CI)(RX)" /T
```

### Step 3: Verify & Run
```powershell
# Canonical 1-command verification (syntax, 50 unit tests, config/MCP/hook/PID/hygiene)
node scripts/verify.mjs

# Run interactively with console output
.\start.bat
```
*(Note: `node scripts/verify.mjs` validates syntax, unit/regression tests, and daemon health; real Windows GUI/Chrome AM/Discord Voice interactions should also be smoke-tested live on the host after major changes.)*
For background autostart on Windows logon, create a Task Scheduler task named `AntigravityDiscordBridge` (`Logon Mode: Interactive only`) running `wscript.exe //B "<path>\run-hidden.vbs"`. Deploy updates with:
```powershell
.\stop.bat
schtasks /Run /TN "AntigravityDiscordBridge"
```

---

## 6. Slash Commands Reference (`26` Commands)

### Member Commands (`8`)
| Command | Description |
| :--- | :--- |
| `/play <link-media> [voice]` | Play tracks or playlists (YouTube, YT Music, SoundCloud, Spotify, search query) in Voice; supports `queue`, `skip`, `clear`, `shuffle`, `repeat`, `repeat-one`, `sequential`, `pause`, `resume`, `stop` *(usable in `#free-chat`, Voice text chats & member rooms)* |
| `/help` | Show commands filtered by the caller's role |
| `/status` | Inspect active model, session & RBAC state |
| `/usage` | View token usage and remaining daily quota |
| `/new` | Reset conversation context while keeping project & model |
| `/stop` | Abort the running AI task immediately |
| `/clear [count]` | Clear messages outside Threads in your room *(Admin can also `/clear` in `#free-chat` and `#announcement`)* |
| `/delete` | Delete the current Thread along with its starter message and conversation |

### Admin-Only Commands (`18`, `default_member_permissions: "8"`)
* **Workspace & Model:** `/projects`, `/project`, `/models`, `/model`, `/mode`, `/sandbox`
* **Access & Docs:** `/access` (`list`, `onboard`, `offboard`, `auto`, `private`, `channel`, `revoke`, `admin`, `model ...`, `quota ...`, `security ...`, `report ...`), `/guide [reset]`, `/reload`
* **Desktop & Diagnostics:** `/chrome <status|close>`, `/windows <list|focus|close>`, `/logs [lines]`, `/cleanup`
* **Automation & Display:** `/cron`, `/webhook`, `/footer`, `/autothread`, `/stream`

---

## 7. Multi-Agent Handoff Rules

1. Always read [`AGENTS.md`](./AGENTS.md), the top 30–60 lines of [`CHANGELOG.md`](./CHANGELOG.md), and run `node scripts/verify.mjs` before editing code or config.
2. **Never read, print, or commit `botToken`** inside `config.json`.
3. **Never launch GUI apps directly from IDE terminals:** IDE shells execute inside hidden desktop `WinSta0\exebox-...`; GUI launches belong to the Interactive Task Scheduler daemon `bot.mjs`.
4. **After every change:** Prepend a new entry to [`CHANGELOG.md`](./CHANGELOG.md), update [`AGENTS.md`](./AGENTS.md) if architecture changed, run `node scripts/verify.mjs`, restart with `stop.bat` → `schtasks /Run /TN "AntigravityDiscordBridge"`, then re-run `node scripts/verify.mjs` and inspect `bot.log`.
