import { describe, expect, it } from "vitest";

import { createLoopback } from "./loopback";
import type { ClientMessage, HostMessage } from "./transport";
import type { Snapshot } from "../game/types";

const EMPTY: Snapshot = {
  version: 1,
  code: "2345678",
  hostId: "1",
  players: {},
  participants: ["1"],
  game: null,
  createdAt: 0,
};

const welcome = (deviceId: string, playerId: string): HostMessage => ({
  t: "welcome",
  deviceId,
  playerId,
  state: EMPTY,
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("loopback", () => {
  it("lleva los mensajes del cliente al host y los del host a todos", async () => {
    const bus = createLoopback();
    const seenByHost: ClientMessage[] = [];
    const seenByA: HostMessage[] = [];
    const seenByB: HostMessage[] = [];

    const host = bus.host();
    host.connect({ onClientMessage: (m) => seenByHost.push(m), onHostMessage: () => {} });
    const a = bus.client("da");
    a.connect({ onClientMessage: () => {}, onHostMessage: (m) => seenByA.push(m) });
    const b = bus.client("db");
    b.connect({ onClientMessage: () => {}, onHostMessage: (m) => seenByB.push(m) });

    a.send({ t: "hello", deviceId: "da", name: "Ana" });
    host.broadcast({ t: "snapshot", state: EMPTY });
    await flush();

    expect(seenByHost).toEqual([{ t: "hello", deviceId: "da", name: "Ana" }]);
    expect(seenByA).toEqual([{ t: "snapshot", state: EMPTY }]);
    expect(seenByB).toEqual(seenByA);
  });

  it("no entrega nada en el mismo tick", async () => {
    const bus = createLoopback();
    const seen: ClientMessage[] = [];
    bus.host().connect({ onClientMessage: (m) => seen.push(m), onHostMessage: () => {} });
    const a = bus.client("da");
    a.connect({ onClientMessage: () => {}, onHostMessage: () => {} });
    a.send({ t: "ack", playerId: "2", version: 3 });
    expect(seen).toEqual([]);
    await flush();
    expect(seen).toHaveLength(1);
  });

  it("dirige sendTo al jugador que aprendió su id del welcome, y lo marca dirigido", async () => {
    const bus = createLoopback();
    const seenByA: [HostMessage, boolean][] = [];
    const seenByB: HostMessage[] = [];
    const host = bus.host();
    host.connect({ onClientMessage: () => {}, onHostMessage: () => {} });
    bus
      .client("da")
      .connect({ onClientMessage: () => {}, onHostMessage: (m, direct) => seenByA.push([m, direct]) });
    bus.client("db").connect({ onClientMessage: () => {}, onHostMessage: (m) => seenByB.push(m) });

    host.broadcast(welcome("da", "2"));
    host.broadcast(welcome("db", "3"));
    await flush();
    host.sendTo("2", { t: "snapshot", state: EMPTY });
    await flush();

    const aA = seenByA.filter(([m]) => m.t === "snapshot");
    expect(aA).toHaveLength(1);
    // El canal personal es la señal de que el host está esperando un acuse.
    expect(aA[0][1]).toBe(true);
    expect(seenByA.filter(([m]) => m.t === "welcome").every(([, direct]) => !direct)).toBe(true);
    expect(seenByB.filter((m) => m.t === "snapshot")).toHaveLength(0);
  });

  it("deja de entregar al desconectarse", async () => {
    const bus = createLoopback();
    const seen: HostMessage[] = [];
    const host = bus.host();
    host.connect({ onClientMessage: () => {}, onHostMessage: () => {} });
    const stop = bus
      .client("da")
      .connect({ onClientMessage: () => {}, onHostMessage: (m) => seen.push(m) });
    stop();
    host.broadcast({ t: "snapshot", state: EMPTY });
    await flush();
    expect(seen).toEqual([]);
  });

  it("drop tira el mensaje que le toca", async () => {
    const bus = createLoopback({ drop: (msg) => msg.t === "snapshot" });
    const seen: HostMessage[] = [];
    const host = bus.host();
    host.connect({ onClientMessage: () => {}, onHostMessage: () => {} });
    bus.client("da").connect({ onClientMessage: () => {}, onHostMessage: (m) => seen.push(m) });
    host.broadcast({ t: "snapshot", state: EMPTY });
    host.broadcast(welcome("da", "2"));
    await flush();
    expect(seen.map((m) => m.t)).toEqual(["welcome"]);
  });

  it("no deja que el host mande como cliente ni al revés", () => {
    const bus = createLoopback();
    expect(() => bus.host().send({ t: "bye", playerId: "2" })).toThrow();
    expect(() => bus.client("da").broadcast({ t: "snapshot", state: EMPTY })).toThrow();
  });
});
