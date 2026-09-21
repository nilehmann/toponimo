import type { MqttClient } from "mqtt";
import { describe, expect, it } from "vitest";

import type { ClientMessage, HostMessage, TransportHandlers } from "./transport";
import { topics } from "./brokers";
import { wrapClient } from "./mqtt";
import type { Snapshot } from "../game/types";

const CODE = "2345678";
const T = topics(CODE);

const EMPTY: Snapshot = {
  version: 7,
  code: CODE,
  hostId: "1",
  players: {},
  game: null,
  createdAt: 0,
};

interface Published {
  topic: string;
  payload: string;
  qos: number;
}

/** Un broker de mentira: guarda lo publicado y deja empujar mensajes hacia adentro. */
function fakeClient() {
  const published: Published[] = [];
  const subscribed: { topic: string; qos: number }[] = [];
  const listeners = new Set<(topic: string, payload: Uint8Array) => void>();
  let ended = false;

  const client = {
    on: (_event: string, cb: (topic: string, payload: Uint8Array) => void) => listeners.add(cb),
    off: (_event: string, cb: (topic: string, payload: Uint8Array) => void) => listeners.delete(cb),
    subscribe: (topic: string, opts: { qos: number }) => subscribed.push({ topic, ...opts }),
    publish: (topic: string, payload: string, opts: { qos: number }) =>
      published.push({ topic, payload, ...opts }),
    end: () => {
      ended = true;
    },
  } as unknown as MqttClient;

  return {
    client,
    published,
    subscribed,
    get ended() {
      return ended;
    },
    arrive(topic: string, body: unknown) {
      const payload = new TextEncoder().encode(
        typeof body === "string" ? body : JSON.stringify(body),
      );
      for (const listener of [...listeners]) listener(topic, payload);
    },
  };
}

function collect() {
  const up: ClientMessage[] = [];
  const down: HostMessage[] = [];
  const handlers: TransportHandlers = {
    onClientMessage: (m) => up.push(m),
    onHostMessage: (m) => down.push(m),
  };
  return { up, down, handlers };
}

describe("host sobre mqtt", () => {
  it("escucha el buzón y difunde por el topic de todos", () => {
    const broker = fakeClient();
    const transport = wrapClient(broker.client, CODE, "host", "dh");
    const { up, handlers } = collect();
    transport.connect(handlers);

    expect(broker.subscribed).toEqual([{ topic: T.inbox, qos: 1 }]);

    broker.arrive(T.inbox, { t: "hello", deviceId: "da", name: "Ana" });
    expect(up).toEqual([{ t: "hello", deviceId: "da", name: "Ana" }]);

    transport.broadcast({ t: "snapshot", state: EMPTY });
    transport.sendTo("2", { t: "snapshot", state: EMPTY });
    expect(broker.published.map((p) => p.topic)).toEqual([T.host, T.direct("2")]);
    expect(broker.published.every((p) => p.qos === 1)).toBe(true);
  });

  it("no escucha nada que no venga del buzón", () => {
    const broker = fakeClient();
    const transport = wrapClient(broker.client, CODE, "host", "dh");
    const { up, handlers } = collect();
    transport.connect(handlers);
    broker.arrive(T.host, { t: "hello", deviceId: "da", name: "Ana" });
    broker.arrive(`toponimo/OTRA/in`, { t: "bye", playerId: "2" });
    expect(up).toEqual([]);
  });

  it("guarda lo que llegó antes de que el runtime se enganche", () => {
    const broker = fakeClient();
    const transport = wrapClient(broker.client, CODE, "host", "dh");
    broker.arrive(T.inbox, { t: "ack", playerId: "2", version: 3 });
    const { up, handlers } = collect();
    transport.connect(handlers);
    expect(up).toEqual([{ t: "ack", playerId: "2", version: 3 }]);
  });

  it("corta la conexión al dejar de escuchar", () => {
    const broker = fakeClient();
    const transport = wrapClient(broker.client, CODE, "host", "dh");
    const { up, handlers } = collect();
    transport.connect(handlers)();
    broker.arrive(T.inbox, { t: "bye", playerId: "2" });
    expect(up).toEqual([]);
    expect(broker.ended).toBe(true);
  });
});

describe("jugador sobre mqtt", () => {
  it("se suscribe a su canal dirigido recién cuando sabe quién es", () => {
    const broker = fakeClient();
    const transport = wrapClient(broker.client, CODE, "client", "da");
    const { down, handlers } = collect();
    transport.connect(handlers);

    expect(broker.subscribed).toEqual([{ topic: T.host, qos: 1 }]);

    broker.arrive(T.host, { t: "welcome", deviceId: "otro", playerId: "3", state: EMPTY });
    expect(broker.subscribed).toHaveLength(1);

    broker.arrive(T.host, { t: "welcome", deviceId: "da", playerId: "2", state: EMPTY });
    expect(broker.subscribed).toEqual([
      { topic: T.host, qos: 1 },
      { topic: T.direct("2"), qos: 1 },
    ]);
    // Los welcome ajenos llegan igual y los descarta el cliente, no el transporte.
    expect(down).toHaveLength(2);
  });

  it("manda al buzón del host", () => {
    const broker = fakeClient();
    const transport = wrapClient(broker.client, CODE, "client", "da");
    transport.connect(collect().handlers);
    transport.send({ t: "hello", deviceId: "da", name: "Ana" });
    expect(broker.published).toEqual([
      { topic: T.inbox, payload: '{"t":"hello","deviceId":"da","name":"Ana"}', qos: 1 },
    ]);
  });

  it("no deja que un lado mande por el otro", () => {
    const broker = fakeClient();
    const cliente = wrapClient(broker.client, CODE, "client", "da");
    const host = wrapClient(fakeClient().client, CODE, "host", "dh");
    expect(() => cliente.broadcast({ t: "snapshot", state: EMPTY })).toThrow();
    expect(() => host.send({ t: "bye", playerId: "2" })).toThrow();
  });
});

describe("payloads de un broker público", () => {
  it("descarta lo que no es un mensaje del otro lado", () => {
    const broker = fakeClient();
    const transport = wrapClient(broker.client, CODE, "host", "dh");
    const { up, handlers } = collect();
    transport.connect(handlers);

    for (const basura of [
      "no es json",
      "null",
      "42",
      '"hola"',
      "[]",
      '{"sin":"tag"}',
      '{"t":42}',
      '{"t":"snapshot","state":{}}',
    ]) {
      broker.arrive(T.inbox, basura);
    }
    expect(up).toEqual([]);

    broker.arrive(T.inbox, { t: "bye", playerId: "2" });
    expect(up).toHaveLength(1);
  });
});
