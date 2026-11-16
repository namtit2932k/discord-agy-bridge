import fs from "node:fs";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { createRequire } from "node:module";

const SHARED_TOOLS_PKG_JSON = "C:\\ProgramData\\agy-shared-tools\\package.json";
const DEFAULT_YTDLP_PATH = "C:\\ProgramData\\agy-shared-tools\\bin\\yt-dlp.exe";
const DEFAULT_FFMPEG_PATH = "C:\\ffmpeg\\ffmpeg.exe";
const MAX_QUEUE_SIZE = 50;
const MAX_PLAYLIST_IMPORT = 25;
const MAX_EMBED_QUEUE_PREVIEW = 5;
const IDLE_DISCONNECT_MS = 2 * 60 * 1000;
const EMPTY_ROOM_DISCONNECT_MS = 60 * 1000;
const PAUSED_DISCONNECT_MS = 10 * 60 * 1000;

let voiceLibCache = null;

/** Lazy-load @discordjs/voice from C:\ProgramData\agy-shared-tools without adding repo node_modules. */
export function loadVoiceModule() {
  if (voiceLibCache) return voiceLibCache;
  if (!fs.existsSync(SHARED_TOOLS_PKG_JSON)) {
    throw new Error(`Missing voice dependencies manifest: ${SHARED_TOOLS_PKG_JSON}`);
  }
  const req = createRequire(SHARED_TOOLS_PKG_JSON);
  voiceLibCache = req("@discordjs/voice");
  return voiceLibCache;
}

/** Resolve yt-dlp executable path (shared tools bin or PATH fallback). */
export function resolveYtDlpPath() {
  return fs.existsSync(DEFAULT_YTDLP_PATH) ? DEFAULT_YTDLP_PATH : "yt-dlp";
}

/** Resolve ffmpeg executable path (C:\ffmpeg or PATH fallback). */
export function resolveFfmpegPath() {
  return fs.existsSync(DEFAULT_FFMPEG_PATH) ? DEFAULT_FFMPEG_PATH : "ffmpeg";
}

/** Format duration in seconds into mm:ss, hh:mm:ss, or LIVE. */
export function formatDuration(rawSeconds, isLive = false) {
  if (isLive) return "LIVE";
  const sec = Number(rawSeconds);
  if (!Number.isFinite(sec) || sec <= 0) return "--:--";
  const whole = Math.floor(sec);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Classify user media input into platform type and normalized URL/search string. */
export function detectMediaSource(rawInput) {
  const input = String(rawInput || "").trim().replace(/^<|>$/g, "");
  if (!input) return { kind: "empty", input: "" };

  if (/^https?:\/\//i.test(input)) {
    let parsed;
    try {
      parsed = new URL(input);
    } catch {
      return { kind: "search", input };
    }
    const host = parsed.hostname.toLowerCase();
    if (host === "open.spotify.com" || host === "play.spotify.com" || host === "spotify.link" || host.endsWith(".spotify.com")) {
      return { kind: "spotify", input };
    }
    if (host === "music.youtube.com") {
      return { kind: "youtube_music", input };
    }
    if (host.includes("youtube.com") || host === "youtu.be") {
      return { kind: "youtube", input };
    }
    if (host.includes("soundcloud.com")) {
      return { kind: "soundcloud", input };
    }
    if (/\.(?:mp3|ogg|opus|wav|flac|m4a|aac|webm)(?:$|\?)/i.test(parsed.pathname)) {
      return { kind: "direct_audio", input };
    }
    return { kind: "url", input };
  }

  return { kind: "search", input };
}

/** Return true if a URL refers to a multi-track playlist/album/set on YouTube, YT Music, or SoundCloud. */
export function isPlaylistUrl(kind, rawInput) {
  if (!rawInput || !["youtube", "youtube_music", "soundcloud"].includes(kind)) return false;
  let parsed;
  try {
    parsed = new URL(String(rawInput).trim().replace(/^<|>$/g, ""));
  } catch {
    return false;
  }
  const pathname = parsed.pathname.toLowerCase();
  if (kind === "soundcloud") {
    return /\/sets(?:\/|$)|\/albums(?:\/|$)/i.test(pathname);
  }
  if (/\/playlist(?:\/|$)|\/browse\//i.test(pathname)) return true;
  return Boolean(parsed.searchParams.get("list"));
}

/** Parse Spotify embed HTML __NEXT_DATA__ to extract track or playlist items without API keys. */
export function parseSpotifyEmbedHtml(html) {
  const raw = String(html || "");
  const marker = 'type="application/json">';
  const idx = raw.indexOf(marker);
  if (idx === -1) return null;
  const end = raw.indexOf("</script>", idx);
  if (end === -1) return null;

  let data;
  try {
    data = JSON.parse(raw.slice(idx + marker.length, end));
  } catch {
    return null;
  }

  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity || typeof entity !== "object") return null;

  if (Array.isArray(entity.trackList) && entity.trackList.length > 0) {
    const items = entity.trackList
      .slice(0, MAX_PLAYLIST_IMPORT)
      .map((t) => {
        const title = String(t?.title || t?.name || "").trim();
        const artist = String(t?.subtitle || (Array.isArray(t?.artists) ? t.artists.map((a) => a.name).join(", ") : "") || "").trim();
        const uri = String(t?.uri || "").trim();
        const trackUrl = uri.startsWith("spotify:track:")
          ? `https://open.spotify.com/track/${uri.split(":")[2]}`
          : "";
        const rawDur = Number(t?.duration);
        const durationSec = Number.isFinite(rawDur) && rawDur > 0 ? Math.round(rawDur / 1000) : 0;
        return title
          ? { title, artist, trackUrl, durationSec, searchQuery: artist ? `${title} ${artist}` : title }
          : null;
      })
      .filter(Boolean);
    if (items.length > 0) {
      return { isCollection: true, collectionTitle: String(entity.name || entity.title || "Spotify Playlist"), items };
    }
  }

  const name = String(entity.name || entity.title || "").trim();
  if (!name) return null;
  const artists = Array.isArray(entity.artists) ? entity.artists.map((a) => a?.name).filter(Boolean).join(", ") : "";
  const rawDur = Number(entity.duration);
  const durationSec = Number.isFinite(rawDur) && rawDur > 0 ? Math.round(rawDur / 1000) : 0;
  return {
    isCollection: false,
    items: [{ title: name, artist: artists, durationSec, searchQuery: artists ? `${name} ${artists}` : name }],
  };
}

/** Resolve Spotify track/album/playlist URL into searchable title+artist queries. */
export async function resolveSpotifyMetadata(rawUrl) {
  let targetUrl = String(rawUrl || "").trim();
  const parsed0 = new URL(targetUrl);
  if (parsed0.hostname.toLowerCase() === "spotify.link") {
    const resp = await fetch(targetUrl, { redirect: "follow", signal: AbortSignal.timeout(10000) }).catch(() => null);
    if (resp?.url) targetUrl = resp.url;
  }

  const parsed = new URL(targetUrl);
  const pathParts = parsed.pathname.split("/").filter(Boolean).filter((p) => !/^intl-[a-z-]+$/i.test(p));
  const entityType = pathParts[0] || "";
  const entityId = pathParts[1] || "";

  if (entityType && entityId && ["track", "album", "playlist", "episode"].includes(entityType)) {
    const embedUrl = `https://open.spotify.com/embed/${entityType}/${entityId}`;
    const html = await fetch(embedUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    })
      .then((r) => (r.ok ? r.text() : ""))
      .catch(() => "");
    const parsedEmbed = parseSpotifyEmbedHtml(html);
    if (parsedEmbed?.items?.length) {
      return parsedEmbed;
    }
  }

  const oe = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(targetUrl)}`, {
    signal: AbortSignal.timeout(10000),
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (oe?.title) {
    return {
      isCollection: false,
      items: [{ title: String(oe.title).trim(), artist: "", searchQuery: String(oe.title).trim() }],
    };
  }
  throw new Error("Không đọc được thông tin bài hát từ link Spotify này.");
}

function runYtDlpJson(args, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    execFile(
      resolveYtDlpPath(),
      args,
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 12 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const msg = String(stderr || err.message || "yt-dlp failed").trim();
          reject(new Error(msg.slice(0, 300)));
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch (parseErr) {
          reject(new Error(`Không đọc được metadata từ yt-dlp: ${parseErr.message}`));
        }
      }
    );
  });
}

/** Return true if a yt-dlp stream is already 48kHz stereo Opus inside WebM/Ogg and can bypass CPU re-encoding. */
export function canCopyOpusStream(entry) {
  if (!entry || typeof entry !== "object") return false;
  const acodec = String(entry.acodec || "").toLowerCase();
  const ext = String(entry.ext || "").toLowerCase();
  const asr = Number(entry.asr || 0);
  const channels = Number(entry.audio_channels || 0);
  if (acodec !== "opus") return false;
  if (ext && !["webm", "ogg", "opus"].includes(ext)) return false;
  if (asr && asr !== 48000) return false;
  if (channels && channels !== 2) return false;
  return true;
}

function pickAllowedHeaders(rawHeaders) {
  if (!rawHeaders || typeof rawHeaders !== "object") return {};
  const kept = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    if (k && v && /^(user-agent|referer|origin|cookie|accept)$/i.test(k)) {
      kept[k] = String(v).replace(/[\r\n]+/g, " ");
    }
  }
  return kept;
}

function normalizeYtDlpEntry(entry, platformLabel, requestedBy) {
  return {
    title: String(entry?.title || "Audio Track").trim(),
    artist: String(entry?.artist || entry?.uploader || entry?.channel || "").trim(),
    durationSec: Number(entry?.duration) || 0,
    isLive: Boolean(entry?.is_live),
    webpageUrl: String(entry?.webpage_url || entry?.original_url || entry?.url || "").trim(),
    streamUrl: String(entry?.url || "").trim(),
    copyOpus: canCopyOpusStream(entry),
    httpHeaders: pickAllowedHeaders(entry?.http_headers),
    platform: platformLabel,
    requestedBy,
    lazySearchQuery: "",
  };
}

/** Resolve any YouTube, YouTube Music, SoundCloud, Spotify, direct audio URL, or search query into playable track items. */
export async function resolveMediaTracks(rawQuery, requestedBy = "Member") {
  const src = detectMediaSource(rawQuery);
  if (src.kind === "empty") {
    throw new Error("Hãy nhập link YouTube / YouTube Music / SoundCloud / Spotify hoặc tên bài hát.");
  }

  if (src.kind === "direct_audio") {
    const fileName = decodeURIComponent(path.basename(new URL(src.input).pathname || "audio"));
    return {
      tracks: [
        {
          title: fileName || src.input,
          artist: "",
          durationSec: 0,
          isLive: false,
          webpageUrl: src.input,
          streamUrl: src.input,
          httpHeaders: {},
          platform: "Direct Audio",
          requestedBy,
          lazySearchQuery: "",
        },
      ],
      note: "",
    };
  }

  if (src.kind === "spotify") {
    const sp = await resolveSpotifyMetadata(src.input);
    const tracks = [];
    let firstPlayable = null;
    let firstMeta = null;

    for (const candidate of sp.items) {
      if (!candidate?.searchQuery) continue;
      if (!firstPlayable) {
        try {
          const resolvedFirst = await resolveMediaTracks(candidate.searchQuery, requestedBy);
          if (resolvedFirst.tracks[0]) {
            firstPlayable = resolvedFirst.tracks[0];
            firstMeta = candidate;
            tracks.push({
              ...firstPlayable,
              title: candidate.artist ? `${candidate.title} — ${candidate.artist}` : candidate.title,
              platform: "Spotify → YouTube",
              webpageUrl: candidate.trackUrl || src.input,
            });
            continue;
          }
        } catch {
          // Try next track if the first item in collection failed to match
        }
      }
      tracks.push({
        title: candidate.artist ? `${candidate.title} — ${candidate.artist}` : candidate.title,
        artist: candidate.artist,
        durationSec: candidate.durationSec || 0,
        isLive: false,
        webpageUrl: candidate.trackUrl || src.input,
        streamUrl: "",
        httpHeaders: {},
        platform: "Spotify → YouTube",
        requestedBy,
        lazySearchQuery: candidate.searchQuery,
      });
    }

    if (tracks.length === 0 || !firstPlayable || !firstMeta) {
      throw new Error("Không tìm thấy bản phát phù hợp cho link Spotify này.");
    }
    return {
      tracks,
      note: sp.isCollection ? `Đã nạp **${tracks.length}** bài từ **${sp.collectionTitle}**` : "",
    };
  }

  const platformNames = {
    youtube: "YouTube",
    youtube_music: "YouTube Music",
    soundcloud: "SoundCloud",
    search: "YouTube Search",
    url: "Media URL",
  };
  const label = platformNames[src.kind] || "Media";

  const isExplicitCollection = isPlaylistUrl(src.kind, src.input);

  const targetArg = src.kind === "search" ? `ytsearch1:${src.input}` : src.input;
  const baseYtArgs = [
    "-f",
    "bestaudio[acodec=opus][abr>=96]/bestaudio/best",
    "--dump-single-json",
    "--no-warnings",
    "--no-cache-dir",
  ];
  let usedFlatPlaylist = isExplicitCollection;
  let data;
  try {
    data = await runYtDlpJson([
      ...baseYtArgs,
      ...(usedFlatPlaylist ? ["--flat-playlist", "--playlist-end", String(MAX_PLAYLIST_IMPORT)] : ["--no-playlist"]),
      targetArg,
    ]);
  } catch (err) {
    // Fallback to single video if URL had a broken/private `list=` param alongside a video ID (`v=`)
    if (usedFlatPlaylist && /[?&]v=[^&]+/i.test(src.input)) {
      usedFlatPlaylist = false;
      data = await runYtDlpJson([...baseYtArgs, "--no-playlist", targetArg]);
    } else {
      throw err;
    }
  }

  if (Array.isArray(data?.entries) && data.entries.length > 0) {
    const validEntries = data.entries
      .filter((e) => {
        if (!e || typeof e !== "object") return false;
        const title = String(e.title || "").trim();
        if (/^\[(Private|Deleted) video\]$/i.test(title)) return false;
        return Boolean(e.url || e.webpage_url || e.id || title);
      })
      .slice(0, MAX_PLAYLIST_IMPORT);
    if (validEntries.length === 0) throw new Error("Không tìm thấy bài hát khả dụng nào trong playlist.");
    if (src.kind === "search") {
      return { tracks: [normalizeYtDlpEntry(validEntries[0], label, requestedBy)], note: "" };
    }
    const tracks = validEntries.map((e, idx) => {
      const fallbackWatch = e.id
        ? src.kind === "youtube_music"
          ? `https://music.youtube.com/watch?v=${e.id}`
          : `https://www.youtube.com/watch?v=${e.id}`
        : "";
      const entryUrl = String(e.webpage_url || e.url || fallbackWatch).trim();
      const hasDirectStream = !usedFlatPlaylist && e.url && e.acodec && e.acodec !== "none";
      if (idx === 0 && hasDirectStream) {
        return normalizeYtDlpEntry(e, label, requestedBy);
      }
      return {
        title: String(e.title || `Track #${idx + 1}`).trim(),
        artist: String(e.artist || e.uploader || e.channel || "").trim(),
        durationSec: Number(e.duration) || 0,
        isLive: Boolean(e.is_live),
        webpageUrl: entryUrl,
        streamUrl: "",
        httpHeaders: {},
        platform: label,
        requestedBy,
        lazySearchQuery: entryUrl || String(e.title || ""),
      };
    });
    return {
      tracks,
      note: data?.title ? `Đã nạp **${tracks.length}** bài từ playlist **${data.title}**` : `Đã nạp **${tracks.length}** bài từ playlist`,
    };
  }

  return { tracks: [normalizeYtDlpEntry(data, label, requestedBy)], note: "" };
}

/** Build lightweight FFmpeg arguments (zero-GPU, single-thread, Opus stream-copy when possible). */
export function buildFfmpegArgs({ streamUrl = "", httpHeaders = {}, pipeFromStdin = false, copyOpus = false } = {}) {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-hwaccel",
    "none",
    "-threads",
    "1",
    "-probesize",
    "32768",
    "-analyzeduration",
    "1000000",
  ];
  if (!pipeFromStdin) {
    const headerLines = [];
    for (const [k, v] of Object.entries(httpHeaders || {})) {
      if (k && v && /^(user-agent|referer|origin|cookie|accept)/i.test(k)) {
        headerLines.push(`${k}: ${String(v).replace(/[\r\n]+/g, " ")}`);
      }
    }
    if (headerLines.length > 0) {
      args.push("-headers", `${headerLines.join("\r\n")}\r\n`);
    }
    if (/^https?:\/\//i.test(streamUrl)) {
      args.push("-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5");
    }
    args.push("-i", streamUrl);
  } else {
    args.push("-i", "pipe:0");
  }
  if (copyOpus) {
    args.push("-vn", "-c:a", "copy", "-f", "opus", "pipe:1");
  } else {
    args.push(
      "-vn",
      "-c:a",
      "libopus",
      "-application",
      "audio",
      "-b:a",
      "128k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-compression_level",
      "5",
      "-f",
      "opus",
      "pipe:1"
    );
  }
  return args;
}

/** Format a track title + original URL + duration pill matching sleek Discord Embed cards. */
export function formatTrackLinkPill(track) {
  const rawTitle = String(track?.title || "Audio Track").trim();
  const artist = String(track?.artist || "").trim();
  const displayTitle = artist && !rawTitle.toLowerCase().includes(artist.toLowerCase()) ? `${rawTitle} — ${artist}` : rawTitle;
  const safeTitle = displayTitle.replace(/[`[\]\r\n]/g, (ch) => (ch === "`" ? "'" : ch === "[" ? "(" : ch === "]" ? ")" : " ")).slice(0, 140);
  const dur = formatDuration(track?.durationSec, Boolean(track?.isLive));
  const rawUrl = String(track?.webpageUrl || "").trim();
  if (/^https?:\/\//i.test(rawUrl)) {
    const safeUrl = rawUrl.replace(/[)\s<>]/g, encodeURIComponent);
    return `[\`${safeTitle}\`](${safeUrl}) \`[${dur}]\``;
  }
  return `\`${safeTitle}\` \`[${dur}]\``;
}

/** Format up to 5 queued tracks for display inside a Now Playing or Queued Embed card. */
export function formatQueuePreviewLines(queue = [], maxItems = MAX_EMBED_QUEUE_PREVIEW) {
  if (!Array.isArray(queue) || queue.length === 0) return [];
  const preview = queue.slice(0, maxItems);
  const lines = [`**Tiếp theo (${queue.length} bài trong hàng chờ):**`];
  preview.forEach((t, idx) => {
    lines.push(`${idx + 1}. ${formatTrackLinkPill(t)}`);
  });
  if (queue.length > maxItems) {
    lines.push(`*(...và ${queue.length - maxItems} bài khác)*`);
  }
  return lines;
}

/** Playback modes cycled by the mode button and /play subcommands. */
export const PLAY_MODE_ORDER = ["sequential", "shuffle", "repeat_one", "repeat_all"];

export const PLAY_MODE_META = {
  sequential: { label: "Tuần tự", emoji: "➡️", style: 2 },
  shuffle: { label: "Shuffle", emoji: "🔀", style: 1 },
  repeat_one: { label: "Repeat 1 bài", emoji: "🔂", style: 1 },
  repeat_all: { label: "Repeat tất cả", emoji: "🔁", style: 1 },
};

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Build a Discord Embed card for the currently playing (or paused) track + next 5 queued tracks. */
export function buildNowPlayingEmbed({
  track,
  queue = [],
  voiceChannelId = "",
  paused = false,
  playMode = "sequential",
  extraNote = "",
}) {
  const authorName = paused ? "⏸️ Đang tạm dừng" : "🎶 Đang phát nhạc";
  const authorObj = { name: authorName };
  if (track?.requestedByAvatarUrl) {
    authorObj.icon_url = track.requestedByAvatarUrl;
  }

  const modeMeta = PLAY_MODE_META[playMode] || PLAY_MODE_META.sequential;
  const lines = [
    formatTrackLinkPill(track),
    `${voiceChannelId ? `🔊 <#${voiceChannelId}> · ` : ""}Nguồn: \`${track?.platform || "Media"}\` · ${modeMeta.emoji} \`${modeMeta.label}\` · Yêu cầu: ${track?.requestedBy || "Member"}`,
  ];
  if (extraNote) {
    lines.push(`• ${extraNote}`);
  }
  const previewLines = formatQueuePreviewLines(queue, MAX_EMBED_QUEUE_PREVIEW);
  if (previewLines.length > 0) {
    lines.push("", ...previewLines);
  } else {
    lines.push("• Hàng chờ: *(trống)*");
  }

  return {
    color: paused ? 0xfee75c : 0x5865f2,
    author: authorObj,
    description: lines.join("\n").slice(0, 4000),
  };
}

/** Build a Discord Embed card when adding 1 track or a playlist to an active queue, showing the updated queue. */
export function buildQueuedEmbed({
  tracks = [],
  pos = 1,
  requestedBy = "Member",
  requestedByAvatarUrl = "",
  extraNote = "",
  currentTrack = null,
  fullQueue = null,
  voiceChannelId = "",
  paused = false,
  playMode = "sequential",
}) {
  const first = tracks[0];
  const titleText =
    tracks.length > 1
      ? `Đã thêm ${tracks.length} bài vào hàng chờ (từ #${pos})`
      : `Đã thêm vào hàng chờ #${pos}`;
  const authorObj = { name: titleText };
  if (requestedByAvatarUrl) {
    authorObj.icon_url = requestedByAvatarUrl;
  }

  const lines = [];
  if (tracks.length === 1 && first) {
    lines.push(formatTrackLinkPill(first));
    lines.push(`Nguồn: \`${first.platform || "Media"}\` · Yêu cầu: ${first.requestedBy || requestedBy}`);
  } else if (extraNote) {
    lines.push(extraNote);
  }

  const modeMeta = PLAY_MODE_META[playMode] || PLAY_MODE_META.sequential;
  if (currentTrack) {
    lines.push(
      "",
      `${paused ? "⏸️ **Đang tạm dừng" : "🎶 **Đang phát"}${voiceChannelId ? ` tại <#${voiceChannelId}>` : ""}** (${modeMeta.emoji} \`${modeMeta.label}\`): ${formatTrackLinkPill(currentTrack)}`
    );
  }

  const queueToShow = Array.isArray(fullQueue) ? fullQueue : tracks.length > 1 ? tracks : [];
  const previewLines = formatQueuePreviewLines(queueToShow, MAX_EMBED_QUEUE_PREVIEW);
  if (previewLines.length > 0) {
    if (!currentTrack) lines.push("");
    lines.push(...previewLines);
  }

  return {
    color: 0x57f287,
    author: authorObj,
    description: lines.join("\n").slice(0, 4000),
  };
}

/** Build Discord action buttons for playback control (Pause/Resume, Skip, Play Mode, Clear Queue, Stop). */
export function buildMusicControlComponents(paused = false, playMode = "sequential") {
  const modeMeta = PLAY_MODE_META[playMode] || PLAY_MODE_META.sequential;
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          label: paused ? "Tiếp tục" : "Tạm dừng",
          emoji: { name: paused ? "▶️" : "⏸️" },
          custom_id: "music:toggle",
        },
        {
          type: 2,
          style: 2,
          label: "Qua bài",
          emoji: { name: "⏭️" },
          custom_id: "music:skip",
        },
        {
          type: 2,
          style: modeMeta.style,
          label: modeMeta.label,
          emoji: { name: modeMeta.emoji },
          custom_id: "music:mode",
        },
        {
          type: 2,
          style: 2,
          label: "Clear Queue",
          emoji: { name: "🧹" },
          custom_id: "music:clear",
        },
        {
          type: 2,
          style: 4,
          label: "Dừng & Rời",
          emoji: { name: "⏹️" },
          custom_id: "music:stop",
        },
      ],
    },
  ];
}

/** Manage Discord Voice Gateway connections, queues, and playback across guilds. */
export function createMusicManager({
  getGateway,
  getBotUserId,
  sendNotice,
  clearControlButtons,
  idleDisconnectMs = IDLE_DISCONNECT_MS,
  emptyRoomDisconnectMs = EMPTY_ROOM_DISCONNECT_MS,
  pausedDisconnectMs = PAUSED_DISCONNECT_MS,
}) {
  // guildId -> Map<userId, { channelId: string, isBot: boolean }>
  const guildVoiceStates = new Map();
  // guildId -> @discordjs/voice adapter callback methods
  const voiceAdapters = new Map();
  // guildId -> { guildId, voiceChannelId, textChannelId, connection, player, queue, current, paused, idleTimer, emptyRoomTimer, activeProcs, advancing }
  const sessions = new Map();

  const killSessionProcesses = (session) => {
    if (!session || !Array.isArray(session.activeProcs)) return;
    while (session.activeProcs.length > 0) {
      const proc = session.activeProcs.pop();
      try {
        proc?.kill("SIGKILL");
      } catch {
        // Ignore already exited child process
      }
    }
  };

  const clearIdleTimer = (session) => {
    if (session?.idleTimer) {
      clearTimeout(session.idleTimer);
      session.idleTimer = null;
    }
  };

  const clearEmptyRoomTimer = (session) => {
    if (session?.emptyRoomTimer) {
      clearTimeout(session.emptyRoomTimer);
      session.emptyRoomTimer = null;
    }
  };

  const clearPausedTimer = (session) => {
    if (session?.pausedTimer) {
      clearTimeout(session.pausedTimer);
      session.pausedTimer = null;
    }
  };

  const schedulePausedDisconnect = (session) => {
    clearPausedTimer(session);
    session.pausedTimer = setTimeout(() => {
      if (sessions.get(session.guildId) === session && session.paused) {
        stopSession(
          session.guildId,
          "⏸️ Nhạc tạm dừng quá lâu, bot đã tự rời phòng Voice để giải phóng tài nguyên."
        ).catch(() => {});
      }
    }, pausedDisconnectMs);
    session.pausedTimer.unref?.();
  };

  const countHumanListeners = (guildId, voiceChannelId) => {
    const map = guildVoiceStates.get(String(guildId || ""));
    if (!map || !voiceChannelId) return 0;
    const botId = String(getBotUserId?.() || "");
    let count = 0;
    for (const [uid, entry] of map.entries()) {
      if (uid === botId || entry?.isBot) continue;
      if (entry?.channelId === voiceChannelId) count++;
    }
    return count;
  };

  const updateRoomOccupancyTimer = (session) => {
    if (!session || sessions.get(session.guildId) !== session) return;
    const listeners = countHumanListeners(session.guildId, session.voiceChannelId);
    if (listeners === 0) {
      if (!session.emptyRoomTimer) {
        const waitSec = Math.max(1, Math.round(emptyRoomDisconnectMs / 1000));
        const waitLabel = waitSec >= 60 && waitSec % 60 === 0 ? `${waitSec / 60} phút` : `${waitSec} giây`;
        session.emptyRoomTimer = setTimeout(() => {
          if (sessions.get(session.guildId) !== session) return;
          if (countHumanListeners(session.guildId, session.voiceChannelId) > 0) return;
          stopSession(
            session.guildId,
            `👋 Phòng Voice <#${session.voiceChannelId}> không còn ai trong **${waitLabel}**, bot đã tự động thoát.`
          ).catch(() => {});
        }, emptyRoomDisconnectMs);
        session.emptyRoomTimer.unref?.();
      }
    } else {
      clearEmptyRoomTimer(session);
    }
  };

  const scheduleIdleDisconnect = (session) => {
    clearIdleTimer(session);
    session.idleTimer = setTimeout(() => {
      if (sessions.get(session.guildId) === session && !session.current && session.queue.length === 0) {
        stopSession(session.guildId, "⏱️ Không còn nhạc phát trong hàng chờ, bot đã tự rời phòng Voice.").catch(() => {});
      }
    }, idleDisconnectMs);
    session.idleTimer.unref?.();
  };

  const createVoiceAdapter = (guildId) => {
    return (methods) => {
      voiceAdapters.set(guildId, methods);
      return {
        sendPayload(payload) {
          const gw = getGateway();
          if (!gw?.ws || gw.ws.readyState !== 1) return false;
          gw.sendPayload(payload.op, payload.d);
          return true;
        },
        destroy() {
          voiceAdapters.delete(guildId);
        },
      };
    };
  };

  async function ensureFreshTrackStream(track) {
    if (track.streamUrl) return track;
    const query = track.lazySearchQuery || track.webpageUrl || track.title;
    const resolved = await resolveMediaTracks(query, track.requestedBy);
    const fresh = resolved.tracks[0];
    if (!fresh?.streamUrl) {
      throw new Error(`Không lấy được luồng âm thanh cho "${track.title}".`);
    }
    const upgradedUrl =
      fresh.webpageUrl &&
      (!track.webpageUrl || /api\.soundcloud\.com\//i.test(track.webpageUrl))
        ? fresh.webpageUrl
        : track.webpageUrl;
    return {
      ...track,
      webpageUrl: upgradedUrl,
      streamUrl: fresh.streamUrl,
      copyOpus: Boolean(fresh.copyOpus),
      httpHeaders: fresh.httpHeaders || {},
      durationSec: track.durationSec || fresh.durationSec,
      isLive: track.isLive || fresh.isLive,
    };
  }

  function trackChildProcess(session, proc) {
    session.activeProcs.push(proc);
    proc.once("close", () => {
      const idx = session.activeProcs.indexOf(proc);
      if (idx !== -1) session.activeProcs.splice(idx, 1);
    });
  }

  function spawnAudioStreamResource(track, session) {
    const { createAudioResource, StreamType } = loadVoiceModule();
    const ffmpegBin = resolveFfmpegPath();
    const ytdlpBin = resolveYtDlpPath();

    // Direct URL fast-path via ffmpeg; uses zero-CPU stream-copy when source is already 48kHz stereo Opus
    if (track.streamUrl) {
      const ffArgs = buildFfmpegArgs({
        streamUrl: track.streamUrl,
        httpHeaders: track.httpHeaders,
        pipeFromStdin: false,
        copyOpus: Boolean(track.copyOpus),
      });
      const ffProc = spawn(ffmpegBin, ffArgs, { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
      trackChildProcess(session, ffProc);
      ffProc.on("error", (err) => console.warn("[music] ffmpeg spawn error:", err.message));
      return createAudioResource(ffProc.stdout, { inputType: StreamType.OggOpus, metadata: track });
    }

    const ytSource = track.webpageUrl || track.lazySearchQuery;
    const ytProc = spawn(
      ytdlpBin,
      ["-f", "bestaudio/best", "--no-playlist", "--no-warnings", "--no-cache-dir", "-o", "-", ytSource],
      { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }
    );
    const ffProc = spawn(ffmpegBin, buildFfmpegArgs({ pipeFromStdin: true, copyOpus: false }), {
      windowsHide: true,
      stdio: ["pipe", "pipe", "ignore"],
    });
    ytProc.stdout.pipe(ffProc.stdin);
    ytProc.stdout.on("error", () => {});
    ffProc.stdin.on("error", () => {});
    trackChildProcess(session, ytProc);
    trackChildProcess(session, ffProc);
    return createAudioResource(ffProc.stdout, { inputType: StreamType.OggOpus, metadata: track });
  }

  async function playNext(session, { announce = true, manualSkip = false } = {}) {
    if (session.advancing) return;
    session.advancing = true;
    clearIdleTimer(session);
    clearPausedTimer(session);
    try {
      killSessionProcesses(session);
      const prevTrack = session.current;
      let nextTrack = null;
      let replayedSameTrack = false;

      if (!manualSkip && prevTrack && session.playMode === "repeat_one") {
        nextTrack = { ...prevTrack };
        replayedSameTrack = true;
      } else {
        if (prevTrack && session.playMode === "repeat_all" && session.queue.length < MAX_QUEUE_SIZE) {
          session.queue.push({ ...prevTrack });
        }
        nextTrack = session.queue.shift() || null;
      }

      if (!nextTrack) {
        session.current = null;
        session.paused = false;
        scheduleIdleDisconnect(session);
        return;
      }

      session.current = nextTrack;
      session.paused = false;

      let playable;
      try {
        playable = await ensureFreshTrackStream(nextTrack);
        session.current = playable;
        const resource = spawnAudioStreamResource(playable, session);
        session.player.play(resource);
      } catch (err) {
        console.warn(`[music] Failed to start track "${nextTrack.title}":`, err.message);
        await sendNotice?.(
          session.textChannelId,
          `⚠️ Không phát được bài **${nextTrack.title}**: \`${err.message}\``
        ).catch(() => {});
        session.current = null;
        session.advancing = false;
        if (replayedSameTrack) return;
        return playNext(session, { announce: true, manualSkip: false });
      }

      if (announce && session.textChannelId && !replayedSameTrack) {
        await clearSessionControlButtons(session);
        const embed = buildNowPlayingEmbed({
          track: playable,
          queue: session.queue,
          voiceChannelId: session.voiceChannelId,
          paused: false,
          playMode: session.playMode || "sequential",
        });
        const posted = await sendNotice?.(
          session.textChannelId,
          { content: "", embeds: [embed] },
          buildMusicControlComponents(false, session.playMode || "sequential")
        ).catch(() => null);
        if (posted?.id) {
          session.lastControlMessage = {
            channelId: String(posted.channel_id || session.textChannelId),
            messageId: String(posted.id),
          };
        }
      }
    } finally {
      session.advancing = false;
    }
  }

  async function clearSessionControlButtons(session) {
    const prev = session?.lastControlMessage;
    if (!prev?.channelId || !prev?.messageId) return;
    session.lastControlMessage = null;
    await clearControlButtons?.(prev.channelId, prev.messageId).catch(() => {});
  }

  async function ensureSessionConnection({ guildId, voiceChannelId, textChannelId }) {
    const {
      AudioPlayerStatus,
      NoSubscriberBehavior,
      VoiceConnectionStatus,
      createAudioPlayer,
      entersState,
      joinVoiceChannel,
    } = loadVoiceModule();

    let session = sessions.get(guildId);
    if (session) {
      session.textChannelId = textChannelId || session.textChannelId;
      if (session.voiceChannelId === voiceChannelId && session.connection?.state?.status !== VoiceConnectionStatus.Destroyed) {
        return session;
      }
      await stopSession(guildId, "", false);
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannelId,
      guildId,
      adapterCreator: createVoiceAdapter(guildId),
      selfDeaf: true,
      selfMute: false,
    });

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });

    session = {
      guildId,
      voiceChannelId,
      textChannelId,
      connection,
      player,
      queue: [],
      current: null,
      paused: false,
      playMode: "sequential",
      trackSeq: 0,
      idleTimer: null,
      emptyRoomTimer: null,
      pausedTimer: null,
      lastControlMessage: null,
      activeProcs: [],
      advancing: false,
    };
    sessions.set(guildId, session);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
      if (sessions.get(guildId) !== session) return;
      playNext(session, { announce: true }).catch((err) => {
        console.warn("[music] playNext error:", err.message);
      });
    });

    player.on("error", (err) => {
      console.warn(`[music] AudioPlayer error in guild ${guildId}:`, err.message);
      if (sessions.get(guildId) === session) {
        playNext(session, { announce: true }).catch(() => {});
      }
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (sessions.get(guildId) !== session) return;
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch {
        stopSession(guildId, "", false).catch(() => {});
      }
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15000);
    } catch (err) {
      await stopSession(guildId, "", false).catch(() => {});
      throw new Error(`Không kết nối được vào kênh Voice (<#${voiceChannelId}>): ${err.message}`);
    }

    return session;
  }

  async function stopSession(guildId, noticeText = "", sendMessage = true) {
    const session = sessions.get(guildId);
    if (!session) return false;
    sessions.delete(guildId);
    clearIdleTimer(session);
    clearEmptyRoomTimer(session);
    clearPausedTimer(session);
    session.queue = [];
    session.current = null;
    killSessionProcesses(session);
    await clearSessionControlButtons(session);
    try {
      session.player?.stop(true);
    } catch {}
    try {
      session.connection?.destroy();
    } catch {}
    session.player = null;
    session.connection = null;
    if (sendMessage && noticeText && session.textChannelId) {
      await sendNotice?.(session.textChannelId, noticeText).catch(() => {});
    }
    return true;
  }

  return {
    getUserVoiceChannel(guildId, userId) {
      return guildVoiceStates.get(String(guildId || ""))?.get(String(userId || ""))?.channelId || "";
    },

    getHumanListenerCount(guildId, voiceChannelId) {
      return countHumanListeners(guildId, voiceChannelId);
    },

    /** Register the latest control-button message for a guild and clear buttons from any older card. */
    async registerControlMessage(guildId, channelId, messageId) {
      const session = sessions.get(String(guildId || ""));
      if (!session || !channelId || !messageId) return;
      const next = { channelId: String(channelId), messageId: String(messageId) };
      const prev = session.lastControlMessage;
      if (prev && (prev.channelId !== next.channelId || prev.messageId !== next.messageId)) {
        session.lastControlMessage = next;
        await clearControlButtons?.(prev.channelId, prev.messageId).catch(() => {});
      } else {
        session.lastControlMessage = next;
      }
    },

    /** Expose active session registry for controlled testing and diagnostics. */
    _getSessionForTest(guildId) {
      return sessions.get(String(guildId || "")) || null;
    },

    _setSessionForTest(guildId, sessionObj) {
      sessions.set(String(guildId || ""), sessionObj);
      updateRoomOccupancyTimer(sessionObj);
    },

    handleGuildCreate(guild) {
      const guildId = String(guild?.id || "");
      if (!guildId) return;
      const botIds = new Set();
      for (const m of Array.isArray(guild?.members) ? guild.members : []) {
        if (m?.user?.bot && m?.user?.id) botIds.add(String(m.user.id));
      }
      const map = new Map();
      for (const vs of Array.isArray(guild?.voice_states) ? guild.voice_states : []) {
        if (vs?.user_id && vs?.channel_id) {
          const uid = String(vs.user_id);
          map.set(uid, { channelId: String(vs.channel_id), isBot: botIds.has(uid) });
        }
      }
      guildVoiceStates.set(guildId, map);
      const session = sessions.get(guildId);
      if (session) updateRoomOccupancyTimer(session);
    },

    handleGatewayEvent(eventName, data) {
      if (eventName === "VOICE_STATE_UPDATE") {
        const guildId = String(data?.guild_id || "");
        const userId = String(data?.user_id || "");
        if (!guildId || !userId) return;
        let map = guildVoiceStates.get(guildId);
        if (!map) {
          map = new Map();
          guildVoiceStates.set(guildId, map);
        }
        const prevEntry = map.get(userId);
        const isBot = Boolean(data?.member?.user?.bot ?? prevEntry?.isBot);
        if (data?.channel_id) {
          map.set(userId, { channelId: String(data.channel_id), isBot });
        } else {
          map.delete(userId);
        }

        const botId = String(getBotUserId?.() || "");
        if (botId && userId === botId) {
          voiceAdapters.get(guildId)?.onVoiceStateUpdate(data);
        } else {
          const session = sessions.get(guildId);
          if (session) {
            updateRoomOccupancyTimer(session);
          }
        }
      } else if (eventName === "VOICE_SERVER_UPDATE") {
        const guildId = String(data?.guild_id || "");
        if (guildId) {
          voiceAdapters.get(guildId)?.onVoiceServerUpdate(data);
        }
      }
    },

    async play({
      guildId,
      userId,
      requestedByLabel,
      requestedByAvatarUrl = "",
      textChannelId,
      query,
      explicitVoiceChannelId = "",
    }) {
      if (!guildId) throw new Error("Lệnh `/play` chỉ dùng trong server Discord (không dùng trong DM).");
      const targetVoiceId = explicitVoiceChannelId || this.getUserVoiceChannel(guildId, userId);
      if (!targetVoiceId) {
        throw new Error("Bạn cần vào trước một kênh **Voice** (hoặc chọn thêm kênh Voice) rồi dùng lại `/play` nhé.");
      }

      const resolved = await resolveMediaTracks(query, requestedByLabel || `<@${userId}>`);
      const session = await ensureSessionConnection({
        guildId,
        voiceChannelId: targetVoiceId,
        textChannelId,
      });
      updateRoomOccupancyTimer(session);

      const freeSlots = Math.max(0, MAX_QUEUE_SIZE - session.queue.length);
      if (freeSlots === 0) {
        throw new Error(`Hàng chờ đã đạt tối đa **${MAX_QUEUE_SIZE}** bài. Dùng \`/play skip\`, \`/play clear\` hoặc \`/play stop\` để bớt.`);
      }

      const toAdd = resolved.tracks.slice(0, freeSlots).map((t) => ({
        ...t,
        _seq: ++session.trackSeq,
        requestedByAvatarUrl: t.requestedByAvatarUrl || requestedByAvatarUrl || "",
      }));
      const wasPlaying = Boolean(session.current);
      session.queue.push(...toAdd);
      if (session.playMode === "shuffle" && session.queue.length > 1) {
        shuffleInPlace(session.queue);
      }

      if (!wasPlaying) {
        await playNext(session, { announce: false, manualSkip: false });
        const cur = session.current;
        if (!cur) {
          throw new Error("Không thể khởi tạo luồng phát nhạc cho yêu cầu này.");
        }
        const embed = buildNowPlayingEmbed({
          track: cur,
          queue: session.queue,
          voiceChannelId: session.voiceChannelId,
          paused: false,
          playMode: session.playMode || "sequential",
          extraNote: resolved.note,
        });
        return {
          mode: "playing",
          track: cur,
          embeds: [embed],
          components: buildMusicControlComponents(false, session.playMode || "sequential"),
          message: "",
        };
      }

      const first = toAdd[0];
      const pos = session.queue.length - toAdd.length + 1;
      const playMode = session.playMode || "sequential";
      const queuedEmbed = buildQueuedEmbed({
        tracks: toAdd,
        pos,
        requestedBy: requestedByLabel || `<@${userId}>`,
        requestedByAvatarUrl,
        extraNote: resolved.note,
        currentTrack: session.current,
        fullQueue: session.queue,
        voiceChannelId: session.voiceChannelId,
        paused: Boolean(session.paused),
        playMode,
      });
      return {
        mode: "queued",
        track: first,
        embeds: [queuedEmbed],
        components: buildMusicControlComponents(Boolean(session.paused), playMode),
        message: "",
      };
    },

    async skip({ guildId }) {
      const session = sessions.get(guildId);
      if (!session || (!session.current && session.queue.length === 0)) {
        return { ok: false, emptied: false, message: "ℹ️ Hiện không có bài nào đang phát." };
      }
      const skippedTitle = session.current?.title || "bài hiện tại";
      if (session.queue.length === 0) {
        await stopSession(guildId, "", false);
        return {
          ok: true,
          emptied: true,
          message: `⏭️ Đã bỏ qua **${skippedTitle}** *(hết hàng chờ → bot rời phòng Voice)*.`,
        };
      }
      await playNext(session, { announce: true, manualSkip: true });
      return { ok: true, emptied: false, message: `⏭️ Đã bỏ qua **${skippedTitle}**.` };
    },

    setPlayMode({ guildId, mode }) {
      const session = sessions.get(guildId);
      if (!session || !session.current) {
        return { ok: false, playMode: "sequential", embeds: undefined, components: undefined, message: "ℹ️ Hiện không có bài nào đang phát." };
      }
      const nextMode = PLAY_MODE_ORDER.includes(mode) ? mode : "sequential";
      session.playMode = nextMode;
      if (nextMode === "shuffle" && session.queue.length > 1) {
        shuffleInPlace(session.queue);
      } else if (nextMode === "sequential" && session.queue.length > 1) {
        session.queue.sort((a, b) => (a._seq || 0) - (b._seq || 0));
      }
      const modeMeta = PLAY_MODE_META[nextMode];
      const embed = buildNowPlayingEmbed({
        track: session.current,
        queue: session.queue,
        voiceChannelId: session.voiceChannelId,
        paused: Boolean(session.paused),
        playMode: nextMode,
      });
      return {
        ok: true,
        playMode: nextMode,
        label: modeMeta.label,
        embeds: [embed],
        components: buildMusicControlComponents(Boolean(session.paused), nextMode),
        message: `${modeMeta.emoji} Đã chuyển sang chế độ **${modeMeta.label}**.`,
      };
    },

    cyclePlayMode({ guildId }) {
      const session = sessions.get(guildId);
      if (!session || !session.current) {
        return { ok: false, playMode: "sequential", embeds: undefined, components: undefined, message: "ℹ️ Hiện không có bài nào đang phát." };
      }
      const curIdx = PLAY_MODE_ORDER.indexOf(session.playMode || "sequential");
      const nextMode = PLAY_MODE_ORDER[(curIdx + 1) % PLAY_MODE_ORDER.length];
      return this.setPlayMode({ guildId, mode: nextMode });
    },

    clearQueue({ guildId }) {
      const session = sessions.get(guildId);
      if (!session || !session.current) {
        return { ok: false, clearedCount: 0, embeds: undefined, components: undefined, message: "ℹ️ Hiện không có hàng chờ nào." };
      }
      const clearedCount = session.queue.length;
      session.queue = [];
      const mode = session.playMode || "sequential";
      const embed = buildNowPlayingEmbed({
        track: session.current,
        queue: [],
        voiceChannelId: session.voiceChannelId,
        paused: Boolean(session.paused),
        playMode: mode,
      });
      return {
        ok: true,
        clearedCount,
        embeds: [embed],
        components: buildMusicControlComponents(Boolean(session.paused), mode),
        message:
          clearedCount > 0
            ? `🧹 Đã xóa **${clearedCount}** bài trong hàng chờ *(tiếp tục phát bài hiện tại)*.`
            : "ℹ️ Hàng chờ hiện đã trống.",
      };
    },

    togglePause({ guildId }) {
      const session = sessions.get(guildId);
      if (!session || !session.current) {
        return { ok: false, paused: false, embeds: undefined, components: undefined, message: "ℹ️ Hiện không có bài nào đang phát." };
      }
      if (session.paused) {
        session.player.unpause();
        session.paused = false;
        clearPausedTimer(session);
      } else {
        session.player.pause(true);
        session.paused = true;
        schedulePausedDisconnect(session);
      }
      const mode = session.playMode || "sequential";
      const embed = buildNowPlayingEmbed({
        track: session.current,
        queue: session.queue,
        voiceChannelId: session.voiceChannelId,
        paused: session.paused,
        playMode: mode,
      });
      const components = buildMusicControlComponents(session.paused, mode);
      return {
        ok: true,
        paused: session.paused,
        embeds: [embed],
        components,
        message: session.paused
          ? `⏸️ Đã tạm dừng **${session.current.title}**.`
          : `▶️ Tiếp tục phát **${session.current.title}**.`,
      };
    },

    setPaused({ guildId, paused }) {
      const session = sessions.get(guildId);
      if (!session || !session.current) {
        return { ok: false, embeds: undefined, components: undefined, message: "ℹ️ Hiện không có bài nào đang phát." };
      }
      if (paused) {
        session.player.pause(true);
        session.paused = true;
        schedulePausedDisconnect(session);
      } else {
        session.player.unpause();
        session.paused = false;
        clearPausedTimer(session);
      }
      const mode = session.playMode || "sequential";
      const embed = buildNowPlayingEmbed({
        track: session.current,
        queue: session.queue,
        voiceChannelId: session.voiceChannelId,
        paused: session.paused,
        playMode: mode,
      });
      return {
        ok: true,
        embeds: [embed],
        components: buildMusicControlComponents(session.paused, mode),
        message: paused
          ? `⏸️ Đã tạm dừng **${session.current.title}**.`
          : `▶️ Tiếp tục phát **${session.current.title}**.`,
      };
    },

    async stop({ guildId }) {
      const ok = await stopSession(guildId, "", false);
      return ok
        ? { ok: true, message: "⏹️ Đã dừng phát nhạc, xóa hàng chờ và rời phòng Voice." }
        : { ok: false, message: "ℹ️ Bot hiện không phát nhạc trong phòng Voice nào." };
    },

    getStatus({ guildId }) {
      const session = sessions.get(guildId);
      if (!session || !session.current) {
        return {
          embeds: undefined,
          components: undefined,
          message: "ℹ️ Hiện chưa có bài nào đang phát. Dùng `/play <link hoặc tên bài hát>` khi đang ở trong phòng Voice!",
        };
      }
      const mode = session.playMode || "sequential";
      const embed = buildNowPlayingEmbed({
        track: session.current,
        queue: session.queue,
        voiceChannelId: session.voiceChannelId,
        paused: Boolean(session.paused),
        playMode: mode,
      });
      return {
        embeds: [embed],
        components: buildMusicControlComponents(Boolean(session.paused), mode),
        message: "",
      };
    },

    buildControlComponents: buildMusicControlComponents,

    destroyAll() {
      for (const guildId of Array.from(sessions.keys())) {
        stopSession(guildId, "", false).catch(() => {});
      }
    },
  };
}
