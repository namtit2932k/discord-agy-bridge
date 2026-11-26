# Gemini / Antigravity Context Pointer

Khi mở workspace `discord-agy-bridge`, **BẮT BUỘC** thực hiện theo thứ tự:
1. Đọc [`AGENTS.md`](./AGENTS.md) (Master Handoff & Operations Playbook).
2. Đọc phần đầu [`CHANGELOG.md`](./CHANGELOG.md) (các thay đổi mới nhất ở trên cùng).
3. Chạy `node scripts/verify.mjs` để kiểm tra syntax, unit tests, MCP/Security Hook và trạng thái daemon (`bot.pid`).

> **Luật bảo mật tuyệt đối:** Không bao giờ đọc, in hoặc commit `botToken` trong `config.json`. Không mở ứng dụng GUI từ terminal IDE (`WinSta0\exebox-...`). Sau mỗi lần sửa code/cấu hình, bắt buộc cập nhật đầu `CHANGELOG.md`, chạy `node scripts/verify.mjs`, và restart daemon qua `stop.bat` → `schtasks /Run /TN "AntigravityDiscordBridge"`.
