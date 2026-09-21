import { beforeEach, describe, expect, it } from "vitest";

import { createSession, reduce } from "../game/session";
import { fakeToponyms } from "../game/fixtures";
import { loadIdentity, rememberName, rememberRoom, saveIdentity } from "./identity";
import { clearHostSession, loadHostSession, loadSaved, saveHostSession } from "./session";
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
    saveHostSession("room", saved);
    expect(loadHostSession("room")).toEqual(saved);
  });

  it("la sala y el solitario no se pisan: jugar solo no borra una sala en curso", () => {
    const sala = state();
    const solo = createSession("2345678", "d", "Vos", 10);
    saveHostSession("room", sala);
    saveHostSession("solo", solo);
    expect(loadSaved()).toEqual({ room: sala, solo });
    clearHostSession("solo");
    expect(loadSaved()).toEqual({ room: sala, solo: null });
  });

  it("no hay nada guardado antes de la primera sala", () => {
    expect(loadSaved()).toEqual({ room: null, solo: null });
  });

  it("descarta lo que no cumple los invariantes en vez de difundirlo", () => {
    const broken = state();
    broken.game!.rounds = broken.game!.rounds.slice(0, 3);
    saveHostSession("room", broken);
    expect(loadHostSession("room")).toBeNull();
  });

  it("descarta un estado a medio guardar en vez de romper la pantalla", () => {
    // Esto corre durante el primer render: una excepción acá deja la aplicación en blanco y sin
    // nada que tocar para borrar lo que la causa.
    const roto = state();
    for (const parche of [
      { ...roto, game: { number: 1 } },
      { ...roto, game: { ...roto.game, rounds: [{ toponym: null, guesses: {} }] } },
      { ...roto, game: { ...roto.game, rounds: "quince" } },
      { ...roto, history: [{ number: 1 }] },
      { ...roto, game: { ...roto.game, participants: null } },
    ]) {
      localStorage.setItem("toponimo:sala", JSON.stringify(parche));
      expect(loadHostSession("room")).toBeNull();
    }
  });

  it("descarta lo que no es un estado", () => {
    localStorage.setItem("toponimo:sala", "no es json");
    expect(loadHostSession("room")).toBeNull();
    localStorage.setItem("toponimo:sala", '{"version":1}');
    expect(loadHostSession("room")).toBeNull();
  });

  it("se puede borrar", () => {
    saveHostSession("room", state());
    clearHostSession("room");
    expect(loadHostSession("room")).toBeNull();
  });
});
