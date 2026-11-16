/** Discord Slash Commands (`/`) registry, autocomplete builder, and command normalizer. */

const CHOICE_MODES = [
  { name: "auto (tự chạy trong sandbox)", value: "auto" },
  { name: "accept-edits (tự sửa file)", value: "accept-edits" },
  { name: "plan (chỉ lập kế hoạch)", value: "plan" },
];

const CHOICE_ON_OFF = [
  { name: "on (bật)", value: "on" },
  { name: "off (tắt)", value: "off" },
];

function adminCmd(def) {
  return {
    type: 1,
    default_member_permissions: "8", // ADMINISTRATOR: ẩn hoàn toàn menu lệnh Admin với thành viên thường
    ...def,
  };
}

function memberCmd(def) {
  return {
    type: 1,
    ...def,
  };
}

export const SLASH_COMMANDS = [
  // --- Member commands (visible to everyone) ---
  memberCmd({
    name: "help",
    description: "Xem danh sách lệnh khả dụng trong kênh hiện tại",
  }),
  memberCmd({
    name: "status",
    description: "Xem model, thư mục làm việc và phân quyền hiện tại",
  }),
  memberCmd({
    name: "new",
    description: "Mở cuộc hội thoại AI mới (giữ nguyên model và thư mục)",
  }),
  memberCmd({
    name: "delete",
    description: "Xóa Thread hiện tại của bạn cùng dữ liệu hội thoại",
  }),
  memberCmd({
    name: "stop",
    description: "Dừng tác vụ AI đang chạy ở kênh hoặc Thread hiện tại",
  }),
  memberCmd({
    name: "usage",
    description: "Xem thống kê token và thời gian xử lý đã dùng",
  }),
  memberCmd({
    name: "play",
    description: "Phát nhạc/playlist trong Voice (YouTube, YT Music, SoundCloud, Spotify) hoặc queue/skip/stop",
    options: [
      {
        type: 3,
        name: "link-media",
        description: "Link bài/playlist (YouTube, YTM, SoundCloud, Spotify), tên bài hoặc skip/pause/stop/queue",
        required: true,
        autocomplete: true,
      },
      {
        type: 7,
        name: "voice",
        description: "Kênh Voice muốn bot vào (bỏ trống = tự vào phòng Voice bạn đang ngồi)",
        required: false,
        channel_types: [2, 13],
      },
    ],
  }),

  // --- Admin commands (hidden from non-admin members in Discord UI) ---
  adminCmd({
    name: "models",
    description: "Liệt kê toàn bộ model AI khả dụng từ agy",
  }),
  adminCmd({
    name: "model",
    description: "Xem hoặc đổi model AI cho kênh hiện tại",
    options: [
      {
        type: 3,
        name: "model_id",
        description: "Chọn model (bỏ trống để xem model hiện tại)",
        required: false,
        autocomplete: true,
      },
    ],
  }),
  adminCmd({
    name: "projects",
    description: "Liệt kê các Antigravity Projects đã lưu",
  }),
  adminCmd({
    name: "project",
    description: "Xem hoặc đổi Project / thư mục làm việc",
    options: [
      {
        type: 3,
        name: "target",
        description: "Tên project, đường dẫn thư mục, hoặc 'none' (chat tự do)",
        required: false,
        autocomplete: true,
      },
    ],
  }),
  adminCmd({
    name: "mode",
    description: "Đổi quyền thực thi của agy (auto / accept-edits / plan)",
    options: [
      {
        type: 3,
        name: "mode",
        description: "Chế độ thực thi (bỏ trống để xem hiện tại)",
        required: false,
        choices: CHOICE_MODES,
      },
    ],
  }),
  adminCmd({
    name: "sandbox",
    description: "Bật hoặc tắt terminal sandbox",
    options: [
      {
        type: 3,
        name: "state",
        description: "Bật (on) hoặc tắt (off)",
        required: false,
        choices: CHOICE_ON_OFF,
      },
    ],
  }),
  adminCmd({
    name: "access",
    description: "Phân quyền RBAC, auto-onboard và model thành viên",
    options: [
      {
        type: 1,
        name: "list",
        description: "Xem toàn bộ cấu hình phân quyền RBAC hiện tại",
      },
      {
        type: 2,
        name: "model",
        description: "Xem hoặc khóa model riêng cho thành viên và auto-onboard",
        options: [
          {
            type: 1,
            name: "status",
            description: "Xem cấu hình model hiện tại của các thành viên",
          },
          {
            type: 1,
            name: "auto",
            description: "Đặt model mặc định cho thành viên mới join (autoOnboard)",
            options: [
              {
                type: 3,
                name: "model_id",
                description: "Model cho thành viên mới (hoặc 'clear' để bỏ khóa)",
                required: true,
                autocomplete: true,
              },
            ],
          },
          {
            type: 1,
            name: "set",
            description: "Khóa model riêng cho phòng của một thành viên hoặc kênh",
            options: [
              {
                type: 3,
                name: "model_id",
                description: "Model áp dụng (hoặc 'clear' để gỡ khóa)",
                required: true,
                autocomplete: true,
              },
              {
                type: 6,
                name: "user",
                description: "Chọn thành viên cần khóa model",
                required: false,
              },
              {
                type: 7,
                name: "channel",
                description: "Hoặc chọn trực tiếp kênh thành viên",
                required: false,
              },
              {
                type: 3,
                name: "member_name",
                description: "Hoặc nhập tên thành viên nếu đang ở kênh Private",
                required: false,
              },
            ],
          },
        ],
      },
      {
        type: 1,
        name: "onboard",
        description: "Tạo phòng Private và thư mục sandbox cho một thành viên",
        options: [
          {
            type: 6,
            name: "user",
            description: "Chọn thành viên",
            required: false,
          },
          {
            type: 3,
            name: "member_name",
            description: "Hoặc nhập tên / user ID nếu Discord không gợi ý",
            required: false,
          },
        ],
      },
      {
        type: 1,
        name: "offboard",
        description: "Thu hồi quyền phòng onboarding của thành viên",
        options: [
          {
            type: 6,
            name: "user",
            description: "Chọn thành viên",
            required: false,
          },
          {
            type: 3,
            name: "member_name",
            description: "Hoặc nhập tên / user ID",
            required: false,
          },
          {
            type: 5,
            name: "delete_channel",
            description: "Xóa luôn kênh trên Discord?",
            required: false,
          },
        ],
      },
      {
        type: 1,
        name: "auto",
        description: "Bật/tắt hoặc xem trạng thái Auto-Onboard thành viên mới",
        options: [
          {
            type: 3,
            name: "state",
            description: "Bật (on) hoặc tắt (off), bỏ trống để xem trạng thái",
            required: false,
            choices: CHOICE_ON_OFF,
          },
        ],
      },
      {
        type: 1,
        name: "private",
        description: "Ẩn hoặc mở lại quyền xem của @everyone cho một kênh",
        options: [
          {
            type: 7,
            name: "channel",
            description: "Kênh cần ẩn/hiện (mặc định kênh hiện tại)",
            required: false,
          },
          {
            type: 3,
            name: "state",
            description: "on = ẩn thành Private, off = mở lại",
            required: false,
            choices: [
              { name: "on (ẩn thành Private)", value: "on" },
              { name: "off (mở lại cho @everyone)", value: "off" },
            ],
          },
        ],
      },
      {
        type: 1,
        name: "channel",
        description: "Cấp quyền thủ công cho kênh gắn vào thư mục an toàn",
        options: [
          {
            type: 7,
            name: "channel",
            description: "Kênh muốn cấp quyền",
            required: true,
          },
          {
            type: 3,
            name: "cwd",
            description: "Đường dẫn thư mục an toàn trên máy",
            required: true,
          },
          {
            type: 6,
            name: "user",
            description: "Thành viên được phép dùng",
            required: false,
          },
          {
            type: 8,
            name: "role",
            description: "Role được phép dùng",
            required: false,
          },
          {
            type: 5,
            name: "everyone",
            description: "Cho phép mọi người trong kênh dùng?",
            required: false,
          },
          {
            type: 3,
            name: "mode",
            description: "Chế độ thực thi",
            required: false,
            choices: CHOICE_MODES,
          },
          {
            type: 5,
            name: "sandbox",
            description: "Bật terminal sandbox?",
            required: false,
          },
          {
            type: 5,
            name: "desktop",
            description: "Cho phép điều khiển app Windows / chụp màn hình?",
            required: false,
          },
          {
            type: 5,
            name: "chrome",
            description: "Cho phép điều khiển Chrome AM?",
            required: false,
          },
          {
            type: 5,
            name: "allow_model_change",
            description: "Cho phép thành viên tự dùng /model?",
            required: false,
          },
        ],
      },
      {
        type: 1,
        name: "revoke",
        description: "Gỡ rule phân quyền RBAC khỏi một kênh",
        options: [
          {
            type: 7,
            name: "channel",
            description: "Kênh cần gỡ rule",
            required: true,
          },
        ],
      },
      {
        type: 1,
        name: "admin",
        description: "Thêm hoặc gỡ Co-Admin cho bot",
        options: [
          {
            type: 3,
            name: "action",
            description: "Thao tác",
            required: true,
            choices: [
              { name: "add (thêm Co-Admin)", value: "add" },
              { name: "remove (gỡ Co-Admin)", value: "remove" },
            ],
          },
          {
            type: 6,
            name: "user",
            description: "Người dùng",
            required: true,
          },
        ],
      },
      {
        type: 1,
        name: "quota",
        description: "Xem hoặc đặt hạn mức lượt/ngày, cooldown và token cho Member",
        options: [
          {
            type: 4,
            name: "daily_turns",
            description: "Số lượt tối đa mỗi ngày/member (0 = không giới hạn)",
            required: false,
            min_value: 0,
            max_value: 5000,
          },
          {
            type: 4,
            name: "cooldown_sec",
            description: "Thời gian chờ giữa 2 tin nhắn (giây, 0 = tắt)",
            required: false,
            min_value: 0,
            max_value: 3600,
          },
          {
            type: 4,
            name: "daily_tokens",
            description: "Giới hạn tổng token/ngày cho 1 member (0 = không giới hạn)",
            required: false,
            min_value: 0,
            max_value: 100000000,
          },
          {
            type: 6,
            name: "user",
            description: "Chỉ áp dụng riêng cho thành viên này (bỏ trống = toàn server)",
            required: false,
          },
        ],
      },
      {
        type: 1,
        name: "security",
        description: "Siết chế độ thực thi, chặn BypassSandbox và giới hạn ổ đĩa Member",
        options: [
          {
            type: 3,
            name: "member_mode",
            description: "Chế độ mặc định cho phòng thành viên",
            required: false,
            choices: [
              { name: "auto (cho phép tạo file/chạy sandbox)", value: "auto" },
              { name: "plan (chỉ chat/đọc file, cấm chạy lệnh PC)", value: "plan" },
            ],
          },
          {
            type: 3,
            name: "block_bypass_sandbox",
            description: "Tự dừng & báo Admin nếu phòng Member cố BypassSandbox?",
            required: false,
            choices: CHOICE_ON_OFF,
          },
          {
            type: 4,
            name: "workspace_max_mb",
            description: "Dung lượng tối đa thư mục phòng Member (MB, 0 = không giới hạn)",
            required: false,
            min_value: 0,
            max_value: 10000,
          },
        ],
      },
      {
        type: 1,
        name: "report",
        description: "Xem, gửi ngay hoặc hẹn giờ báo cáo tổng kết cuối ngày về #admin",
        options: [
          {
            type: 3,
            name: "action",
            description: "Hành động (mặc định: xem trạng thái)",
            required: false,
            choices: [
              { name: "status (xem trạng thái hiện tại)", value: "status" },
              { name: "now (gửi báo cáo tổng kết ngay)", value: "now" },
              { name: "on (bật tự động gửi hàng ngày)", value: "on" },
              { name: "off (tắt tự động gửi)", value: "off" },
            ],
          },
          {
            type: 3,
            name: "time",
            description: "Giờ gửi hàng ngày dạng HH:MM (vd: 22:00)",
            required: false,
          },
          {
            type: 7,
            name: "channel",
            description: "Kênh nhận báo cáo (mặc định #admin)",
            required: false,
          },
        ],
      },
    ],
  }),
  adminCmd({
    name: "cron",
    description: "Quản lý lịch chạy AI tự động (every / in / daily / POSIX)",
    options: [
      {
        type: 1,
        name: "list",
        description: "Xem danh sách lịch Cron đang có",
      },
      {
        type: 1,
        name: "add",
        description: "Tạo lịch chạy tự động mới",
        options: [
          {
            type: 3,
            name: "schedule",
            description: "Lịch (vd: 'every 30m', 'daily 08:30', '0 9 * * 1-5')",
            required: true,
          },
          {
            type: 3,
            name: "prompt",
            description: "Câu lệnh hoặc yêu cầu gửi cho agy",
            required: true,
          },
          {
            type: 5,
            name: "here",
            description: "Chạy thẳng ở kênh này thay vì tạo Thread mới?",
            required: false,
          },
        ],
      },
      {
        type: 1,
        name: "pause",
        description: "Tạm dừng một Cron job",
        options: [
          { type: 3, name: "id", description: "ID của Cron job", required: true, autocomplete: true },
        ],
      },
      {
        type: 1,
        name: "resume",
        description: "Bật lại một Cron job",
        options: [
          { type: 3, name: "id", description: "ID của Cron job", required: true, autocomplete: true },
        ],
      },
      {
        type: 1,
        name: "del",
        description: "Xóa một Cron job",
        options: [
          { type: 3, name: "id", description: "ID của Cron job", required: true, autocomplete: true },
        ],
      },
      {
        type: 1,
        name: "run",
        description: "Chạy ngay một Cron job để kiểm tra",
        options: [
          { type: 3, name: "id", description: "ID của Cron job", required: true, autocomplete: true },
        ],
      },
    ],
  }),
  adminCmd({
    name: "webhook",
    description: "Kiểm tra trạng thái HTTP Webhook hoặc bắn sự kiện test",
    options: [
      { type: 1, name: "status", description: "Xem trạng thái HTTP Webhook Server" },
      {
        type: 1,
        name: "test",
        description: "Bắn một payload test vào hookId",
        options: [
          { type: 3, name: "hook_id", description: "ID của webhook hook", required: true, autocomplete: true },
        ],
      },
    ],
  }),
  adminCmd({
    name: "chrome",
    description: "Xem tab đang mở hoặc đóng riêng Chrome AM (port 9229)",
    options: [
      { type: 1, name: "status", description: "Xem các tab đang mở trên Chrome AM" },
      { type: 1, name: "close", description: "Đóng riêng tiến trình Chrome AM" },
    ],
  }),
  adminCmd({
    name: "windows",
    description: "Xem, focus hoặc đóng cửa sổ ứng dụng trên Desktop thật",
    options: [
      { type: 1, name: "list", description: "Liệt kê các cửa sổ GUI đang mở" },
      {
        type: 1,
        name: "focus",
        description: "Đưa một cửa sổ lên trên cùng",
        options: [{ type: 3, name: "target", description: "PID hoặc từ khóa tiêu đề cửa sổ", required: true }],
      },
      {
        type: 1,
        name: "close",
        description: "Đóng an toàn một cửa sổ qua WM_CLOSE",
        options: [{ type: 3, name: "target", description: "PID hoặc từ khóa tiêu đề cửa sổ", required: true }],
      },
    ],
  }),
  memberCmd({
    name: "clear",
    description: "Xóa tin nhắn trong kênh của bạn (giữ Thread và cấu hình)",
    options: [
      {
        type: 4,
        name: "count",
        description: "Số lượng tin nhắn cần xóa (bỏ trống để xóa toàn bộ)",
        required: false,
        min_value: 1,
        max_value: 500,
      },
    ],
  }),
  adminCmd({
    name: "footer",
    description: "Bật/tắt dòng thống kê model và token cuối câu trả lời",
    options: [
      { type: 3, name: "state", description: "on hoặc off (bỏ trống để đảo)", required: false, choices: CHOICE_ON_OFF },
      {
        type: 3,
        name: "scope",
        description: "Phạm vi áp dụng (mặc định: kênh/Thread hiện tại)",
        required: false,
        choices: [
          { name: "Kênh / Thread hiện tại", value: "channel" },
          { name: "Toàn server (mọi kênh & mặc định mới)", value: "all" },
        ],
      },
    ],
  }),
  adminCmd({
    name: "autothread",
    description: "Bật/tắt tự tạo Thread cho mỗi câu hỏi ở kênh chính",
    options: [
      { type: 3, name: "state", description: "on hoặc off (bỏ trống để đảo)", required: false, choices: CHOICE_ON_OFF },
      {
        type: 3,
        name: "scope",
        description: "Phạm vi áp dụng (mặc định: kênh hiện tại)",
        required: false,
        choices: [
          { name: "Kênh hiện tại", value: "channel" },
          { name: "Toàn server (mọi kênh & mặc định mới)", value: "all" },
        ],
      },
    ],
  }),
  adminCmd({
    name: "stream",
    description: "Bật/tắt cập nhật tiến độ từng bước trong lúc xử lý",
    options: [
      { type: 3, name: "state", description: "on hoặc off (bỏ trống để đảo)", required: false, choices: CHOICE_ON_OFF },
      {
        type: 3,
        name: "scope",
        description: "Phạm vi áp dụng (mặc định: kênh/Thread hiện tại)",
        required: false,
        choices: [
          { name: "Kênh / Thread hiện tại", value: "channel" },
          { name: "Toàn server (mọi kênh & mặc định mới)", value: "all" },
        ],
      },
    ],
  }),
  adminCmd({
    name: "guide",
    description: "Đồng bộ lại nội dung hướng dẫn sang #instructions",
    options: [
      {
        type: 5,
        name: "reset",
        description: "Xóa toàn bộ tin nhắn cũ trong #instructions trước khi đăng lại?",
        required: false,
      },
    ],
  }),
  adminCmd({
    name: "cleanup",
    description: "Dọn ngay file tạm ảnh và tệp đính kèm quá hạn (>7 ngày)",
  }),
  adminCmd({
    name: "logs",
    description: "Xem N dòng cuối của bot.log (tự động che token/secret)",
    options: [
      {
        type: 4,
        name: "lines",
        description: "Số dòng cần xem (mặc định 25, tối đa 80)",
        required: false,
        min_value: 5,
        max_value: 80,
      },
    ],
  }),
  adminCmd({
    name: "reload",
    description: "Nạp lại config.json ngay lập tức không cần tắt bot",
  }),
];

/** Wrap text in double quotes when it contains whitespace for splitCommandArgs(). */
function quoteArg(val) {
  const s = String(val ?? "").replace(/"/g, "'").trim();
  if (!s) return "";
  return /\s/.test(s) ? `"${s}"` : s;
}

/** Extract { subGroup, subCommand, options, focused } cleanly from an Interaction data object. */
export function parseInteractionOptions(data) {
  const optsList = Array.isArray(data?.options) ? data.options : [];
  let subGroup = "";
  let subCommand = "";
  let leafOptions = optsList;

  if (optsList[0]?.type === 2) {
    subGroup = optsList[0].name;
    const sub = Array.isArray(optsList[0].options) ? optsList[0].options[0] : null;
    if (sub?.type === 1) {
      subCommand = sub.name;
      leafOptions = Array.isArray(sub.options) ? sub.options : [];
    }
  } else if (optsList[0]?.type === 1) {
    subCommand = optsList[0].name;
    leafOptions = Array.isArray(optsList[0].options) ? optsList[0].options : [];
  }

  const options = {};
  let focused = null;
  for (const item of leafOptions) {
    options[item.name] = item.value;
    if (item.focused) {
      focused = { name: item.name, value: String(item.value ?? "") };
    }
  }
  return { subGroup, subCommand, options, focused };
}

/** Convert an incoming Slash Command Interaction into a normalized `/cmd ...` command string. */
export function interactionToCommand(data) {
  const cmdName = String(data?.name || "").toLowerCase();
  const { subGroup, subCommand, options } = parseInteractionOptions(data);

  switch (cmdName) {
    case "help":
    case "status":
    case "new":
    case "delete":
    case "stop":
    case "usage":
    case "models":
    case "projects":
    case "cleanup":
    case "reload":
      return `/${cmdName}`;

    case "model": {
      if (!options.model_id) return "/model";
      return `/model ${options.model_id}`;
    }

    case "project":
      return options.target ? `/project ${options.target}` : "/project";

    case "mode":
      return options.mode ? `/mode ${options.mode}` : "/mode";

    case "sandbox":
      return options.state ? `/sandbox ${options.state}` : "/sandbox";

    case "clear":
      return options.count !== undefined ? `/clear ${options.count}` : "/clear";

    case "play": {
      const q = String(options["link-media"] || options.query || "").trim();
      const parts = ["/play", q];
      if (options.voice) parts.push(`voice:${options.voice}`);
      return parts.filter(Boolean).join(" ");
    }

    case "footer":
    case "autothread":
    case "stream": {
      const parts = [`/${cmdName}`];
      if (options.state) parts.push(options.state);
      if (options.scope && options.scope !== "channel") parts.push(options.scope);
      return parts.join(" ");
    }

    case "guide":
      return options.reset ? "/guide reset" : "/guide";

    case "logs":
      return options.lines !== undefined ? `/logs ${options.lines}` : "/logs";

    case "cron": {
      if (!subCommand || subCommand === "list") return "/cron list";
      if (subCommand === "add") {
        const parts = ["/cron", "add", quoteArg(options.schedule), quoteArg(options.prompt)];
        if (options.here) parts.push("--here");
        return parts.filter(Boolean).join(" ");
      }
      return `/cron ${subCommand} ${options.id || ""}`.trim();
    }

    case "webhook":
      if (subCommand === "test") return `/webhook test ${options.hook_id || ""}`.trim();
      return "/webhook status";

    case "chrome":
      return subCommand ? `/chrome ${subCommand}` : "/chrome status";

    case "windows": {
      if (!subCommand || subCommand === "list") return "/windows list";
      return `/windows ${subCommand} ${quoteArg(options.target)}`.trim();
    }

    case "access": {
      if (!subGroup && (!subCommand || subCommand === "list")) return "/access list";
      if (subGroup === "model") {
        if (!subCommand || subCommand === "status") return "/access model";
        if (subCommand === "auto") {
          return ["/access", "model", "auto", options.model_id].filter(Boolean).join(" ");
        }
        if (subCommand === "set") {
          const target = options.user
            ? `<@${options.user}>`
            : options.channel
              ? `<#${options.channel}>`
              : quoteArg(options.member_name);
          if (!target) return "/access model";
          return ["/access", "model", target, options.model_id].filter(Boolean).join(" ");
        }
      }
      if (subCommand === "onboard") {
        const target = options.user ? `<@${options.user}>` : quoteArg(options.member_name);
        return target ? `/access onboard ${target}` : "/access onboard";
      }
      if (subCommand === "offboard") {
        const target = options.user ? `<@${options.user}>` : quoteArg(options.member_name);
        const parts = ["/access", "offboard", target];
        if (options.delete_channel) parts.push("--delete-channel");
        return parts.filter(Boolean).join(" ");
      }
      if (subCommand === "auto") {
        return options.state ? `/access auto ${options.state}` : "/access auto";
      }
      if (subCommand === "private") {
        const parts = ["/access", "private"];
        if (options.channel) parts.push(`<#${options.channel}>`);
        if (options.state) parts.push(options.state);
        return parts.join(" ");
      }
      if (subCommand === "channel") {
        const parts = ["/access", "channel", `<#${options.channel}>`, quoteArg(options.cwd)];
        if (options.user) parts.push(`users:<@${options.user}>`);
        if (options.role) parts.push(`roles:<@&${options.role}>`);
        if (options.everyone !== undefined) parts.push(`everyone:${options.everyone ? "on" : "off"}`);
        if (options.mode) parts.push(`mode:${options.mode}`);
        if (options.sandbox !== undefined) parts.push(`sandbox:${options.sandbox ? "on" : "off"}`);
        if (options.desktop !== undefined) parts.push(`desktop:${options.desktop ? "on" : "off"}`);
        if (options.chrome !== undefined) parts.push(`chrome:${options.chrome ? "on" : "off"}`);
        if (options.allow_model_change !== undefined) parts.push(`model:${options.allow_model_change ? "on" : "off"}`);
        return parts.filter(Boolean).join(" ");
      }
      if (subCommand === "revoke") {
        return options.channel ? `/access revoke <#${options.channel}>` : "/access revoke";
      }
      if (subCommand === "admin") {
        return `/access admin ${options.action || ""} ${options.user ? `<@${options.user}>` : ""}`.trim();
      }
      if (subCommand === "quota") {
        const parts = ["/access", "quota"];
        if (options.user) parts.push(`user:<@${options.user}>`);
        if (options.daily_turns !== undefined) parts.push(`daily_turns:${options.daily_turns}`);
        if (options.cooldown_sec !== undefined) parts.push(`cooldown_sec:${options.cooldown_sec}`);
        if (options.daily_tokens !== undefined) parts.push(`daily_tokens:${options.daily_tokens}`);
        return parts.join(" ");
      }
      if (subCommand === "security") {
        const parts = ["/access", "security"];
        if (options.member_mode) parts.push(`member_mode:${options.member_mode}`);
        if (options.block_bypass_sandbox) parts.push(`block_bypass_sandbox:${options.block_bypass_sandbox}`);
        if (options.workspace_max_mb !== undefined) parts.push(`workspace_max_mb:${options.workspace_max_mb}`);
        return parts.join(" ");
      }
      if (subCommand === "report") {
        const parts = ["/access", "report", options.action || "status"];
        if (options.time) parts.push(options.time);
        if (options.channel) parts.push(`<#${options.channel}>`);
        return parts.join(" ");
      }
      return "/access list";
    }

    default:
      return `/${cmdName}`;
  }
}

/** Build up to 25 Discord autocomplete choices for model, project, cron, and webhook options. */
export function buildAutocompleteChoices({
  commandName,
  subGroup,
  subCommand,
  focused,
  models = [],
  projects = [],
  cronJobs = [],
  webhookIds = [],
}) {
  if (!focused?.name) return [];
  const query = String(focused.value || "").trim().toLowerCase();

  if (commandName === "play" && (focused.name === "link-media" || focused.name === "query")) {
    const quickActions = [
      { name: "queue — Xem bài đang phát & hàng chờ", value: "queue" },
      { name: "skip — Chuyển sang bài kế tiếp", value: "skip" },
      { name: "shuffle — Xáo trộn ngẫu nhiên hàng chờ", value: "shuffle" },
      { name: "repeat — Lặp lại toàn bộ hàng chờ", value: "repeat" },
      { name: "repeat-one — Lặp lại 1 bài hiện tại", value: "repeat-one" },
      { name: "sequential — Phát tuần tự theo thứ tự", value: "sequential" },
      { name: "clear — Xóa sạch hàng chờ (giữ bài đang phát)", value: "clear" },
      { name: "pause — Tạm dừng nhạc", value: "pause" },
      { name: "resume — Tiếp tục phát nhạc", value: "resume" },
      { name: "stop — Dừng nhạc & cho bot rời phòng Voice", value: "stop" },
    ];
    if (!query) return quickActions;
    const matched = quickActions.filter((a) => a.value.includes(query) || a.name.toLowerCase().includes(query));
    return [{ name: String(focused.value).slice(0, 100), value: String(focused.value).slice(0, 100) }, ...matched].slice(0, 25);
  }

  if (focused.name === "model_id") {
    const candidates = [];
    if (commandName === "access" && subGroup === "model") {
      candidates.push({ name: "clear (Gỡ khóa, dùng lại mặc định)", value: "clear" });
    }
    for (const m of models) {
      if (!m?.id) continue;
      const display = m.label ? `${m.id} — ${m.label}` : m.id;
      candidates.push({
        name: display.slice(0, 100),
        value: String(m.id).slice(0, 100),
      });
    }
    const filtered = query
      ? candidates.filter(
          (c) => c.name.toLowerCase().includes(query) || c.value.toLowerCase().includes(query)
        )
      : candidates;
    if (filtered.length === 0 && query) {
      return [{ name: query.slice(0, 100), value: query.slice(0, 100) }];
    }
    return filtered.slice(0, 25);
  }

  if (commandName === "project" && focused.name === "target") {
    const candidates = [{ name: "none — Gỡ project (chat tự do)", value: "none" }];
    for (const p of projects) {
      if (!p?.name) continue;
      const label = p.folderPath ? `${p.name} (${p.folderPath})` : p.name;
      candidates.push({
        name: label.slice(0, 100),
        value: String(p.name).slice(0, 100),
      });
    }
    return candidates
      .filter((c) => !query || c.name.toLowerCase().includes(query) || c.value.toLowerCase().includes(query))
      .slice(0, 25);
  }

  if (commandName === "cron" && focused.name === "id") {
    return cronJobs
      .filter((j) => !query || j.id.toLowerCase().includes(query) || String(j.expr || "").toLowerCase().includes(query))
      .slice(0, 25)
      .map((j) => ({
        name: `${j.id} — ${j.expr}${j.enabled ? "" : " [tạm dừng]"}`.slice(0, 100),
        value: String(j.id).slice(0, 100),
      }));
  }

  if (commandName === "webhook" && subCommand === "test" && focused.name === "hook_id") {
    return webhookIds
      .filter((id) => !query || id.toLowerCase().includes(query))
      .slice(0, 25)
      .map((id) => ({
        name: String(id).slice(0, 100),
        value: String(id).slice(0, 100),
      }));
  }

  return [];
}
