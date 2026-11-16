export const BASE_GATEWAY_INTENTS = 1 | (1 << 7) | (1 << 9) | (1 << 12) | (1 << 15); // GUILDS | GUILD_VOICE_STATES | GUILD_MESSAGES | DIRECT_MESSAGES | MESSAGE_CONTENT
export const GUILD_MEMBERS_INTENT = 1 << 1; // GUILD_MEMBERS (Server Members Intent for auto-onboard)

const CONNECT_HELLO_TIMEOUT_MS = 15000;
const CLOSE_HANDSHAKE_TIMEOUT_MS = 4000;

/** Discord Gateway WebSocket client with Heartbeat, Zombie-Socket Watchdog, Resume, and Exponential Backoff. */
export class DiscordGatewayClient {
  constructor({
    getToken,
    getConfig,
    discordRequest,
    onDispatch,
    onFatalClose = () => process.exit(1),
    WebSocketImpl = globalThis.WebSocket,
  }) {
    this.getToken = getToken;
    this.getConfig = getConfig;
    this.discordRequest = discordRequest;
    this.onDispatch = onDispatch;
    this.onFatalClose = onFatalClose;
    this.WebSocketImpl = WebSocketImpl;

    this.ws = null;
    this.heartbeatJitterTimer = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.helloTimer = null;
    this.closeWatchTimer = null;
    this.lastSeq = null;
    this.sessionId = null;
    this.resumeGatewayUrl = null;
    this.awaitingAck = false;
    this.backoffMs = 1500;
    this.botUser = null;
    this.memberIntentFallback = false;
    this.lastRequestedIntents = BASE_GATEWAY_INTENTS;
  }

  computeIntents() {
    const cfg = this.getConfig() || {};
    if ((cfg.autoOnboard?.enabled || cfg.announceChannelId || cfg.announceChannelName) && !this.memberIntentFallback) {
      return BASE_GATEWAY_INTENTS | GUILD_MEMBERS_INTENT;
    }
    return BASE_GATEWAY_INTENTS;
  }

  refreshIntents({ forceRetryMembers = false } = {}) {
    if (forceRetryMembers) {
      this.memberIntentFallback = false;
    }
    const desired = this.computeIntents();
    if (this.ws && this.ws.readyState === 1 && this.lastRequestedIntents !== desired) {
      this.sessionId = null;
      this.resumeGatewayUrl = null;
      this.backoffMs = 800;
      this.forceCloseSocket(this.ws, 1000, "Refresh gateway intents", false);
    }
  }

  clearTimers() {
    if (this.heartbeatJitterTimer) {
      clearTimeout(this.heartbeatJitterTimer);
      this.heartbeatJitterTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.helloTimer) {
      clearTimeout(this.helloTimer);
      this.helloTimer = null;
    }
    if (this.closeWatchTimer) {
      clearTimeout(this.closeWatchTimer);
      this.closeWatchTimer = null;
    }
  }

  scheduleReconnect(delayMs, useResume) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(useResume).catch((err) => {
        console.error("[gateway] Reconnect failed:", err.message || err);
        this.backoffMs = Math.min(this.backoffMs * 2, 30000);
        this.scheduleReconnect(this.backoffMs, false);
      });
    }, delayMs);
  }

  /** Close a socket and force-recover if the TCP connection stalls in CLOSING (zombie socket). */
  forceCloseSocket(ws, code, reason, useResume = true) {
    if (!ws || this.ws !== ws) return;
    this.clearTimers();
    if (this.closeWatchTimer) clearTimeout(this.closeWatchTimer);
    this.closeWatchTimer = setTimeout(() => {
      this.closeWatchTimer = null;
      if (this.ws !== ws) return;
      console.warn(`[gateway] Close handshake timed out (${reason}); forcing reconnect.`);
      this.ws = null;
      this.clearTimers();
      try {
        ws.terminate?.();
      } catch {
        // Native WebSocket may not implement terminate()
      }
      const delay = this.backoffMs;
      this.backoffMs = Math.min(this.backoffMs * 2, 30000);
      this.scheduleReconnect(delay, useResume);
    }, CLOSE_HANDSHAKE_TIMEOUT_MS);
    this.closeWatchTimer.unref?.();

    try {
      ws.close(code, reason);
    } catch {
      if (this.closeWatchTimer) {
        clearTimeout(this.closeWatchTimer);
        this.closeWatchTimer = null;
      }
      this.ws = null;
      this.scheduleReconnect(1000, useResume);
    }
  }

  async fetchGatewayUrl() {
    try {
      const data = await this.discordRequest("GET", "/gateway/bot");
      if (data?.url) return `${data.url}?v=10&encoding=json`;
    } catch (err) {
      console.warn("[gateway] Fallback to default URL:", err.message);
    }
    return "wss://gateway.discord.gg/?v=10&encoding=json";
  }

  sendPayload(op, d) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ op, d }));
    }
  }

  startHeartbeat(intervalMs) {
    if (this.heartbeatJitterTimer) clearTimeout(this.heartbeatJitterTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.awaitingAck = false;
    const jitter = Math.floor(intervalMs * Math.random() * 0.5);
    this.heartbeatJitterTimer = setTimeout(() => {
      this.heartbeatJitterTimer = null;
      this.sendHeartbeat();
      this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), intervalMs);
    }, jitter);
  }

  sendHeartbeat() {
    if (this.awaitingAck) {
      console.warn("[gateway] Heartbeat ACK missed, reconnecting...");
      this.forceCloseSocket(this.ws, 4000, "Heartbeat timeout", Boolean(this.sessionId));
      return;
    }
    this.awaitingAck = true;
    this.sendPayload(1, this.lastSeq);
  }

  async connect(useResume = false) {
    const base =
      useResume && this.resumeGatewayUrl
        ? `${this.resumeGatewayUrl}?v=10&encoding=json`
        : await this.fetchGatewayUrl();
    console.log(`[gateway] Connecting (${useResume ? "resume" : "fresh"})...`);

    const ws = new this.WebSocketImpl(base);
    this.ws = ws;
    this.clearTimers();

    this.helloTimer = setTimeout(() => {
      this.helloTimer = null;
      if (this.ws !== ws) return;
      console.warn("[gateway] Timed out waiting for Discord Hello (op 10), reconnecting...");
      this.forceCloseSocket(ws, 4000, "Hello timeout", false);
    }, CONNECT_HELLO_TIMEOUT_MS);
    this.helloTimer.unref?.();

    ws.addEventListener("message", (event) => {
      if (this.ws !== ws) return;
      let payload;
      try {
        payload = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
      } catch {
        return;
      }

      if (payload.s !== null && payload.s !== undefined) {
        this.lastSeq = payload.s;
      }

      switch (payload.op) {
        case 10: // Hello
          if (this.helloTimer) {
            clearTimeout(this.helloTimer);
            this.helloTimer = null;
          }
          this.startHeartbeat(payload.d.heartbeat_interval);
          if (useResume && this.sessionId && this.lastSeq !== null) {
            this.sendPayload(6, { token: this.getToken(), session_id: this.sessionId, seq: this.lastSeq });
          } else {
            this.lastRequestedIntents = this.computeIntents();
            this.sendPayload(2, {
              token: this.getToken(),
              intents: this.lastRequestedIntents,
              properties: { os: process.platform, browser: "agy-discord-bridge", device: "agy-discord-bridge" },
            });
          }
          break;
        case 11: // Heartbeat ACK
          this.awaitingAck = false;
          break;
        case 1: // Heartbeat requested
          this.sendPayload(1, this.lastSeq);
          break;
        case 7: // Reconnect requested
          this.forceCloseSocket(ws, 4001, "Gateway requested reconnect", Boolean(this.sessionId));
          break;
        case 9: // Invalid session
          if (!payload.d) {
            this.sessionId = null;
            this.resumeGatewayUrl = null;
          }
          this.forceCloseSocket(ws, 4002, "Invalid session", Boolean(payload.d));
          break;
        case 0: // Dispatch
          this.handleDispatch(payload.t, payload.d);
          break;
      }
    });

    ws.addEventListener("close", (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.clearTimers();
      console.warn(`[gateway] Closed (code=${ev.code}, reason=${ev.reason || "none"})`);
      if (ev.code === 4014 && (this.lastRequestedIntents & GUILD_MEMBERS_INTENT) !== 0) {
        this.memberIntentFallback = true;
        this.sessionId = null;
        this.resumeGatewayUrl = null;
        console.warn(
          "[gateway] Server Members Intent (GUILD_MEMBERS) chưa bật trên Discord Developer Portal; tạm hạ intent để bot vẫn chạy ổn định (bật Server Members Intent rồi dùng /reload để kích hoạt 100% auto-onboard)."
        );
        this.scheduleReconnect(1500, false);
        return;
      }
      if ([4004, 4010, 4011, 4012, 4013, 4014].includes(ev.code)) {
        console.error("[gateway] Fatal Discord close code. Check Bot Token or Message Content Intent.");
        this.onFatalClose(ev.code);
        return;
      }
      const canResume = Boolean(this.sessionId) && ev.code !== 1000;
      const delay = ev.code === 4002 ? 2000 + Math.random() * 2000 : this.backoffMs;
      this.backoffMs = Math.min(this.backoffMs * 2, 30000);
      this.scheduleReconnect(delay, canResume);
    });

    ws.addEventListener("error", (err) => {
      if (this.ws !== ws) return;
      console.error("[gateway] WebSocket error:", err.message || err);
    });
  }

  handleDispatch(eventName, data) {
    if (eventName === "READY") {
      this.sessionId = data.session_id;
      this.resumeGatewayUrl = data.resume_gateway_url || this.resumeGatewayUrl;
      this.botUser = data.user;
      this.backoffMs = 1500;
    } else if (eventName === "RESUMED") {
      this.backoffMs = 1500;
    }
    this.onDispatch(eventName, data, this);
  }
}
