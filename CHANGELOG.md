# Project Changelog & Agent Handoff Log (`discord-agy-bridge`)

> **Quy tắc cập nhật bắt buộc cho mọi AI Agent:**
> Sau mỗi lượt làm việc có thay đổi code, cấu hình (`mcp_config.json`, `config.example.json`, Task Scheduler, shortcut/profile Chrome AM) hoặc quyết định kiến trúc mới, **PHẢI thêm một mục mới ngay dưới dòng phân cách bên dưới** (mới nhất ở trên cùng) theo mẫu:
>
> ```markdown
> ## [YYYY-MM-DD HH:mm] — <Tiêu đề ngắn gọn>
> * **Agent / Phiên:** <tên agent hoặc conversation>
> * **Tóm tắt thay đổi:**
>   * ...
> * **File / Thành phần tác động (trong & ngoài repo):**
>   * ...
> * **Kiểm tra đã chạy:**
>   * ...
> ```
>
> **Lưu ý bảo mật:** Tuyệt đối không ghi `botToken`, cookie, mật khẩu hay nội dung dữ liệu cá nhân vào file này.

---

## [2026-11-27 13:44] — Tinh giản icon trong `README.md` & `README.vi.md` (`README.md`, `README.vi.md`)
* **Agent / Phiên:** Antigravity (`b3e80bce-6430-42b4-807f-8f859ead9c16`)
* **Tóm tắt thay đổi:**
  * Bỏ phần lớn icon thừa ở tiêu đề phụ, thanh điều hướng, từng dòng bullet/bảng và hướng dẫn cài đặt; chỉ giữ lại icon ở 7 tiêu đề mục chính (`##`), ma trận trạng thái quyền (`✅`/`❌`/`🔒`/`⚙️`) và nhãn nút Discord thực tế để README gọn mắt, chuyên nghiệp hơn.
* **File / Thành phần tác động:**
  * [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md), [`README.vi.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.vi.md), [`CHANGELOG.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/CHANGELOG.md).
* **Kiểm tra đã chạy:**
  * Kiểm tra 100% anchor & liên kết tệp cục bộ + `node scripts/verify.mjs`.

## [2026-11-27 13:40] — Thiết kế lại `README.md` & `README.vi.md` trực quan hơn kèm 2 sơ đồ SVG dual-theme dựng bằng Archify (`README.md`, `README.vi.md`, `assets/diagrams/*.svg`, `.gitignore`)
* **Agent / Phiên:** Antigravity (`b3e80bce-6430-42b4-807f-8f859ead9c16`)
* **Tóm tắt thay đổi:**
  * **Tạo 2 sơ đồ Archify chuẩn mã nguồn (code-backed, xuất SVG Dark + Light):**
    * [`assets/diagrams/architecture-dark.svg`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/assets/diagrams/architecture-dark.svg) & [`architecture-light.svg`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/assets/diagrams/architecture-light.svg): Sơ đồ kiến trúc tổng thể (`19` trích dẫn nguồn được Archify xác thực tại commit `6a4795e`), đạt đủ 4 cổng `validate`/`deliver`/`check`/`browser-check` (`quality: showcase`).
    * [`assets/diagrams/security-flow-dark.svg`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/assets/diagrams/security-flow-dark.svg) & [`security-flow-light.svg`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/assets/diagrams/security-flow-light.svg): Sơ đồ tuần tự luồng bảo mật RBAC 2 lớp & chốt chặn `PreToolUse` default-deny (`8` trích dẫn nguồn được xác thực), đạt đủ 4 cổng `showcase`.
  * **Thiết kế lại [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md) & [`README.vi.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.vi.md):**
    * Dùng `<picture>` tự động đổi Dark/Light cho cả Logo (`logo-white.png` / `logo-black.png`) lẫn 2 sơ đồ Archify SVG.
    * Bổ sung hệ thống icon nhất quán, thanh điều hướng nhanh có anchor tường minh (`#highlights`, `#architecture`, `#features`, `#security`, `#quick-start`, `#commands`, `#handoff`), bảng so sánh trực quan (Bài toán ↔ Giải pháp, 4 MCP Routing, ma trận quyền Admin / Member / Webhook), khung GitHub Alert (`TIP`, `IMPORTANT`, `NOTE`) và khối thu gọn `<details>` cho 18 lệnh Admin + cây thư mục.
  * Thêm `.archify/` vào [`.gitignore`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/.gitignore) để giữ repo sạch không dính tệp dựng tạm.
* **File / Thành phần tác động:**
  * [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md), [`README.vi.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.vi.md), [`.gitignore`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/.gitignore), [`CHANGELOG.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/CHANGELOG.md), `assets/diagrams/architecture-{dark,light}.svg`, `assets/diagrams/security-flow-{dark,light}.svg`.
* **Kiểm tra đã chạy:**
  * Archify `finalize --quality showcase --repo-root` đạt `pass` cả 2 sơ đồ (`0` diagnostics, `browser-check` pass ở các viewport `1440px`–`2048px`, cả `light` & `dark`).
  * Kiểm tra 100% liên kết nội bộ & anchor trong `README.md` / `README.vi.md` + chạy `node scripts/verify.mjs`.

## [2026-11-27 13:27] — Chuyển `PreToolUse` guard sang default-deny cho MCP lạ, siết Webhook `/health` & untrusted payload, chặn UNC path, dọn `activeRuns` khi shutdown & đồng bộ `README` (`lib/guard.mjs`, `lib/webhook.mjs`, `lib/utils.mjs`, `bot.mjs`, `README.md`, `README.vi.md`, `AGENTS.md`)
* **Agent / Phiên:** Antigravity (`b3e80bce-6430-42b4-807f-8f859ead9c16`)
* **Tóm tắt thay đổi:**
  * **Default-deny MCP Guard ([`lib/guard.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/guard.mjs), [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs)):**
    * Chuyển mọi lời gọi `call_mcp_tool`, `list_resources`, `read_resource` và `mcp_*` của phiên non-Admin sang **fail-closed (default-deny)**: bất kỳ MCP server/plugin mới cài thêm nào ngoài allowlist tường minh đều bị chặn ngay tại `PreToolUse` và bắn cảnh báo `#admin` qua `onBlockedMcp`.
    * Chặn thêm `schedule` và `run_workflow` đối với non-Admin.
  * **Siết Webhook (`/health` & Prompt Injection) ([`lib/webhook.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/webhook.mjs)):**
    * `GET /health` không xác thực chỉ trả liveness tối giản `{"ok":true}` (không lộ danh sách `hooks` hay `gatewayReady`); chỉ trả chi tiết khi kèm đúng `defaultSecret`.
    * `prepareWebhookEvent()` bọc dữ liệu đầu vào bằng `<untrusted_webhook_payload>` (neutralize thẻ đóng giả) kèm quy tắc `UNTRUSTED EXTERNAL DATA`.
  * **Chặn Windows UNC/device paths & Clean Shutdown ([`lib/utils.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/utils.mjs), [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs)):**
    * Thêm `isWindowsUncOrDevicePath()` từ chối `\\server\share`, `\\?\...`, `\\.\...` trong `isPathInsideDir()` và `resolveLocalFilePath()`.
    * Cập nhật `shutdownBridge()` gọi `abort()` trên mọi `activeRuns` trước khi thoát tiến trình.
  * **Đồng bộ tài liệu & Regression Tests:**
    * Cập nhật [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md), [`README.vi.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.vi.md) (`50/50` tests, `node scripts/verify.mjs`, 4 MCP, `lib/guard.mjs`, mục Security Model & Boundaries) và [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md).
    * Bổ sung regression tests vào [`test/guard.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/guard.test.mjs), [`test/webhook.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/webhook.test.mjs), [`test/utils.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/utils.test.mjs) (gồm cả test Windows directory junction escape).
* **File / Thành phần tác động (trong & ngoài repo):**
  * Trong repo: `lib/guard.mjs`, `lib/webhook.mjs`, `lib/utils.mjs`, `bot.mjs`, `test/guard.test.mjs`, `test/webhook.test.mjs`, `test/utils.test.mjs`, `README.md`, `README.vi.md`, `AGENTS.md`, `CHANGELOG.md`.
  * Ngoài repo: `C:\Users\Admin\.gemini\config\hooks.json` (tự cập nhật matcher thêm `schedule|run_workflow` khi restart bot).
* **Kiểm tra đã chạy:**
  * `node scripts/verify.mjs` (`7/7 PASS`, `50/50` tests passing, `0 failed, 0 warning(s)`).
  * Restart daemon qua `stop.bat` → `schtasks /Run /TN "AntigravityDiscordBridge"`, xác minh `bot.pid`, `hooks.json` & `bot.log`.

---

## [2026-11-27 06:23] — Tối ưu hướng dẫn `take_screenshot` trong `cwd` & bỏ tiêm thừa Chrome AM guide khi dùng Firecrawl đọc URL tĩnh (`lib/runner.mjs`, `test/runner.test.mjs`)
* **Agent / Phiên:** Antigravity (`b3e80bce-6430-42b4-807f-8f859ead9c16`)
* **Tóm tắt thay đổi:**
  * [`lib/runner.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/runner.mjs):
    * Cập nhật `CHROME_DEVTOOLS_FAST_GUIDE` nêu rõ lưu `take_screenshot` bằng `filePath` **bên trong workspace `cwd`** (tránh lưu nhầm vào `~/.gemini/.../brain/` gây lỗi `Access denied` mất thêm 1 lượt retry) kèm `delete_after_send: true`.
    * Bỏ qua tiêm `Chrome AM Pre-check` & `CHROME_DEVTOOLS_FAST_GUIDE` khi `allowFirecrawl=true` và prompt chỉ là đọc/tóm tắt/scrape URL tĩnh không yêu cầu tương tác trình duyệt (`preferFirecrawlOnly`), giúp tiết kiệm ~350 input tokens/lượt.
  * [`test/runner.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/runner.test.mjs): Thêm assertion xác minh cả 2 tối ưu trên.
* **File / Thành phần tác động (trong & ngoài repo):**
  * Trong repo: `lib/runner.mjs`, `test/runner.test.mjs`, `CHANGELOG.md`.
* **Kiểm tra đã chạy:**
  * `node scripts/verify.mjs` (`50/50` pass, `0 failed, 0 warning(s)`).
  * Restart daemon qua `stop.bat` → `schtasks /Run /TN "AntigravityDiscordBridge"`, xác minh `bot.pid` & `bot.log`.

---

## [2026-11-27 06:06] — Sửa toàn bộ 9 phát hiện `ponytail-audit`, bổ sung unit test & chuẩn hóa quy trình bàn giao đa-Agent (`lib/desktop.mjs`, `lib/report.mjs`, `lib/music.mjs`, `lib/onboard.mjs`, `lib/webhook.mjs`, `bot.mjs`, `scripts/verify.mjs`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`)
* **Agent / Phiên:** Antigravity (`b3e80bce-6430-42b4-807f-8f859ead9c16`)
* **Tóm tắt thay đổi:**
  * **Khắc phục 9 phát hiện từ `ponytail-audit`:**
    1. **Cách ly thư mục tạm theo kênh (`discord-temp/<channelId>/`)** trong [`lib/desktop.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/desktop.mjs) (`getChannelTempDir`, `pruneOldTempFiles`, `capture_desktop`, `text_to_speech`, `send_to_discord`) và [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) (`unsentImages`) — chặn triệt để rò rỉ chéo file tạm giữa Admin và Member.
    2. **Sửa lỗi ánh xạ user trong báo cáo cuối ngày** ([`lib/report.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/report.mjs)): đổi `rule.allowedUserIds` → `rule.allowUserIds` để các kênh cấp bằng `/access channel` hiện đúng dung lượng đĩa & liên kết kênh.
    3. **Tự làm mới signed stream URL khi phát lặp dài** ([`lib/music.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/music.mjs)): thêm `STREAM_URL_TTL_MS` (`2h`), `streamResolvedAt` và `isStreamUrlExpired()` cho `ensureFreshTrackStream()`.
    4. **Sửa fallback tên model chào mừng** ([`lib/onboard.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/onboard.mjs)): dùng `defaultHit?.label || defaultModel || 'Gemini 4 Hydrogen (Medium)'` thay vì cứng label cũ khi `availableModels` rỗng.
    5. **Giới hạn kích thước cache runtime & dọn `channelQueues`** ([`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs)): tự xóa key `channelQueues` sau khi xong và dùng `setBoundedMap`/`addBoundedSet` (`500` mục) cho `channelMetaCache`, `channelLastPrompts`, `deletedChannels`.
    6. **Kill sạch cây tiến trình con trên Windows khi `/stop`** ([`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs)): gọi `taskkill /PID <pid> /T /F` trong `abort()` của `runAgy()`.
    7. **Siết an toàn HTTP Webhook** ([`lib/webhook.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/webhook.mjs)): thêm `req.setTimeout(15000)` (`408`) và trả `401` trước khi trả `404` với caller chưa xác thực để tránh lộ danh sách `hookId`.
    8. **Mở rộng bộ unit test:** thêm [`test/cron.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/cron.test.mjs), [`test/webhook.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/webhook.test.mjs) và bổ sung test hồi quy vào [`test/auth.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/auth.test.mjs), [`test/desktop.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/desktop.test.mjs), [`test/report.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/report.test.mjs), [`test/music.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/music.test.mjs), [`test/onboard.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/onboard.test.mjs).
    9. **Giữ security watchdog hoạt động kể cả khi `/stream off`** ([`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs)): luôn dùng `--output-format stream-json` nội bộ kèm `securityMonitor` nhẹ, chỉ tắt việc post/edit tin nhắn tiến độ trên Discord.
  * **Hệ thống bàn giao chuẩn đa-Agent:**
    * Tạo [`scripts/verify.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/scripts/verify.mjs) (`node scripts/verify.mjs`) kiểm tra 1 lệnh toàn bộ syntax, unit tests, `config.json` (redact secret), MCP/Security Hook, `bot.pid` và repo hygiene.
    * Nâng cấp [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md) thành Master Handoff Playbook (Onboarding 60s, 5 Luật Thép, Bản đồ tra cứu file, mẫu prompt bàn giao), đồng bộ con trỏ [`CLAUDE.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/CLAUDE.md) và thêm [`GEMINI.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/GEMINI.md).
* **File / Thành phần tác động (trong & ngoài repo):**
  * Trong repo: `bot.mjs`, `lib/desktop.mjs`, `lib/report.mjs`, `lib/music.mjs`, `lib/onboard.mjs`, `lib/webhook.mjs`, `scripts/verify.mjs`, `test/cron.test.mjs`, `test/webhook.test.mjs`, `test/auth.test.mjs`, `test/desktop.test.mjs`, `test/report.test.mjs`, `test/music.test.mjs`, `test/onboard.test.mjs`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `CHANGELOG.md`.
* **Kiểm tra đã chạy:**
  * `node scripts/verify.mjs`: toàn bộ syntax check, unit tests (`50/50` pass), config/MCP/Hook/PID/hygiene đều `PASS`.
  * Restart daemon qua `stop.bat` → `schtasks /Run /TN "AntigravityDiscordBridge"`, xác minh `bot.pid` và `bot.log` (`[guard] Registered`, `[mcp] Desktop bridge listening`, `[gateway] Ready as sickyturtlez#7297`).

---

## [2026-11-27 06:00] — Chặn cứng MCP toàn cục (`agent-desktop`, `firecrawl`, `chrome-devtools`) cho Member/Webhook bằng `PreToolUse` hook & phân vai Desktop/Firecrawl cho Admin (`lib/guard.mjs`, `hook-guard.cmd`, `lib/auth.mjs`, `lib/runner.mjs`, `lib/webhook.mjs`, `lib/onboard.mjs`, `bot.mjs`)
* **Agent / Phiên:** Antigravity (`b3e80bce-6430-42b4-807f-8f859ead9c16`)
* **Tóm tắt thay đổi:**
  * **P0 — Chốt chặn cứng `PreToolUse` RBAC Guard ([`lib/guard.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/guard.mjs), [`hook-guard.cmd`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/hook-guard.cmd), [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs)):**
    * Tự động đăng ký idempotent hook `discord-bridge-rbac-guard` vào `C:\Users\Admin\.gemini\config\hooks.json` qua `ensureSecurityHookRegistered()` khi bot khởi động.
    * Wrapper [`hook-guard.cmd`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/hook-guard.cmd) thoát no-op `exit /b 0` (stdout rỗng, không spawn Node.js) đối với mọi phiên IDE/CLI ngoài Discord bridge (`AGY_DISCORD_GUARD_ACTIVE` chưa đặt), đảm bảo không làm chậm và không ghi đè chính sách quyền mặc định của IDE thường.
    * Với phiên Member / Webhook (`AGY_DISCORD_IS_ADMIN=0`), `bot.mjs --hook-guard` chặn cứng (`decision: "deny"`) **trước khi tool kịp chạy** đối với: `agent-desktop`, `firecrawl` (khi `allowFirecrawl=false`), `chrome-devtools` & `browser_subagent` (khi `allowChrome=false`), `discord-bridge-desktop` ngoài allowlist, `list_resources`/`read_resource` trên server bị khóa, `list_plugin_accounts`, và `run_command` truyền `BypassSandbox: true`.
    * Với cả Admin lẫn Member, bảo vệ các tiến trình hệ thống/cầu nối (`node`, `agy`, `antigravity`, `explorer`, ...) khỏi `agent-desktop` `desktop_close_app`.
    * Bổ sung lớp cảnh báo thứ 2 (`onBlockedMcp`) trong stream watchdog của [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) để ghi nhận `recordSecurityAlert` và gửi cảnh báo về `#admin`, đồng thời bổ sung nhãn tiến độ tiếng Việt (`MCP_ACTION_LABELS`) cho các tool `agent-desktop` & `firecrawl`.
  * **RBAC `allowFirecrawl` ([`lib/auth.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/auth.mjs), [`lib/webhook.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/webhook.mjs), [`lib/onboard.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/onboard.mjs), [`config.example.json`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/config.example.json)):**
    * Mặc định mở `allowFirecrawl: true` cho Admin, `false` cho Member (`autoOnboard`, `channelRules`) và Webhook; hỗ trợ `firecrawl:on|off` trong `/access channel`.
  * **P1 — Phân vai rõ `discord-bridge-desktop` vs `agent-desktop` và định tuyến `Firecrawl` vs `Chrome AM` ([`lib/runner.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/runner.mjs)):**
    * Cập nhật `buildEffectivePrompt()` giải quyết xung đột chỉ dẫn giữa `lib/desktop.mjs` và rule của plugin `agent-desktop`: dùng `discord-bridge-desktop` khi mở app/file/Chrome AM sống dai, gửi file Discord, Cloud TTS, chụp màn hình 1 bước hoặc đóng riêng Chrome AM; dùng `agent-desktop` để đọc UI bên trong app Windows (`desktop_snapshot`, `desktop_find`), thao tác headless không cướp chuột (`desktop_click`, `desktop_set_value`) và đọc thông báo Windows.
    * Thêm `FIRECRAWL_HINT_RE` ưu tiên `firecrawl_scrape`/`firecrawl_parse`/`firecrawl_search` cho URL/tài liệu/PDF công khai không cần đăng nhập (không bật cửa sổ trình duyệt), chỉ mở Chrome AM khi cần đăng nhập hoặc tương tác SPA.
  * **Kiểm thử:** Thêm [`test/guard.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/guard.test.mjs) và mở rộng [`test/auth.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/auth.test.mjs), [`test/runner.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/runner.test.mjs).
* **File / Thành phần tác động (trong & ngoài repo):**
  * Trong repo: `lib/guard.mjs`, `hook-guard.cmd`, `lib/auth.mjs`, `lib/runner.mjs`, `lib/webhook.mjs`, `lib/onboard.mjs`, `bot.mjs`, `config.example.json`, `test/guard.test.mjs`, `test/auth.test.mjs`, `test/runner.test.mjs`, `AGENTS.md`, `CHANGELOG.md`.
  * Ngoài repo: `C:\Users\Admin\.gemini\config\hooks.json` (tự đăng ký mục `discord-bridge-rbac-guard`).
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ `.mjs` đã sửa/thêm, `node --test`: `41/41` pass.
  * Live E2E với `agy.exe -p --settings '{"toolPermission":"always-proceed",...}' --sandbox` giả lập Member xác nhận `PreToolUse` hook chặn cứng `agent-desktop_agent-desktop/desktop_list_windows` trong `0.15s` (`tool call denied by pre-tool hook`).
  * Restart daemon qua `stop.bat` → `schtasks /Run /TN "AntigravityDiscordBridge"`, xác minh `bot.pid` và `bot.log` (`[guard] Registered discord-bridge-rbac-guard`, `[mcp] Desktop bridge listening`, `[gateway] Ready as sickyturtlez#7297`).

---

## [2026-11-17 03:43] — Sửa lỗi không tìm thấy module `quick-sheet` (`lib/runner.mjs`)
* **Agent / Phiên:** Antigravity (`d0d63b24-d1f0-4246-83a6-9f832452641e`)
* **Tóm tắt thay đổi:**
  * [`lib/runner.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/runner.mjs): Cập nhật chú thích về `NODE_PATH` để đảm bảo bot/script con nhận diện đúng thư viện dùng chung `agy-shared-tools`.
* **Kiểm tra đã chạy:**
  * Chạy thủ công `node` script con và xác nhận lỗi `MODULE_NOT_FOUND` đã được xử lý (trên môi trường thực tế, cần đảm bảo `NODE_PATH` được export đúng khi `agy` spawn tiến trình).
  * Restart daemon.

---

## [2026-11-17 03:32] — Rút gọn thông báo chào mừng (`lib/onboard.mjs`)
* **Agent / Phiên:** Antigravity (`d0d63b24-d1f0-4246-83a6-9f832452641e`)
* **Tóm tắt thay đổi:**
  * [`lib/onboard.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/onboard.mjs): Rút gọn thông báo onboarding, bỏ các bullet point thừa, gom nhóm model theo family và loại bỏ suffix (Low/High/...).
* **Kiểm tra đã chạy:**
  * `node --test`: `36/36` pass.
  * Restart daemon.

---

## [2026-11-17 03:37] — Hiển thị lại tên model đầy đủ trong thông báo chào mừng (`lib/onboard.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/onboard.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/onboard.mjs): Hoàn tác việc rút gọn tên model, giờ hiển thị đầy đủ tên model (vẫn giữ nguyên việc loại bỏ hậu tố `(thinking level)` nếu có).
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs`, `node --test`: `36/36` pass.
  * Restart daemon.

---

## [2026-11-17 03:34] — Rút gọn tin nhắn chào mừng (`lib/onboard.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/onboard.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/onboard.mjs): Rút gọn danh sách gợi ý model trong tin nhắn chào mừng thành chỉ lấy tên chính (ví dụ: "Gemini", "Claude") thay vì liệt kê đầy đủ.
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs`, `node --test`: `36/36` pass.
  * Restart daemon.

---

## [2026-11-17 03:27] — Cập nhật model mặc định & mở rộng danh sách `FALLBACK_ALT_MODELS` trong `lib/onboard.mjs`
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/onboard.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/onboard.mjs):
    * Đổi `defaultModel` trong `buildMemberWelcomeMessage()` thành `'gemini-4-hydrogen-medium'`.
    * Nâng cấp `FALLBACK_ALT_MODELS` từ danh sách tĩnh cứng nhắc sang danh sách đầy đủ các model hiện có (để hướng dẫn người dùng chính xác hơn).
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs`, `node --test`: `36/36` pass.
  * Restart daemon (`bot.pid`, `[gateway] Ready as sickyturtlez#7297`).

---

## [2026-11-17 03:16] — Sửa logic tính số thành viên (trừ bot ra khỏi tổng đếm) (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Trong hàm `sendMemberAnnouncement()`, sửa `adjustedCount = Math.max(0, memberCount - 1)` để trừ đi bot khỏi tổng số thành viên hiển thị trên banner card `#announcement`.
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs`, `node --test`: `36/36` pass.
  * Restart daemon (`bot.pid`, `[gateway] Ready as sickyturtlez#7297`).

---

## [2026-11-17 01:52] — Đổi logo sang bản nét trắng nền trong suốt (`assets/logo-white.png`) và giữ sẵn `assets/logo-black.png`
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Thêm [`assets/logo-white.png`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/assets/logo-white.png) (`sickyturtlez-icon-transparent-white-ink.png`) và [`assets/logo-black.png`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/assets/logo-black.png) (`sickyturtlez-icon-transparent.png`), xóa `assets/logo.png`.
  * Cập nhật [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md) và [`README.vi.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.vi.md) dùng `assets/logo-white.png`.
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs`, `node --test`: `36/36` pass, commit & push lên `origin/main`.

---

## [2026-11-17 01:48] — Làm mới `README.md` (mặc định tiếng Anh) + `README.vi.md` kèm logo `assets/logo.png` & language switcher
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Copy logo bản đen nền trong suốt (`sickyturtlez-icon-transparent.png`) vào [`assets/logo.png`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/assets/logo.png).
  * Thiết kế [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md) (mặc định tiếng Anh) và [`README.vi.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.vi.md) (tiếng Việt) theo bố cục hero căn giữa (logo, tên dự án, badges, link chuyển ngôn ngữ `English · Tiếng Việt`).
  * Viết lại phần **Vấn đề ban đầu & Cách giải quyết** đúng 3 trụ cột: (1) Antigravity chưa có app riêng, (2) Chia sẻ AI an toàn cho nhiều người dùng với sandbox/RBAC, (3) Tích hợp đầy đủ tính năng bot quản lý server Discord cỡ lớn + tự động hóa + tiện ích Voice vào 1 bot duy nhất.
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs`, `node --test`: `36/36` pass, commit & push lên `origin/main`.

---

## [2026-11-17 01:24] — Chỉnh lại mô tả vấn đề đầu trang `README.md` (do Antigravity chưa có app native riêng)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md): Sửa mục 1 phần "Vấn đề ban đầu" thành lý do thực tế là Antigravity chưa có ứng dụng native riêng (thay cho ý phụ thuộc ngồi tại máy).
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs`, `node --test`: `36/36` pass, commit & push lên `origin/main`.

---

## [2026-11-17 01:20] — Gộp tính năng phát nhạc Voice vào nhóm Bot Discord đa nhiệm trong `README.md`
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md): Gộp mục phát nhạc Voice `/play` chung vào nhóm **B. Bot Discord đa nhiệm: Quản lý Server, Thông báo, Bảo mật & Tiện ích Voice** (bỏ tách mục `E` riêng), đồng bộ lại mô tả tổng quan & bài toán đầu trang.
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs`, `node --test`: `36/36` pass, commit & push lên `origin/main`.

---

## [2026-11-17 01:15] — Bổ sung chi tiết mục tiêu, bài toán, kiến trúc & bàn giao trong `README.md`
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md): Bổ sung phần Tổng quan & Bài toán thực tế giải quyết được, sơ đồ kiến trúc luồng xử lý 4 lớp, phân nhóm chi tiết từng tính năng (Chat 2 chiều, RBAC/Auto-Onboard, Desktop/Chrome AM, Automation Hub, Voice Music Player `/play`) và checklist bàn giao rõ ràng cho người nhận/AI Agent khác.
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs`, `node --test`: `36/36` pass, commit & push lên `origin/main`.

---

## [2026-11-17 01:08] — Khởi tạo Git, bổ sung `.gitignore` bảo mật & viết lại `README.md` chi tiết cho bàn giao (`README.md`, `.gitignore`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Tạo [`.gitignore`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/.gitignore) chặn tuyệt đối `config.json`, `state.json`, `bot.log`, `bot.pid`, `node_modules/`, thư mục sandbox và file tạm.
  * Viết lại [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md) đầy đủ: kiến trúc hệ thống, danh sách file bàn giao (`AGENTS.md`, `CLAUDE.md`, `CHANGELOG.md`), hướng dẫn cài đặt từ đầu (bao gồm thiết lập `C:\ProgramData\agy-shared-tools` + `yt-dlp.exe` + `ffmpeg.exe`), bảng 26 lệnh `/` và quy trình chuẩn cho AI Agent tiếp theo.
  * Khởi tạo Git, commit và đẩy lên `https://github.com/namtit2932k/discord-agy-bridge.git` (nhánh `main`).
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs`, `node --test`: `36/36` pass.
  * Xác minh `git status` / `git ls-files` không chứa `config.json`, `state.json`, `bot.log`, `bot.pid`.

---

## [2026-11-17 01:00] — Hiển thị luôn playlist sau khi thêm và chuyển cụm nút điều khiển sang tin nhắn thêm bài mới (`lib/music.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/music.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/music.mjs): Cập nhật `buildQueuedEmbed()` và nhánh `wasPlaying` trong `play()` để khi thêm bài/playlist mới vào hàng chờ đang phát, thẻ phản hồi hiển thị bài đang phát + danh sách hàng chờ sau khi thêm (tối đa 5 bài tiếp theo) và đính kèm luôn cụm nút điều khiển `buildMusicControlComponents()` (đồng thời `registerControlMessage()` tự gỡ nút ở thẻ cũ phía trên).
  * Cập nhật [`test/music.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/music.test.mjs).
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs` (`exit code 0`), `node --test`: `36/36` pass.
  * Restart daemon (`bot.pid`, `[gateway] Ready as sickyturtlez#7297`, `[slash] Synced 26 guild slash command(s)`).

---

## [2026-11-17 00:43] — Chỉ giữ cụm nút hành động AI (`Thử lại / Tóm tắt / Xóa Thread / Phiên mới`) ở tin nhắn trả lời mới nhất (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Cập nhật `finalizeTurnMessage()` lưu `chState.lastActionMessageId` vào `state.json`; mỗi khi có câu trả lời AI mới trong kênh/Thread, bot tự gỡ `components: []` khỏi tin nhắn trả lời AI trước đó để cụm nút hành động chỉ hiển thị ở tin nhắn mới nhất.
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs` (`exit code 0`), `node --test`: `36/36` pass.
  * Restart daemon (`bot.pid`, `[gateway] Ready as sickyturtlez#7297`, `[slash] Synced 26 guild slash command(s)`).

---

## [2026-11-17 00:32] — Hiển thị thời lượng cho toàn bộ bài hát trong playlist Spotify ([`lib/music.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/music.mjs))
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/music.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/music.mjs): Trích xuất `duration` (ms → giây `durationSec`) từ `__NEXT_DATA__` của Spotify embed trong `parseSpotifyEmbedHtml()` và gắn `durationSec` vào các bài trong hàng chờ Spotify (`resolveMediaTracks()`), thay vì để `0` (`[--:--]`).
  * Cập nhật [`test/music.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/music.test.mjs).
* **Kiểm tra đã chạy:**
  * `resolveMediaTracks` live trên playlist Spotify xác nhận các bài chờ có `durationSec > 0`.
  * `node --check` toàn bộ `.mjs` (`exit code 0`), `node --test`: `36/36` pass.
  * Restart daemon (`bot.pid`, `[gateway] Ready as sickyturtlez#7297`).

---

## [2026-11-17 00:22] — Đổi tên bot Discord từ `AM` sang `sickyturtlez` (`bot.mjs`, `lib/onboard.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * **Discord API:** Đổi bot username sang `sickyturtlez` (`PATCH /users/@me`, `200 OK` → `sickyturtlez#7297`) và đổi nickname bot trong server sang `sickyturtlez` (`PATCH /guilds/1570090644200755220/members/@me`, `200 OK`).
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) & [`lib/onboard.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/onboard.mjs): Thêm helper `getBotDisplayName()` (lấy động từ `gateway.botUser.username`, mặc định `"sickyturtlez"`) thay toàn bộ chuỗi tên bot `"AM"` cứng trong `#instructions`, thông báo stream (`⏳ **sickyturtlez ...**`), chào mừng thành viên mới và thông báo thiếu quyền; giữ nguyên tên trình duyệt **Chrome AM**.
  * Cập nhật [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md).
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs` (`exit code 0`), `node --test`: `36/36` pass.
  * Restart daemon (`bot.pid`, `[gateway] Ready as sickyturtlez#7297`, `#instructions` tự đồng bộ tên mới, `[slash] Synced 26 guild slash command(s)`).

---

## [2026-11-17 00:15] — Bổ sung nút đổi chế độ phát `Tuần tự / Shuffle / Repeat 1 bài / Repeat tất cả` (`lib/music.mjs`, `bot.mjs`, `lib/slash.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/music.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/music.mjs):
    * Bổ sung nút thứ 5 (`music:mode`) trên thanh điều khiển `buildMusicControlComponents()` xoay vòng 4 chế độ: `➡️ Tuần tự` (`sequential`) → `🔀 Shuffle` (`shuffle`, xáo trộn Fisher-Yates & hiển thị đúng 5 bài tiếp theo sau xáo trộn, giữ `_seq` để khôi phục thứ tự gốc khi quay về `Tuần tự`) → `🔂 Repeat 1 bài` (`repeat_one`, tự phát lại bài hiện tại nhưng bấm `Qua bài` vẫn nhảy tới bài kế) → `🔁 Repeat tất cả` (`repeat_all`, tự đẩy bài vừa phát xong về cuối hàng chờ).
    * Hiển thị chế độ phát hiện tại ngay trên Embed `buildNowPlayingEmbed()`; bổ sung `cyclePlayMode()` và `setPlayMode()`.
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) & [`lib/slash.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/slash.mjs): Nối interaction `music:mode` (cập nhật Embed + nút tức thì qua `type: 7`), thêm subcommand `/play mode`, `shuffle`, `repeat`, `repeat-one`, `sequential` và gợi ý autocomplete.
  * Mở rộng [`test/music.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/music.test.mjs).
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs` (`exit code 0`), `node --test`: `36/36` pass.
  * Restart daemon (`bot.pid`, `[gateway] Ready as AM#7297`, `[slash] Synced 26 guild slash command(s)`).

---

## [2026-11-17 00:10] — Nâng chất lượng âm thanh phát nhạc (`bitrate: 96000` cho `#yapping`, `abr>=96`, `-application audio -b:a 128k`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * **Discord Voice `#yapping` (`1570090646734110812`):** Nâng `bitrate` từ `64000` (`64 kbps`) lên mức tối đa của server tier 0 là `96000` (`96 kbps`).
  * [`lib/music.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/music.mjs):
    * Cập nhật bộ lọc `yt-dlp` thành `bestaudio[acodec=opus][abr>=96]/bestaudio/best` để tránh lấy nhầm bản Opus `50–70 kbps` trên video cũ.
    * Cập nhật nhánh chuyển mã `libopus` (khi nguồn là AAC/MP3/SoundCloud) thành `-application audio -b:a 128k` chuyên cho nhạc thay vì mặc định `96k`.
  * Cập nhật [`test/music.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/music.test.mjs).
* **Kiểm tra đã chạy:**
  * Discord `PATCH /channels/1570090646734110812` xác nhận `bitrate: 96000`.
  * `node --check` toàn bộ `.mjs` (`exit code 0`), `node --test`: `35/35` pass.
  * Restart daemon (`bot.pid`, `[gateway] Ready as AM#7297`, `[slash] Synced 26 guild slash command(s)`).

---

## [2026-11-17 00:05] — Tối ưu CPU/RAM/GPU/SSD tối đa cho tính năng phát nhạc Voice ([`lib/music.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/music.mjs))
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * **Zero-transcode Opus passthrough (`canCopyOpusStream`, `-c:a copy`):** Khi nguồn phát (YouTube / YouTube Music) đã là Opus 48kHz stereo trong WebM/Ogg, `ffmpeg.exe` chuyển sang remux thẳng `-c:a copy -f opus pipe:1`, bỏ hoàn toàn giải mã + mã hóa lại trên CPU; các nguồn khác dùng `-c:a libopus -compression_level 5`.
  * **Ép cấu hình nhẹ cho FFmpeg (`buildFfmpegArgs`):** Thêm `-nostdin -hwaccel none -threads 1 -probesize 32768 -analyzeduration 1000000` (không đụng GPU, chỉ 1 worker thread, giảm RAM đệm khi mở luồng).
  * **Không ghi cache ra SSD (`--no-cache-dir`):** Mọi lời gọi `yt-dlp.exe` dùng `--no-cache-dir` và bỏ `stderr` pipe buffer trên tiến trình phát (`stdio: [..., "ignore"]`), kèm tự gỡ handle tiến trình con trong `session.activeProcs` ngay khi `"close"` và dọn sạch object tham chiếu trong `stopSession()`.
  * **Rút ngắn timeout giải phóng tài nguyên:** Tự rời phòng sau `2` phút hết hàng chờ (`IDLE_DISCONNECT_MS`), `1` phút phòng không còn người nghe (`EMPTY_ROOM_DISCONNECT_MS`), và thêm `PAUSED_DISCONNECT_MS` (`10` phút) để tự tắt `ffmpeg`/rời phòng nếu tạm dừng quá lâu.
  * Cập nhật [`test/music.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/music.test.mjs) và [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md).
* **Kiểm tra đã chạy:**
  * Benchmark thực tế `yt-dlp --no-cache-dir` + `ffmpeg -c:a copy -f opus pipe:1` qua `StreamType.OggOpus` thành công (10 gói Opus đầu không lỗi).
  * `node --check` toàn bộ `.mjs` (`exit code 0`), `node --test`: `35/35` pass.
  * Restart daemon (`bot.pid`, `[gateway] Ready as AM#7297`, `[slash] Synced 26 guild slash command(s)`).

---

## [2026-11-16 23:53] — Cho phép Admin dùng `/clear` tại `#free-chat` (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Bổ sung `authorizeAdminFreeChatClearFallback(msg)` và nối vào `onMessageCreate` (`rawSlashWord === "clear"`) + `onInteractionCreate` (`cmdWord === "/clear"`) để **chỉ Admin** (`isAdminUser`) dùng được `/clear` dọn tin nhắn trong `#free-chat` (và thread con); thành viên thường vẫn bị chặn tại `#free-chat`.
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ `.mjs` (`exit code 0`), `node --test`: `35/35` pass.
  * Restart daemon (`bot.pid`, `[gateway] Ready as AM#7297`, `[slash] Synced 26 guild slash command(s)`).

---

## [2026-11-16 23:51] — Sửa lỗi timeout nút Skip/Stop, hiển thị thẻ Embed kèm link gốc + 5 bài tiếp theo, thêm nút Clear Queue & chỉ giữ nút ở bài cuối (`bot.mjs`, `lib/music.mjs`, `lib/slash.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * **Sửa triệt để lỗi `AM didn't respond in time` khi bấm `⏭️ Qua bài` / `⏹️ Dừng & Rời`:** Trong [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs), `music:skip` và `music:stop` gửi interaction ACK `type: 7` (`{ components: [] }`) ngay lập tức trước khi `yt-dlp` giải mã bài kế tiếp hoặc ngắt kết nối Voice.
  * **Giao diện thẻ Embed gọn kèm link media gốc & 5 bài tiếp theo ([`lib/music.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/music.mjs)):**
    * Bổ sung `formatTrackLinkPill()`, `formatQueuePreviewLines()`, `buildNowPlayingEmbed()`, `buildQueuedEmbed()`: header `author` hiển thị avatar người yêu cầu (`getDiscordUserAvatarUrl` trong [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs)), tiêu đề bài hát đặt dạng ``[`Title — Artist`](url) `[duration]` `` dẫn thẳng tới link gốc (kèm lấy URI từng bài trong Spotify playlist), và liệt kê tối đa **5** bài tiếp theo trong hàng chờ (cùng số bài còn lại nếu > 5).
  * **Nút `🧹 Clear Queue` & lệnh `/play clear`:** Thêm nút `music:clear` vào `buildMusicControlComponents()`, `clearQueue()` trong `lib/music.mjs`, và gợi ý `clear` trong [`lib/slash.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/slash.mjs).
  * **Chỉ giữ cụm nút điều khiển ở tin nhắn nhạc cuối cùng:** Theo dõi `session.lastControlMessage` qua `registerControlMessage()` & `clearControlButtons()` — mỗi khi chuyển bài tự động (`playNext`), gửi thẻ mới có nút, hoặc dừng phát (`stopSession`), bot tự xóa `components: []` ở thẻ cũ phía trên.
  * Mở rộng [`test/music.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/music.test.mjs).
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ `.mjs` (`exit code 0`), `node --test`: `35/35` pass.
  * Restart daemon (`bot.pid`, `[gateway] Ready as AM#7297`, `[slash] Synced 26 guild slash command(s)`).

---

## [2026-11-16 23:32] — Đổi `/music` thành `/play`, mở rõ `#free-chat`, hỗ trợ playlist đa nền tảng & tự thoát khi phòng Voice trống (`bot.mjs`, `lib/music.mjs`, `lib/slash.mjs`, `lib/auth.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * **Đổi lệnh sang `/play`:** Cập nhật [`lib/slash.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/slash.mjs), [`lib/auth.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/auth.mjs), [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) (`handleMusicCommand`, `/help`, `#instructions` guide) và [`lib/music.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/music.mjs).
  * **Cho phép dùng `/play` trong `#free-chat`:** Cập nhật `authorizeGuildMusicFallback()` trong [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) để luôn cho phép thành viên dùng `/play` và bấm nút điều khiển nhạc trong `#free-chat` (và thread con) cùng các kênh public/voice của server; đồng thời sửa `sendNotice` chuyển tiếp đủ `components` cho các bài tự chuyển tiếp theo trong hàng chờ.
  * **Hỗ trợ playlist đa nền tảng ([`lib/music.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/music.mjs)):** Thêm `isPlaylistUrl()` nhận diện playlist YouTube (`/playlist`, `?v=...&list=...`), YouTube Music (`playlist`, `browse`, `?list=`), SoundCloud (`/sets/`, `/albums/`) cùng Spotify (`/playlist/`, `/album/`); lọc bỏ video ẩn/xóa `[Private video]`/`[Deleted video]` và resolved lazy stream cho từng bài tiếp theo; nâng mức nạp playlist lên `25` bài và hàng chờ tối đa lên `50` bài.
  * **Tự động rời phòng Voice khi không còn người nghe:** Tách riêng `emptyRoomTimer` (`EMPTY_ROOM_DISCONNECT_MS = 60_000` — `1` phút) khỏi `idleTimer` (`3` phút khi hết hàng chờ). Bất cứ khi nào tất cả thành viên rời khỏi phòng Voice (kể cả khi nhạc vẫn đang phát/tạm dừng), sau `1` phút không có người quay lại bot sẽ tự dừng phát, hủy session và rời phòng Voice; nếu có người vào lại trước khi hết hạn thì timer tự hủy.
  * Mở rộng [`test/music.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/music.test.mjs), [`test/slash.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/slash.test.mjs), [`test/auth.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/auth.test.mjs).
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ `.mjs` (`exit code 0`), `node --test`: `34/34` pass.
  * Live resolve playlist qua `resolveMediaTracks` với YouTube `/playlist`, YouTube `watch?v=...&list=...`, YouTube Music `/playlist` và Spotify `/playlist` (`4/4` nạp thành công `25` bài/playlist).
  * Restart daemon (`bot.pid`, `[gateway] Ready as AM#7297`, `[slash] Synced 26 guild slash command(s)`).

---

## [2026-11-16 22:28] — Thêm lệnh `/music <link-media>` phát nhạc Discord Voice cho mọi thành viên (`lib/music.mjs`, `bot.mjs`, `lib/slash.mjs`, `lib/auth.mjs`, `lib/discord-gateway.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * **Cài đặt phụ thuộc ngoài repo tại `C:\ProgramData\agy-shared-tools`** (giữ nguyên repo không có `node_modules`):
    * Cài `@discordjs/voice@0.19.2`, `@snazzah/davey@0.1.12` (Discord DAVE E2EE), `prism-media@1.3.5`, `opusscript@0.0.8` và `yt-dlp.exe` (`2026.10.26` tại `C:\ProgramData\agy-shared-tools\bin\yt-dlp.exe`), dùng kết hợp `C:\ffmpeg\ffmpeg.exe` (`libopus: yes`).
  * [`lib/music.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/music.mjs):
    * Tự động phân loại nguồn phát (`detectMediaSource`): **YouTube**, **YouTube Music**, **SoundCloud**, **Spotify** (đọc metadata embed `__NEXT_DATA__` / `oembed` rồi tìm và phát luồng âm thanh qua YouTube/`yt-dlp.exe`, hỗ trợ cả track đơn lẫn album/playlist tối đa 15 bài), **Direct Audio URL** và tìm kiếm theo **tên bài hát**.
    * Hàng đợi phát nhạc theo từng server (`MAX_QUEUE_SIZE = 25`), `createAudioPlayer` + `NoSubscriberBehavior.Pause`, transcode `libopus` qua FFmpeg (`StreamType.OggOpus`), tự ngắt kết nối khi rảnh `3` phút (`IDLE_DISCONNECT_MS`), cùng 3 nút điều khiển (`music:toggle`, `music:skip`, `music:stop`).
  * [`lib/discord-gateway.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/discord-gateway.mjs): Bổ sung `GUILD_VOICE_STATES` (`1 << 7`) vào `BASE_GATEWAY_INTENTS` để theo dõi user đang ở kênh Voice nào.
  * [`lib/auth.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/auth.mjs) & [`lib/slash.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/slash.mjs): Mở `/music` trong `MEMBER_ALLOWED_COMMANDS`; khai báo Slash Command `/music` (`link-media` có autocomplete `queue`/`skip`/`pause`/`resume`/`stop` và tùy chọn `voice` kênh Voice/Stage, không đặt `default_member_permissions: "8"` để mọi thành viên đều dùng được).
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Nối `musicManager` với `GUILD_CREATE`, `VOICE_STATE_UPDATE`, `VOICE_SERVER_UPDATE`, `shutdownBridge()`, `authorizeGuildMusicFallback()` (cho phép thành viên gọi `/music` và bấm nút `music:*` ở các kênh server ngoài `#instructions`/`#announcement` và phòng riêng của người khác), đồng bộ `#instructions` và `/help`, gắn Action Buttons lên phản hồi Slash Command qua `interactionReplyStorage`.
  * Kiểm thử mới/mở rộng: [`test/music.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/music.test.mjs), [`test/slash.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/slash.test.mjs), [`test/auth.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/auth.test.mjs).
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ `.mjs` (`exit code 0`), `node --test`: `33/33` pass.
  * Live resolve metadata + stream URL qua `resolveMediaTracks` (`yt-dlp.exe`) với YouTube, YouTube Music, SoundCloud và Spotify (`4/4` thành công, `hasStream: true`).
  * Restart daemon (`bot.pid` = `19468`, `[gateway] Ready as AM#7297`, `[guide] Updated 1 guide message(s) in #instructions`, `[slash] Synced 26 guild slash command(s)`).

---

## [2026-11-16 22:10] — Chuyển toàn bộ ví dụ, thông báo cú pháp & parser các lệnh `/` sang dạng gõ thẳng không cần `prefix:` (`bot.mjs`, `lib/slash.mjs`, `lib/auth.mjs`, `lib/cron.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs):
    * Cập nhật toàn bộ ví dụ trong `getCommandDocs()` (`/help`) và câu báo cú pháp sang dạng ngắn không `prefix:` (`/footer off` • `/footer off all` • `/footer on all`, `/autothread on` • `/autothread off all`, `/stream on` • `/stream off all`, `/project discord-agy-bridge`, `/model gemini-...`, `/mode plan`, `/sandbox on`, `/clear 30`, `/logs 30`, `/windows focus Chrome`, `/webhook test <id>`, `/cron add "daily 08:30" "..."`, `/access report on 22:00`, `/access quota 30 5`, `/access private #ten-kenh on`, `/access model set @ten ...`).
    * Gộp `/footer`, `/autothread`, `/stream` vào cùng một nhánh xử lý thống nhất hỗ trợ cả phạm vi `all` (toàn server) và tự nhận diện cả gõ thẳng lẫn có `prefix:` (`state:`, `scope:`, `target:`, `count:`, `lines:`, `time:`, `action:`, `member_mode:`...).
  * [`lib/slash.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/slash.mjs): Thêm `scope` (`channel` | `all`) cho `/autothread` & `/stream` và chuẩn hóa `interactionToCommand()` xuất chuỗi phẳng không prefix (`/footer off all`, `/autothread on all`, `/access report on 21:30`).
  * [`lib/auth.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/auth.mjs) & [`lib/cron.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/cron.mjs): Bỏ các `prefix:` mẫu trong thông báo hướng dẫn.
  * Cập nhật [`test/slash.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/slash.test.mjs).
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ `.mjs` (`exit code 0`), `node --test`: `28/28` pass (`443.7ms`).
  * Restart daemon (`bot.pid` = `19144`, `[gateway] Ready as AM#7297`, `[slash] Synced 25 guild slash command(s)`).

---

## [2026-11-16 22:03] — Hỗ trợ nhận thêm cú pháp `state:on|off` cho `/footer` khi gõ chữ thuần (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Bổ sung nhận `state:on` / `state:off` trong handler `/footer` để cả gõ Slash Command của Discord lẫn gõ chữ trực tiếp (`/footer state:on scope:all`, `/footer on scope:all`, `/footer on all`) đều cho kết quả như nhau.
* **Kiểm tra đã chạy:**
  * `node --check bot.mjs` (`exit code 0`), `node --test`: `28/28` pass (`452.7ms`).
  * Restart daemon (`bot.pid` = `4032`, `[gateway] Ready as AM#7297`).

---

## [2026-11-16 21:48] — Bổ sung `scope: all` cho lệnh `/footer` áp dụng toàn server (`bot.mjs`, `lib/slash.mjs`, `test/slash.test.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/slash.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/slash.mjs): Thêm tùy chọn `scope` (`Kênh / Thread hiện tại` | `Toàn server (mọi kênh & mặc định mới)`) vào `/footer` và ánh xạ trong `interactionToCommand()`.
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Khi chạy `/footer state:<on|off> scope:all` (hoặc `/footer off all`), tự động lưu `config.json` (`showFooter`), đồng bộ toàn bộ kênh/Thread trong `state.channels`; khi chạy ở kênh cha mặc định (`scope:channel`), đồng bộ luôn sang các Thread con của kênh đó.
  * Bổ sung case kiểm thử `/footer` `scope:all` trong [`test/slash.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/slash.test.mjs).
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ `.mjs` (`exit code 0`), `node --test`: `28/28` pass (`440.4ms`).
  * Restart daemon (`bot.pid` = `22596`, `[gateway] Ready as AM#7297`, `[slash] Synced 25 guild slash command(s)`).

---

## [2026-11-16 21:28] — Đảo vị trí câu trả lời & Action Buttons xuống dưới file gửi kèm + Báo cáo tổng kết cuối ngày cho Admin (`lib/report.mjs`, `bot.mjs`, `lib/slash.mjs`, `lib/auth.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * **Đưa câu trả lời cuối & hàng nút xuống dưới cùng khi có gửi file (`bot.mjs`):**
    * Thêm `activeRunPostedChannels` ghi nhận trong `sendDiscordAttachments()` khi `runId` gửi file vào chính `channelId` hiện tại; đẩy `unsentImages` auto-upload chạy trước bước kết thúc, và dùng `finalizeTurnMessage()` xóa tin nhắn placeholder cũ ở trên rồi POST câu trả lời cuối + Footer + Action Buttons ở dưới cùng ngay sau các tệp đính kèm.
  * **Báo cáo tổng kết cuối ngày cho Admin (`lib/report.mjs`, `bot.mjs`, `lib/slash.mjs`, `lib/auth.mjs`):**
    * Tạo [`lib/report.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/report.mjs) tổng hợp `0` token AI (số lượt/token hôm nay của từng Member, dung lượng thư mục từng phòng kèm cảnh báo `>= 80%`, số cảnh báo `BypassSandbox` trong ngày, tổng tích lũy toàn bot) cùng `createDailyReportScheduler` chạy tự động theo `dailyReport` (`enabled`, `time`, `channelId`).
    * Thêm subcommand `/access report` (`action: status|now|on|off`, `time: HH:MM`, `channel`) vào [lib/slash.mjs](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/slash.mjs), cập nhật `formatAccessSummary` trong [lib/auth.mjs](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/auth.mjs) và `recordSecurityAlert()` khi Member kích hoạt `BypassSandbox`.
  * Bổ sung [`test/report.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/report.test.mjs), cập nhật [`test/slash.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/slash.test.mjs) và [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md).
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ `.mjs` (`exit code 0`), `node --test`: `28/28` pass (`489.8ms`).
  * Kiểm chứng sinh báo cáo trên dữ liệu thực tế từ `state.json` & `config.json`.
  * Restart daemon (`bot.pid` = `8404`, `[gateway] Ready as AM#7297`, `[slash] Synced 25 guild slash command(s)`).
  * Test trực tiếp trên Chrome AM (`bakemono`, `#ai-liemdaibomay`): file `.mp3` (`10.69 KB`) hiển thị ở trên, câu trả lời + footer (`12.8s`) + nút `[🔄 Thử lại] [📝 Tóm tắt ngắn] [🗑️ Xóa Thread]` nằm ở dưới cùng, sau đó bấm `[🗑️ Xóa Thread]` dọn sạch Thread test.

---

## [2026-11-16 20:50] — Tối ưu dung lượng thư viện dùng chung `C:\ProgramData\agy-shared-tools` & dọn `node_modules` thừa ở phòng Member
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Loại bỏ các tệp chỉ dùng cho browser/build/TypeScript không dùng ở Node.js CommonJS khỏi `C:\ProgramData\agy-shared-tools\node_modules`: `exceljs\dist` (`19.87 MB`), bản build `iife`/`umd`/`mjs`/`.d.*` trong `docx\dist`, `.yarn`/`tools`/`types`/`*.map`/`*.browser.*`/`*.standalone.*` trong `pdfkit`, bản browser/ESM/PNG trong `xlsx` (giữ lại `dist\cpexcel.js`), `src`/`*.map`/`browser*` trong `fontkit`, `types`/bundle thừa trong `pptxgenjs`, và toàn bộ `@types`, `*.map`, `*.d.ts`, `README*`, `CHANGELOG*`.
  * Xóa `C:\Users\Admin\DiscordShared\liemdaibomay\node_modules` + lockfile (`33.45 MB`) cài nhầm từ trước khi chuyển sang `ProgramData` (giữ nguyên toàn bộ file kết quả của `bakemono`).
* **Dung lượng sau tối ưu (đo thực tế):**
  * `discord-agy-bridge`: `0.63 MB`
  * `C:\ProgramData\agy-shared-tools`: **`96.69 MB` → `27.13 MB`** (giảm `69.56 MB`; riêng bộ script `quick-*` chỉ chiếm `~0.05 MB`).
  * `C:\Users\Admin\DiscordShared\liemdaibomay`: **`34.57 MB` → `1.11 MB`** (giảm `33.46 MB`).
* **Kiểm tra đã chạy:**
  * Kiểm chứng lại `require()` toàn bộ 6 thư viện gốc (`xlsx`, `exceljs`, `pptxgenjs`, `docx`, `pdfkit`, `archiver`), đọc lại file `.xlsx` bằng `XLSX.readFile`, và xuất thành công cả 8 định dạng qua `quick-files`.
  * `node --check` toàn bộ `.mjs` (`exit code 0`), `node --test`: `25/25` pass (`639.0ms`).

---

## [2026-11-16 20:45] — Tổng quát hóa hệ thống theme & font động cho `quick-files` (`themes.js`, `quick-deck`, `quick-pdf`, `lib/runner.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Không cần thêm preset cho từng màu mới: [`themes.js`](file:///C:/ProgramData/agy-shared-tools/node_modules/quick-files/themes.js) bổ sung `NAMED_COLORS` + `normHex()` + `resolveTheme()` để nhận bất kỳ cặp màu nào qua `colors: { bg, accent, ... }` (cả mã hex lẫn tên màu tiếng Anh như `pink`, `purple`, `mint`, `cream`, `black`...) và tự suy ra độ tương phản toàn bảng màu (`surface`, `title`, `text`, `border`, `tint`).
  * Hỗ trợ truyền `font` (`Arial`, `Times New Roman`, `Calibri`, `Georgia`, `Segoe UI`, `Tahoma`, `Verdana`) trong [`quick-pdf`](file:///C:/ProgramData/agy-shared-tools/node_modules/quick-pdf/index.js) (`resolveFontSpec()`) và [`quick-deck`](file:///C:/ProgramData/agy-shared-tools/node_modules/quick-deck/index.js).
  * [`lib/runner.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/runner.mjs): Bỏ quảng bá preset màu cố định, hướng dẫn AI truyền trực tiếp `colors`/`font` động hoặc dùng thư viện gốc (`pptxgenjs`, `exceljs`, `docx`, `pdfkit`) khi cần thiết kế ngoài khuôn mẫu.
* **Kiểm tra đã chạy:**
  * Test `resolveTheme` với cặp màu động không có preset (`white`/`purple`, `black`/`orange`) và xuất `buildPdf` (`Times New Roman`, `33,045 bytes`) + `buildDeck` (`Calibri`, `56,047 bytes`).
  * `node --check` trên toàn bộ `.mjs` (`exit code 0`), `node --test`: `25/25` pass (`428.1ms`).
  * Restart daemon (`bot.pid` = `14144`, `[gateway] Ready as AM#7297`).

---

## [2026-11-16 20:41] — Bổ sung theme tùy biến màu tự do (`colors`) & preset `rose-light` cho bộ `quick-files` (`themes.js`, `quick-*`, `lib/runner.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`themes.js`](file:///C:/ProgramData/agy-shared-tools/node_modules/quick-files/themes.js): Bổ sung preset `rose-light` (hồng/trắng) và hàm `resolveTheme(theme, colors)` hỗ trợ người dùng/AI truyền bất kỳ bảng màu tùy chỉnh nào (`colors: { bg, accent, surface?, surfaceAlt?, title?, text? }`), tự tính màu chữ/viền tương phản sáng-tối.
  * Cập nhật toàn bộ `quick-deck`, `quick-sheet`, `quick-doc`, `quick-pdf`, `quick-html`, `buildChartSvg` nhận tham số `colors`.
  * [`lib/runner.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/runner.mjs): Bổ sung từ khóa nhận diện đổi màu/style (`tông màu|màu sắc|style|theme`) vào `DESKTOP_OPEN_HINT_RE` và ghi chú tùy biến `colors` trong `buildSharedToolsHint()`.
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ `.mjs` (`exit code 0`), `node --test`: `25/25` pass (`467.2ms`).
  * Restart daemon (`bot.pid` = `20604`, `[gateway] Ready as AM#7297`).
  * Kiểm thử trực tiếp trên Chrome AM (tài khoản `bakemono`, Thread `1571881010050637837`): gửi *"cái này tối quá, tôi muốn đổi slide sang tông màu chủ đạo hồng/trắng rồi gửi lại tôi file mới"* → hoàn thành trong **`26.0s`** (`Top_5_Ngon_Ngu_Lap_Trinh_2026_Pink.pptx`, `143.36 KB`, giữ nguyên trên Discord và đĩa để người dùng kiểm tra).

---

## [2026-11-16 20:26] — Mở rộng bộ tạo file nhanh `quick-files` cho toàn bộ định dạng phổ biến (`.xlsx`, `.csv`, `.docx`, `.pdf`, `.html`, `.pptx`, `.svg`, `.zip`) & định tuyến prompt thông minh (`C:\ProgramData\agy-shared-tools`, `lib/runner.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Xây dựng bộ helper thống nhất trong `C:\ProgramData\agy-shared-tools\node_modules\` (đã cấp ACL `ALL APPLICATION PACKAGES:(OI)(CI)(RX)` để tiến trình sandbox `agy --sandbox` đọc trực tiếp qua `NODE_PATH`):
    * `quick-sheet` (`buildWorkbook` `.xlsx` tự auto-fit cột, freeze header, AutoFilter, zebra rows, hỗ trợ công thức `{ formula }`, nhiều sheet; `buildCsv` `.csv` chuẩn UTF-8 BOM không lỗi font tiếng Việt).
    * `quick-doc` (`buildDoc` `.docx` chuẩn Unicode Arial, bìa tiêu đề, metadata, callout, quote, bảng căn khổ A4, footer đánh số trang).
    * `quick-pdf` (`buildPdf` `.pdf` tự đăng ký font `arial.ttf`/`arialbd.ttf`/`ariali.ttf`/`consola.ttf` chống lỗi dấu tiếng Việt, tự ngắt trang thông minh, lặp header bảng khi sang trang, đánh footer `Trang X / Y`).
    * `quick-html` (`buildHtml` `.html` single-file offline responsive có nút Dark/Light, thanh tìm kiếm bảng, KPI cards, biểu đồ cột, hỗ trợ in PDF).
    * Cập nhật `quick-deck` hỗ trợ thêm `spec.table` trên slide `.pptx`.
    * `quick-files` (`index.js` + `themes.js`): Re-export toàn bộ helper trên kèm `buildZip` (`.zip` qua `archiver`) và `buildChartSvg` (`.svg` bar/pie/donut).
  * [`lib/runner.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/runner.mjs): Bổ sung `buildSharedToolsHint()` — chỉ chèn API signature của đúng định dạng người dùng hỏi trong prompt, tránh phình token cho chat thông thường; bổ sung từ khóa mở rộng trong `DESKTOP_OPEN_HINT_RE`.
  * Cập nhật [`test/runner.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/runner.test.mjs) và [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md).
* **Kiểm tra đã chạy:**
  * Smoke test chạy cả 8 định dạng bằng `NODE_PATH=C:\ProgramData\agy-shared-tools\node_modules`: `.pptx` (`14ms`), `.xlsx` (`18ms`), `.csv` (`1ms`), `.docx` (`26ms`), `.pdf` (`106ms`), `.html` (`14ms`), `.svg` (`1ms`), `.zip` (`18ms`) — tất cả tạo thành công không lỗi.
  * `node --check` và `node --test`: `25/25` pass (`519.3ms`).
  * Restart daemon (`bot.pid` = `22728`, `[gateway] Ready as AM#7297`) và kiểm chứng trực tiếp tài khoản Member `bakemono` tạo file Excel 2 sheet (`Top_10_GDP_Quoc_Gia.xlsx`, `8.95 KB`) qua Discord hoàn thành trong **`30.4s`**, sau đó dọn sạch Thread test.

---

## [2026-11-16 20:17] — Rút gọn & đơn giản hóa nội dung `/help` cho Admin (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) (`GUIDE_GROUPS`, `getCommandDocs()`, `buildHelpMessages()`): Gom từ 8 nhóm dài dòng xuống **5 nhóm trực quan** (`1. Chọn Dự án & AI Model`, `2. Chat, Kiểm tra & Dọn phòng`, `3. Quản lý Thành viên & Hướng dẫn`, `4. Chrome AM, Cửa sổ & Nhật ký`, `5. Hẹn giờ & Tùy chỉnh hiển thị`), bỏ dòng `Ví dụ:` thừa với các lệnh không có tham số, viết mô tả ngắn gọn tự nhiên và giữ 5 ví dụ cốt lõi cho `/access`.
* **Kiểm tra đã chạy:**
  * `node --check` trên `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `24` tests, `24` pass, `0` fail, `0` skipped (`477.8ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `23172`, `bot.log` xác nhận `[gateway] Ready as AM#7297`.
  * Gõ `/help` trực tiếp trên `#admin` để xác minh định dạng hiển thị.

---

## [2026-11-16 20:12] — Kiểm thử E2E tài khoản Admin `sickyturtlez` & sửa lỗi `/chrome status` + Markdown `/cron list` (`lib/desktop.mjs`, `bot.mjs`, `lib/cron.mjs`, `test/desktop.test.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Kiểm thử E2E trên Chrome AM (`pageId: 1`) dưới tài khoản Admin `sickyturtlez` tại `#admin`:
    * Menu Slash Command (`/`) hiện đủ lệnh Admin (`/logs`, `/project`, `/access admin`, ...).
    * `/usage`, `/status`, `/projects`, `/models`, `/access list`, `/access quota`, `/access security`, `/webhook status`, `/logs 15`, `/windows list` hiển thị đúng thông tin đặc quyền Admin.
    * Tác vụ AI qua `chrome-devtools` (`list_pages` đọc tab Chrome AM hiện tại) hoàn thành trong **`13.0s`** (`gemini-3.8-flash-high`), đủ Action Buttons và xóa gọn bằng `[🗑️ Xóa Thread]`.
  * **Sửa lỗi `/chrome status` (`Cannot read properties of undefined (reading 'slice')`):**
    * [`lib/desktop.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/desktop.mjs): Bổ sung mảng `tabs` (`[{ title, url }]`) vào kết quả trả về của `getChromeAmStatus()`.
    * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Kiểm tra an toàn `Array.isArray(status.tabs)` trong `handleChromeCommand()`.
    * [`test/desktop.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/desktop.test.mjs): Thêm unit test kiểm tra `getChromeAmStatus()` luôn trả về `tabs` dạng mảng.
  * **Sửa hiển thị Markdown `/cron list`:**
    * [`lib/cron.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/cron.mjs): Bỏ cặp `*...*` bao ngoài câu gợi ý rỗng để chuỗi `"0 9 * * *"` không bị parser Markdown của Discord làm mất dấu `* *`.
* **Kiểm tra đã chạy:**
  * `node --check` trên `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `24` tests, `24` pass, `0` fail, `0` skipped (`418.7ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `8864`, `bot.log` xác nhận `[gateway] Ready as AM#7297`.
  * Kiểm chứng lại `/chrome status` (hiển thị tab Chrome AM đang mở), `/cron list` và `/clear` dọn sạch `#admin` trực tiếp trên Discord Web.

---

## [2026-11-16 20:03] — Kiểm thử E2E trực tiếp trên Discord (tài khoản Member `bakemono`), ẩn thống kê/đường dẫn Admin khỏi Member & chuẩn hóa link `file://` (`bot.mjs`, `lib/utils.mjs`, `test/utils.test.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Kiểm thử E2E trực tiếp bằng `chrome-devtools` trên Chrome AM (`pageId: 1`) dưới tài khoản Member `bakemono` trong `#ai-liemdaibomay`:
    * Tạo PowerPoint (`quick-deck`): `36.0s` (`Cac_Triet_Gia_Vi_Dai_Nhat_Lich_Su.pptx`, `203.88 KB`, 0 lần dò thư viện/`BypassSandbox`).
    * Cloud TTS (`text_to_speech`): `11.2s` gửi thẳng file `.mp3` (`13.50 KB`) có audio player.
    * Action Buttons: `[📝 Tóm tắt ngắn]` (`5.8s`), `[⏹️ Dừng ngay]` (dừng ngay + chuyển sang `[🔄 Thử lại]` & `[🗑️ Xóa Thread]`), `[🔄 Thử lại]` (chạy lại thành công trong `26s`), `[🗑️ Xóa Thread]` (xóa sạch Thread + tin nhắn gốc + conversation + file đính kèm).
    * Reply Context (`referenced_message`): reply vào tin nhắn `.mp3` hoạt động đúng ngữ cảnh (`7.6s`).
    * RBAC & Slash commands: `/access security` bị chặn đúng, `/clear 6` & `/clear 8` dọn tin nhắn hoạt động đúng.
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs):
    * Sửa `/usage` cho Member (`!route.isAdmin`): ẩn dòng `Tổng toàn bot` và ghi chú terminal `agy` (chỉ dành cho Admin); hiển thị rõ hạn mức ngày (lượt, token) và **dung lượng thư mục riêng** (`route.rule?.cwd || chState.cwd`).
    * Sửa `/help` cho Member: cập nhật mô tả `/usage` phù hợp với quyền Member (không nhắc `"toàn bot"`).
    * Gọi `sanitizeDiscordReplyText()` trước khi gửi phản hồi Discord (sau khi `extractUnsentMarkdownImages()` đọc đường dẫn ảnh) để chuyển link `[ten_file](file:///...)` không click được trên Discord thành inline code `` `ten_file` `` và ẩn đường dẫn thư mục host khỏi Member.
  * [`lib/utils.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/utils.mjs) & [`test/utils.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/utils.test.mjs): Thêm hàm `sanitizeDiscordReplyText()` và unit test kiểm tra xử lý `file:///` + ẩn đường dẫn host cho Member.
* **Kiểm tra đã chạy:**
  * `node --check` trên `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `23` tests, `23` pass, `0` fail, `0` skipped (`444.4ms`).
  * Kiểm chứng lại `/usage` và `/help` trực tiếp trên Discord Web sau khi restart daemon (`bot.pid` = `12208`, `[gateway] Ready as AM#7297`) và dọn sạch tin nhắn test bằng `/clear 6`.

---

## [2026-11-16 19:42] — Chuyển `shared-tools` sang `C:\ProgramData\agy-shared-tools`, thêm `quick-deck` tăng tốc PPTX & sửa bắt chuỗi `BypassSandbox: "true"` (`bot.mjs`, `lib/runner.mjs`, `AGENTS.md`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Chuyển bộ thư viện dùng chung từ `%USERPROFILE%\.gemini\antigravity-cli\shared-tools` sang **`C:\ProgramData\agy-shared-tools`** (được cấp ACL `ALL APPLICATION PACKAGES:(OI)(CI)(RX)`), khắc phục lỗi `Access is denied` trong AppContainer `--sandbox` đã làm lượt `9e50c532` mất `30s` đi dò đường và phải `pnpm add`.
  * Tạo module nội bộ **`quick-deck`** (`C:\ProgramData\agy-shared-tools\node_modules\quick-deck\index.js`) với 4 theme sẵn (`dark-gold`, `navy`, `emerald`, `clean-light`) và layout cover/section/bullets/cards/quote giúp giảm kích thước code AI phải sinh cho PowerPoint từ ~500 dòng (~`81s`) xuống ~40 dòng dữ liệu.
  * [`lib/runner.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/runner.mjs): Cập nhật `buildEffectivePrompt()` ưu tiên `quick-deck` cho PowerPoint `.pptx` và yêu cầu bỏ qua bước kiểm tra Python/`npm`.
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Trỏ `SHARED_TOOLS_DIR` sang `C:\ProgramData\agy-shared-tools` và sửa bộ phát hiện `BypassSandbox` trong `createAgyStreamState()` để bắt cả chuỗi `"true"` (không chỉ boolean `true`).
  * Cập nhật [`test/runner.test.mjs`](./test/runner.test.mjs) và [`AGENTS.md`](./AGENTS.md).
* **Lý do kỹ thuật:** Phân tích log `9e50c532` (`127s`) cho thấy 2 nút thắt chính là: (1) sandbox chặn quyền đọc `~/.gemini`, làm AI tốn `30s` dò global & chạy `pnpm add pptxgenjs` với `BypassSandbox: "true"`; (2) `write_file` tốn `81s` để gõ thủ công hàng trăm dòng tọa độ slide `pptxgenjs`.
* **Kiểm tra đã chạy:**
  * Chạy thử `buildDeck` (`quick-deck`) -> tạo `.pptx` `69,403 bytes` trong **`17ms`** (`exit code 0`).
  * `node --check` trên toàn bộ `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `22` tests, `22` pass, `0` fail, `0` skipped (`516.7ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `23472` khớp tiến trình `node.exe ... bot.mjs --log`; `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:63001` và `[gateway] Ready as AM#7297 (1570088887156604992)`.

---

## [2026-11-16 19:22] — Tự reset `conversationId` khi bấm `🔄 Thử lại` sau lượt lỗi/timeout (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) (`processPrompt()` & `agy:retry`): Lưu cờ `chState.lastTurnFailed` (`false` khi thành công, `true` khi lỗi/timeout/dừng); khi người dùng bấm nút **`🔄 Thử lại`** sau một lượt bị lỗi, tự động xóa `chState.conversationId` (và `chromeGuideInjected`) để mở conversation mới sạch sẽ, tránh `agy --conversation` nạp lại trạng thái/workspace cũ bị lỗi từ file `.db`.
  * Xóa `conversationId` cũ bị kẹt (`2eed3017-d606-4543-ab80-6697b324f162`) của Thread `1571857988870869024` trong `state.json` và dọn sạch file tạm trong `C:\Users\Admin\.gemini\antigravity-cli\shared-tools`.
* **Lý do kỹ thuật:** `agy` lưu workspace sandbox vào file `.db` của conversation ngay từ lượt đầu; nên khi bấm `🔄 Thử lại` trên Thread `2eed3017` (đã bị dính `shared-tools` từ lượt trước khi sửa `--add-dir`), `agy --conversation` vẫn chạy lại trong `shared-tools` và lỗi quyền `EPERM` đối với `DiscordShared\liemdaibomay`.
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `22` tests, `22` pass, `0` fail, `0` skipped (`425.9ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `10160` khớp tiến trình `node.exe ... bot.mjs --log`; `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:53256` và `[gateway] Ready as AM#7297 (1570088887156604992)`.

---

## [2026-11-16 19:12] — Sửa lỗi `--add-dir shared-tools` làm lệch `cwd` & gây `EPERM` workspace Member (`bot.mjs`, `AGENTS.md`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Bỏ truyền `--add-dir SHARED_TOOLS_DIR` khi gọi `agy`, chỉ truyền biến môi trường `NODE_PATH` (`shared-tools\node_modules`).
  * [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md): Ghi chú lại hành vi `agy.exe --add-dir` để các agent sau không truyền `--add-dir` thừa làm lệch `cwd` sandbox.
  * Dọn các file rác phát sinh trong `C:\Users\Admin\.gemini\antigravity-cli\shared-tools` từ lượt chạy lỗi trước (`make_slides.js`, `test_output.pptx`, `Cac_Triet_Gia_Quan_Trong_Nhat_Lich_Su.pptx`).
* **Lý do kỹ thuật:** Kiểm tra thực tế phiên lỗi `2eed3017-d606-4543-ab80-6697b324f162` và chạy test trực tiếp `agy.exe --sandbox` cho thấy khi không truyền `--project`, `agy --add-dir` tự đổi `process.cwd()` của `run_command` sang thư mục `--add-dir` (`shared-tools`) và chặn quyền (`EPERM`) đối với `C:\Users\Admin\DiscordShared\liemdaibomay`; khi bỏ `--add-dir` và chỉ giữ `NODE_PATH`, `process.cwd()` giữ đúng workspace `liemdaibomay` và vẫn `require('pptxgenjs')` thành công.
* **Kiểm tra đã chạy:**
  * Test `agy.exe --sandbox` với `NODE_PATH` (không truyền `--add-dir`) -> `process.cwd()` = `C:\Users\Admin\DiscordShared\liemdaibomay`, `typeof require('pptxgenjs')` = `function` (`exit code 0`).
  * `node --check` trên toàn bộ `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `22` tests, `22` pass, `0` fail, `0` skipped (`432.0ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `22872` khớp tiến trình `node.exe ... bot.mjs --log`; `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:65420` và `[gateway] Ready as AM#7297 (1570088887156604992)`.

---

## [2026-11-16 18:54] — Hiện nút `🔄 Thử lại` cả trên tin nhắn lỗi, timeout và dừng giữa chừng (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) (`buildResponseActionComponents()` & `processPrompt()`): Thêm tùy chọn `includeSummarize` (bật khi có nội dung trả lời đầy đủ, tắt khi gặp lỗi/timeout/dừng) để luôn gắn nút **`🔄 Thử lại`** + **`🗑️ Xóa Thread`** / **`🆕 Phiên mới`** cả khi `agy` báo lỗi, quá `printTimeout`, hoặc bị người dùng bấm dừng.
* **Lý do kỹ thuật:** Trước đây chỉ gắn nút khi `responseText` khác rỗng, dẫn tới tin nhắn lỗi/timeout (như `print timeout after 5m0s`) bị trống nút `[]` đúng lúc người dùng cần thử lại nhất.
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `22` tests, `22` pass, `0` fail, `0` skipped (`448.6ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `13816` khớp tiến trình `node.exe ... bot.mjs --log`; `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:55214` và `[gateway] Ready as AM#7297 (1570088887156604992)`.

---

## [2026-11-16 18:52] — Hạng mục #4: Bộ công cụ dựng sẵn (`shared-tools`) & Cloud TTS (`text_to_speech`) (`lib/desktop.mjs`, `lib/auth.mjs`, `lib/runner.mjs`, `bot.mjs`, `test/desktop.test.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * **Cài bộ thư viện tạo tài liệu dùng chung bên ngoài repo (`C:\Users\Admin\.gemini\antigravity-cli\shared-tools`):** `pptxgenjs`, `exceljs`, `xlsx`, `docx`, `pdfkit` (`added 230 packages`).
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Tự động truyền `NODE_PATH` (`shared-tools\node_modules`) và `--add-dir` tới `shared-tools` vào mọi tiến trình `agy` con (giữ nguyên repo không có `node_modules` và không làm phình dung lượng phòng Member). Bổ sung nhãn hiển thị `text_to_speech: "Tạo audio đọc"`.
  * [`lib/desktop.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/desktop.mjs): Bổ sung MCP tool **`text_to_speech`** (`splitTtsChunks`, `synthesizeCloudTtsMp3`) tổng hợp MP3 qua Cloud TTS theo từng đoạn <=180 ký tự và tự gửi thẳng lên Discord (tự dọn file tạm nếu không chỉ định `output_path`).
  * [`lib/auth.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/auth.mjs): Xuất `MEMBER_SAFE_MCP_TOOLS = ["send_to_discord", "text_to_speech"]` cho các phiên thành viên.
  * [`lib/runner.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/runner.mjs): Mở rộng `DESKTOP_OPEN_HINT_RE` cho các từ khóa tài liệu/âm thanh (`pptx`, `slide`, `xlsx`, `docx`, `pdf`, `audio`, `tts`, `mp3`...) và tiêm hướng dẫn ngắn dùng sẵn `text_to_speech` + `require(...)` CommonJS trên `NODE_PATH` (kèm mẹo font `arial.ttf` cho PDF tiếng Việt) để `agy` bỏ qua bước dò Python/`npm install`.
  * Cập nhật [`test/auth.test.mjs`](./test/auth.test.mjs), [`test/runner.test.mjs`](./test/runner.test.mjs), tạo [`test/desktop.test.mjs`](./test/desktop.test.mjs), và cập nhật [`AGENTS.md`](./AGENTS.md).
* **Lý do kỹ thuật:** Khắc phục triệt để lỗi timeout `5m` ở lượt tạo PowerPoint vừa qua của `bakemono` (`14f3c9eb-ca6d-4839-b2c9-8e435eeaf61f`, mất >4 phút chỉ để dò Python/npm và tự viết XML `.pptx` bằng tay từ `cfb`).
* **Kiểm tra đã chạy:**
  * Xác minh `agy.exe --sandbox` đọc được `require('pptxgenjs')` qua `NODE_PATH` + `--add-dir` -> `function` (`exit code 0`).
  * `node --check` trên toàn bộ `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `22` tests, `22` pass, `0` fail, `0` skipped (`448.4ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `13892` khớp tiến trình `node.exe ... bot.mjs --log`; `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:55177`, `[gateway] Ready as AM#7297 (1570088887156604992)` và `[slash] Synced 25 guild slash command(s)`.

---

## [2026-11-16 18:35] — Thêm Action Buttons dưới tin nhắn, nhận diện Reply (`referenced_message`) & Quota/Bảo mật Member (`lib/quota.mjs`, `bot.mjs`, `lib/slash.mjs`, `lib/runner.mjs`, `lib/utils.mjs`, `lib/auth.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * **1. Discord Action Buttons (`MESSAGE_COMPONENT`):**
    * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Gắn nút **`⏹️ Dừng ngay`** (`agy:stop`) ngay trên tin nhắn tiến độ khi đang stream; gắn hàng nút **`🔄 Thử lại`**, **`📝 Tóm tắt ngắn`** và **`🗑️ Xóa Thread`** (trong Thread) / **`🆕 Phiên mới`** (ngoài kênh chính/DM) dưới câu trả lời hoàn chỉnh. Xử lý `interaction.type === 3` trong `onInteractionCreate()`.
  * **2. Nhận diện tin nhắn được Reply (`referenced_message`):**
    * [`lib/utils.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/utils.mjs) (`extractReplyContext`) & [`lib/runner.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/runner.mjs) (`formatPromptWithReplyContext`): Khi người dùng Reply một tin nhắn/ảnh/tài liệu cũ trong cùng kênh, `bot.mjs` tự lấy nội dung & tải đính kèm của tin nhắn được Reply để đưa vào ngữ cảnh câu hỏi cho `agy`.
  * **3. Hạn mức & Siết an toàn Member:**
    * Tạo mới [`lib/quota.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/quota.mjs) (`checkMemberQuota`, `recordMemberTurnAccepted`, `recordMemberTurnTokens`, `getDirectorySizeBytes`, mặc định `30` lượt/ngày, `cooldownSec: 5`, `workspaceMaxMb: 200`, `blockBypassSandbox: true`).
    * [`lib/slash.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/slash.mjs), [`lib/auth.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/auth.mjs) & [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Bổ sung `/access quota` và `/access security` (`member_mode: auto|plan`, `block_bypass_sandbox`, `workspace_max_mb`), hiển thị hạn mức còn lại trong `/usage` cho thành viên, tiêm quy tắc cấm `BypassSandbox: true` trong `Scoped Session`, và tự động ngắt + báo về `#admin` khi phiên Member cố truyền `BypassSandbox: true`.
  * Cập nhật [`buildGuideMessages()`](./bot.mjs) (`#instructions`), [`config.example.json`](./config.example.json), [`AGENTS.md`](./AGENTS.md), [`README.md`](./README.md), và bổ sung unit tests trong [`test/quota.test.mjs`](./test/quota.test.mjs), [`test/utils.test.mjs`](./test/utils.test.mjs), [`test/runner.test.mjs`](./test/runner.test.mjs), [`test/slash.test.mjs`](./test/slash.test.mjs).
* **Lý do kỹ thuật:** Nâng cao trải nghiệm bấm-chạy cho người dùng phổ thông (nút bấm + Reply), đồng thời bảo vệ quota và kiểm soát việc chạy lệnh ngoài sandbox ở phòng thành viên.
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `20` tests, `20` pass, `0` fail, `0` skipped (`461.6ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `2512` khớp tiến trình `node.exe ... bot.mjs --log`; `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:50613`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[slash] Synced 25 guild slash command(s)` và `[guide] Published 2 guide message(s) to #instructions`.

---

## [2026-11-14 14:40] — Đồng bộ tài liệu `README.md` và `AGENTS.md` sau khi bỏ tham số `effort` (`README.md`, `AGENTS.md`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md): Sửa mô tả lệnh `/model [model_id]` (bỏ `[effort]`, ghi chú mức suy luận nằm sẵn trong `model_id`).
  * [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md): Cập nhật phần RBAC `/access model` (bỏ nhắc `effort` / `rule.effort`), cập nhật mô tả `#instructions` thân thiện cho người dùng phổ thông, và liệt kê `test/*.test.mjs` trong cấu trúc repo.
* **Lý do kỹ thuật:** Giữ tài liệu sử dụng và tài liệu handoff đồng nhất 100% với schema Slash Command `/` và hành vi code hiện tại.
* **Kiểm tra đã chạy:**
  * `Select-String` trên `README.md`, `AGENTS.md`, `CLAUDE.md` xác nhận không còn `/model [model_id] [effort]` hay `rule.effort` trong `/access model`.

---

## [2026-11-14 14:30] — Bỏ tham số `effort` dư thừa khỏi `/model` và `/access model` (`lib/slash.mjs`, `bot.mjs`, `test/slash.test.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/slash.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/slash.mjs): Gỡ `CHOICE_EFFORTS` và bỏ tham số `effort` khỏi schema `/model`, `/access model auto`, `/access model set` cùng logic nối chuỗi trong `interactionToCommand()` (do mức effort đã nằm sẵn trong `model_id` của `agy models`).
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Cập nhật lệnh `/model` (tự reset `chState.effort = ""` khi đổi model và rút gọn thông báo phản hồi) cùng phần mô tả/ví dụ `/model` trong `getCommandDocs()`.
  * [`test/slash.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/slash.test.mjs): Thêm unit test xác nhận `/model` chỉ còn `model_id` và `/access model` không còn tham số `effort`.
* **Lý do kỹ thuật:** Tránh trùng lặp tham số vì các `model_id` của `agy` (như `gemini-4-hydrogen-high`, `claude-opus-5-5-medium`, `gemini-3.8-flash-low`...) đã bao gồm sẵn mức effort.
* **Kiểm tra đã chạy:**
  * `node --check` trên `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `14` tests, `14` pass, `0` fail, `0` skipped (`424.5ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `14104` khớp tiến trình `node.exe ... bot.mjs --log`; `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:58566`, `[gateway] Ready as AM#7297 (1570088887156604992)` và `[slash] Synced 25 guild slash command(s) for guild 1570090644200755220`.

---

## [2026-11-14 14:23] — Nâng cấp `/help` theo nhóm dễ hiểu kèm ví dụ thực tế (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) (`GUIDE_GROUPS`, `getCommandDocs()`, `buildHelpMessages()`, `packDiscordSections()`): Viết lại mô tả toàn bộ 25 lệnh `/` theo ngôn ngữ dễ hiểu, gom thành 8 nhóm chức năng cho Admin và bổ sung ví dụ thực tế đúng cú pháp Slash Command (bao gồm chi tiết các subcommand của `/access`, `/cron`, `/project`, `/model`, `/chrome`, `/windows`...) cũng như cho thành viên thường. Dùng chung `packDiscordSections()` để đóng gói các khối tin nhắn gọn dưới `1850` ký tự cho cả `/help` và `#instructions`.
* **Lý do kỹ thuật:** Thay danh sách phẳng nhiều ký hiệu `<...>` khó đọc của `/help` bằng bảng hướng dẫn phân nhóm kèm ví dụ bấm chạy được ngay.
* **Kiểm tra đã chạy:**
  * `node --check` trên `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `13` tests, `13` pass, `0` fail, `0` skipped (`431.9ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `12372` khớp tiến trình `node.exe ... bot.mjs --log`; `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:59403`, `[gateway] Ready as AM#7297 (1570088887156604992)` và `[guide] #instructions (1570105667941830898) is up to date`.

---

## [2026-11-14 14:20] — Bỏ mục `4. Một vài lưu ý nhỏ` khỏi `#instructions` (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) (`buildGuideMessages()`): Gỡ bỏ phần `## 4. Một vài lưu ý nhỏ` (và biến `guideName` không còn dùng), giúp toàn bộ hướng dẫn ở `#instructions` gói gọn trong 1 tin nhắn.
* **Lý do kỹ thuật:** Rút gọn nội dung `#instructions` theo đúng yêu cầu người dùng.
* **Kiểm tra đã chạy:**
  * `node --check` trên `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `13` tests, `13` pass, `0` fail, `0` skipped (`421.4ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `11092` khớp tiến trình `node.exe ... bot.mjs --log`; `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:59355`, `[gateway] Ready as AM#7297 (1570088887156604992)` và `[guide] Published 1 guide message(s) to #instructions (1570105667941830898)`.

---

## [2026-11-14 14:16] — Đổi lời chào `#announcement` & link `#instructions` bấm được trong Embed (`bot.mjs`, `config.json`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) & `config.json`: Cập nhật `announceJoinMessage` thành `"{mention} yokoso watashi no soul society, nhớ đọc kĩ hướng dẫn sử dụng trước khi dùng ở #instructions"`.
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) (`sendMemberAnnouncement()`): Tự động chuyển `#instructions` (theo `config.guideChannelName` / `state.guide.channelId`) thành `<#channelId>` để hiển thị thành link kênh bấm được trực tiếp bên trong Embed thông báo.
* **Lý do kỹ thuật:** Cập nhật nội dung lời chào mới trên kênh `#announcement` và giúp thành viên mới bấm thẳng vào `#instructions` từ thông báo chào mừng.
* **Kiểm tra đã chạy:**
  * `node --check` trên `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `13` tests, `13` pass, `0` fail, `0` skipped (`406.5ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `4800` khớp tiến trình `node.exe ... bot.mjs --log`; `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:59529`, `[gateway] Ready as AM#7297 (1570088887156604992)` và `[announce] Ready on #announcement (1570370595332300810)`.

---

## [2026-11-14 14:12] — Viết lại nội dung kênh `#instructions` thân thiện cho người không rành kỹ thuật (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Cập nhật `buildGuideMessages()` loại bỏ toàn bộ thuật ngữ lập trình (`sandbox`, `cwd`, `RBAC`, `conversationId`, `Project/Model`, `agy`, `token in/out/cache`...) và thay bằng hướng dẫn 4 bước trực quan, gần gũi cho người dùng phổ thông (cách tìm phòng riêng `#ai-<tên>`, cách nhắn tin/gửi ảnh qua nút `+`, giải thích dễ hiểu về Thread tách chủ đề, và 7 lệnh `/` thành viên viết theo ngôn ngữ đời thường).
* **Lý do kỹ thuật:** Giúp thành viên mới không rành công nghệ có thể đọc hiểu trong vài giây và sử dụng ngay trợ lý AI mà không bị choáng ngợp bởi thuật ngữ kỹ thuật.
* **Kiểm tra đã chạy:**
  * `node --check` trên `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `13` tests, `13` pass, `0` fail, `0` skipped (`403.2ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `3816` khớp tiến trình `node.exe ... bot.mjs --log`; `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:59494`, `[gateway] Ready as AM#7297 (1570088887156604992)` và `[guide] Published 2 guide message(s) to #instructions (1570105667941830898)`.

---

## [2026-11-14 14:07] — Cập nhật tin nhắn chào mừng thành viên mới với các model Gemini mới (`lib/onboard.mjs`, `bot.mjs`, `test/onboard.test.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/onboard.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/onboard.mjs): Tách hàm thuần `buildMemberWelcomeMessage()` và thêm tham số tùy chọn `getAvailableModels` vào `createMemberProvisioner()` để lấy động tên model mặc định hiện tại (`autoOnboard.defaultModel` / `defaultModel`) cùng danh sách đầy đủ các họ model từ `agy models` (bao gồm các model mới của Gemini như **Gemini 4 Hydrogen**, **Orchestrator (Argon)** bên cạnh **Gemini 4 Argon**, **Claude Opus 5.5**, **Claude Sonnet 5.5**, **GPT-OSS 120B**), kèm fallback an toàn và timeout `1500ms` có dọn timer.
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Truyền `getAvailableModels: () => getAgyModelsCached()` vào `createMemberProvisioner()`.
  * [`test/onboard.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/onboard.test.mjs): Thêm 2 unit test kiểm tra `buildMemberWelcomeMessage()` với cache model và khi fallback rỗng.
* **Lý do kỹ thuật:** Tự động phản ánh chính xác các model Gemini mới và model mặc định trong tin nhắn chào mừng mỗi khi khởi tạo kênh riêng cho thành viên mới mà không cần sửa tay chuỗi cứng sau mỗi lần `agy` cập nhật model.
* **Kiểm tra đã chạy:**
  * `node --check` trên `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `13` tests, `13` pass, `0` fail, `0` skipped (`480.9ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `20616` khớp tiến trình `node.exe ... bot.mjs --log`; `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:60147`, `[gateway] Ready as AM#7297 (1570088887156604992)` và `[announce] Ready on #announcement (1570370595332300810)`.

---

## [2026-11-12 19:21] — Thông báo đổi model tới kênh riêng Member & Bộ kiểm thử `node --test` (`bot.mjs`, `test/*.test.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Cập nhật lệnh `/access model` để khi Admin đổi model (hoặc đưa về mặc định) cho thành viên từ một kênh khác (như `#admin`), bot tự gửi thông báo kèm ping chủ kênh (`rule.onboardedUserId` / `rule.allowUserIds[0]`) và tên model đã format vào kênh riêng `#ai-<slug>` tương ứng (tránh gửi trùng nếu Admin gõ lệnh ngay trong chính kênh đó).
  * Tạo bộ unit test zero-dependency chạy trực tiếp bằng `node --test`:
    * [`test/utils.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/utils.test.mjs): Kiểm tra `quoteSnowflakeLiterals`, `isPathInsideDir`, `resolveCanonicalPath`, `extractSnowflakeId`, `sanitizeAttachmentFilename`.
    * [`test/auth.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/auth.test.mjs): Kiểm tra `evaluateMessageAccess` (DM, `#announcement`, Thread kế thừa), `canExecuteDiscordCommand`, `resolveTurnExecutionPolicy`.
    * [`test/runner.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/runner.test.mjs): Kiểm tra `createPrioritySemaphore` (giới hạn slot, thứ tự ưu tiên, hủy qua `AbortSignal`), `resolveTurnTimeout`, `normalizeMaxConcurrentRuns`, `buildEffectivePrompt`, `createSleepInhibitor`.
    * [`test/discord-gateway.test.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/test/discord-gateway.test.mjs): Kiểm tra `DiscordGatewayClient` (bật/hạ `GUILD_MEMBERS` intent khi gặp `4014`, phát hiện mất Heartbeat ACK và đóng socket mã `4000`).
* **Lý do kỹ thuật:** Giúp thành viên biết ngay khi Admin nâng/đổi model cho kênh riêng của mình, đồng thời có bộ kiểm thử tự động bảo vệ các module RBAC, concurrency, path guard và gateway chống hồi quy.
* **Kiểm tra đã chạy:**
  * `node --check` trên `bot.mjs`, `lib\*.mjs`, `test\*.test.mjs` -> `exit code 0`.
  * `node --test` -> `11` tests, `11` pass, `0` fail, `0` skipped (`409.3ms`).
  * Khởi động lại daemon (`stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`): `bot.pid` = `9804` khớp tiến trình `node.exe ... bot.mjs --log`; `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:59341`, `[gateway] Ready as AM#7297 (1570088887156604992)` và `[announce] Ready on #announcement (1570370595332300810)`.

---

## [2026-11-12 18:55] — Nâng cấp Global Concurrency Pool, Gateway Zombie Watchdog, Timeout Member & Prompt/Anti-Sleep (`lib/runner.mjs`, `lib/discord-gateway.mjs`, `bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/runner.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/runner.mjs):
    * Tạo `createPrioritySemaphore()` giới hạn tổng tiến trình `agy` chạy song song (`config.maxConcurrentRuns`, mặc định `2`, clamp `1..10`) theo độ ưu tiên: Chat User (`1`) > Webhook (`2`) > Cron (`3`), hỗ trợ hủy khi chờ hàng đợi qua `AbortSignal` (`/stop`, xóa Thread).
    * Tách `buildEffectivePrompt()` sang module riêng và tối ưu tránh chèn lặp lại toàn bộ `CHROME_DEVTOOLS_FAST_GUIDE` trong các lượt tiếp theo của cùng `conversationId` (`chState.chromeGuideInjected`).
    * Thêm `resolveTurnTimeout()` tách riêng `memberPrintTimeout` (mặc định `"5m"`) cho thành viên/webhook và `printTimeout` (`"15m"`) cho Admin.
    * Thêm `createSleepInhibitor()` gọi `SetThreadExecutionState(0x00000001)` định kỳ **chỉ khi** có lượt `agy` đang chạy (`active > 0`).
  * [`lib/discord-gateway.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/discord-gateway.mjs):
    * Bóc tách `DiscordGatewayClient` khỏi `bot.mjs` và bổ sung `forceCloseSocket()` (`4000ms` close-handshake watchdog) + `CONNECT_HELLO_TIMEOUT_MS` (`15000ms`) để tự hủy socket treo nửa chừng (zombie socket) và nối lại ngay khi rớt mạng cứng.
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) & [`config.example.json`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/config.example.json): Tích hợp Global Semaphore + Anti-Sleep trong `processPrompt()`, hiển thị `Global Pool` trong `/status` Admin, xóa `chromeGuideInjected` khi `/new`.
  * Cập nhật [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md).
* **Lý do kỹ thuật:** Chống quá tải CPU/RAM & quota khi nhiều người/cron chạy song song, giảm treo slot do member chạy lâu, xử lý dứt điểm zombie socket khi đứt mạng và thu gọn `bot.mjs`.
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ 11 file `.mjs` -> `SYNTAX_OK (11 files)` (`exit code 0`).
  * Chạy bộ unit assertion xác nhận: giới hạn concurrency `2`, thứ tự ưu tiên `user > webhook > cron`, hủy tác vụ qua `AbortSignal` khi đang chờ slot, `resolveTurnTimeout` (`15m` vs `5m`), lọc & tối ưu lặp `CHROME_DEVTOOLS_FAST_GUIDE`, refcount của `createSleepInhibitor`, và `DiscordGatewayClient` ACK timeout (`4000`) -> `ALL_UNIT_CHECKS_PASSED`.
  * Khởi động lại qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `12152` khớp đúng tiến trình `node.exe ... bot.mjs --log`, `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:64416`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[announce] Ready on #announcement (1570370595332300810).`.

---

## [2026-11-12 17:17] — Đồng bộ `rule.model` vào state kênh & Thread con khi khởi tạo/đổi model (`bot.mjs`, `state.json`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs):
    * Cập nhật `getChannelState()` ưu tiên `parent?.model || rule?.model || config.defaultModel` (và `effort` tương ứng) để kênh mới được tạo từ `autoOnboard`/`channelRules` khởi tạo đúng model riêng (`gemini-3.8-flash-low`) thay vì rơi về `config.defaultModel` (`gemini-3.8-flash-high`).
    * Cập nhật nhánh `/access model` để đồng bộ cả các Thread con đang mở (`chSt.parentId === cid`) khi đổi/xóa model của một kênh thành viên.
  * `state.json`: Đồng bộ lại `model` của kênh `#ai-liemdaibomay` (`1570381330192269392`) và Thread `1570381463046848563` về `gemini-3.8-flash-low`.
* **Lý do kỹ thuật:** Dù thành viên chạy qua `createMemberPolicy()` đã bị ép `forcedModel = "gemini-3.8-flash-low"`, khi Admin test trực tiếp trong kênh riêng thành viên thì Admin chạy theo `chState.model` vốn bị khởi tạo từ `config.defaultModel` (`gemini-3.8-flash-high`) do `getChannelState()` trước đó bỏ sót `rule?.model`.
* **Kiểm tra đã chạy:**
  * `node --check` trên 9 file `.mjs` -> `SYNTAX_OK (9 files)` (`exit code 0`).
  * Khởi động lại qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `22876` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`, `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:64210`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[announce] Ready on #announcement (1570370595332300810).`.

---

## [2026-11-12 17:11] — Cho phép Admin dùng `/clear` trong `#announcement` (`lib/auth.mjs`, `bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/auth.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/auth.mjs):
    * Bổ sung tham số `isAnnounceChannel` trong `evaluateMessageAccess()` trả về route Admin với cờ `isAnnounceChannel: true` (chặn thành viên thường và chặn trong Thread).
    * Cập nhật `canExecuteDiscordCommand()` chỉ cho phép `route.isAdmin && cmd === "/clear"` khi `route.isAnnounceChannel` bật.
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs):
    * Cập nhật `authorizeMessage()` nhận diện `#announcement` (`config.announceChannelId || state.announceChannelId`), bỏ qua mọi tin nhắn thường/thread trong `#announcement` ở `onMessageCreate()` và chỉ cho Admin thực thi `/clear` (cả Slash Command lẫn text `/clear`), đồng thời trả thông báo ephemeral rõ ràng nếu gọi lệnh khác trong `#announcement`.
* **Lý do kỹ thuật:** Trước đó `#announcement` không nằm trong `allowedChannelIds`/`channelRules` nên bị chặn ở `evaluateMessageAccess()`, khiến Admin không dùng được `/clear` để dọn thông báo cũ.
* **Kiểm tra đã chạy:**
  * `node --check` trên 9 file `.mjs` -> `SYNTAX_OK (9 files)` (`exit code 0`).
  * Khởi động lại qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `22992` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`, `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:50567`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[announce] Ready on #announcement (1570370595332300810).`.

---

## [2026-11-12 17:07] — Chuẩn hóa viết hoa & sửa đúng tên model trong lời chào onboard (`lib/onboard.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/onboard.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/onboard.mjs): Chuẩn hóa viết hoa (`AI Agent`, `Admin`) và sửa đúng tên model theo `agy models` (`gemini flash 3.8 low` -> `Gemini 3.8 Flash (Low)`, `Claude Opus 5.5`, `Claude Sonnet 5.5`, `GPT-OSS 120B`, `Gemini 4 Argon`).
  * Cập nhật trực tiếp tin nhắn chào mừng trong kênh `#ai-liemdaibomay` (`1570376174335565825`) qua Discord API (`PATCHED_WELCOME_MSG: 200`).
* **Lý do kỹ thuật:** Đối chiếu `agy models` cho thấy model mặc định `gemini-3.8-flash-low` có tên chuẩn là `Gemini 3.8 Flash (Low)` và `gpt-oss-120b-medium` viết hoa chuẩn là `GPT-OSS 120B`.
* **Kiểm tra đã chạy:**
  * `agy models` xác nhận danh sách tên model chuẩn.
  * `node --check` trên 9 file `.mjs` -> `SYNTAX_OK (9 files)` (`exit code 0`).
  * Khởi động lại qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `12352` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`, `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:50530`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[announce] Ready on #announcement (1570370595332300810).`.

---

## [2026-11-12 17:05] — Ẩn đường dẫn máy Admin & cập nhật lời chào kênh thành viên (`lib/onboard.mjs`, `bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/onboard.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/onboard.mjs):
    * Cập nhật tin nhắn chào mừng trong kênh riêng thành viên: đổi dòng đầu thành `👋 Chào mừng <@${userId}> đến channel ai agent riêng của bạn!`, chèn dòng thông tin model mặc định (`gemini flash 3.8 low`) & hướng dẫn đổi model/thinking level ngay sau câu đầu, xóa bỏ dòng `Thư mục sandbox: ...` (không lộ đường dẫn máy Admin), và bỏ đoạn mô tả `bot bị khóa chặt trong thư mục của bạn, bật sandbox và tắt điều khiển Desktop/Chrome.` ở mục `Bảo mật`.
    * Bỏ `— Thư mục: ${targetCwd}` khỏi `topic` của kênh được tạo mới (`Kênh AI riêng cho @<name>`).
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Ẩn `Thư mục (cwd)` và chi tiết sandbox/desktop nội bộ khỏi đầu ra `/status` khi người gọi là thành viên thường (`!execPolicy.isAdmin`).
  * Cập nhật lại trực tiếp `topic` và tin nhắn chào mừng trên kênh `#ai-liemdaibomay` (`1570376174335565825`) hiện có qua Discord API.
* **Lý do kỹ thuật:** Bảo mật thông tin đường dẫn hệ thống trên máy Admin ở mọi bề mặt thành viên có thể nhìn thấy (lời chào, topic kênh, `/status`).
* **Kiểm tra đã chạy:**
  * Patch kênh `1570376174335565825` (`PATCHED_WELCOME_MSG: 200`).
  * `node --check` trên 9 file `.mjs` -> `SYNTAX_OK (9 files)` (`exit code 0`).
  * Khởi động lại qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `2012` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`, `bot.log` xác nhận `[mcp] Desktop bridge listening`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[announce] Ready on #announcement (1570370595332300810).`.

---

## [2026-11-12 16:52] — Chỉ tag `@user` 1 lần trên Embed thông báo `#announcement` (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): Trong `sendMemberAnnouncement()`, giữ tag `<@userId>` duy nhất ở `content` phía trên Embed (để ping thông báo hoạt động), và loại bỏ `{mention}`/`{user}` lặp ở đầu `embed.description` (nếu còn placeholder giữa câu thì đổi thành `**username**`).
* **Lý do kỹ thuật:** Tránh hiển thị tag `@user` 2 lần liên tiếp (1 lần ở ngoài và 1 lần ở dòng đầu trong Embed) do cả `announceJoinMessage` và `announceLeaveMessage` đều bắt đầu bằng `{mention}`.
* **Kiểm tra đã chạy:**
  * `node --check bot.mjs` -> `SYNTAX_OK` (`exit code 0`).
  * Khởi động lại qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `23188` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`, `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:64559`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[announce] Ready on #announcement (1570370595332300810).`.

---

## [2026-11-12 16:49] — Format thông báo `#announcement` dạng Embed + Card avatar (`lib/announce-card.mjs`, `bot.mjs`, `AGENTS.md`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/announce-card.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/announce-card.mjs):
    * Tạo module mới gồm `buildMemberAvatarUrl()` (lấy avatar server/global hoặc avatar mặc định Discord dưới dạng PNG) và `renderAnnouncementCard()` dùng `.NET System.Drawing` (`powershell.exe` + `GraphicsPath`) vẽ ảnh PNG nền trong suốt (`720x290`): avatar tròn ở giữa có viền xanh lá `#22C55E` (khi vào) hoặc đỏ `#EF4444` (khi rời), dòng chữ trắng đậm `<username> vừa tham gia server` / `<username> vừa rời khỏi server`, và dòng phụ `Thành viên #N` / `Còn lại N thành viên`.
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs):
    * Theo dõi `guildMemberCounts` qua sự kiện `GUILD_CREATE` (`member_count`), cập nhật tăng/giảm khi nhận `GUILD_MEMBER_ADD`/`GUILD_MEMBER_REMOVE`, và fallback sang `GET /guilds/<guildId>?with_counts=true` qua `resolveGuildMemberCount()`.
    * Cập nhật `sendMemberAnnouncement()` để gửi tin nhắn theo format: tag `<@userId>` bên ngoài Embed, giữ nguyên nội dung thông báo (`{mention} yokoso watashi no soul society, yêu cầu bank 50k lệ phí` / `{mention} cút ra ngoài`) trong `embed.description`, vạch màu trái Embed (`0x7257ff` tím khi vào, `0xef4444` đỏ khi rời), và đính kèm ảnh `attachment://announce-card.png` vào `embed.image` qua `multipart/form-data`.
  * Cập nhật [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md) bổ sung `lib/announce-card.mjs`.
* **Lý do kỹ thuật:** Đạt bố cục Embed + Card chào mừng giống mẫu người dùng gửi trong khi vẫn giữ nguyên văn bản thông báo và không cần cài đặt thêm `npm` package.
* **Kiểm tra đã chạy:**
  * Render thử `renderAnnouncementCard` cho cả 2 trạng thái `join` (`15120` bytes) và `leave` (`15597` bytes) và kiểm tra trực quan PNG đầu ra.
  * `node --check` trên toàn bộ 9 file `.mjs` -> `SYNTAX_OK (9 files)` (`exit code 0`).
  * Khởi động lại qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `15172` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`, `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:64531`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[announce] Ready on #announcement (1570370595332300810).`.

---

## [2026-11-12 16:41] — Bỏ dấu `.` cuối câu thông báo & tự khóa quyền chỉ đọc cho `#announcement` (`bot.mjs`, `config.json`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs) & `config.json`:
    * Bỏ dấu `.` cuối câu ở cả `announceJoinMessage` (`{mention} yokoso watashi no soul society, yêu cầu bank 50k lệ phí`) và `announceLeaveMessage` (`{mention} cút ra ngoài`).
    * Trong `syncAnnounceChannel()`, gọi `memberProvisioner.setChannelReadOnly(...)` để tự khóa `@everyone` (`READ_ONLY_DENY_MASK`: chặn gửi tin, react, tạo/gửi trong Thread, poll, voice message) và cấp quyền gửi tin nhắn cho bot `AM` trên `#announcement` (`1570370595332300810`).
* **Lý do kỹ thuật:** Đúng văn phong yêu cầu và đảm bảo `#announcement` chỉ để `AM` (và Admin) đăng thông báo tự động.
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ 8 file `.mjs` -> `SYNTAX_OK` (`exit code 0`).
  * Khởi động lại qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `14072` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`.
  * API `GET /channels/1570370595332300810` và `bot.log` xác nhận `[announce] Enforced read-only permissions for @everyone on #announcement (1570370595332300810).` (`deny: '633696654723136'` cho `@everyone`, `allow: '326417624064'` cho `AM`).

---

## [2026-11-12 16:38] — Thông báo tự động thành viên vào/ra server tại `#announcement` (`bot.mjs`, `lib/utils.mjs`, `config.json`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs):
    * Bổ sung cấu hình `announceChannelId`, `announceChannelName` (mặc định `"announcement"`), `announceJoinMessage`, `announceLeaveMessage` trong `loadConfig()`, và giữ `GUILD_MEMBERS_INTENT` bật khi cấu hình thông báo đang hoạt động.
    * Thêm `syncAnnounceChannel()` (tự dò kênh tại `READY`) và `sendMemberAnnouncement("join" | "leave", data)` gắn vào `GUILD_MEMBER_ADD` và `GUILD_MEMBER_REMOVE` (hỗ trợ placeholder `{mention}`, `{username}`, tự bỏ qua bot khi `autoOnboard.ignoreBots !== false`).
  * [`lib/utils.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/utils.mjs): thêm `announceChannelId` vào `quoteSnowflakeLiterals` để bảo toàn Snowflake 64-bit.
  * `config.json`: gắn `announceChannelId: "1570370595332300810"`, `announceChannelName: "announcement"`, `announceJoinMessage: "{mention} yokoso watashi no soul society, yêu cầu bank 50k lệ phí."`, `announceLeaveMessage: "{mention} cút ra ngoài."`.
  * Cập nhật [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md).
* **Lý do kỹ thuật:** Tự động thông báo khi có thành viên mới tham gia hoặc rời server trong `#announcement` dùng chung `GUILD_MEMBERS` Intent sẵn có.
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ 8 file `.mjs` -> Đạt (`exit code 0`).
  * Kiểm thử `ANNOUNCE_UTILS_OK` (`quoteSnowflakeLiterals` bảo toàn `announceChannelId`) -> Đạt.
  * Khởi động lại qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `10884` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`.
  * `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:51357`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[onboard] Auto-onboard: bật (GUILD_MEMBERS active)`, `[announce] Ready on #announcement (1570370595332300810).`, và `[slash] Synced 25 guild slash command(s) for guild 1570090644200755220.`.

---

## [2026-11-12 16:28] — Ghim `autoOnboard` vào category `Member` và bật tự xóa kênh khi thành viên rời server (`config.json`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Cập nhật khối `autoOnboard` trong `config.json` (bảo toàn Snowflake ID chuỗi, không đụng `botToken`):
    * `categoryName: "Member"` và `categoryId: "1570349327572803715"` (khớp đúng category `Member` đang có trên server).
    * `deleteChannelOnLeave: true` (tự động xóa kênh `#ai-...` trên Discord khi thành viên rời server / bị kick qua `GUILD_MEMBER_REMOVE`, vẫn giữ nguyên thư mục sandbox trên máy).
* **Lý do kỹ thuật:** Đồng bộ tên category hiện tại trên Discord và tự động dọn kênh thành viên khi rời server theo yêu cầu.
* **Kiểm tra đã chạy:**
  * Kiểm tra `normalizeAutoOnboardConfig` sau khi ghi `config.json` -> xác nhận `categoryName: 'Member'`, `categoryId: '1570349327572803715'`, `deleteChannelOnLeave: true`, `allowClear: true`, `defaultModel: 'gemini-3.8-flash-low'`.
  * Khởi động lại qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `21604` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`.
  * `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:57847`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[onboard] Auto-onboard: bật (GUILD_MEMBERS active)`, `[slash] Synced 25 guild slash command(s) for guild 1570090644200755220.`, và `[guide] #instructions (1570105667941830898) is up to date.`.

---

## [2026-11-12 16:21] — Gia cố kiểm tra tầng sâu cho `/delete` chỉ xóa Thread (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs):
    * Bổ sung lớp chặn thứ hai trong `deleteDiscordThreadWithCleanup`: từ chối xóa nếu ID nằm trong `allowedChannelIds`, `freeChatChannelIds`, `channelRules`, `guideChannelId` hoặc `meta.type` không thuộc `THREAD_CHANNEL_TYPES` (đảm bảo kênh chính như `#admin`, `#projects`, `#ai-...` không bao giờ bị xóa nhầm qua `/delete`).
    * Làm rõ thông báo từ chối ở cả `onInteractionCreate` và `handleCommand` khi chạy `/delete` ngoài Thread (nhắc dùng `/clear` để dọn kênh chính).
* **Lý do kỹ thuật:** Phòng thủ nhiều lớp (defense-in-depth) đảm bảo `/delete` chỉ hoạt động bên trong Thread, không bao giờ xóa kênh chính.
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ 8 file `.mjs` -> `SYNTAX_OK` (exit code 0).
  * Khởi động lại qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `23336` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`.
  * `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:65263`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[slash] Synced 25 guild slash command(s) for guild 1570090644200755220.`, và `[guide] #instructions (1570105667941830898) is up to date.`.

---

## [2026-11-12 16:14] — Tự xóa tin nhắn khởi tạo Thread ở kênh cha khi xóa Thread (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs):
    * Khi `autoThread` tạo Thread từ tin nhắn gốc (`onMessageCreate`), lưu thêm `parentId` và `starterMessageId` vào `state.channels[threadId]`.
    * Bổ sung `deleteThreadStarterMessage(parentId, starterMessageId)` và `deleteDiscordThreadWithCleanup(threadId, parentIdHint)`: khi xóa Thread bằng `/delete` hoặc xóa trực tiếp trên giao diện Discord (`THREAD_DELETE`), bot sẽ xóa thêm tin nhắn gốc đã tạo Thread ở kênh cha (fallback dùng chính `threadId` làm `starterMessageId` cho Thread Public tạo từ tin nhắn nếu chưa lưu sẵn; tự bỏ qua lỗi `404`/`10008`/`403` nếu tin đã xóa hoặc Thread không có tin nhắn gốc).
    * Cập nhật mô tả `/delete` trong `getCommandDocs()` và đồng bộ lên `#instructions`.
  * Cập nhật [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md) và [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md).
* **Lý do kỹ thuật:** Trên Discord, xóa Thread không tự xóa tin nhắn gốc ở kênh cha, làm kênh riêng của thành viên vẫn bị sót tin nhắn mở đầu sau khi `/delete`.
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ 8 file `.mjs` -> `SYNTAX_OK` (exit code 0).
  * Khởi động lại qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `10940` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`.
  * `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:53400`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[slash] Synced 25 guild slash command(s) for guild 1570090644200755220.`, và `[guide] Updated 1 guide message(s) in #instructions (1570105667941830898).`.

---

## [2026-11-12 16:08] — Cho phép thành viên dùng `/clear` dọn kênh riêng của họ (`lib/slash.mjs`, `lib/auth.mjs`, `lib/onboard.mjs`, `bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * [`lib/slash.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/slash.mjs): chuyển `/clear` thành `memberCmd` để hiển thị trong menu `/` cho thành viên (nâng danh sách lệnh thành viên lên 7 lệnh: `help`, `status`, `new`, `delete`, `stop`, `usage`, `clear`; còn 18 lệnh Admin).
  * [`lib/auth.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/auth.mjs): thêm `/clear` vào `MEMBER_ALLOWED_COMMANDS`, mặc định `allowClear: true` cho `normalizeAutoOnboardConfig` và cho kênh có `onboardedUserId` (vẫn chặn ở kênh nhóm dùng chung nếu không bật `allowClear`).
  * [`lib/onboard.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/onboard.mjs): bật `allowClear: autoCfg?.allowClear !== false` khi tạo phòng mới và cập nhật tin nhắn chào mừng; đồng thời bật `allowClear: true` cho kênh `#ai-liemdaibomay` trong `config.json`.
  * [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): thêm kiểm tra chính chủ khi thành viên chạy `/clear` bên trong Thread, cập nhật danh sách lệnh động khi từ chối quyền trong `handleCommand`.
  * Cập nhật [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md) và [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md).
* **Lý do kỹ thuật:** Cho phép thành viên tự dọn dẹp tin nhắn bừa bộn trong kênh AI riêng (mà vẫn bảo vệ kênh dùng chung/kênh ngoài phạm vi).
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ 8 file `.mjs` -> Đạt (exit code 0).
  * Kiểm thử `MEMBER_CLEAR_TESTS_PASSED` -> Đạt (7 lệnh member gồm `clear`, kênh onboarded bật `allowClear`, kênh chung mặc định `false`).
  * Khởi động lại qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `12964` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`.
  * `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:64617`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[slash] Synced 25 guild slash command(s) for guild 1570090644200755220.`, và `[guide] Updated 1 guide message(s) in #instructions (1570105667941830898).`.

---

## [2026-11-12 16:02] — Chuyển toàn bộ bot sang sử dụng hoàn toàn Slash Commands (`/`) (`bot.mjs`, `lib/*.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Ngừng thực thi tiền tố `!` trong `onMessageCreate` của [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs); nếu người dùng gõ nhầm lệnh `!tên_lệnh` thuộc 25 lệnh của bot thì trả nhắc chuyển sang `/` (tránh đẩy nhầm vào `agy`), đồng thời giữ hỗ trợ gõ `/tên_lệnh` dạng text (hữu ích trong DM) đi qua `canExecuteDiscordCommand`.
  * Chuyển toàn bộ chuỗi lệnh chuẩn hóa, tài liệu nội bộ, RBAC (`MEMBER_ALLOWED_COMMANDS`), thông báo cú pháp/lỗi, lời chào onboarding và `#instructions` sang `/` trong [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs), [`lib/slash.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/slash.mjs) (`interactionToCommand`), [`lib/auth.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/auth.mjs), [`lib/cron.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/cron.mjs), và [`lib/onboard.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/onboard.mjs).
  * Điều chỉnh `/clear` khi gọi từ Slash Interaction trả summary qua ephemeral `@original` thay vì đăng thêm tin nhắn tạm ra kênh vừa xóa.
  * Cập nhật [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md) và [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md).
* **Lý do kỹ thuật:** Đồng nhất 100% trải nghiệm Slash Command (`/`) trên toàn bộ bot và giao diện thành viên, loại bỏ tiền tố `!` cũ.
* **Kiểm tra đã chạy:**
  * `node --check` trên toàn bộ 8 file `.mjs` -> Đạt (exit code 0).
  * Kiểm thử `SLASH_ONLY_TESTS_PASSED` -> Đạt (25 Slash Commands, RBAC `/help` vs `/access`, `interactionToCommand`).
  * Khởi động lại qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `18364` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`.
  * `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:64564`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[free-chat] Ready on #admin (1570109656632918037)`, `[slash] Synced 25 guild slash command(s) for guild 1570090644200755220.`, và `[guide] Updated 1 guide message(s) in #instructions (1570105667941830898).`.

---

## [2026-11-12 15:54] — Triển khai Slash Commands `/` song song với `!` (`lib/slash.mjs`, `bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Tạo [`lib/slash.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/lib/slash.mjs) định nghĩa 25 Slash Commands `/` (19 lệnh Admin gắn `default_member_permissions: "8"` tự ẩn khỏi thành viên thường trên Discord UI; 6 lệnh thành viên `help`, `status`, `new`, `delete`, `stop`, `usage`), trình phân tích options/subcommands (`parseInteractionOptions`, `interactionToBangCommand`) và trình gợi ý autocomplete động (`buildAutocompleteChoices`).
  * Cập nhật [`bot.mjs`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/bot.mjs): đồng bộ lệnh theo từng Guild khi `READY` (`syncGuildSlashCommands`), làm ấm danh sách model (`getAgyModelsCached`), xử lý `INTERACTION_CREATE` (`type: 4` autocomplete và `type: 2` thực thi qua `interactionReplyStorage` `AsyncLocalStorage`, ACK ephemeral trước khi xóa Thread ở `/delete`, `/clear` ephemeral, kiểm tra RBAC phía server) và cập nhật hướng dẫn `#instructions` (`buildGuideMessages`) kèm gợi ý `/`.
  * Cập nhật [`README.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/README.md) và [`AGENTS.md`](file:///c:/Users/Admin/.gemini/antigravity/scratch/discord-agy-bridge/AGENTS.md).
* **Lý do kỹ thuật:** Giúp người dùng và thành viên chọn lệnh nhanh qua menu `/` kèm mô tả tham số và autocomplete động, tách biệt menu Admin khỏi thành viên thường nhưng vẫn giữ nguyên 100% tập lệnh tiền tố `!`.
* **Kiểm tra đã chạy:**
  * `node --check` toàn bộ 8 file `.mjs` -> Đạt (exit code 0).
  * Khởi động lại daemon qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `10424` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`.
  * `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:50429`, `[gateway] Ready as AM#7297`, `[free-chat] Ready on #admin`, `[slash] Synced 25 guild slash command(s) for guild 1570090644200755220.`, và `[guide] Updated 1 guide message(s) in #instructions`.

---

## [2026-11-12 15:47] — Cho phép thành viên dùng `!delete` xóa chính Thread của mình (`lib/auth.mjs`, `lib/onboard.mjs`, `bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Bổ sung `!delete` vào `MEMBER_ALLOWED_COMMANDS` ([`lib/auth.mjs`](./lib/auth.mjs)) và cập nhật tin chào trong [`lib/onboard.mjs`](./lib/onboard.mjs).
  * Lưu `ownerUserId` khi bot tự mở Thread trong `onMessageCreate()` và thêm kiểm tra quyền sở hữu `isThreadOwnedByUser()` cho lệnh `!delete` trong [`bot.mjs`](./bot.mjs) (xác minh theo `chState.ownerUserId`, `threadMeta.owner_id`, hoặc tác giả tin nhắn gốc `starter.author.id` khi bot auto-create thread): thành viên xóa được Thread của chính mình (kể cả trong phòng chung) nhưng bị chặn xóa Thread của người khác hoặc Admin.
  * Cập nhật mô tả `!delete` hiển thị trong `#instructions` và thông báo lệnh khả dụng cho thành viên.
* **File / Thành phần tác động:**
  * [`lib/auth.mjs`](./lib/auth.mjs), [`lib/onboard.mjs`](./lib/onboard.mjs), [`bot.mjs`](./bot.mjs), [`CHANGELOG.md`](./CHANGELOG.md)
* **Kiểm tra đã chạy:**
  * `node --check` trên `bot.mjs` và toàn bộ `lib/*.mjs` (exit code 0), cùng test `MEMBER_DELETE_CHECK_OK`.
  * Khởi động lại daemon qua `stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid=9004` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`, `bot.log` xác nhận `[gateway] Ready as AM#7297` và `[guide] Updated 1 guide message(s) in #instructions (1570105667941830898).`.

---

## [2026-11-12 15:40] — Tìm kiếm `@tên` / `#kênh` theo tên trong `!access` khi chạy từ kênh Private (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Khi Admin gõ `@bakemono` bên trong kênh Private như `#admin` (nơi thành viên đó không có quyền xem), Discord không tự chuyển `@bakemono` thành mention `<@userId>` nên `extractSnowflakeId()` không nhận ra.
  * Thêm `resolveDiscordMemberToken()` (`GET /guilds/<guildId>/members/search`) và `resolveDiscordChannelToken()` (`GET /guilds/<guildId>/channels`) dùng chung cho `!access model`, `!access onboard`, `!access offboard`, và `!access private` để nhận diện mượt cả mention `<@...>`, user ID, tên/display-name thường (`@bakemono`, `bakemono`, `liemdaibomay`), lẫn `#tên-kênh`.
* **File / Thành phần tác động:**
  * [`bot.mjs`](./bot.mjs), [`CHANGELOG.md`](./CHANGELOG.md)
* **Kiểm tra đã chạy:**
  * `node --check bot.mjs` (exit code 0) và kiểm tra thực tế `GET /guilds/.../members/search?query=bakemono` trả về đúng `695586472966750240`.

---

## [2026-11-12 15:36] — Tách riêng & khóa Model cho thành viên (`!access model`, `autoOnboard.defaultModel`, `rule.model`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Mở rộng [`lib/auth.mjs`](./lib/auth.mjs): thêm `model`/`effort` vào `channelRules`, `defaultModel`/`defaultEffort` vào `autoOnboard`, `forcedModel`/`forcedEffort` vào `createMemberPolicy()` và `resolveTurnExecutionPolicy()`, hỗ trợ `model:<id>` và `effort:<level>` trong `parseAccessChannelCommand()` (giữ tương thích `model:on|off`), và hiển thị cấu hình model trong `formatAccessSummary()`.
  * Mở rộng [`lib/onboard.mjs`](./lib/onboard.mjs): khi onboard thành viên mới tự gắn `autoOnboard.defaultModel` / `autoOnboard.defaultEffort` vào rule mới nếu đã cấu hình.
  * Mở rộng [`bot.mjs`](./bot.mjs):
    * Thêm lệnh Admin `!access model` (xem cấu hình; `!access model auto <model_id|clear> [effort]` để đặt mặc định riêng cho người mới join mà không ảnh hưởng Admin; `!access model <@user|#kênh> <model_id|clear> [effort]` để khóa model cho phòng của từng thành viên và mọi Thread đang mở/mới).
    * Cập nhật `runAgyPrint()`, `!status`, `!model`, và `formatFooter()` dùng `execPolicy.model` / `execPolicy.effort` để model bị khóa luôn có hiệu lực nhất quán kể cả trong Thread cũ.
  * Cập nhật [`config.example.json`](./config.example.json), [`README.md`](./README.md) và [`AGENTS.md`](./AGENTS.md).
* **File / Thành phần tác động:**
  * [`lib/auth.mjs`](./lib/auth.mjs), [`lib/onboard.mjs`](./lib/onboard.mjs), [`bot.mjs`](./bot.mjs), [`config.example.json`](./config.example.json), [`README.md`](./README.md), [`AGENTS.md`](./AGENTS.md), [`CHANGELOG.md`](./CHANGELOG.md)
* **Kiểm tra đã chạy:**
  * `node --check` trên `bot.mjs` và toàn bộ `lib/*.mjs` (`ALL_SYNTAX_OK`, exit code 0).
  * Chạy test inline `MEMBER_MODEL_TESTS_PASSED`: kiểm tra `normalizeAutoOnboardConfig` (`defaultModel`/`defaultEffort`), `normalizeChannelRules` (`model`/`effort`), `resolveTurnExecutionPolicy` (ép `forcedModel`/`forcedEffort` cho Member kể cả khi `chState.model` khác, không ảnh hưởng Admin), `parseAccessChannelCommand` (`model:on` vs `model:<id>`/`effort:<level>`), `onboardMember` kế thừa `autoOnboard.defaultModel` và `formatAccessSummary`.
  * Khởi động lại daemon qua `stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid=4428` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`, `bot.log` xác nhận `[gateway] Ready as AM#7297`, `[onboard] Auto-onboard: bật (GUILD_MEMBERS active)` và `[free-chat] Ready on #admin (1570109656632918037) (no project).`.

---

## [2026-11-12 15:29] — Chặn tạo Private Thread, Reaction, Voice & Poll trên `#instructions` (`lib/onboard.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Bổ sung `CREATE_PRIVATE_THREADS` (`1n << 36n`), `ADD_REACTIONS` (`1n << 6n`), `SEND_VOICE_MESSAGES` (`1n << 46n`), và `SEND_POLLS` (`1n << 49n`) vào `READ_ONLY_DENY_MASK` (và thêm `CREATE_PRIVATE_THREADS` vào `READ_ONLY_MIN_DENY_MASK`) trong [`lib/onboard.mjs`](./lib/onboard.mjs), đồng thời cập nhật kiểm tra `existingOverwrites` bằng `READ_ONLY_MIN_DENY_MASK` để kênh `#instructions` tự động nâng cấp quyền chặn đầy đủ cả Thread công khai lẫn riêng tư.
  * Xóa thread thử nghiệm `nnniii` (`1570354424965238934`) còn sót trong `#instructions`.
* **File / Thành phần tác động:**
  * [`lib/onboard.mjs`](./lib/onboard.mjs), [`CHANGELOG.md`](./CHANGELOG.md)
* **Kiểm tra đã chạy:**
  * `node --check lib/onboard.mjs`, `node --check bot.mjs` (exit code 0) và test `TESTS_OK_DEL_THREAD_STATUS=200`.

---

## [2026-11-12 15:25] — Khóa chỉ-đọc `#instructions` và ẩn toàn bộ lệnh Admin khỏi hướng dẫn công khai (`lib/onboard.mjs`, `bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Thêm `setChannelReadOnly()` trong [`lib/onboard.mjs`](./lib/onboard.mjs): giữ nguyên quyền gửi/quản lý cho bot **AM**, đồng thời chặn `@everyone` `SEND_MESSAGES` / `CREATE_PUBLIC_THREADS` / `SEND_MESSAGES_IN_THREADS` (kèm fallback `PERM_SEND_MESSAGES` khi gặp `403` và skip idempotent nếu quyền đã khớp).
  * Cập nhật `syncGuideChannel()` và `buildGuideMessages()` trong [`bot.mjs`](./bot.mjs):
    * Tự động ép kênh `#instructions` về chế độ **chỉ đọc** đối với `@everyone` mỗi khi đồng bộ hướng dẫn.
    * Lọc nội dung đăng lên `#instructions` chỉ còn các lệnh dành cho thành viên (`MEMBER_ALLOWED_COMMANDS`: `!help`, `!status`, `!new`, `!stop`, `!usage`), bỏ toàn bộ lệnh Admin (`!cron`, `!webhook`, `!access`, `!chrome`, `!windows`, `!logs`, `!project`, `!mode`, `!sandbox`, v.v.) và tên các kênh riêng tư (`#projects`, `#admin`). Admin vẫn xem đầy đủ lệnh bằng `!help` tại kênh quản trị/DM.
* **File / Thành phần tác động:**
  * [`lib/onboard.mjs`](./lib/onboard.mjs), [`bot.mjs`](./bot.mjs), [`AGENTS.md`](./AGENTS.md), [`CHANGELOG.md`](./CHANGELOG.md)
* **Kiểm tra đã chạy:**
  * `node --check bot.mjs`, `node --check lib/onboard.mjs` (exit code 0).
  * Chạy test inline `SET_CHANNEL_READ_ONLY_TESTS_OK` (cấp quyền bot trước, deny send/thread với fallback 403, và bỏ qua khi quyền đã đặt sẵn).

---

## [2026-11-12 15:18] — Ghim ID kênh `#admin` (đổi tên từ `#free-chat`) vào `config.json`
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Khi người dùng đổi tên `#free-chat` → `#admin` trên Discord, sự kiện `CHANNEL_UPDATE` gỡ kênh khỏi `freeChatChannelIds` vì trước đó kênh chỉ được nhận diện theo tên `freeChatChannelName = "free-chat"`.
  * Cập nhật `config.json` cục bộ với `freeChatChannelId: "1570109656632918037"` và `freeChatChannelName: "admin"` để ghim cố định theo Channel ID (đổi tên về sau không bị mất kết nối).
* **File / Thành phần tác động:**
  * `config.json` (cục bộ), [`CHANGELOG.md`](./CHANGELOG.md)
* **Kiểm tra đã chạy:**
  * Khởi động lại daemon `AntigravityDiscordBridge` và xác nhận `bot.log` nhận diện `#admin (1570109656632918037)`.

---

## [2026-11-12 15:11] — Sửa lỗi thứ tự cấp quyền trong `setChannelPrivacy` khiến bot tự khóa `VIEW_CHANNEL` khi chạy `!access private` (`lib/onboard.mjs`, `bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Khắc phục lỗi trong `setChannelPrivacy()` và `ensurePrivatePermissions()` ([`lib/onboard.mjs`](./lib/onboard.mjs)): trước đây bot gửi `PUT .../permissions/<guildId>` (`deny: VIEW_CHANNEL`) **trước** khi cấp quyền `allow` cho chính bot **AM**, khiến ngay sau bước 1 bot bị mất quyền nhìn thấy kênh đang thao tác và lập tức dính `403 Missing Permissions` ở bước 2.
  * Tách helper `ensureBotChannelAccess()` cấp quyền rõ ràng cho `botUserId` **trước tiên** (kèm fallback sang `BOT_MIN_CHANNEL_ALLOW_MASK` nếu bot thiếu quyền phụ như `Manage Threads`), rồi mới chặn `@everyone`.
  * Cập nhật thông báo lỗi `403` của `!access private` trong [`bot.mjs`](./bot.mjs) để nêu đúng 2 nguyên nhân (`Manage Roles / Manage Permissions` hoặc kênh đã bị tắt `View Channel` với bot).
* **File / Thành phần tác động:**
  * [`lib/onboard.mjs`](./lib/onboard.mjs), [`bot.mjs`](./bot.mjs), [`CHANGELOG.md`](./CHANGELOG.md)
* **Kiểm tra đã chạy:**
  * `node --check bot.mjs`, `node --check lib/onboard.mjs` (exit code 0).
  * Chạy test inline `SET_CHANNEL_PRIVACY_ORDER_AND_FALLBACK_OK` xác nhận `PUT .../permissions/<botId>` luôn chạy trước `PUT .../permissions/<guildId>` và tự fallback về `BOT_MIN_CHANNEL_ALLOW_MASK` khi gặp `403`.

---

## [2026-11-12 15:06] — Tự động hóa 100% onboarding thành viên mới & kênh Private sandbox (`lib/onboard.mjs`, `bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Tạo module [`lib/onboard.mjs`](./lib/onboard.mjs) (`createMemberProvisioner`, `sanitizeMemberSlug`): tự động tạo thư mục sandbox `<rootDir>\<slug>` (mặc định `C:\Users\Admin\DiscordShared\<user>`), tự tạo category `Member Workspaces` nếu chưa có, tạo kênh text Private `#ai-<slug>` (chặn `@everyone` `VIEW_CHANNEL`, cấp quyền riêng cho member + bot `AM`), lưu rule RBAC (kèm `onboardedUserId`, `sandbox: true`, `allowNonWorkspaceAccess: false`, tắt Desktop/Chrome) vào `config.json`, gửi tin nhắn chào mừng và hỗ trợ khôi phục idempotent khi thành viên join lại.
  * Mở rộng [`lib/utils.mjs`](./lib/utils.mjs) (`quoteSnowflakeLiterals` cho `onboardedUserId`, `categoryId`, `allowGuildIds`) và [`lib/auth.mjs`](./lib/auth.mjs) (`normalizeAutoOnboardConfig`, `onboardedUserId` trong `channelRules`, hiển thị trạng thái Auto-Onboard trong `formatAccessSummary`).
  * Cập nhật [`bot.mjs`](./bot.mjs):
    * Hỗ trợ Privileged Intent `GUILD_MEMBERS` (`1 << 1`) kèm cơ chế graceful fallback khi Gateway đóng với mã `4014` nếu người dùng chưa bật `Server Members Intent` trên Discord Developer Portal (bot vẫn online, `!reload` tự thử kích hoạt lại intent).
    * Xử lý sự kiện `GUILD_MEMBER_ADD` và `GUILD_MEMBER_REMOVE` tự động.
    * Bổ sung các lệnh `!access auto [on|off]`, `!access onboard <@user|id>`, `!access offboard <@user|id> [--delete-channel]`, `!access private <#kênh|id> [on|off]` và thông báo thân thiện khi bot thiếu quyền `Manage Channels` (`403`).
  * Tạo sẵn thư mục sandbox `C:\Users\Admin\DiscordShared\bakemono` và cập nhật [`config.example.json`](./config.example.json), [`README.md`](./README.md), [`AGENTS.md`](./AGENTS.md).
* **File / Thành phần tác động (trong & ngoài repo):**
  * Trong repo: [`lib/onboard.mjs`](./lib/onboard.mjs), [`lib/auth.mjs`](./lib/auth.mjs), [`lib/utils.mjs`](./lib/utils.mjs), [`bot.mjs`](./bot.mjs), [`config.example.json`](./config.example.json), [`README.md`](./README.md), [`AGENTS.md`](./AGENTS.md), [`CHANGELOG.md`](./CHANGELOG.md).
  * Ngoài repo: tạo thư mục trống `C:\Users\Admin\DiscordShared\bakemono`.
* **Kiểm tra đã chạy:**
  * `node --check` trên `bot.mjs` và toàn bộ `lib/*.mjs` (exit code 0).
  * Chạy unit test `verify_onboard.mjs` (đã dọn sau khi chạy): pass kiểm tra Snowflake `quoteSnowflakeLiterals`, `sanitizeMemberSlug`, `normalizeAutoOnboardConfig`, `formatAccessSummary`, `onboardMember` + idempotency, `setChannelPrivacy`, và `offboardMember` (`deleteChannel: false/true`).
  * Khởi động lại daemon qua `stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid=17212` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`, `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:59105`, `[cron] Scheduler active (0 enabled job(s)).`, `[gateway] Ready as AM#7297 (1570088887156604992)`, `[onboard] Auto-onboard: bật (GUILD_MEMBERS active)`, và `[guide] Updated 1 guide message(s) in #instructions (1570105667941830898).`.

---

## [2026-11-12 14:42] — Phát triển theo 2 hướng: Automation Hub + RBAC đa người dùng và tự chủ Pipeline Desktop/Browser (`bot.mjs`, `lib/*.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * **Kiến trúc module hóa thuần Node.js (`0` dependencies / không `node_modules`):** Tách logic chuyên biệt sang thư mục [`lib/`](./lib) gồm [`lib/utils.mjs`](./lib/utils.mjs), [`lib/auth.mjs`](./lib/auth.mjs), [`lib/desktop.mjs`](./lib/desktop.mjs), [`lib/cron.mjs`](./lib/cron.mjs), [`lib/webhook.mjs`](./lib/webhook.mjs), giữ [`bot.mjs`](./bot.mjs) làm Gateway, runner & bộ điều phối trung tâm.
  * **Hướng 1A — Phân quyền nhóm / gia đình (RBAC):**
    * Giữ DM và quyền hệ thống cho Root Admin (`allowedUserId`) và `adminUserIds`; thêm `channelRules` trong `config.json` / [`config.example.json`](./config.example.json) (tự động kế thừa xuống các Thread con).
    * Phiên của thành viên không phải Admin (`Member`) bị khóa chặt trong `cwd` an toàn của kênh + `sandbox: true` + `allowNonWorkspaceAccess: false`, chặn các lệnh quản trị (`!project`, `!mode`, `!sandbox`, `!cron`, `!webhook`, `!access`, `!chrome`, `!windows`, `!reload`, v.v.), thu hẹp MCP tool qua `AGY_DISCORD_ALLOWED_TOOLS=send_to_discord` kèm kiểm tra đường dẫn canonical `isPathInsideDir()` ở cả `send_to_discord` lẫn `extractUnsentMarkdownImages()`.
    * Thêm lệnh `!access` (`list`, `channel`, `revoke`, `admin add|remove`) và `!reload` nạp nóng `config.json`.
  * **Hướng 1B — Automation Hub (Cron & HTTP Webhook):**
    * [`lib/cron.mjs`](./lib/cron.mjs): Lưu job bền vững tại `state.crons`, hỗ trợ `every`, `in`, `daily HH:MM`, và biểu thức cron POSIX 5 trường; tự mở Thread hoặc chạy trực tiếp trong kênh; thêm lệnh `!cron` (`list`, `add`, `pause`, `resume`, `del`, `run`).
    * [`lib/webhook.mjs`](./lib/webhook.mjs): HTTP Server mặc định `127.0.0.1` (`POST /webhook/<hookId>`, `GET /health`), hỗ trợ xác thực `Bearer`, `X-Webhook-Secret`, HMAC-SHA256 (`X-Hub-Signature-256`), rate limit, `dedupWindowSec`, stage payload >2500 ký tự ra tệp cho `agy`, trả `202 Accepted` ngay rồi mở Thread chẩn đoán chạy theo policy riêng; thêm `!webhook [status | test <hookId>]`.
  * **Hướng 2 — Tự chủ Pipeline Desktop & Chrome AM:**
    * Bổ sung pre-check `getChromeAmStatus()` (`127.0.0.1:9229`) trong `buildEffectivePrompt()` để báo thẳng trạng thái Chrome AM đang bật/tắt thay vì để `chrome-devtools` tự đâm đầu vào `ECONNREFUSED` ~6 giây ở lượt đầu.
    * Thêm 3 MCP tool mới trong `discord-bridge-desktop`: `capture_desktop` (chụp toàn màn hình hoặc 1 cửa sổ DPI-aware kèm `send_to_discord`), `desktop_clipboard` (`get`/`set` UTF-8), `desktop_windows` (`list`/`focus`/`close` có danh sách tiến trình hệ thống được bảo vệ, kèm `close_chrome_am` đóng riêng Chrome AM), và tham số `delete_after_send` trên `send_to_discord` (có bảo vệ file trong workspace ngay cả khi workspace nằm dưới `%TEMP%`).
    * Thêm các lệnh Admin `!chrome [status | close]`, `!windows [list | focus | close]`, `!cleanup`, `!logs [N]` (tự che `botToken`/webhook secret), cập nhật hướng dẫn `#instructions`, [`README.md`](./README.md) và [`AGENTS.md`](./AGENTS.md).
* **File / Thành phần tác động:**
  * [`bot.mjs`](./bot.mjs), [`lib/utils.mjs`](./lib/utils.mjs), [`lib/auth.mjs`](./lib/auth.mjs), [`lib/desktop.mjs`](./lib/desktop.mjs), [`lib/cron.mjs`](./lib/cron.mjs), [`lib/webhook.mjs`](./lib/webhook.mjs), [`config.example.json`](./config.example.json), [`README.md`](./README.md), [`AGENTS.md`](./AGENTS.md), [`CHANGELOG.md`](./CHANGELOG.md)
* **Kiểm tra đã chạy:**
  * `node --check` trên `bot.mjs`, `lib/utils.mjs`, `lib/auth.mjs`, `lib/desktop.mjs`, `lib/cron.mjs`, `lib/webhook.mjs` (tất cả exit code 0).
  * Chạy script kiểm thử tích hợp `verify_hub.mjs` (đã dọn sau khi chạy): pass **11/11 nhóm test** (Snowflake & `isPathInsideDir` traversal guard; DM Admin/Member & kế thừa RBAC xuống Thread; `!access` parser & summary; `filterMcpTools`, khóa biên `send_to_discord` & bảo vệ workspace cho `delete_after_send`; `manageDesktopWindows("list")` & `getChromeAmStatus()` live; lịch `cron` `every`/`daily`/POSIX 5 trường + vòng đời `pause`/`resume`/trigger 1 lần; HTTP Webhook loopback `127.0.0.1` xác thực `Bearer`/`HMAC-SHA256`, `403`/`401`/`404`/`429`, `dedupWindowSec`, stage >2500 chars; và `node bot.mjs --mcp-stdio` cho Admin vs Member vs ngoài bridge).
  * Khởi động lại daemon qua `stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid=9876` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`, `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:52852`, `[cron] Scheduler active (0 enabled job(s)).`, `[gateway] Ready as AM#7297`, và `[guide] Published 4 guide message(s) to #instructions`.

---

## [2026-11-12 14:09] — Đối chiếu hint trên `rawPrompt` để tránh chèn nhầm `CHROME_DEVTOOLS_FAST_GUIDE` khi đính kèm file (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Mở rộng [`buildEffectivePrompt(chState, prompt, hintText = prompt)`](./bot.mjs) để kiểm tra `WEB_BROWSER_HINT_RE` và `DESKTOP_OPEN_HINT_RE` theo `hintText`.
  * Trong `processPrompt()`, truyền `rawPrompt` làm `hintText` khi gọi `buildEffectivePrompt(chState, promptWithAttachments, rawPrompt)` — tránh việc chuỗi `images/PDF/audio/video` trong `[Discord Attachment Note: ...]` tự khớp từ khóa `/video` và chèn nhầm `CHROME_DEVTOOLS_FAST_GUIDE` vào các tin nhắn gửi ảnh/âm thanh/tài liệu không dùng trình duyệt.
* **File / Thành phần tác động:**
  * [`bot.mjs`](./bot.mjs), [`CHANGELOG.md`](./CHANGELOG.md)
* **Kiểm tra đã chạy:**
  * `node --check bot.mjs` (exit code 0).
  * Chạy 4 test case VM trên `buildEffectivePrompt()` (truyền attachment note có chữ `video`): pass 4/4 (chỉ chèn `CHROME_DEVTOOLS_FAST_GUIDE` khi `rawPrompt` thực sự khớp từ khóa web, đồng thời vẫn giữ `Discord Bridge Runtime Note` khi `rawPrompt` nhắc `gửi`/`ảnh` hoặc ở lượt đầu).
  * Khởi động lại daemon qua `stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid=6472` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`, `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:53013` và `[gateway] Ready as AM#7297`.

---

## [2026-11-12 13:58] — Hỗ trợ gửi ảnh & file 2 chiều (Discord ↔ `agy`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * **Discord → `agy`:**
    * Thêm `downloadIncomingAttachments()`, `sanitizeAttachmentFilename()`, `isAllowedDiscordAttachmentUrl()` và `formatByteSize()` trong [`bot.mjs`](./bot.mjs): kiểm tra URL CDN HTTPS của Discord (`*.discordapp.com` / `*.discordapp.net`), giới hạn `25MB` (`MAX_INCOMING_ATTACHMENT_BYTES`), tạo tên tệp không trùng (`<messageId>-<index>-<safeName>`) trong `~/.gemini/antigravity-cli/discord-attachments/<channelId>/`.
    * Hỗ trợ tin nhắn Discord chỉ gửi ảnh/tệp không có nội dung chữ (`onMessageCreate()` / `processPrompt()`), truyền `--add-dir <attachChannelDir>` kèm đường dẫn cục bộ và ghi chú đọc trực tiếp bằng `read_file` (hoặc python/node cho file nhị phân/bảng tính).
    * Tự dọn tệp đính kèm cũ quá 7 ngày khi khởi động (`pruneOldDiscordAttachments()`), và xóa thư mục `discord-attachments/<threadId>` khi `!delete` hoặc `THREAD_DELETE` (`deleteChannelAttachmentsDir()` trong `deleteThreadSession()`).
  * **`agy` → Discord:**
    * Mở rộng `discordRequest()` hỗ trợ `FormData` (`multipart/form-data`, tự bỏ qua header `Content-Type: application/json`).
    * Thêm MCP tool `send_to_discord({ path | paths, message? })` trong `discord-bridge-desktop` (`MCP_TOOLS`, truyền `AGY_DISCORD_CHANNEL_ID` và `AGY_DISCORD_RUN_ID` qua `runAgy()` -> `runMcpStdioMode()` -> `startMcpBridgeServer()` -> `handleDesktopOpenTool()`).
    * Hàm `sendDiscordAttachments()` tự chặn tải lên `config.json` (bảo vệ `botToken`), kiểm tra tệp tồn tại/`25MB` cap, chia batch tối đa `10` tệp/tin nhắn Discord, báo lỗi rõ khi chạm giới hạn `~10MB` HTTP `413`/`40005` và theo dõi `activeRunSentFiles` theo `runId`.
    * Bổ sung fallback `extractUnsentMarkdownImages()` cuối `processPrompt()` để tự động gửi các ảnh cục bộ dạng `![alt](localPath)` chưa gửi qua `send_to_discord`.
    * Cập nhật `DESKTOP_OPEN_HINT_RE`, `CHROME_DEVTOOLS_FAST_GUIDE` (nhắc dùng `filePath` khi `take_screenshot` để gửi qua `send_to_discord`), `buildEffectivePrompt()`, `MCP_ACTION_LABELS` / `describeAgyToolStep()`, `setPhase()` khi tải tệp, và hướng dẫn trong `buildGuideMessages()`.
  * Cập nhật tài liệu [`README.md`](./README.md) và [`AGENTS.md`](./AGENTS.md).
* **File / Thành phần tác động:**
  * [`bot.mjs`](./bot.mjs), [`README.md`](./README.md), [`AGENTS.md`](./AGENTS.md), [`CHANGELOG.md`](./CHANGELOG.md)
* **Kiểm tra đã chạy:**
  * `node --check bot.mjs` (exit code 0).
  * Chạy script kiểm thử VM + `--mcp-stdio` end-to-end tạm (`verify_attachments.mjs`, đã dọn sau khi chạy): pass **9/9 nhóm test** (`sanitizeAttachmentFilename`/`isAllowedDiscordAttachmentUrl`, `downloadIncomingAttachments` chống trùng tên & giới hạn 25MB/host, `resolveLocalFilePath`, `discordRequest` `FormData` + batch 12 tệp = 10+2 + chặn `config.json` + xử lý HTTP `413`/`40005`, `handleDesktopOpenTool("send_to_discord")`, `extractUnsentMarkdownImages`, `buildEffectivePrompt` + `describeAgyToolStep`, `pruneOldDiscordAttachments` + `deleteChannelAttachmentsDir`, và `node bot.mjs --mcp-stdio` trả `tools: []` ngoài bridge vs chuyển tiếp `send_to_discord` + `channelId` + `runId` trong phiên bridge).
  * Khởi động lại daemon qua `stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid=8568` khớp đúng 1 tiến trình `node.exe ... bot.mjs --log`, `bot.log` xác nhận `[mcp] Desktop bridge listening on 127.0.0.1:53145`, `[gateway] Ready as AM#7297`, và `[guide] Published 3 guide message(s) to #instructions`.

---

## [2026-11-12 11:36] — Tinh chỉnh `CHROME_DEVTOOLS_FAST_GUIDE` tránh nhầm `format:"script"` & gộp polling trong 1 `async evaluate_script` (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Sửa `CHROME_DEVTOOLS_FAST_GUIDE` trong [`bot.mjs`](./bot.mjs):
    * Bỏ lựa chọn `"script"` khỏi chữ ký gợi ý của `evaluate_script` và nhắc bỏ trống `format` (mặc định `"function"`), viết dạng `async () => { ... }` để tránh trường hợp trả về `undefined` rồi phải `read_file` lại `evaluate_script.json`.
    * Nhấn mạnh gộp thao tác nhiều bước trên DOM (cuộn + vòng lặp polling đợi lazy-load + focus/nhập/submit) vào **1 lần `async evaluate_script` duy nhất** thay vì chia nhỏ từng bước thăm dò rời rạc.
* **File / Thành phần tác động:**
  * [`bot.mjs`](./bot.mjs), [`CHANGELOG.md`](./CHANGELOG.md)
* **Kiểm tra đã chạy:**
  * `node --check bot.mjs` (exit code 0) và test `buildEffectivePrompt` xác nhận nội dung hướng dẫn mới pass (đã dọn file test tạm).
  * Khởi động lại `AntigravityDiscordBridge` qua `stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `1616` khớp đúng 1 tiến trình `node.exe --log`, `bot.log` ghi nhận `[mcp] Desktop bridge listening on 127.0.0.1:63369`, `[gateway] Ready as AM#7297` và `[guide] #instructions is up to date.`.

---

## [2026-11-12 11:22] — Bổ sung cheat-sheet `chrome-devtools` & hướng dẫn gộp thao tác vào prompt (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Tách `WEB_BROWSER_HINT_RE` khỏi `DESKTOP_OPEN_HINT_RE` và thêm `CHROME_DEVTOOLS_FAST_GUIDE` trong [`bot.mjs`](./bot.mjs):
    * Chèn sẵn chữ ký tham số tóm tắt của 12 tool `chrome-devtools` hay dùng (`list_pages`, `select_page`, `new_page`, `navigate_page`, `take_snapshot`, `wait_for`, `take_screenshot`, `click`, `fill`, `type_text`, `press_key`, `evaluate_script`) kèm tham số `discord-bridge-desktop` (`open_in_chrome`, `open_app`, `open_desktop_target`) để `agy` gọi thẳng qua `call_mcp_tool` mà không tốn vòng `read_file` đọc schema JSON.
    * Nhắc `agy` ưu tiên `evaluate_script` để gộp nhiều bước DOM trong 1 lần gọi, dùng `includeSnapshot: true` trên `click`/`fill`/`press_key` khi cần DOM mới, và bỏ qua `take_snapshot` xác nhận thừa sau bước cuối trên các trang SPA nặng như YouTube.
    * Chỉ chèn `CHROME_DEVTOOLS_FAST_GUIDE` khi prompt khớp `WEB_BROWSER_HINT_RE` để tránh làm nặng các lượt chat code thông thường.
  * Cập nhật [`AGENTS.md`](./AGENTS.md) ghi nhận cơ chế `WEB_BROWSER_HINT_RE` / `CHROME_DEVTOOLS_FAST_GUIDE`.
* **File / Thành phần tác động:**
  * [`bot.mjs`](./bot.mjs), [`AGENTS.md`](./AGENTS.md), [`CHANGELOG.md`](./CHANGELOG.md)
* **Kiểm tra đã chạy:**
  * `node --check bot.mjs` (exit code 0) và test kiểm tra `buildEffectivePrompt`, `WEB_BROWSER_HINT_RE`, `DESKTOP_OPEN_HINT_RE` pass (đã dọn file test tạm).
  * Khởi động lại `AntigravityDiscordBridge` qua `stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `12684` khớp đúng 1 tiến trình `node.exe --log`, `bot.log` ghi nhận `[mcp] Desktop bridge listening on 127.0.0.1:59117`, `[gateway] Ready as AM#7297` và `[guide] #instructions is up to date.`.

---

## [2026-11-12 11:07] — Review & gia cố edge case cho stream tiến độ (`bot.mjs`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Bổ sung `formatAgyFailureOutput()` trong [`bot.mjs`](./bot.mjs): ưu tiên `stderr` và lọc bỏ các dòng NDJSON tiến độ (`init`, `step_update`) khi `agy` thoát mã lỗi, tránh việc `init` (~1.4KB danh sách tool) che mất thông báo lỗi thật.
  * Cải thiện `createAgyStreamState().render()`: phát hiện block ```` ``` ```` bị cắt ngang ở đầu khi rút gọn phần xem trước (`omittedFences % 2 === 1`) để cân bằng dấu fence đúng cách thay vì để lệch markdown.
  * Mở rộng `describeAgyToolStep()` nhận diện thêm `sed_file`, `send_command_input`, `invoke_subagent` và xử lý trường hợp `call_mcp_tool` truyền `Arguments` dạng chuỗi JSON.
* **File / Thành phần tác động:**
  * [`bot.mjs`](./bot.mjs), [`CHANGELOG.md`](./CHANGELOG.md)
* **Kiểm tra đã chạy:**
  * `node --check bot.mjs` (exit code 0) và test kiểm tra `formatAgyFailureOutput`, cân bằng fence ```` ``` ```` khi cắt đầu/đuôi, và `describeAgyToolStep` đều pass; đã dọn file test tạm.
  * Khởi động lại `AntigravityDiscordBridge` qua `stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `11108` khớp đúng 1 tiến trình `node.exe --log`, `bot.log` ghi nhận `[mcp] Desktop bridge listening on 127.0.0.1:64212`, `[gateway] Ready as AM#7297` và `[guide] #instructions is up to date.`.

---

## [2026-11-12 11:02] — Stream tiến độ từng bước & nội dung trả lời trực tiếp (`--output-format stream-json`, `!stream`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Chuyển runner mặc định trong [`bot.mjs`](./bot.mjs) từ batch `--output-format json` sang `--output-format stream-json`:
    * `runAgy()` đọc stdout dạng NDJSON theo dòng theo thời gian thực (`onStdoutLine`) và flush sạch phần dư khi tiến trình đóng.
    * Thêm bộ dựng trạng thái & hiển thị tiến độ (`describeAgyToolStep`, `createAgyStreamState`, `createDiscordStreamTracker`) theo dõi sự kiện `init`, `step_update` (`tool` ACTIVE/DONE/ERROR, `agent_response` `text_delta`) và `result`, hiển thị tối đa 8 bước gần nhất, thời gian trôi, xem trước phần trả lời đang stream và tự đóng fence code ```` ``` ```` khi cắt ngắn dưới giới hạn 2000 ký tự của Discord.
    * Tuần tự hóa và giới hạn tần suất sửa tin nhắn tiến độ trên Discord (`STREAM_EDIT_INTERVAL_MS = 1400ms`, heartbeat `STREAM_HEARTBEAT_INTERVAL_MS = 5000ms`) để tránh đụng rate limit `429`, rồi tái sử dụng đúng tin nhắn đó (`editDiscordMessage` / `sendOrReplaceDiscordMessages`) cho câu trả lời hoàn chỉnh + footer, thông báo dừng (`!stop`), hoặc lỗi (tự fallback `POST` nếu tin nhắn tiến độ đã bị xóa).
    * Cập nhật `parseAgyOutput()` hỗ trợ unwrap `{"event":"result","result":{...}}` của `stream-json` và bổ sung `extractConversationIdFromAgyStdout()` để dọn dẹp đúng conversation khi xóa Thread giữa chừng.
  * Thêm cấu hình `streamProgress` (mặc định `true` trong `loadConfig()`, `config.example.json` và `getChannelState()`), thêm lệnh `!stream [on|off]`, cập nhật `!status`, `!help` và `#instructions`.
* **File / Thành phần tác động:**
  * [`bot.mjs`](./bot.mjs), [`config.example.json`](./config.example.json), [`README.md`](./README.md), [`AGENTS.md`](./AGENTS.md), [`CHANGELOG.md`](./CHANGELOG.md)
* **Kiểm tra đã chạy:**
  * `node --check bot.mjs` (exit code 0).
  * Bộ kiểm thử stream trên code thật của `bot.mjs` (trong sandbox `node:vm` + live E2E `agy.exe -p ... --output-format stream-json`): kiểm tra `parseAgyOutput`, `extractConversationIdFromAgyStdout`, `describeAgyToolStep`, `createAgyStreamState`, throttling/serialization/fallback 404 của `createDiscordStreamTracker`, và stream thật từ `agy.exe` (`init` -> `read_file` ACTIVE/DONE -> `text_delta` -> `result` thành công, 23,908 tokens).
  * Khởi động lại `AntigravityDiscordBridge` qua `stop.bat` -> `schtasks /Run /TN "AntigravityDiscordBridge"`: `bot.pid` = `9576` khớp đúng 1 tiến trình `node.exe`, `bot.log` ghi nhận `[mcp] Desktop bridge listening on 127.0.0.1:56862`, `[gateway] Ready as AM#7297` và `[guide] Updated 1 guide message(s) in #instructions`.

---

## [2026-11-12 10:35] — Thiết lập hệ thống lưu ngữ cảnh cho nhiều Agent (`AGENTS.md`, `CHANGELOG.md`, `CLAUDE.md`)
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Tạo [`CHANGELOG.md`](./CHANGELOG.md) ghi lại toàn bộ lịch sử xây dựng, cấu hình ngoài repo và các nâng cấp đã triển khai từ đầu dự án đến hiện tại, kèm template cập nhật bắt buộc cho các phiên agent sau.
  * Cập nhật [`AGENTS.md`](./AGENTS.md) bổ sung luật handoff liên-agent (luôn đọc ngữ cảnh trước khi sửa, luôn ghi log vào `CHANGELOG.md` sau khi làm xong) và cảnh báo môi trường `WinSta0\exebox-...` khi mở GUI từ terminal IDE.
  * Tạo [`CLAUDE.md`](./CLAUDE.md) làm pointer ngắn dẫn về `AGENTS.md` và `CHANGELOG.md` cho các coding agent khác ngoài Antigravity.
  * Cập nhật [`README.md`](./README.md) bổ sung thông tin tích hợp Chrome AM / mở ứng dụng Desktop và tài liệu ngữ cảnh dự án.
* **File / Thành phần tác động:**
  * `AGENTS.md`, `CHANGELOG.md`, `CLAUDE.md`, `README.md`

---

## [2026-11-12 10:19] — Chuyển sang profile riêng **Chrome AM** (port `9229`) & bỏ hẳn popup `Allow remote debugging?`
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Bối cảnh & Lý do:**
  * Chrome 144+ (`chrome://inspect/#remote-debugging`, cờ `--autoConnect`) không có nút "Always allow" trên profile mặc định; do mỗi tin nhắn Discord tạo một tiến trình `agy -p` ngắn hạn rồi đóng, Chrome hiện lại popup `Allow remote debugging?` ở mỗi lần nhắn.
  * Cổng `9222` đang được Chrome chính của người dùng giữ khi bật remote debugging, nên tách riêng **Chrome AM** chạy trên cổng **`9229`** và `--user-data-dir` riêng để chạy song song không đụng cổng và không bao giờ hiện hộp thoại Allow.
* **Tóm tắt thay đổi:**
  * Tạo thư mục profile riêng `%LOCALAPPDATA%\Google\Chrome AM User Data` (`C:\Users\Admin\AppData\Local\Google\Chrome AM User Data`) và shortcut ngoài Desktop `C:\Users\Admin\Desktop\Chrome AM.lnk` chạy:
    `"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9229 --user-data-dir="C:\Users\Admin\AppData\Local\Google\Chrome AM User Data" --no-first-run --no-default-browser-check`.
  * Cập nhật `C:\Users\Admin\.gemini\config\mcp_config.json`: đổi server `chrome-devtools` từ `--autoConnect` sang `--browserUrl=http://127.0.0.1:9229` (giữ `--no-usage-statistics`, `--no-performance-crux`).
  * Nâng cấp `bot.mjs`:
    * Thêm `CHROME_AM_DEBUG_PORT` (`9229`), `CHROME_AM_DEBUG_URL`, `getChromeAmUserDataDir()`, `getChromeAmLaunchArgs()`, `isChromeAmDebugReady()`, `waitForChromeAmDebugReady()`, `launchChromeAm()`.
    * Cập nhật `resolveApplication()` và `handleDesktopOpenTool()` (`open_in_chrome`, `open_app("Chrome AM" | "Chrome" | "Google Chrome")`) để luôn mở đúng instance **Chrome AM** trên cổng `9229` và đợi `/json/version` sẵn sàng (tăng timeout `--mcp-stdio` `/open` lên `20000ms`).
    * Cập nhật `buildEffectivePrompt()` để hướng dẫn `agy` tự gọi `open_app("Chrome AM")` nếu Chrome AM chưa chạy rồi mới gọi `chrome-devtools`.
  * Di chuyển `History` từ Chrome chính (`User Data\Default\History`, `15,564,800` bytes) sang `Chrome AM User Data\Default\History` khi Chrome đã tắt (`PRAGMA quick_check: ok`). *(Lưu ý: Chrome 127+ dùng App-Bound Encryption nên không copy thô `Login Data`/`Cookies`; user đã đăng nhập Google phụ và tự export/import `.csv` mật khẩu).*
  * Xử lý sự cố `Chrome AM` không hiện cửa sổ khi bấm ngoài Desktop: phát hiện `run_command` trong Antigravity IDE chạy trong desktop ẩn (`WINSTA=WinSta0 DESKTOP=exebox-...`); khi test mở `Chrome AM` từ `run_command` đã khóa `Chrome AM User Data` trong desktop ẩn đó. Đã đóng sạch qua CDP `Browser.close` (`REMAINING_CHROME=0`) để user mở trực tiếp từ Desktop `WinSta0\Default` bình thường (còn bot `AntigravityDiscordBridge` chạy ở `Logon Mode: Interactive only`).
* **File / Thành phần tác động (trong & ngoài repo):**
  * Trong repo: `bot.mjs`, `AGENTS.md`
  * Ngoài repo: `C:\Users\Admin\.gemini\config\mcp_config.json`, `C:\Users\Admin\Desktop\Chrome AM.lnk`, `C:\Users\Admin\AppData\Local\Google\Chrome AM User Data`
* **Kiểm tra đã chạy:**
  * `node --check bot.mjs` → `SYNTAX OK`
  * `agy mcp list` → `chrome-devtools` (`--browserUrl=http://127.0.0.1:9229`) và `discord-bridge-desktop` ở trạng thái `enabled`
  * Khởi động lại task `AntigravityDiscordBridge` (`PID 20796`, `[gateway] Ready as AM#7297`)
  * Test `agy -p` gọi `chrome-devtools.list_pages` → `status: "SUCCESS"`, không hiện popup Allow
  * Đóng `Chrome AM` bị kẹt trong `exebox` qua `Browser.close` → `REMAINING_CHROME=0`, `History` `quick_check: ok`, Task Scheduler `Logon Mode: Interactive only`

---

## [2026-11-12 02:45] — Tích hợp điều khiển trình duyệt qua `chrome-devtools-mcp`
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * Cài đặt cục bộ gói `chrome-devtools-mcp@latest` (`1.13.0`) vào `C:\Users\Admin\.gemini\config\mcp-tools` (để `discord-agy-bridge` giữ nguyên kiến trúc không `node_modules` trong repo).
  * Đăng ký server `chrome-devtools` trong `C:\Users\Admin\.gemini\config\mcp_config.json` (ban đầu dùng `--autoConnect`, sau đó ở mốc `10:19` đã chuyển sang `--browserUrl=http://127.0.0.1:9229`).
  * Cập nhật `DESKTOP_OPEN_HINT_RE` và `buildEffectivePrompt()` trong `bot.mjs` để điều hướng tác vụ đọc/tương tác trang web sang `mcp\chrome-devtools`.
* **File / Thành phần tác động:**
  * Trong repo: `bot.mjs`, `AGENTS.md`
  * Ngoài repo: `C:\Users\Admin\.gemini\config\mcp-tools\node_modules\chrome-devtools-mcp`, `C:\Users\Admin\.gemini\config\mcp_config.json`
* **Kiểm tra đã chạy:**
  * Kiểm tra `initialize` + `tools/list` (`33` tools), `agy mcp list`, test E2E `agy -p` gọi `chrome-devtools.list_pages`.

---

## [2026-11-11 23:59] — Xây dựng MCP Desktop Bridge (`discord-bridge-desktop`) mở Chrome & mọi ứng dụng Windows
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Bối cảnh & Lý do:**
  * Lệnh `RunCommand` của `agy` đóng cây tiến trình con ngay khi kết thúc lượt nên Chrome/ứng dụng GUI mới bật bị tắt theo ngay lập tức.
* **Tóm tắt thay đổi:**
  * Thêm vào `bot.mjs` chế độ `--mcp-stdio` + HTTP loopback endpoint xác thực Bearer token (`startMcpBridgeServer()` trên `127.0.0.1:0`), tự đăng ký `discord-bridge-desktop` vào `C:\Users\Admin\.gemini\config\mcp_config.json` (`ensureMcpConfigRegistered()`).
  * Chỉ cấp phát env `AGY_DISCORD_MCP_PORT`, `AGY_DISCORD_MCP_TOKEN`, `AGY_DISCORD_MCP_CWD` cho tiến trình `agy` do bot gọi; ngoài bot thì trả `tools: []`.
  * Cung cấp 3 tool desktop: `open_in_chrome`, `open_desktop_target`, và `open_app` (tìm qua `APP_ALIASES`, Registry `App Paths`, thư mục Start Menu/Desktop `.lnk`, `WindowsApps`, `where.exe`/`System32`, và `Get-StartApps`, kèm cache `loadAppCatalog()`).
  * Thêm `DESKTOP_OPEN_HINT_RE` và `buildEffectivePrompt()` nhắc `agy` dùng `mcp\discord-bridge-desktop`.
* **Kiểm tra đã chạy:**
  * `node --check bot.mjs`, unit test `22/22` truy vấn mở ứng dụng + `5/5` kiểm tra bảo mật từ chối target không hợp lệ, E2E `agy -p` mở thành công Notepad & Paint ngoài cây tiến trình `agy`.

---

## [2026-11-11 22:30 – 23:20] — Sửa lỗi headless `auto`, đồng bộ Thread/Project, `!clear`, `#instructions`, `#free-chat`, `!usage`
* **Agent / Phiên:** Antigravity (`d41d543d-cf7f-4a5f-98e1-c203db926e65`)
* **Tóm tắt thay đổi:**
  * **Sửa mode `auto` khi chạy headless (`agy -p`):** Thay `--mode auto` (vốn tự hạ về `default` và bị soft-deny `RunCommand`/ghi file ngoài workspace) bằng `--settings` JSON (`toolPermission: "always-proceed"`, `allowNonWorkspaceAccess: true`, `enableTerminalSandbox: Boolean(chState.sandbox)`) kèm `--sandbox`; đặt mặc định `mode: "auto"` trong `state.json` / `bot.mjs`.
  * **Đồng bộ xóa Thread ↔ Conversation `agy`:** Hỗ trợ sự kiện `THREAD_DELETE` và lệnh `!delete` để hủy tác vụ đang chạy, xóa khỏi `state.json` và xóa dữ liệu conversation tương ứng tại `~/.gemini/antigravity-cli/{conversations,brain}/<conversationId>`.
  * **Chống đúp tiến trình trả lời 2 lần:** Bổ sung `acquirePidLock()` (`bot.pid`) và cập nhật `stop.bat` dọn sạch mọi tiến trình `discord-agy-bridge` cũ trước khi khởi chạy mới.
  * **Lệnh `!clear [số_lượng | all]`:** Dọn tin nhắn trong kênh (dùng bulk-delete cho tin `< 14` ngày, xóa lẻ tin cũ hơn, bỏ qua thread con).
  * **Kênh `#instructions` (`guideChannelName`):** Tự động đồng bộ nội dung hướng dẫn toàn bộ lệnh `!` khi bot khởi động hoặc qua lệnh `!guide [reset]`, đồng thời không nhận prompt chat thường.
  * **Kênh `#free-chat` (`freeChatChannelName`):** Tự phát hiện kênh `free-chat` để chat tự do không gắn project tại `~/.gemini/antigravity-cli/no-project`, tách biệt với `#projects`; đặt tên Thread ở `#projects` kèm tiền tố `[<ProjectName>]`.
  * **Đo thời lượng & Footer usage:** Đo `turnDurationSec` thực tế của từng lượt trả lời cho footer gọn cuối tin nhắn và hoàn thiện `!usage` đọc từ `--output-format json`.

---

## [2026-11-11 21:00 – 22:15] — Khởi tạo cầu nối `discord-agy-bridge` & Task Scheduler chạy ngầm
* **Tóm tắt thay đổi:**
  * Xây dựng cầu nối chat 2 chiều Discord ↔ `agy.exe` bằng 1 file Node.js ESM thuần (`bot.mjs`, Node `v24.6.0`, không `npm install`), gồm Discord Gateway `WebSocket` (Heartbeat + Resume/Reconnect), hàng đợi xử lý tuần tự theo kênh/Thread, bảo toàn Discord Snowflake ID 64-bit khi parse `config.json`.
  * Tạo `config.json`, `config.example.json`, `state.json`, `run-hidden.vbs`, `start.bat`, `stop.bat`, `README.md`, `AGENTS.md`.
  * Đăng ký Windows Task Scheduler tên `AntigravityDiscordBridge` chạy ẩn `wscript.exe //B run-hidden.vbs` → `node bot.mjs --log` mỗi khi đăng nhập Windows (không giới hạn thời gian chạy, chạy được bằng pin).
