# Discord ↔ Antigravity CLI (`agy`) Bridge

> **Biến máy tính Windows cài Antigravity CLI (`agy`) thành một Trợ lý AI điều khiển từ xa, Hệ thống tự động hóa (Automation Hub) và Bot phát nhạc Discord Voice** — điều khiển mọi lúc mọi nơi qua Discord trên điện thoại hoặc máy tính, hoàn toàn bằng **Node.js thuần** (không `node_modules` trong repo) và không cần mở ứng dụng Antigravity Desktop.

---

## 1. Tổng quan & Bài toán dự án giải quyết

### Vấn đề ban đầu
1. **Phụ thuộc ngồi trực tiếp tại máy:** `agy` (Antigravity CLI) chạy cục bộ trên máy Windows của bạn. Khi ra ngoài hoặc dùng điện thoại, bạn không thể giao việc cho AI đọc code, sửa file, chạy lệnh hay xem màn hình/trình duyệt trên máy mình.
2. **Không chia sẻ an toàn được cho nhiều người:** Nếu cho bạn bè/thành viên server Discord dùng chung `agy` trực tiếp trên máy chủ, họ có thể vô tình hoặc cố ý truy cập thư mục hệ thống, đọc file cấu hình bí mật (`config.json`), chạy lệnh vượt quyền (`BypassSandbox`) hoặc spam làm hết lượt AI.
3. **Thiếu kênh tự động hóa & phản hồi đa phương tiện:** Các cron job, webhook cảnh báo hệ thống hay nhu cầu tạo nhanh file thuyết trình (`.pptx`), Excel (`.xlsx`), PDF, Word, đọc văn bản thành giọng nói MP3, điều khiển trình duyệt **Chrome AM**, hoặc nghe nhạc cùng nhau trong Discord Voice thường phải ghép nhiều bot/dịch vụ rời rạc.

### Cách `discord-agy-bridge` giải quyết
Dự án dựng lên **một cầu nối thống nhất 1 tiến trình nhẹ (`~74 MB` RAM khi rảnh)** với cơ chế phân quyền 2 tầng rõ ràng:
* **Với Admin (Chủ máy / Co-Admin):** Toàn quyền dùng `agy` làm việc trên các project cục bộ qua DM hoặc kênh `#admin` / `#projects`, xem tiến độ real-time, gửi/nhận file 2 chiều, điều khiển cửa sổ Windows thật, thao tác web qua **Chrome AM** (`chrome-devtools`), hẹn giờ `/cron`, nhận HTTP `/webhook` và dọn kênh `/clear`.
* **Với Thành viên Server (Member):** Khi mới vào server, bot tự động cấp **1 phòng chat riêng tư `#ai-<tên>`** + **1 thư mục sandbox riêng**. Thành viên thoải mái hỏi đáp, gửi ảnh/tài liệu, tạo file Office/PDF/audio TTS, dùng Action Buttons — nhưng bị khóa chặt trong thư mục riêng (`--sandbox`, chặn `BypassSandbox`, giới hạn lượt/token/dung lượng đĩa mỗi ngày). Ngoài ra mọi thành viên đều có thể nghe nhạc/playlist trong kênh Voice bằng `/play` ngay tại `#free-chat` hoặc kênh Voice.

---

## 2. Kiến trúc tổng quát

```text
Discord (DM / Server Channels / Threads / Voice)
   │
   ▼  WebSocket Gateway + Slash Commands + Action Buttons (lib/discord-gateway.mjs, lib/slash.mjs)
┌──────────────────────────────────────────────────────────────────────┐
│                         bot.mjs (Điều phối trung tâm)                │
│  ├─ Kiểm tra quyền & RBAC (lib/auth.mjs, lib/quota.mjs)              │
│  ├─ Auto-Onboard & Banner #announcement (lib/onboard.mjs, announce)  │
│  ├─ Automation Hub: Cron & HTTP Webhook (lib/cron.mjs, webhook.mjs)  │
│  └─ Priority Queue Semaphore: User > Webhook > Cron (lib/runner.mjs) │
└───────┬───────────────────────────────┬──────────────────────┬───────┘
        │                               │                      │
        ▼                               ▼                      ▼
 Antigravity CLI (`agy`)      MCP Desktop Bridge        Discord Voice Engine
 - Model & Mode theo kênh     - Chrome AM (9229)        - yt-dlp (--no-cache-dir)
 - Stream JSON từng bước      - Windows App/Clipboard   - ffmpeg (-c:a copy Opus)
 - `--sandbox` cho Member     - Screenshot & Cloud TTS  - @discordjs/voice + DAVE
 - Shared quick-files libs    - send_to_discord (25MB)  - Auto-leave khi trống phòng
```

---

## 3. Chi tiết các nhóm chức năng chính

### A. Giao tiếp AI & Xử lý tệp 2 chiều (`bot.mjs`, `lib/runner.mjs`)
* **26 Slash Commands (`/`) + Action Buttons:** Gõ `/` để chọn lệnh có mô tả & autocomplete danh sách model, project, cron ID, webhook ID. Dưới câu trả lời luôn gắn nút bấm nhanh (`[🔄 Thử lại]`, `[📝 Tóm tắt ngắn]`, `[🆕 Phiên mới]`, `[🗑️ Xóa Thread]`) và **chỉ giữ cụm nút ở tin nhắn mới nhất** để tránh rối giao diện.
* **Stream tiến độ theo thời gian thực:** Hiện từng bước `agy` đang làm (`Đọc file`, `Sửa file`, `Chạy lệnh`, `Mở Chrome AM`...) kèm nút `[⏹️ Dừng ngay]`; tự động chống Windows Sleep khi đang có tác vụ AI chạy.
* **Cô lập ngữ cảnh bằng Thread & Reply Context:** Ở kênh chính, mỗi câu hỏi mới có thể tự mở một Thread riêng (`/autothread on`); khi xóa Thread trên Discord (hoặc `/delete`), bot tự xóa kèm tin nhắn gốc và dọn conversation tương ứng. Khi **Reply** vào tin nhắn/ảnh cũ, AI đọc lại đúng nội dung và tệp đính kèm của tin nhắn được Reply.
* **Trao đổi file đa phương tiện & Quick Files:** Nhận ảnh, PDF, code, audio, video từ Discord (tối đa `25 MB`/tệp); AI tạo và gửi trả trực tiếp `.pptx`, `.xlsx`, `.docx`, `.pdf`, `.html`, `.zip`, `.svg` hoặc file ảnh Markdown lên Discord (hỗ trợ `delete_after_send` cho tệp tạm).

### B. Quản trị đa người dùng, Bảo mật & Báo cáo (`lib/auth.mjs`, `lib/onboard.mjs`, `lib/quota.mjs`, `lib/report.mjs`)
* **Auto-Onboard 100% (`GUILD_MEMBERS`):** Thành viên mới vào server tự động được tạo thư mục sandbox riêng + kênh private `#ai-<tên>` (chỉ thành viên đó, Admin và bot nhìn thấy) + gửi hướng dẫn chào mừng đúng danh sách model hiện có; khi rời server tự thu hồi quyền.
* **Banner `#announcement` (`lib/announce-card.mjs`):** Tự render thẻ ảnh PNG nền trong suốt có avatar tròn viền xanh/đỏ và bộ đếm tổng thành viên khi có người vào/rời server.
* **Đồng bộ `#instructions` (`/guide`):** Tự xuất bản hướng dẫn thuần tiếng Việt thân thiện cho người mới (chỉ lộ lệnh thành viên, tự khóa read-only với `@everyone`).
* **Quota & Giám sát Sandbox:** Giới hạn số lượt/ngày, số token/ngày, thời gian chờ giữa 2 tin (`cooldownSec`), dung lượng thư mục tối đa (`workspaceMaxMb`); tự ngắt và báo về `#admin` nếu phiên Member cố kích hoạt `BypassSandbox: true`.
* **Báo cáo cuối ngày (`0` token AI):** Đúng giờ hẹn (`HH:MM`) tự gửi thống kê lượt hỏi, token, dung lượng ổ đĩa từng thành viên và cảnh báo bảo mật về `#admin`.

### C. Điều khiển Desktop thật & Chrome AM (`lib/desktop.mjs`)
* Cung cấp **8 MCP host tools** qua bridge cục bộ (`127.0.0.1:0`, Bearer token theo từng run): `open_in_chrome`, `open_app`, `open_desktop_target`, `send_to_discord`, `text_to_speech` (tạo file MP3 đọc văn bản), `capture_desktop`, `desktop_clipboard`, `desktop_windows` (liệt kê/focus/đóng cửa sổ hoặc đóng riêng **Chrome AM**).
* Tách biệt hoàn toàn trình duyệt cho bot (**Chrome AM** tại `%LOCALAPPDATA%\Google\Chrome AM User Data`, debug port `9229`) khỏi Chrome cá nhân của chủ máy, có pre-check `getChromeAmStatus()` trước khi gọi `chrome-devtools` MCP.

### D. Automation Hub — Cron & HTTP Webhook (`lib/cron.mjs`, `lib/webhook.mjs`)
* **Cron Scheduler:** Đặt lịch AI tự chạy theo `every 30m`, `in 15m`, `daily 08:30`, hoặc biểu thức POSIX 5 trường (`0 9 * * 1-5`), lưu bền vững trong `state.json`.
* **HTTP Webhook Server:** Nhận sự kiện `POST /webhook/<hookId>` từ server/monitoring ngoài (xác thực `Bearer`, `X-Webhook-Secret`, HMAC-SHA256 `X-Hub-Signature-256`), chống spam rate-limit & chống trùng (`dedupWindowSec`), trả `202 Accepted` ngay lập tức và mở Thread cho `agy` chẩn đoán theo policy riêng an toàn.

### E. Trình phát nhạc Discord Voice đa nền tảng (`/play`, `lib/music.mjs`)
* **Mở cho mọi thành viên** ở `#free-chat`, chat kênh Voice và phòng riêng; chạy thuần Node + `yt-dlp` + `ffmpeg` (**`0` token AI**).
* **Đa nền tảng & Playlist:** Hỗ trợ link đơn và playlist từ **YouTube**, **YouTube Music**, **SoundCloud**, **Spotify** (tự đọc tên bài, nghệ sĩ, URI và **thời lượng** từ Spotify embed rồi phát qua YouTube), link audio trực tiếp (`.mp3`, `.ogg`, `.flac`, ...) và tìm kiếm theo tên bài hát. Hàng đợi tối đa `50` bài/server, nạp `25` bài/playlist.
* **Giao diện Embed & 5 nút điều khiển:** Hiển thị avatar người yêu cầu, link tới media gốc, tối đa `5` bài tiếp theo trong hàng chờ, và hàng 5 nút (`⏸️ Tạm dừng` · `⏭️ Qua bài` · `➡️ Tuần tự / 🔀 Shuffle / 🔂 Repeat 1 bài / 🔁 Repeat tất cả` · `🧹 Clear Queue` · `⏹️ Dừng & Rời`) tự động gỡ khỏi tin nhắn cũ để chỉ nằm ở tin nhắn mới nhất.
* **Tối ưu CPU/RAM/GPU/SSD:** Lazy-load `@discordjs/voice` ngoài repo (`C:\ProgramData\agy-shared-tools`), `yt-dlp --no-cache-dir` (0 byte cache lên SSD), `ffmpeg -hwaccel none -threads 1 -c:a copy` passthrough Opus không nén lại cho YouTube/YTM (fallback `libopus -application audio -b:a 128k` cho MP3/SoundCloud), tự rời phòng khi trống người nghe (`1` phút), khi hết hàng chờ (`2` phút) hoặc khi tạm dừng quá lâu (`10` phút).

---

## 4. Cấu trúc mã nguồn & File bàn giao

> **Dành cho người nhận clone về hoặc giao tiếp cho AI Agent khác:**
> Hãy chỉ định Agent đọc [`AGENTS.md`](./AGENTS.md), [`CLAUDE.md`](./CLAUDE.md) và phần đầu [`CHANGELOG.md`](./CHANGELOG.md) trước khi chỉnh sửa code.

```text
discord-agy-bridge/
├── bot.mjs                   # Điểm vào chính: Gateway dispatch, Slash/Button handlers, luồng chạy agy
├── lib/
│   ├── announce-card.mjs     # Render banner PNG nền trong suốt cho #announcement (.NET System.Drawing)
│   ├── auth.mjs              # RBAC phân quyền Admin/Member, MEMBER_ALLOWED_COMMANDS, MCP scope
│   ├── cron.mjs              # Bộ lập lịch bền vững (every / in / daily / cron 5 trường)
│   ├── desktop.mjs           # Host MCP bridge cho Chrome AM, Windows GUI, Clipboard, Screenshot & TTS
│   ├── discord-gateway.mjs   # Discord WebSocket Gateway client (Heartbeat, Resume, Watchdog, Intents)
│   ├── music.mjs             # Discord Voice music engine, playlist parser, 4 play modes, tối ưu tài nguyên
│   ├── onboard.mjs           # Auto-onboard/offboard kênh riêng + thư mục sandbox thành viên
│   ├── quota.mjs             # Theo dõi hạn mức lượt/token/cooldown & dung lượng workspace Member
│   ├── report.mjs            # Tổng kết cuối ngày 0-token & cảnh báo sandbox
│   ├── runner.mjs            # Priority semaphore hàng đợi chạy agy, anti-sleep, prompt builder
│   ├── slash.mjs             # Schema 26 Slash Commands (/), parser & autocomplete động
│   ├── utils.mjs             # Bảo toàn Snowflake 64-bit, atomic JSON, sanitize link/log, path safety
│   └── webhook.mjs           # HTTP Webhook server (Bearer / HMAC-SHA256 / rate limit / dedup)
├── test/                     # Bộ 36 unit test zero-dependency (`node --test`)
│   ├── auth.test.mjs
│   ├── desktop.test.mjs
│   ├── discord-gateway.test.mjs
│   ├── music.test.mjs
│   ├── onboard.test.mjs
│   ├── quota.test.mjs
│   ├── report.test.mjs
│   ├── runner.test.mjs
│   ├── slash.test.mjs
│   └── utils.test.mjs
├── config.example.json       # File cấu hình mẫu (copy thành config.json trên máy chạy, KHÔNG commit)
├── .gitignore                # Chặn config.json, state.json, bot.log, bot.pid, node_modules/, workspaces/
├── run-hidden.vbs            # Launcher chạy ẩn bot qua Windows Task Scheduler
├── start.bat / stop.bat      # Chạy thử trên terminal / dừng tiến trình bot & Task Scheduler
├── AGENTS.md                 # Tài liệu kiến trúc, quyết định kỹ thuật & quy trình deploy cho AI Agent
├── CLAUDE.md                 # Con trỏ ngữ cảnh ngắn gọn trỏ sang AGENTS.md & CHANGELOG.md
└── CHANGELOG.md              # Nhật ký toàn bộ thay đổi theo mốc thời gian (mới nhất ở trên cùng)
```

---

## 5. Hướng dẫn cài đặt trên máy mới

### Yêu cầu hệ thống
* **Hệ điều hành:** Windows 10 / 11 *(phần Desktop/Chrome AM/Task Scheduler dùng công cụ Windows; Gateway & Voice chạy chuẩn Node.js)*.
* **Node.js:** `v22+` (khuyến nghị `v24.6.0` để có sẵn native `aes-256-gcm` cho Discord Voice).
* **Antigravity CLI:** `agy.exe` đã cài đặt và đăng nhập OAuth sẵn.
* **FFmpeg:** Đặt tại `C:\ffmpeg\ffmpeg.exe` (hoặc có trong `PATH`) để phát nhạc `/play`.

### Bước 1: Clone & cấu hình `config.json`
```powershell
git clone https://github.com/namtit2932k/discord-agy-bridge.git
cd discord-agy-bridge
Copy-Item config.example.json config.json
```
Điền các thông tin tối thiểu vào `config.json` *(mọi Snowflake ID để dạng chuỗi `"..."`)*:
* `botToken`: Token bot lấy tại [Discord Developer Portal](https://discord.com/developers/applications). Trên Portal cần bật **Privileged Gateway Intents** (`Message Content Intent`, `Server Members Intent`), và cấp cho bot trên server các quyền: `View Channel`, `Send Messages`, `Read Message History`, `Manage Messages`, `Manage Channels`, `Manage Roles`, `Connect`, `Speak`.
* `allowedUserId`: Discord User ID của Root Admin.
* `allowedChannelIds`: ID kênh làm việc chính của Admin; cập nhật `agyPath`, `defaultCwd`, `autoOnboard.rootDir` theo máy mới.

### Bước 2: Cài thư viện dùng chung ngoài repo (`C:\ProgramData\agy-shared-tools`)
Repo giữ sạch hoàn toàn không chứa `node_modules`. Cài phụ thuộc cho tính năng nhạc Voice `/play` (và helper tạo `.pptx`/`.xlsx`/`.docx`/`.pdf` cho phiên sandbox) ở thư mục dùng chung ngoài repo:

```powershell
New-Item -ItemType Directory -Force -Path "C:\ProgramData\agy-shared-tools\bin" | Out-Null
cd "C:\ProgramData\agy-shared-tools"
npm init -y
npm install @discordjs/voice @snazzah/davey prism-media opusscript
# (Tùy chọn cho AI xuất file Office/PDF): npm install pptxgenjs exceljs xlsx docx pdfkit archiver

# Tải yt-dlp.exe vào C:\ProgramData\agy-shared-tools\bin\yt-dlp.exe
Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile "C:\ProgramData\agy-shared-tools\bin\yt-dlp.exe"

# Cấp quyền đọc/thực thi cho tiến trình sandbox agy trên Windows:
icacls "C:\ProgramData\agy-shared-tools" /grant "*S-1-15-2-1:(OI)(CI)(RX)" /T
```

### Bước 3: Kiểm thử & Khởi chạy
```powershell
# Kiểm tra cú pháp & chạy toàn bộ 36 unit tests
node --check bot.mjs
node --test

# Chạy trực tiếp để xem log lần đầu
.\start.bat
```
Để tự chạy ngầm khi đăng nhập Windows, tạo Windows Task Scheduler tên `AntigravityDiscordBridge` (`Logon Mode: Interactive only`) chạy `wscript.exe //B "<duong-dan>\run-hidden.vbs"`. Khi triển khai bản cập nhật mới:
```powershell
.\stop.bat
schtasks /Run /TN "AntigravityDiscordBridge"
```

---

## 6. Bảng tóm tắt 26 Slash Commands (`/`)

### Lệnh dành cho mọi thành viên (`8` lệnh)
| Lệnh | Chức năng |
| :--- | :--- |
| `/play <link-media> [voice]` | Phát bài hát hoặc playlist (YouTube, YT Music, SoundCloud, Spotify, tên bài) trong Voice; hỗ trợ `queue`, `skip`, `clear`, `shuffle`, `repeat`, `repeat-one`, `sequential`, `pause`, `resume`, `stop` *(dùng được ở `#free-chat`, chat Voice & phòng riêng)* |
| `/help` | Xem danh sách lệnh theo đúng quyền của người gọi |
| `/status` | Xem model, trạng thái phiên & quyền RBAC hiện tại |
| `/usage` | Xem token đã dùng và hạn mức ngày còn lại |
| `/new` | Bắt đầu cuộc hội thoại mới (giữ model & project) |
| `/stop` | Dừng ngay tác vụ AI đang chạy |
| `/clear [count]` | Xóa tin nhắn ngoài kênh trong phòng riêng *(Admin dùng được thêm tại `#free-chat` và `#announcement`)* |
| `/delete` | Xóa Thread hiện tại cùng tin nhắn gốc & dữ liệu hội thoại |

### Lệnh dành riêng cho Admin (`18` lệnh, `default_member_permissions: "8"`)
* **Dự án & Model:** `/projects`, `/project`, `/models`, `/model`, `/mode`, `/sandbox`
* **Phân quyền & Hướng dẫn:** `/access` (`list`, `onboard`, `offboard`, `auto`, `private`, `channel`, `revoke`, `admin`, `model ...`, `quota ...`, `security ...`, `report ...`), `/guide [reset]`, `/reload`
* **Desktop & Hệ thống:** `/chrome <status|close>`, `/windows <list|focus|close>`, `/logs [lines]`, `/cleanup`
* **Tự động hóa & Hiển thị:** `/cron`, `/webhook`, `/footer`, `/autothread`, `/stream`

---

## 7. Lưu ý cho AI Agent tiếp quản (Multi-Agent Handoff)

1. Luôn đọc [`AGENTS.md`](./AGENTS.md) và đầu [`CHANGELOG.md`](./CHANGELOG.md) trước khi sửa code hoặc cấu hình.
2. **Bảo mật tuyệt đối:** Không bao giờ đọc, in hoặc commit `botToken` trong `config.json`.
3. **Không tự mở GUI từ terminal IDE:** Terminal của IDE agent chạy trên desktop ẩn `WinSta0\exebox-...`; mọi thao tác GUI thật trên desktop do daemon `bot.mjs` (chạy dưới Task Scheduler Interactive) xử lý.
4. **Sau mỗi thay đổi:** Chạy `node --check` trên các file `.mjs`, chạy `node --test`, ghi nhận mục mới lên đầu [`CHANGELOG.md`](./CHANGELOG.md), cập nhật [`AGENTS.md`](./AGENTS.md) nếu thay đổi kiến trúc, rồi restart bằng `stop.bat` → `schtasks /Run /TN "AntigravityDiscordBridge"` và xác minh `bot.pid` + `bot.log`.
