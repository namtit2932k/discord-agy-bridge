import test from "node:test";
import assert from "node:assert/strict";
import { BASE_GATEWAY_INTENTS, DiscordGatewayClient, GUILD_MEMBERS_INTENT } from "../lib/discord-gateway.mjs";

class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1;
    this.listeners = {};
    this.closedWith = null;
    this.sent = [];
  }
  addEventListener(ev, fn) {
    (this.listeners[ev] ||= []).push(fn);
  }
  emit(ev, payload) {
    for (const fn of this.listeners[ev] || []) fn(payload);
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close(code, reason) {
    this.closedWith = { code, reason };
    this.readyState = 2;
  }
}

test("DiscordGatewayClient computes GUILD_MEMBERS intent and falls back cleanly on 4014", async () => {
  const gw = new DiscordGatewayClient({
    getToken: () => "tok",
    getConfig: () => ({ autoOnboard: { enabled: true } }),
    discordRequest: async () => ({ url: "wss://mock.discord.gg" }),
    onDispatch: () => {},
    onFatalClose: () => {},
    WebSocketImpl: MockWebSocket,
  });

  assert.equal(gw.computeIntents(), BASE_GATEWAY_INTENTS | GUILD_MEMBERS_INTENT);
  await gw.connect(false);
  gw.lastRequestedIntents = BASE_GATEWAY_INTENTS | GUILD_MEMBERS_INTENT;
  gw.ws.emit("close", { code: 4014, reason: "Disallowed intents" });

  assert.equal(gw.memberIntentFallback, true);
  assert.equal(gw.computeIntents(), BASE_GATEWAY_INTENT_MASK());
  gw.clearTimers();
  if (gw.reconnectTimer) clearTimeout(gw.reconnectTimer);
});

function BASE_GATEWAY_INTENT_MASK() {
  return BASE_GATEWAY_INTENTS;
}

test("DiscordGatewayClient detects missed Heartbeat ACK and closes with code 4000", async () => {
  const gw = new DiscordGatewayClient({
    getToken: () => "tok",
    getConfig: () => ({}),
    discordRequest: async () => ({ url: "wss://mock.discord.gg" }),
    onDispatch: () => {},
    WebSocketImpl: MockWebSocket,
  });

  await gw.connect(false);
  const ws = gw.ws;
  gw.sendHeartbeat();
  assert.equal(gw.awaitingAck, true);
  assert.equal(ws.sent[0].op, 1);

  gw.sendHeartbeat();
  assert.deepEqual(ws.closedWith, { code: 4000, reason: "Heartbeat timeout" });
  gw.clearTimers();
  if (gw.reconnectTimer) clearTimeout(gw.reconnectTimer);
});
