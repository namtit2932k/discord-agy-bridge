# Discord ↔ Antigravity CLI (`agy`) Bridge

Cầu nối chat AI 2 chiều, **Automation Hub**, **Desktop/Chrome AM Pipeline** và **Discord Voice Music Player** kết nối **Discord** với **Antigravity CLI (`agy`)** — viết bằng **Node.js thuần module hóa** (zero `npm install` / zero `node_modules` trong repo), chạy độc lập qua Windows Task Scheduler mà không cần mở giao diện Antigravity Desktop.

> **Dành cho AI Agent / Developer tiếp nhận dự án:**
> Trước khi đọc hay chỉnh sửa mã nguồn, hãy đọc theo đúng thứ tự 3 file bàn giao:
> 1. [`AGENTS.md`](./AGENTS.md) — Quy tắc bắt buộc, kiến trúc chi tiết, lưu ý Windows Desktop ẩn, quy trình deploy & bảo mật.
> 2. [`CLAUDE.md`](./CLAUDE.md) — Entry pointer cho các Agent khác.
> 3. [`CHANGELOG.md`](./CHANGELOG.md) — Nhật ký thay đổi chi tiết toàn dự án (mới nhất nằm ở trên cùng).

---

## 1. Tính năng nổi bật

* **Chat AI 2 chiều & Stream tiến độ (`bot.mjs`, `lib/runner.mjs`):**
  * Giao tiếp trực tiếp qua **26 Discord Slash Commands (`/`)** có autocomplete động, kèm hàng nút bấm nhanh (`[⏹️ Dừng ngay]`, `[🔄 Thử lại]`, `[📝 Tóm tắt ngắn]`, `[🆕 Phiên mới]`, `[🗑️ Xóa Thread]`) chỉ hiển thị ở tin nhắn trả lời mới nhất.
  * Tự tạo Thread cho mỗi câu hỏi ở kênh chính, tự đồng bộ xóa Thread ↔ tin nhắn gốc ↔ conversation của `agy`, đọc ngữ cảnh khi **Reply** tin nhắn cũ, và gửi/nhận ảnh & tệp 2 chiều (`25 MB`/tệp).
* **Phát nhạc Discord Voice đa nền tảng (`/play`, `lib/music.mjs`):**
  * Mở cho **mọi thành viên** trong `#free-chat`, chat kênh Voice và phòng riêng.
  * Hỗ trợ link bài hát **và playlist** từ **YouTube**, **YouTube Music**, **SoundCloud**, **Spotify** (tự đọc embed metadata + thời lượng từng bài rồi tìm luồng audio qua YouTube), link audio trực tiếp và tìm theo tên bài hát.
  * Hàng đợi theo server (`50` bài, nạp `25` bài/playlist), thẻ Embed kèm link gốc + avatar người yêu cầu + tối đa `5` bài tiếp theo, thanh 5 nút điều khiển (`⏸️ Tạm dừng` · `⏭️ Qua bài` · `➡️ Tuần tự / 🔀 Shuffle / 🔂 Repeat 1 bài / 🔁 Repeat tất cả` · `🧹 Clear Queue` · `⏹️ Dừng & Rời`) luôn tự chuyển xuống tin nhắn mới nhất.
  * Tối ưu tài nguyên: lazy-load thư viện ngoài repo, `yt-dlp --no-cache-dir` (không ghi cache SSD), `ffmpeg -c:a copy` passthrough Opus không re-encode khi nguồn chuẩn 48kHz stereo, `-hwaccel none -threads 1`, tự thoát sau `1` phút nếu phòng không còn người nghe, `2` phút khi hết nhạc hoặc `10` phút khi tạm dừng.
* **Phân quyền RBAC, Auto-Onboard & Báo cáo (`lib/auth.mjs`, `lib/onboard.mjs`, `lib/announce-card.mjs`, `lib/quota.mjs`, `lib/report.mjs`):**
  * Tự tạo kênh riêng `#ai-<tên>` + thư mục sandbox riêng khi thành viên mới tham gia (`GUILD_MEMBER_ADD`), khóa model riêng, giới hạn lượt/token/cooldown/dung lượng ổ đĩa theo ngày, chặn `BypassSandbox: true`, gửi banner PNG chào/tạm biệt ở `#announcement` và báo cáo cuối ngày `0` token về `#admin`.
* **Automation Hub (`lib/cron.mjs`, `lib/webhook.mjs`):**
  * Lập lịch tác vụ tự động (`every`, `in`, `daily HH:MM`, cron 5 trường) lưu bền vững trong `state.json`.
  * HTTP Webhook server nội bộ xác thực Bearer / HMAC-SHA256, chống trùng & rate limit, trả `202 Accepted` và tạo Thread xử lý riêng.
* **Chrome AM, Desktop Bridge, Cloud TTS & Quick Files (`lib/desktop.mjs`):**
  * MCP bridge nội bộ (`open_in_chrome`, `open_app`, `open_desktop_target`, `send_to_discord`, `text_to_speech` Cloud TTS MP3, `capture_desktop`, `desktop_clipboard`, `desktop_windows`), kết nối trình duyệt tách biệt **Chrome AM** (`127.0.0.1:9229`).

---

## 2. Cấu trúc thư mục & File bàn giao

```text
discord-agy-bridge/
├── bot.mjs                   # Điểm vào chính, gateway dispatch, slash/button handlers, điều phối agy CLI
├── lib/
│   ├── announce-card.mjs     # Render banner PNG trong suốt cho #announcement (.NET System.Drawing)
│   ├── auth.mjs              # RBAC phân quyền Admin/Member, MEMBER_ALLOWED_COMMANDS, MCP scope
│   ├── cron.mjs              # Bộ lập lịch bền vững (every / in / daily / cron 5 trường)
│   ├── desktop.mjs           # Host MCP bridge cho Chrome AM, Windows GUI, Clipboard, Screenshot & Cloud TTS
│   ├── discord-gateway.mjs   # Discord WebSocket Gateway client (Heartbeat, Resume, Watchdog, GUILD_VOICE_STATES)
│   ├── music.mjs             # Discord Voice music engine, playlist parser, 4 play modes, resource optimization
│   ├── onboard.mjs           # Auto-onboard/offboard kênh riêng + thư mục sandbox thành viên
│   ├── quota.mjs             # Theo dõi hạn mức lượt/token/cooldown & dung lượng workspace Member
│   ├── report.mjs            # Tổng kết cuối ngày 0-token & cảnh báo sandbox
│   ├── runner.mjs            # Priority semaphore hàng đợi chạy agy, anti-sleep, prompt builder
│   ├── slash.mjs             # Schema 26 Slash Commands (/), parser & autocomplete động
│   ├── utils.mjs             # Bảo toàn Snowflake 64-bit, atomic JSON, sanitize link/log, path safety
│   └── webhook.mjs           # HTTP Webhook server (Bearer / HMAC-SHA256 / rate limit / dedup)
├── test/                     # Unit test chuẩn Node (`node --test`), không cần thư viện ngoài
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
├── config.example.json       # File mẫu cấu hình (copy thành config.json trên máy chạy)
├── run-hidden.vbs            # Chạy ẩn bot qua Windows Task Scheduler
├── start.bat / stop.bat      # Khởi động thủ công / dừng tiến trình bot & Task Scheduler
├── AGENTS.md                 # Tài liệu kiến trúc & quy chuẩn bàn giao cho AI Agent
├── CLAUDE.md                 # Con trỏ ngữ cảnh cho Multi-Agent
└── CHANGELOG.md              # Lịch sử thay đổi chi tiết theo thời gian
```

*(Các file cục bộ không đẩy lên Git nhờ `.gitignore`: `config.json`, `state.json`, `bot.log`, `bot.pid`.)*

---

## 3. Hướng dẫn cài đặt trên máy mới

### Yêu cầu môi trường
* **OS:** Windows 10 / 11 (các tool Desktop/Chrome AM/Task Scheduler viết cho Windows; riêng Gateway + Voice chạy tốt trên Node.js).
* **Node.js:** `v22+` (khuyến nghị `v24.6.0` trở lên để hỗ trợ native `aes-256-gcm` cho Discord Voice).
* **Antigravity CLI:** `agy.exe` đã cài đặt và đăng nhập OAuth sẵn.
* **FFmpeg:** Đặt tại `C:\ffmpeg\ffmpeg.exe` (hoặc có trong `PATH`) để dùng tính năng `/play` nhạc Voice.

### Bước 1: Clone repo & tạo cấu hình
```powershell
git clone https://github.com/namtit2932k/discord-agy-bridge.git
cd discord-agy-bridge
Copy-Item config.example.json config.json
```
Mở `config.json` và điền ít nhất:
* `botToken`: Token Discord Bot (lấy ở Discord Developer Portal; bật các **Privileged Gateway Intents**: `Message Content Intent`, `Server Members Intent`, cùng quyền `Manage Channels`, `Manage Messages`, `Connect`, `Speak` trên server).
* `allowedUserId`: Discord User ID của Root Admin.
* `allowedChannelIds`: Danh sách ID kênh Admin chính; tùy chọn `agyPath`, `defaultCwd`, `autoOnboard.rootDir`.
* **Lưu ý:** Mọi Snowflake ID trong `config.json` phải để dạng chuỗi (`"..."`).

### Bước 2: Cài công cụ dùng chung ngoài repo (cho `/play` Voice & Quick Files)
Dự án giữ thư mục repo sạch hoàn toàn không có `node_modules`. Để bật tính năng phát nhạc Voice `/play` (và bộ helper tạo `.pptx`/`.xlsx`/`.docx`/`.pdf` cho phiên AI sandbox), cài đặt vào `C:\ProgramData\agy-shared-tools`:

```powershell
New-Item -ItemType Directory -Force -Path "C:\ProgramData\agy-shared-tools\bin" | Out-Null
cd "C:\ProgramData\agy-shared-tools"
npm init -y
npm install @discordjs/voice @snazzah/davey prism-media opusscript
# (Tùy chọn cho AI tạo file Office/PDF): npm install pptxgenjs exceljs xlsx docx pdfkit archiver

# Tải yt-dlp.exe vào C:\ProgramData\agy-shared-tools\bin\yt-dlp.exe
Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile "C:\ProgramData\agy-shared-tools\bin\yt-dlp.exe"

# Cấp quyền chỉ đọc/thực thi cho tiến trình sandbox agy trên Windows:
icacls "C:\ProgramData\agy-shared-tools" /grant "*S-1-15-2-1:(OI)(CI)(RX)" /T
```

### Bước 3: Kiểm thử & Khởi chạy
```powershell
# 1. Kiểm tra cú pháp & chạy toàn bộ unit test (36/36 test)
node --check bot.mjs
node --test

# 2. Chạy trực tiếp trên terminal để xem log lần đầu
.\start.bat
# Hoặc: node bot.mjs
```
Để chạy ngầm tự động khi bật Windows, tạo Windows Task Scheduler tên `AntigravityDiscordBridge` (`Logon Mode: Interactive only`) trỏ tới `wscript.exe //B "<path>\run-hidden.vbs"`. Khi triển khai thay đổi mới, dùng:
```powershell
.\stop.bat
schtasks /Run /TN "AntigravityDiscordBridge"
```

---

## 4. Danh sách 26 Slash Commands (`/`)

### Lệnh cho mọi thành viên (`8` lệnh)
* `/play <link-media> [voice]` — Phát nhạc/playlist (YouTube, YT Music, SoundCloud, Spotify, tên bài) trong Voice; hỗ trợ `queue`, `skip`, `clear`, `shuffle`, `repeat`, `repeat-one`, `sequential`, `pause`, `resume`, `stop` (dùng được ở `#free-chat`, chat Voice & phòng riêng).
* `/help` — Xem danh sách lệnh theo đúng quyền của người gọi.
* `/status` — Xem cấu hình model, trạng thái phiên & quyền hiện tại.
* `/usage` — Xem token đã dùng và hạn mức ngày còn lại.
* `/new` — Mở cuộc hội thoại mới (giữ model & project).
* `/stop` — Dừng tác vụ AI đang chạy.
* `/clear [count]` — Xóa tin nhắn ngoài kênh trong phòng riêng của bạn *(Admin được `/clear` thêm tại `#free-chat` và `#announcement`)*.
* `/delete` — Xóa Thread hiện tại của bạn cùng dữ liệu hội thoại liên quan.

### Lệnh dành riêng cho Admin (`18` lệnh, `default_member_permissions: "8"`)
* `/projects`, `/project`, `/models`, `/model`, `/mode`, `/sandbox`
* `/access` (`list`, `onboard`, `offboard`, `auto`, `private`, `channel`, `revoke`, `admin`, `model ...`, `quota ...`, `security ...`, `report ...`)
* `/guide`, `/reload`, `/cron`, `/webhook`, `/chrome`, `/windows`, `/logs`, `/cleanup`, `/footer`, `/autothread`, `/stream`

---

## 5. Quy trình cho AI Agent tiếp theo

Khi đưa repo này cho một AI Agent mới tiếp quản:
1. Yêu cầu Agent đọc [`AGENTS.md`](./AGENTS.md) và phần đầu [`CHANGELOG.md`](./CHANGELOG.md) trước khi sửa bất kỳ file nào.
2. Tuyệt đối tuân thủ bảo mật: không đọc/in `botToken` trong `config.json`, không mở GUI trực tiếp từ terminal ẩn IDE (`WinSta0\exebox-...`).
3. Sau mỗi lần sửa code: chạy `node --check` + `node --test`, ghi nhận thay đổi lên đầu [`CHANGELOG.md`](./CHANGELOG.md) (kèm cập nhật [`AGENTS.md`](./AGENTS.md) nếu thay đổi kiến trúc), rồi restart bot bằng `stop.bat` → `schtasks /Run /TN "AntigravityDiscordBridge"` và kiểm tra `bot.pid` + `bot.log`.
