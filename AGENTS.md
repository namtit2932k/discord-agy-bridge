# Project Context, Architecture & Multi-Agent Handoff Playbook (`discord-agy-bridge`)

> Tài liệu này là **Nguồn sự thật duy nhất (Single Source of Truth)** cho mọi AI Agent (Antigravity, Claude Code, Codex, Cursor, Gemini CLI) tiếp nhận dự án. Đọc hết tài liệu này (~60 giây) là đủ ngữ cảnh để làm việc an toàn, đúng chuẩn.

---

## 0. Quy trình Onboarding 60 giây cho AI Agent mới nhận bàn giao
Khi mới mở dự án hoặc bắt đầu phiên mới, thực hiện **đúng 3 bước** trước khi chỉnh sửa bất cứ thứ gì:
1. Đọc trọn [`AGENTS.md`](./AGENTS.md) (file này).
2. Đọc **30–60 dòng đầu** của [`CHANGELOG.md`](./CHANGELOG.md) để nắm các thay đổi gần nhất *(không cần đọc hết toàn bộ lịch sử cũ trừ khi cần truy vết bug cụ thể)*.
3. Chạy lệnh kiểm tra sức khỏe 1 dòng:
   ```powershell
   node scripts/verify.mjs
   ```
   Lệnh này tự kiểm tra syntax mọi file `.mjs`, chạy toàn bộ unit tests (`node --test`), xác minh `config.json` (không in secret), `mcp_config.json`, `hooks.json`, `bot.pid` và vệ sinh repo (`0 node_modules`).

> **Mẫu câu lệnh bàn giao nhanh (copy gửi cho Agent mới):**
> *"Hãy nạp ngữ cảnh dự án theo `AGENTS.md`, đọc phần đầu `CHANGELOG.md`, chạy `node scripts/verify.mjs` để kiểm tra trạng thái hiện tại rồi báo ngắn gọn trước khi làm tác vụ: <mô tả yêu cầu>."*

---

## 1. 5 Luật Thép Bất Khả Xâm Phạm
1. **Bảo mật tuyệt đối (`config.json`):** `config.json` chứa `botToken` và secret webhook — **tuyệt đối không đọc, in ra chat/log hay commit `botToken`**. Khi cần xem schema, chỉ đọc [`config.example.json`](./config.example.json). Mọi Discord Snowflake ID trong `config.json` phải để dạng chuỗi (`"..."`) để không bị `JSON.parse` làm tròn 64-bit (`lib/utils.mjs` cũng có `quoteSnowflakeLiterals` tự bảo vệ).
2. **Giữ kiến trúc Node.js thuần, `0 node_modules` trong repo:** Không chạy `npm install` trong thư mục repo. Mọi thư viện ngoài (`@discordjs/voice`, `@snazzah/davey`, `opusscript`, `quick-files`, `pptxgenjs`, `exceljs`, `docx`, `pdfkit`, `yt-dlp.exe`) đặt tại `C:\ProgramData\agy-shared-tools` (đã cấp quyền `ALL APPLICATION PACKAGES:(OI)(CI)(RX)` cho tiến trình sandbox) và gắn qua `NODE_PATH`. **Tuyệt đối không** truyền `--add-dir` cho thư mục thư viện vì `agy --add-dir` làm lệch `cwd` của `run_command`.
3. **Không tự mở GUI từ terminal IDE (`WinSta0\exebox-...`):** Terminal `run_command` của IDE chạy trong desktop ẩn, KHÔNG phải desktop thật `WinSta0\Default`. Chrome khóa `--user-data-dir` theo đơn tiến trình nên mở từ shell IDE sẽ bị kẹt ẩn. Việc mở GUI thật (`Chrome AM`, app Windows) do tiến trình interactive `bot.mjs` (Task Scheduler `Logon Mode: Interactive only`) đảm nhiệm.
4. **Bảo vệ RBAC 2 lớp khi đụng tới MCP / Plugin / Sandbox:** Mọi tính năng mới phải tôn trọng phân quyền Admin vs Member/Webhook trong [`lib/auth.mjs`](./lib/auth.mjs) và chốt chặn cứng `PreToolUse` trong [`lib/guard.mjs`](./lib/guard.mjs) + [`hook-guard.cmd`](./hook-guard.cmd). Không cho phép Member truy cập file ngoài `cwd` / `discord-attachments/<channelId>` / `discord-temp/<channelId>`.
5. **Definition of Done (bắt buộc sau mọi thay đổi):**
   * Thêm 1 mục mới lên **đầu** [`CHANGELOG.md`](./CHANGELOG.md) theo template sẵn.
   * Cập nhật [`AGENTS.md`](./AGENTS.md) (và [`README.md`](./README.md) nếu đổi kiến trúc, lệnh `/` hoặc quy trình vận hành).
   * Chạy `node scripts/verify.mjs` xác nhận `0 failed`.
   * Restart daemon đúng chuẩn (tránh chạy 2 instance):
     ```powershell
     .\stop.bat
     schtasks /Run /TN "AntigravityDiscordBridge"
     ```
   * Chờ 3–4 giây rồi chạy lại `node scripts/verify.mjs` và kiểm tra cuối `bot.log` xác nhận `[guard] Registered discord-bridge-rbac-guard`, `[mcp] Desktop bridge listening` và `[gateway] Ready as sickyturtlez#7297`.

---

## 2. Tổng quan & Bản đồ Tra cứu Nhanh (`Đổi gì → Sửa file nào`)

Cầu nối chat 2 chiều, **Automation Hub** và **Bot quản lý Server + Voice** giữa **Discord** và **Antigravity CLI (`agy`)**, chạy độc lập nền qua Windows Task Scheduler (`AntigravityDiscordBridge`, `wscript.exe //B run-hidden.vbs` → `node bot.mjs --log`, RAM rảnh ~74 MB).

```text
Discord (DM / Kênh / Thread / Voice)
  │  WebSocket Gateway + 26 Slash Commands + Action Buttons
  ▼
bot.mjs (Orchestrator: --mcp-stdio, --hook-guard, Dispatch, Stream, Buttons)
  ├─ RBAC & Isolation: lib/auth.mjs + lib/guard.mjs (PreToolUse hook) + lib/quota.mjs
  ├─ Server Utilities: lib/onboard.mjs + lib/announce-card.mjs + lib/report.mjs (0 token AI)
  ├─ Automation Hub:   lib/cron.mjs + lib/webhook.mjs + lib/runner.mjs (Priority Queue)
  ├─ Desktop & Web:    lib/desktop.mjs (8 MCP tools, Chrome AM 9229) + agent-desktop + firecrawl
  └─ Voice Music:      lib/music.mjs (yt-dlp + ffmpeg -c:a copy Opus + @discordjs/voice)
```

| Khi cần thay đổi... | File chính | Test tương ứng |
| :--- | :--- | :--- |
| Luồng chat, Slash handler, Action Buttons, stream tiến độ, MCP stdio/hook entry | [`bot.mjs`](./bot.mjs) | `node scripts/verify.mjs` |
| Phân quyền Admin/Member, `channelRules`, `autoOnboard`, `allowFirecrawl`, `/access channel` | [`lib/auth.mjs`](./lib/auth.mjs) | [`test/auth.test.mjs`](./test/auth.test.mjs) |
| Chặn cứng `PreToolUse` (`agent-desktop`, `firecrawl`, `chrome-devtools`, `BypassSandbox`, bảo vệ process) | [`lib/guard.mjs`](./lib/guard.mjs), [`hook-guard.cmd`](./hook-guard.cmd) | [`test/guard.test.mjs`](./test/guard.test.mjs) |
| Hàng đợi ưu tiên (`User > Webhook > Cron`), chống sleep, prompt routing (`quick-files`, Desktop vs `agent-desktop`, Firecrawl vs Chrome AM) | [`lib/runner.mjs`](./lib/runner.mjs) | [`test/runner.test.mjs`](./test/runner.test.mjs) |
| 8 MCP host tool (`open_in_chrome`, `open_app`, `send_to_discord`, `text_to_speech`, `capture_desktop`, `desktop_windows`, Chrome AM status, `discord-temp/<channelId>`) | [`lib/desktop.mjs`](./lib/desktop.mjs) | [`test/desktop.test.mjs`](./test/desktop.test.mjs) |
| Gateway WebSocket, `GUILD_MEMBERS` intent & fallback `4014`, Heartbeat/Zombie watchdog | [`lib/discord-gateway.mjs`](./lib/discord-gateway.mjs) | [`test/discord-gateway.test.mjs`](./test/discord-gateway.test.mjs) |
| Tự tạo/thu hồi phòng `#ai-<slug>`, khóa read-only `#instructions`/`#announcement`, câu chào mừng | [`lib/onboard.mjs`](./lib/onboard.mjs) | [`test/onboard.test.mjs`](./test/onboard.test.mjs) |
| Banner PNG trong suốt join/leave `#announcement` (`.NET System.Drawing`) | [`lib/announce-card.mjs`](./lib/announce-card.mjs) | *(manual visual check)* |
| Hạn mức lượt/token/cooldown/ổ đĩa Member | [`lib/quota.mjs`](./lib/quota.mjs) | [`test/quota.test.mjs`](./test/quota.test.mjs) |
| Báo cáo tổng kết cuối ngày 0 token AI & thống kê cảnh báo bảo mật | [`lib/report.mjs`](./lib/report.mjs) | [`test/report.test.mjs`](./test/report.test.mjs) |
| Lập lịch Cron bền vững (`every`, `in`, `daily`, POSIX 5 trường) | [`lib/cron.mjs`](./lib/cron.mjs) | [`test/cron.test.mjs`](./test/cron.test.mjs) |
| HTTP Webhook Server (Bearer / `X-Webhook-Secret` / HMAC-SHA256, rate limit, dedup, timeout) | [`lib/webhook.mjs`](./lib/webhook.mjs) | [`test/webhook.test.mjs`](./test/webhook.test.mjs) |
| Phát nhạc Discord Voice `/play` (YouTube/YTM/SoundCloud/Spotify, Opus passthrough, 4 chế độ, TTL URL) | [`lib/music.mjs`](./lib/music.mjs) | [`test/music.test.mjs`](./test/music.test.mjs) |
| Schema 26 Slash Commands `/` & dynamic autocomplete | [`lib/slash.mjs`](./lib/slash.mjs) | [`test/slash.test.mjs`](./test/slash.test.mjs) |
| Tiện ích Snowflake 64-bit, atomic JSON, canonical path check, Reply extractor | [`lib/utils.mjs`](./lib/utils.mjs) | [`test/utils.test.mjs`](./test/utils.test.mjs) |

---

## 3. Thành phần cài đặt & cấu hình ngoài repo
* **Antigravity CLI:** `C:\Users\Admin\AppData\Local\agy\bin\agy.exe` (đã xác thực OAuth).
* **Windows Task Scheduler:** Task `AntigravityDiscordBridge` (`Logon Mode: Interactive only`, trigger khi đăng nhập, chạy `wscript.exe //B run-hidden.vbs` → `node bot.mjs --log`). Log ghi tại `bot.log`; khóa đơn tiến trình tại `bot.pid`.
* **Cấu hình MCP & Security Hook toàn cục (`C:\Users\Admin\.gemini\config\`):**
  * `mcp_config.json` → `discord-bridge-desktop`: `node bot.mjs --mcp-stdio` (tự đăng ký idempotent qua `ensureMcpConfigRegistered()`).
  * `mcp_config.json` → `chrome-devtools`: `--browserUrl=http://127.0.0.1:9229 --no-usage-statistics --no-performance-crux`.
  * `hooks.json` → `discord-bridge-rbac-guard`: `PreToolUse` gọi `hook-guard.cmd` → `node bot.mjs --hook-guard` (tự đăng ký idempotent qua `ensureSecurityHookRegistered()`; thoát no-op `exit /b 0` không spawn Node ngoài phiên Discord bridge để không ảnh hưởng quyền mặc định của IDE).
  * Plugins toàn cục đang cài: `agent-desktop`, `firecrawl`, `chrome-devtools-plugin`, `archify`, `ponytail`, `taste-skill`.
* **Chrome AM (trình duyệt riêng cho bot):**
  * Profile: `C:\Users\Admin\AppData\Local\Google\Chrome AM User Data` (cổng debug `http://127.0.0.1:9229`).
  * Shortcut Desktop: `C:\Users\Admin\Desktop\Chrome AM.lnk`.
* **Thư viện chia sẻ & Media binaries ngoài repo:**
  * `C:\ProgramData\agy-shared-tools` (`@discordjs/voice`, `@snazzah/davey`, `prism-media`, `opusscript`, `quick-files`, `pptxgenjs`, `exceljs`, `xlsx`, `docx`, `pdfkit`, `archiver`, `bin\yt-dlp.exe`).
  * `C:\ffmpeg\ffmpeg.exe`.

---

## 4. Quyết định thiết kế & lưu ý kỹ thuật cốt lõi
* **Chế độ mặc định của `agy`:** Mode `auto` không truyền `--mode auto` mà truyền `--settings` JSON (`toolPermission: "always-proceed"`, `allowNonWorkspaceAccess`, `enableTerminalSandbox`) tùy theo Admin hay RBAC Member/Webhook. Nội bộ `bot.mjs` luôn chạy `--output-format stream-json` để watchdog bảo mật (`onBypassSandbox`, `onBlockedMcp`) vẫn hoạt động cả khi người dùng tắt `/stream off` (chỉ tắt việc post/edit tin nhắn tiến độ trên Discord).
* **Phân vai 4 MCP cho Admin (`lib/runner.mjs`):**
  * **`discord-bridge-desktop` (`lib/desktop.mjs`):** mở app/file/Chrome AM sống dai sau lượt chat (`open_app`, `open_in_chrome`, `open_desktop_target`), gửi file lên Discord (`send_to_discord`), Cloud TTS (`text_to_speech`), chụp màn hình 1 bước (`capture_desktop`), đóng riêng Chrome AM (`close_chrome_am`). Ngoài phiên Discord bridge trả `tools: []`.
  * **`agent-desktop`:** đọc UI bên trong app Windows (`desktop_snapshot`, `desktop_find`), bấm nút/điền form headless (`desktop_click`, `desktop_set_value`), xem Windows Notifications.
  * **`firecrawl`:** ưu tiên `firecrawl_scrape`/`firecrawl_parse`/`firecrawl_search` cho URL, docs, PDF công khai không cần đăng nhập (nhanh, sạch, không bật cửa sổ trình duyệt).
  * **`chrome-devtools` (Chrome AM `9229`):** dành cho trang cần đăng nhập, tương tác SPA (click/scroll/comment/video) hoặc chụp ảnh giao diện thực tế; có pre-check `getChromeAmStatus(300)` trước khi gọi.
* **Cách ly đa người dùng (RBAC + Per-Channel Temp/Attachments):**
  * DM chỉ cho Root Admin (`allowedUserId`) và `adminUserIds`.
  * Member bị khóa trong `cwd` riêng + `--sandbox` + `MEMBER_ALLOWED_COMMANDS` (8 lệnh) + `MEMBER_SAFE_MCP_TOOLS` (`send_to_discord`, `text_to_speech`) + chốt chặn cứng `PreToolUse` **default-deny** (`lib/guard.mjs`: mọi MCP server/plugin lạ, `schedule`, `run_workflow`, `list_plugin_accounts`, `browser_subagent` đều bị từ chối mặc định với non-Admin).
  * Tệp đính kèm tải từ Discord lưu cô lập theo kênh tại `~/.gemini/antigravity-cli/discord-attachments/<channelId>/` (tự dọn >7 ngày); tệp tạm của `capture_desktop` & `text_to_speech` cô lập theo kênh tại `~/.gemini/antigravity-cli/discord-temp/<channelId>/` (tự dọn >24h); `lib/utils.mjs` & `resolveLocalFilePath` chặn Windows UNC/device paths (`\\server\share`, `\\?\`, `\\.\`) và symlink/junction trỏ ra ngoài workspace.
  * `send_to_discord` tự chặn upload `config.json` (theo cả đường dẫn chuẩn hóa symlink).
* **Ổn định chạy nền 24/7:**
  * `channelQueues` tự dọn entry khi hoàn tất; `channelMetaCache`, `channelLastPrompts`, `deletedChannels` dùng giới hạn FIFO (`500` mục) tránh tăng RAM vô hạn.
  * Khi hủy lượt bằng `/stop`, `[⏹️ Dừng ngay]` hoặc tắt daemon (`shutdownBridge`), `bot.mjs` abort toàn bộ `activeRuns` và chạy `taskkill /PID <pid> /T /F` trên Windows để tránh tiến trình con mồ côi.
  * `lib/music.mjs` gắn `streamResolvedAt` với TTL `2` giờ (`STREAM_URL_TTL_MS`) để chế độ `Repeat 1` / `Repeat tất cả` tự làm mới signed stream URL khi hết hạn.
  * `lib/webhook.mjs` có `req.setTimeout(15000)`, trả `401` trước `404`, chỉ trả `{"ok":true}` ở `GET /health` chưa xác thực, và bọc payload trong `<untrusted_webhook_payload>` chống prompt injection.
* **Auto-Onboard, `#announcement`, `#instructions`, Slash Commands & Buttons:**
  * `GUILD_MEMBERS` intent tự bật khi `autoOnboard.enabled` hoặc có `#announcement`, kèm fallback an toàn trên close code `4014`.
  * `#instructions` và `#announcement` tự khóa **read-only** cho `@everyone`; `#announcement` đếm `Math.max(0, memberCount - 1)` (trừ bot).
  * Cụm Action Buttons chỉ giữ ở tin nhắn cuối cùng (tự gỡ `components: []` ở thẻ cũ cho cả câu trả lời AI lẫn thẻ nhạc `/play`).
  * Xóa Thread (`THREAD_DELETE` hoặc `/delete`) tự dọn `state.json`, conversation `agy`, attachments và xóa kèm tin nhắn gốc đã tạo Thread (`deleteThreadStarterMessage`).
