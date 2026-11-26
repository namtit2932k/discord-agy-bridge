# Multi-Agent Context Pointer (Claude / Cursor / CLI Agents)

Trước khi đọc sâu code hay sửa bất kỳ file nào trong repository `discord-agy-bridge`, **BẮT BUỘC** thực hiện đúng 3 bước khởi động:

1. Đọc [`AGENTS.md`](./AGENTS.md) — **Master Playbook**: 5 luật thép, bản đồ module, kiến trúc RBAC/Hook và quy trình deploy chuẩn.
2. Đọc **30–60 dòng đầu** của [`CHANGELOG.md`](./CHANGELOG.md) — biết ngay các thay đổi gần nhất (mới nhất ở trên cùng).
3. Chạy 1 lệnh kiểm tra sức khỏe toàn diện: `node scripts/verify.mjs`.

## 5 Luật Thép (nhắc nhanh)
1. **Tuyệt đối không đọc/in/commit `botToken`** trong `config.json` (chỉ đọc `config.example.json`); mọi Snowflake ID là chuỗi `"..."`.
2. **Không `npm install` trong repo:** giữ 0 `node_modules` trong repo; thư viện dùng chung nằm ngoài tại `C:\ProgramData\agy-shared-tools` (gắn qua `NODE_PATH`, **tuyệt đối không** truyền `--add-dir`).
3. **Không tự mở GUI (Chrome AM / app Windows) từ terminal IDE:** terminal IDE chạy trong desktop ẩn `WinSta0\exebox-...`.
4. **Bảo vệ RBAC 2 lớp:** mọi tính năng/MCP mới phải tôn trọng `lib/auth.mjs` + chốt chặn cứng `PreToolUse` trong `lib/guard.mjs` (`hook-guard.cmd`).
5. **Definition of Done bắt buộc:** thêm mục mới lên **đầu** `CHANGELOG.md` → cập nhật `AGENTS.md` nếu đổi kiến trúc → `node scripts/verify.mjs` → restart qua `stop.bat` + `schtasks /Run /TN "AntigravityDiscordBridge"` → xác minh lại `bot.pid` & `bot.log`.
