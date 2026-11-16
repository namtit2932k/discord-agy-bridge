import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CARD_RENDER_PS_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$width = 720
$height = if ([string]::IsNullOrWhiteSpace($env:CARD_SUBTITLE)) { 260 } else { 290 }
$textWidth = $width - 48
$avatarSize = 144
$avatarX = [int](($width - $avatarSize) / 2)
$avatarY = 18

$ringParts = ($env:CARD_RING_RGB -split ',')
$ringColor = [System.Drawing.Color]::FromArgb(255, [int]$ringParts[0], [int]$ringParts[1], [int]$ringParts[2])

$bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Near

$fontFamily = New-Object System.Drawing.FontFamily('Segoe UI')

$drawnAvatar = $false
if (-not [string]::IsNullOrWhiteSpace($env:CARD_AVATAR_PATH) -and (Test-Path -LiteralPath $env:CARD_AVATAR_PATH)) {
  try {
    $clipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $clipPath.AddEllipse($avatarX + 2, $avatarY + 2, $avatarSize - 4, $avatarSize - 4)
    $state = $g.Save()
    $g.SetClip($clipPath)
    $avatarImg = [System.Drawing.Image]::FromFile($env:CARD_AVATAR_PATH)
    $g.DrawImage($avatarImg, $avatarX + 2, $avatarY + 2, $avatarSize - 4, $avatarSize - 4)
    $avatarImg.Dispose()
    $g.Restore($state)
    $clipPath.Dispose()
    $drawnAvatar = $true
  } catch {
    $drawnAvatar = $false
  }
}

if (-not $drawnAvatar) {
  $fallbackBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 88, 101, 242))
  $g.FillEllipse($fallbackBrush, $avatarX + 2, $avatarY + 2, $avatarSize - 4, $avatarSize - 4)
  $fallbackBrush.Dispose()

  $initial = if ([string]::IsNullOrWhiteSpace($env:CARD_FALLBACK_INITIAL)) { '?' } else { $env:CARD_FALLBACK_INITIAL }
  $initSf = New-Object System.Drawing.StringFormat
  $initSf.Alignment = [System.Drawing.StringAlignment]::Center
  $initSf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $initRect = New-Object System.Drawing.RectangleF($avatarX, $avatarY, $avatarSize, $avatarSize)
  $initPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $initPath.AddString($initial, $fontFamily, [int][System.Drawing.FontStyle]::Bold, 60, $initRect, $initSf)
  $initBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $g.FillPath($initBrush, $initPath)
  $initPath.Dispose()
  $initBrush.Dispose()
  $initSf.Dispose()
}

$ringPen = New-Object System.Drawing.Pen($ringColor, 6)
$g.DrawEllipse($ringPen, $avatarX, $avatarY, $avatarSize, $avatarSize)
$ringPen.Dispose()

$titleText = $env:CARD_TITLE
$titleSize = 32
while ($titleSize -gt 16) {
  $measureFont = New-Object System.Drawing.Font($fontFamily, $titleSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $measured = $g.MeasureString($titleText, $measureFont)
  $measureFont.Dispose()
  if ($measured.Width -le $textWidth) { break }
  $titleSize -= 2
}

$titleRect = New-Object System.Drawing.RectangleF(24, 182, $textWidth, 50)
$titlePath = New-Object System.Drawing.Drawing2D.GraphicsPath
$titlePath.AddString($titleText, $fontFamily, [int][System.Drawing.FontStyle]::Bold, $titleSize, $titleRect, $sf)
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
$g.FillPath($whiteBrush, $titlePath)
$titlePath.Dispose()
$whiteBrush.Dispose()

if (-not [string]::IsNullOrWhiteSpace($env:CARD_SUBTITLE)) {
  $subRect = New-Object System.Drawing.RectangleF(24, 232, $textWidth, 40)
  $subPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $subPath.AddString($env:CARD_SUBTITLE, $fontFamily, [int][System.Drawing.FontStyle]::Regular, 22, $subRect, $sf)
  $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 209, 213, 219))
  $g.FillPath($subBrush, $subPath)
  $subPath.Dispose()
  $subBrush.Dispose()
}

$sf.Dispose()
$fontFamily.Dispose()
$g.Dispose()
$bmp.Save($env:CARD_OUT_PATH, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
`;

/** Build the Discord CDN avatar URL (static PNG) for a guild member event payload. */
export function buildMemberAvatarUrl(data, guildId = "") {
  const userId = String(data?.user?.id || "").trim();
  const memberAvatar = String(data?.avatar || "").trim();
  const userAvatar = String(data?.user?.avatar || "").trim();

  if (guildId && userId && memberAvatar) {
    return `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${memberAvatar}.png?size=256`;
  }
  if (userId && userAvatar) {
    return `https://cdn.discordapp.com/avatars/${userId}/${userAvatar}.png?size=256`;
  }
  const discriminator = String(data?.user?.discriminator || "0");
  let index = 0;
  try {
    if (discriminator && discriminator !== "0") {
      index = Number(discriminator) % 5;
    } else if (/^\d+$/.test(userId)) {
      index = Number((BigInt(userId) >> 22n) % 6n);
    }
  } catch {
    index = 0;
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

/** Generate a transparent PNG welcome/leave banner matching Discord embed dark aesthetics. */
export async function renderAnnouncementCard({ kind = "join", username = "", memberCount = 0, avatarUrl = "" } = {}) {
  const isJoin = kind !== "leave";
  const cleanName = String(username || "Thành viên").replace(/[\r\n\t]+/g, " ").trim() || "Thành viên";
  const title = isJoin ? `${cleanName} vừa tham gia server` : `${cleanName} vừa rời khỏi server`;
  const hasCount = Number.isFinite(memberCount) && memberCount > 0;
  const subtitle = hasCount
    ? isJoin
      ? `Thành viên #${memberCount}`
      : `Còn lại ${memberCount} thành viên`
    : "";
  const fallbackInitial = (cleanName.match(/[\p{L}\p{N}]/u)?.[0] || "?").toUpperCase();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "discord-agy-card-"));
  const avatarPath = path.join(tempDir, "avatar.png");
  const outPath = path.join(tempDir, "card.png");

  try {
    let hasAvatarFile = false;
    if (avatarUrl) {
      try {
        const res = await fetch(avatarUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 0) {
            fs.writeFileSync(avatarPath, buf);
            hasAvatarFile = true;
          }
        }
      } catch {
        hasAvatarFile = false;
      }
    }

    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", CARD_RENDER_PS_SCRIPT],
      {
        windowsHide: true,
        timeout: 12000,
        env: {
          ...process.env,
          CARD_AVATAR_PATH: hasAvatarFile ? avatarPath : "",
          CARD_OUT_PATH: outPath,
          CARD_TITLE: title,
          CARD_SUBTITLE: subtitle,
          CARD_RING_RGB: isJoin ? "34,197,94" : "239,68,68",
          CARD_FALLBACK_INITIAL: fallbackInitial,
        },
      }
    );

    if (!fs.existsSync(outPath)) return null;
    return fs.readFileSync(outPath);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
