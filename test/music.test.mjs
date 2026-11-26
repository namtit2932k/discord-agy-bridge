import test from "node:test";
import assert from "node:assert/strict";
import {
  STREAM_URL_TTL_MS,
  buildFfmpegArgs,
  buildMusicControlComponents,
  buildNowPlayingEmbed,
  buildQueuedEmbed,
  canCopyOpusStream,
  createMusicManager,
  detectMediaSource,
  formatDuration,
  isPlaylistUrl,
  isStreamUrlExpired,
  parseSpotifyEmbedHtml,
} from "../lib/music.mjs";

test("detectMediaSource and isPlaylistUrl classify single tracks and playlists across platforms", () => {
  assert.deepEqual(detectMediaSource(""), { kind: "empty", input: "" });
  assert.equal(detectMediaSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ").kind, "youtube");
  assert.equal(detectMediaSource("https://youtu.be/dQw4w9WgXcQ").kind, "youtube");
  assert.equal(detectMediaSource("https://music.youtube.com/watch?v=dQw4w9WgXcQ").kind, "youtube_music");
  assert.equal(detectMediaSource("https://soundcloud.com/rick-astley-official/never-gonna-give-you-up").kind, "soundcloud");
  assert.equal(detectMediaSource("https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8").kind, "spotify");
  assert.equal(detectMediaSource("https://spotify.link/abc123").kind, "spotify");
  assert.equal(detectMediaSource("https://example.com/audio/song.mp3").kind, "direct_audio");
  assert.equal(detectMediaSource("lạc trôi sơn tùng").kind, "search");

  assert.equal(isPlaylistUrl("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"), false);
  assert.equal(isPlaylistUrl("youtube", "https://www.youtube.com/playlist?list=PL123"), true);
  assert.equal(isPlaylistUrl("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123"), true);
  assert.equal(isPlaylistUrl("youtube_music", "https://music.youtube.com/playlist?list=OLAK5uy_123"), true);
  assert.equal(isPlaylistUrl("youtube_music", "https://music.youtube.com/browse/MPREb_123"), true);
  assert.equal(isPlaylistUrl("soundcloud", "https://soundcloud.com/artist/track"), false);
  assert.equal(isPlaylistUrl("soundcloud", "https://soundcloud.com/artist/sets/my-playlist"), true);
  assert.equal(isPlaylistUrl("soundcloud", "https://soundcloud.com/artist/albums/lp"), true);
});

test("formatDuration formats seconds into mm:ss, hh:mm:ss, or LIVE", () => {
  assert.equal(formatDuration(0), "--:--");
  assert.equal(formatDuration(65), "1:05");
  assert.equal(formatDuration(3661), "1:01:01");
  assert.equal(formatDuration(100, true), "LIVE");
});

test("isStreamUrlExpired flags stale signed stream URLs while keeping fresh and direct audio URLs valid", () => {
  const now = 1_700_000_000_000;
  assert.equal(
    isStreamUrlExpired(
      { streamUrl: "https://cdn/signed", webpageUrl: "https://youtube.com/watch?v=1", streamResolvedAt: now - 1000 },
      now
    ),
    false
  );
  assert.equal(
    isStreamUrlExpired(
      {
        streamUrl: "https://cdn/signed",
        webpageUrl: "https://youtube.com/watch?v=1",
        streamResolvedAt: now - STREAM_URL_TTL_MS - 1,
      },
      now
    ),
    true
  );
  // Direct audio URL without a distinct webpageUrl does not expire
  assert.equal(
    isStreamUrlExpired(
      { streamUrl: "https://example.com/a.mp3", webpageUrl: "https://example.com/a.mp3", streamResolvedAt: 0 },
      now
    ),
    false
  );
});

test("parseSpotifyEmbedHtml extracts single tracks and playlists from __NEXT_DATA__", () => {
  const singleHtml = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        state: {
          data: {
            entity: {
              name: "Never Gonna Give You Up",
              artists: [{ name: "Rick Astley" }],
            },
          },
        },
      },
    },
  })}</script></html>`;
  const single = parseSpotifyEmbedHtml(singleHtml);
  assert.equal(single?.isCollection, false);
  assert.equal(single?.items[0]?.searchQuery, "Never Gonna Give You Up Rick Astley");

  const playlistHtml = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        state: {
          data: {
            entity: {
              title: "Chill Mix",
              trackList: [
                { title: "Track A", subtitle: "Artist A", duration: 185000 },
                { title: "Track B", artists: [{ name: "Artist B" }], duration: 240000 },
              ],
            },
          },
        },
      },
    },
  })}</script></html>`;
  const list = parseSpotifyEmbedHtml(playlistHtml);
  assert.equal(list?.isCollection, true);
  assert.equal(list?.collectionTitle, "Chill Mix");
  assert.equal(list?.items.length, 2);
  assert.equal(list?.items[0]?.durationSec, 185);
  assert.equal(list?.items[1]?.durationSec, 240);
  assert.equal(list?.items[1]?.searchQuery, "Track B Artist B");
});

test("buildFfmpegArgs and canCopyOpusStream tune lightweight low-CPU/no-GPU flags and Discord buttons", () => {
  assert.equal(canCopyOpusStream({ acodec: "opus", ext: "webm", asr: 48000, audio_channels: 2 }), true);
  assert.equal(canCopyOpusStream({ acodec: "mp3", ext: "mp3", asr: 44100, audio_channels: 2 }), false);

  const copyArgs = buildFfmpegArgs({
    streamUrl: "https://audio.example/test.webm",
    httpHeaders: { "User-Agent": "TestAgent", "X-Ignored": "nope" },
    copyOpus: true,
  });
  assert.ok(copyArgs.includes("-reconnect"));
  assert.ok(copyArgs.includes("-headers"));
  assert.ok(copyArgs.includes("-hwaccel") && copyArgs.includes("none"));
  assert.ok(copyArgs.includes("-threads") && copyArgs.includes("1"));
  assert.ok(copyArgs.includes("copy"));
  assert.equal(copyArgs.includes("libopus"), false);

  const transcodeArgs = buildFfmpegArgs({ pipeFromStdin: true, copyOpus: false });
  assert.ok(transcodeArgs.includes("pipe:0"));
  assert.ok(transcodeArgs.includes("libopus"));
  assert.ok(transcodeArgs.includes("-application") && transcodeArgs.includes("audio"));
  assert.ok(transcodeArgs.includes("128k"));
  assert.ok(transcodeArgs.includes("-compression_level"));

  const playingButtons = buildMusicControlComponents(false, "sequential");
  assert.equal(playingButtons[0].components.length, 5);
  assert.equal(playingButtons[0].components[0].custom_id, "music:toggle");
  assert.equal(playingButtons[0].components[0].label, "Tạm dừng");
  assert.equal(playingButtons[0].components[2].custom_id, "music:mode");
  assert.equal(playingButtons[0].components[2].label, "Tuần tự");
  assert.equal(playingButtons[0].components[3].custom_id, "music:clear");
  assert.equal(playingButtons[0].components[3].label, "Clear Queue");

  const pausedShuffle = buildMusicControlComponents(true, "shuffle");
  assert.equal(pausedShuffle[0].components[0].label, "Tiếp tục");
  assert.equal(pausedShuffle[0].components[2].label, "Shuffle");
  assert.equal(pausedShuffle[0].components[2].style, 1);

  const nextQueue = Array.from({ length: 7 }, (_, i) => ({
    title: `Next ${i + 1}`,
    durationSec: 60 + i,
    webpageUrl: `https://youtube.com/watch?v=id${i + 1}`,
  }));
  const npEmbed = buildNowPlayingEmbed({
    track: {
      title: "Current Song",
      artist: "Artist",
      durationSec: 185,
      webpageUrl: "https://youtube.com/watch?v=cur",
      platform: "YouTube",
      requestedBy: "sickyturtlez",
      requestedByAvatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
    },
    queue: nextQueue,
    voiceChannelId: "555",
  });
  assert.equal(npEmbed.author.icon_url, "https://cdn.discordapp.com/embed/avatars/0.png");
  assert.match(npEmbed.description, /\[`Current Song — Artist`\]\(https:\/\/youtube\.com\/watch\?v=cur\) `\[3:05\]`/);
  assert.match(npEmbed.description, /Next 5/);
  assert.doesNotMatch(npEmbed.description, /Next 6/);
  assert.match(npEmbed.description, /và 2 bài khác/);

  const qEmbed = buildQueuedEmbed({
    tracks: [nextQueue[0]],
    pos: 3,
    requestedBy: "sickyturtlez",
    requestedByAvatarUrl: "https://cdn.discordapp.com/embed/avatars/1.png",
    currentTrack: {
      title: "Current Song",
      durationSec: 185,
      webpageUrl: "https://youtube.com/watch?v=cur",
    },
    fullQueue: nextQueue,
    voiceChannelId: "555",
  });
  assert.equal(qEmbed.author.name, "Đã thêm vào hàng chờ #3");
  assert.match(qEmbed.description, /https:\/\/youtube\.com\/watch\?v=id1/);
  assert.match(qEmbed.description, /Đang phát/);
  assert.match(qEmbed.description, /Tiếp theo \(7 bài trong hàng chờ\)/);
  assert.match(qEmbed.description, /Next 5/);
  assert.doesNotMatch(qEmbed.description, /Next 6/);
});

test("createMusicManager tracks GUILD_CREATE and VOICE_STATE_UPDATE user channels accurately", async () => {
  const manager = createMusicManager({
    getGateway: () => null,
    getBotUserId: () => "999999999999999999",
    sendNotice: async () => {},
  });

  manager.handleGuildCreate({
    id: "111",
    voice_states: [
      { user_id: "222", channel_id: "555" },
      { user_id: "333", channel_id: null },
    ],
  });

  assert.equal(manager.getUserVoiceChannel("111", "222"), "555");
  assert.equal(manager.getUserVoiceChannel("111", "333"), "");

  manager.handleGatewayEvent("VOICE_STATE_UPDATE", {
    guild_id: "111",
    user_id: "222",
    channel_id: "666",
  });
  assert.equal(manager.getUserVoiceChannel("111", "222"), "666");

  manager.handleGatewayEvent("VOICE_STATE_UPDATE", {
    guild_id: "111",
    user_id: "222",
    channel_id: null,
  });
  assert.equal(manager.getUserVoiceChannel("111", "222"), "");
  assert.ok(manager.getStatus({ guildId: "111" }).message.includes("Hiện chưa có bài nào đang phát"));
});

test("createMusicManager auto-leaves when voice channel becomes empty even while playing", async () => {
  const notices = [];
  let destroyed = false;
  let stopped = false;

  const manager = createMusicManager({
    getGateway: () => null,
    getBotUserId: () => "999999999999999999",
    emptyRoomDisconnectMs: 40,
    sendNotice: async (channelId, text) => {
      notices.push({ channelId, text });
    },
  });

  manager.handleGuildCreate({
    id: "111",
    voice_states: [
      { user_id: "999999999999999999", channel_id: "555" },
      { user_id: "222", channel_id: "555" },
    ],
  });
  assert.equal(manager.getHumanListenerCount("111", "555"), 1);

  manager._setSessionForTest("111", {
    guildId: "111",
    voiceChannelId: "555",
    textChannelId: "777",
    current: { title: "Playing Track", durationSec: 120, platform: "YouTube", requestedBy: "user" },
    queue: [],
    paused: false,
    idleTimer: null,
    emptyRoomTimer: null,
    activeProcs: [],
    player: { stop: () => { stopped = true; } },
    connection: { destroy: () => { destroyed = true; } },
  });

  // User leaves -> room has 0 humans -> emptyRoomTimer starts
  manager.handleGatewayEvent("VOICE_STATE_UPDATE", {
    guild_id: "111",
    user_id: "222",
    channel_id: null,
  });
  assert.equal(manager.getHumanListenerCount("111", "555"), 0);
  assert.ok(manager._getSessionForTest("111")?.emptyRoomTimer);

  // User quickly rejoins -> timer cancels and session stays alive
  manager.handleGatewayEvent("VOICE_STATE_UPDATE", {
    guild_id: "111",
    user_id: "222",
    channel_id: "555",
  });
  assert.equal(manager._getSessionForTest("111")?.emptyRoomTimer, null);

  // User leaves again -> wait past 40ms -> bot leaves cleanly even though a track was playing
  manager.handleGatewayEvent("VOICE_STATE_UPDATE", {
    guild_id: "111",
    user_id: "222",
    channel_id: null,
  });

  await new Promise((r) => setTimeout(r, 90));
  assert.equal(manager._getSessionForTest("111"), null);
  assert.equal(destroyed, true);
  assert.equal(stopped, true);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].channelId, "777");
  assert.match(notices[0].text, /không còn ai/i);
});

test("createMusicManager clears older control buttons and handles clearQueue()", async () => {
  const clearedMsgs = [];
  const manager = createMusicManager({
    getGateway: () => null,
    getBotUserId: () => "999999999999999999",
    sendNotice: async () => null,
    clearControlButtons: async (channelId, messageId) => {
      clearedMsgs.push({ channelId, messageId });
    },
  });

  manager._setSessionForTest("111", {
    guildId: "111",
    voiceChannelId: "555",
    textChannelId: "777",
    current: { title: "Now", durationSec: 100, platform: "YouTube", requestedBy: "user", webpageUrl: "https://youtu.be/1" },
    queue: [
      { title: "Q1", durationSec: 50, platform: "YouTube", requestedBy: "user", webpageUrl: "https://youtu.be/2" },
      { title: "Q2", durationSec: 60, platform: "YouTube", requestedBy: "user", webpageUrl: "https://youtu.be/3" },
    ],
    paused: false,
    idleTimer: null,
    emptyRoomTimer: null,
    lastControlMessage: null,
    activeProcs: [],
    player: { stop: () => {} },
    connection: { destroy: () => {} },
  });

  await manager.registerControlMessage("111", "777", "msg1");
  await manager.registerControlMessage("111", "777", "msg2");
  assert.deepEqual(clearedMsgs, [{ channelId: "777", messageId: "msg1" }]);

  const cleared = manager.clearQueue({ guildId: "111" });
  assert.equal(cleared.ok, true);
  assert.equal(cleared.clearedCount, 2);
  assert.match(cleared.embeds[0].description, /Hàng chờ: \*\(trống\)\*/);

  await manager.stop({ guildId: "111" });
  assert.deepEqual(clearedMsgs, [
    { channelId: "777", messageId: "msg1" },
    { channelId: "777", messageId: "msg2" },
  ]);
});

test("createMusicManager cycles sequential -> shuffle -> repeat_one -> repeat_all and restores _seq order", async () => {
  const manager = createMusicManager({
    getGateway: () => null,
    getBotUserId: () => "999999999999999999",
    sendNotice: async () => null,
  });

  manager._setSessionForTest("111", {
    guildId: "111",
    voiceChannelId: "555",
    textChannelId: "777",
    current: { title: "Now", _seq: 1, durationSec: 100, platform: "YouTube", requestedBy: "user", webpageUrl: "https://youtu.be/1" },
    queue: [
      { title: "Q2", _seq: 2, durationSec: 50, platform: "YouTube", requestedBy: "user", webpageUrl: "https://youtu.be/2" },
      { title: "Q3", _seq: 3, durationSec: 60, platform: "YouTube", requestedBy: "user", webpageUrl: "https://youtu.be/3" },
      { title: "Q4", _seq: 4, durationSec: 70, platform: "YouTube", requestedBy: "user", webpageUrl: "https://youtu.be/4" },
    ],
    paused: false,
    playMode: "sequential",
    trackSeq: 4,
    idleTimer: null,
    emptyRoomTimer: null,
    pausedTimer: null,
    lastControlMessage: null,
    activeProcs: [],
    player: { stop: () => {} },
    connection: { destroy: () => {} },
  });

  const s1 = manager.cyclePlayMode({ guildId: "111" });
  assert.equal(s1.playMode, "shuffle");
  assert.equal(s1.components[0].components[2].label, "Shuffle");

  const s2 = manager.cyclePlayMode({ guildId: "111" });
  assert.equal(s2.playMode, "repeat_one");
  assert.equal(s2.components[0].components[2].label, "Repeat 1 bài");

  const s3 = manager.cyclePlayMode({ guildId: "111" });
  assert.equal(s3.playMode, "repeat_all");
  assert.equal(s3.components[0].components[2].label, "Repeat tất cả");

  const s4 = manager.cyclePlayMode({ guildId: "111" });
  assert.equal(s4.playMode, "sequential");
  assert.equal(s4.components[0].components[2].label, "Tuần tự");
  assert.deepEqual(
    manager._getSessionForTest("111").queue.map((t) => t._seq),
    [2, 3, 4]
  );

  await manager.stop({ guildId: "111" });
});
