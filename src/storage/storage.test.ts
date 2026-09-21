import { beforeEach, describe, expect, it } from "vitest";

import { createSession, reduce } from "../game/session";
import { fakeToponyms } from "../game/fixtures";
import { loadIdentity, rememberName, rememberRoom, saveIdentity } from "./identity";
import { clearHostSession, loadHostSession, saveHostSession } from "./session";
import { MemoryStorage } from "./memory";

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
});

describe("identidad", () => {
  it("sortea el DeviceId la primera vez y no lo regenera", () => {
    const first = loadIdentity();
    expect(first.deviceId).not.toBe("");
    expect(first.name).toBe("");
    expect(first.lastRoomCode).toBeNull();
    expect(loadIdentity().deviceId).toBe(first.deviceId);
  });

  it("sortea un DeviceId distinto por dispositivo", () => {
    const one = loadIdentity().deviceId;
    globalThis.localStorage = new MemoryStorage();
    expect(loadIdentity().deviceId).not.toBe(one);
  });

  it("recuerda el nombre y la última sala", () => {
    const identity = rememberRoom(rememberName(loadIdentity(), "Ana"), "2345678");
    expect(loadIdentity()).toEqual(identity);
    expect(loadIdentity().name).toBe("Ana");
    expect(loadIdentity().lastRoomCode).toBe("2345678");
  });

  it("descarta lo guardado si no tiene forma de identidad", () => {
    localStorage.setItem("toponimo:identity", '{"name":"Ana"}');
    expect(loadIdentity().deviceId).not.toBe("");
    expect(loadIdentity().name).toBe("");
  });

  it("no rompe con localStorage bloqueado", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("bloqueado");
      },
    });
    const identity = loadIdentity();
    expect(identity.deviceId).not.toBe("");
    expect(() => saveIdentity(identity)).not.toThrow();
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });
});

describe("sesión del host", () => {
  const state = () =>
    reduce(reduce(createSession("2345678", "d", "Nico", 10), { type: "join", deviceId: "e", name: "Ana" }), {
      type: "start",
      toponyms: fakeToponyms(),
    });

  it("vuelve igual de como se guardó, con history y devices", () => {
    const saved = state();
    saveHostSession(saved);
    expect(loadHostSession()).toEqual(saved);
  });

  it("no hay nada guardado antes de la primera sala", () => {
    expect(loadHostSession()).toBeNull();
  });

  it("descarta lo que no cumple los invariantes en vez de difundirlo", () => {
    const broken = state();
    broken.game!.rounds = broken.game!.rounds.slice(0, 3);
    saveHostSession(broken);
    expect(loadHostSession()).toBeNull();
  });

  it("descarta lo que no es un estado", () => {
    localStorage.setItem("toponimo:host", "no es json");
    expect(loadHostSession()).toBeNull();
    localStorage.setItem("toponimo:host", '{"version":1}');
    expect(loadHostSession()).toBeNull();
  });

  it("se puede borrar", () => {
    saveHostSession(state());
    clearHostSession();
    expect(loadHostSession()).toBeNull();
  });
});
