import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeToponyms } from "../game/fixtures";
import { createSession, guessOf, phase, project, revealedToponym, score } from "../game/session";
import { ROUNDS } from "../game/toponyms";
import type { Guess, PlayerId, Snapshot } from "../game/types";
import { createClient } from "./client";
import { createHost } from "./host";
import { type LoopbackOptions, createLoopback } from "./loopback";
import { createNullTransport } from "./null";
import type { SessionRuntime } from "./runtime";

/** Los transportes entregan en microtareas, así que hay que dejarlas correr. */
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

function room(options?: LoopbackOptions) {
  const bus = createLoopback(options);
  const host = createHost({
    state: createSession("2345678", "dispositivo-host", "Nico", 0),
    transport: bus.host(),
    now: () => 4242,
  });
  const join = (deviceId: string, name: string) =>
    createClient({ transport: bus.client(deviceId), deviceId, name });
  return { host, join };
}

const snapshotOf = (runtime: SessionRuntime): Snapshot => {
  const { snapshot } = runtime.getView();
  if (!snapshot) throw new Error("todavía no hay snapshot");
  return snapshot;
};

const gameOf = (runtime: SessionRuntime) => {
  const game = snapshotOf(runtime).game;
  if (!game) throw new Error("todavía no hay partida");
  return game;
};

const meOf = (runtime: SessionRuntime): PlayerId => {
  const { me } = runtime.getView();
  if (!me) throw new Error("todavía no sé quién soy");
  return me;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("entrar a la sala", () => {
  it("el welcome dice quién sos y trae el estado entero", async () => {
    const { host, join } = room();
    const ana = join("da", "Ana");
    await settle();

    expect(meOf(ana)).toBe("2");
    expect(snapshotOf(ana).players).toEqual({
      "1": { id: "1", name: "Nico" },
      "2": { id: "2", name: "Ana" },
    });
    expect(snapshotOf(ana).version).toBe(snapshotOf(host).version);
    expect(ana.getView().unreachable).toBe(false);
  });

  it("cada uno se queda solo con su welcome, aunque vayan por el canal de todos", async () => {
    const { join } = room();
    const ana = join("da", "Ana");
    const beto = join("db", "Beto");
    await settle();
    expect(meOf(ana)).toBe("2");
    expect(meOf(beto)).toBe("3");
  });

  it("el host no reparte los DeviceId en el snapshot", async () => {
    const { host, join } = room();
    join("da", "Ana");
    await settle();
    expect(JSON.stringify(snapshotOf(host))).not.toContain("da");
  });

  it("volver con el mismo dispositivo devuelve el mismo jugador y sus respuestas", async () => {
    const { host, join } = room();
    const ana = join("da", "Ana");
    await settle();
    host.start(fakeToponyms());
    await settle();
    ana.answer(true);
    await settle();
    ana.stop();

    const devuelta = join("da", "Ana");
    await settle();
    expect(meOf(devuelta)).toBe("2");
    expect(guessOf(gameOf(devuelta), "2")).toBe(true);
  });
});

describe("una ronda", () => {
  it("el letrero llega tapado y se destapa al revelar", async () => {
    const { host, join } = room();
    const ana = join("da", "Ana");
    await settle();
    host.start(fakeToponyms());
    await settle();

    const tapado = gameOf(ana).rounds[0];
    expect(revealedToponym(tapado)).toBeNull();
    expect(tapado.toponym.name).toBe("Real 0-0");
    expect(phase(gameOf(ana))).toBe("answering");

    host.reveal();
    await settle();
    expect(revealedToponym(gameOf(ana).rounds[0])).toEqual({
      name: "Real 0-0",
      real: true,
      comuna: "Comuna",
      region: "Región",
    });
    expect(phase(gameOf(ana))).toBe("revealed");
  });

  it("marca la elección al toque y la confirma con el snapshot", async () => {
    const { host, join } = room();
    const ana = join("da", "Ana");
    await settle();
    host.start(fakeToponyms());
    await settle();

    ana.answer(false);
    expect(ana.getView().pending).toBe(false);
    expect(guessOf(gameOf(ana), "2")).toBeUndefined();

    await settle();
    expect(ana.getView().pending).toBeNull();
    expect(guessOf(gameOf(ana), "2")).toBe(false);
    expect(guessOf(gameOf(host), "2")).toBe(false);
  });

  it("si la respuesta se pierde, los botones se deseleccionan solos", async () => {
    let tirar = false;
    const { host, join } = room({ drop: (msg) => tirar && msg.t === "answer" });
    const ana = join("da", "Ana");
    await settle();
    host.start(fakeToponyms());
    await settle();

    tirar = true;
    ana.answer(true);
    expect(ana.getView().pending).toBe(true);
    await settle();
    // Nada volvió, así que la marca sigue: lo que la borra es el próximo snapshot.
    expect(ana.getView().pending).toBe(true);

    tirar = false;
    ana.refresh();
    await settle();
    // El welcome vuelve con la misma versión y repinta igual: es lo que hace que refrescar sirva.
    expect(ana.getView().pending).toBeNull();
    expect(ana.getView().late).toBe(false);
    expect(guessOf(gameOf(ana), "2")).toBeUndefined();

    // Y responder de nuevo es el mismo botón de siempre.
    ana.answer(true);
    await settle();
    expect(guessOf(gameOf(ana), "2")).toBe(true);
  });

  it("no deja responder una ronda que ya vio revelada", async () => {
    const { host, join } = room();
    const ana = join("da", "Ana");
    await settle();
    host.start(fakeToponyms());
    await settle();
    host.reveal();
    await settle();

    ana.answer(true);
    await settle();
    expect(guessOf(gameOf(host), "2")).toBeUndefined();
    expect(ana.getView().pending).toBeNull();
    expect(ana.getView().late).toBe(false);
  });

  it("le dice al jugador que su respuesta llegó tarde", async () => {
    // El host revela mientras Ana todavía ve los botones: su toque llega después y se rechaza.
    let tirarDifusion = false;
    const { host, join } = room({ drop: (_msg, to) => tirarDifusion && to === "all" });
    const ana = join("da", "Ana");
    await settle();
    host.start(fakeToponyms());
    await settle();

    tirarDifusion = true;
    host.reveal();
    await settle();
    tirarDifusion = false;

    ana.answer(true);
    expect(ana.getView().late).toBe(false);
    await settle();
    // El host la rechazó sin cambiar nada, así que no difundió: lo que despierta a Ana es el
    // reenvío del reveal que nunca acusó.
    expect(ana.getView().pending).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    await settle();

    expect(guessOf(gameOf(host), "2")).toBeUndefined();
    expect(ana.getView().pending).toBeNull();
    expect(ana.getView().late).toBe(true);

    // El aviso dura lo que dura esa ronda.
    host.next();
    await settle();
    expect(ana.getView().late).toBe(false);
  });

  it("el host ve quién respondió", async () => {
    const { host, join } = room();
    const ana = join("da", "Ana");
    join("db", "Beto");
    await settle();
    host.start(fakeToponyms());
    await settle();
    ana.answer(true);
    await settle();

    expect(Object.keys(gameOf(host).rounds[0].guesses)).toEqual(["2"]);
    expect(gameOf(host).participants).toEqual(["1", "2", "3"]);
  });
});

describe("acuse de recibo y reenvíos", () => {
  it("el reveal se acusa y el host lleva la cuenta", async () => {
    const { host, join } = room();
    join("da", "Ana");
    await settle();
    host.start(fakeToponyms());
    await settle();
    host.reveal();
    await settle();

    expect(host.getView().acked["2"]).toBe(snapshotOf(host).version);
  });

  it("una respuesta ajena no se acusa: no cambia nada de lo que estás mirando", async () => {
    const { host, join } = room();
    const ana = join("da", "Ana");
    join("db", "Beto");
    await settle();
    host.start(fakeToponyms());
    await settle();
    const alDia = host.getView().acked["3"];

    ana.answer(true);
    await settle();
    expect(host.getView().acked["3"]).toBe(alDia);
    expect(snapshotOf(host).version).toBeGreaterThan(alDia);
  });

  it("reenvía a los 2 segundos a quien no acusó y ahí se pone al día", async () => {
    let tirarDifusion = false;
    const { host, join } = room({ drop: (_msg, to) => tirarDifusion && to === "all" });
    const ana = join("da", "Ana");
    await settle();
    host.start(fakeToponyms());
    await settle();

    tirarDifusion = true;
    host.reveal();
    await settle();
    expect(revealedToponym(gameOf(ana).rounds[0])).toBeNull();

    await vi.advanceTimersByTimeAsync(2000);
    await settle();
    expect(revealedToponym(gameOf(ana).rounds[0])).not.toBeNull();
    expect(host.getView().acked["2"]).toBe(snapshotOf(host).version);
  });

  it("se rinde al tercer intento, a los catorce segundos", async () => {
    const perdidos: number[] = [];
    let tirarTodo = false;
    const { host, join } = room({
      drop: (msg, to) => {
        if (!tirarTodo || msg.t !== "snapshot") return false;
        if (to !== "all") perdidos.push(Date.now());
        return true;
      },
    });
    join("da", "Ana");
    await settle();
    host.start(fakeToponyms());
    await settle();
    const alDia = host.getView().acked["2"];

    tirarTodo = true;
    host.reveal();
    await settle();

    await vi.advanceTimersByTimeAsync(1999);
    expect(perdidos).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(perdidos).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(perdidos).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(8000);
    expect(perdidos).toHaveLength(3);
    // Se rindió: de acá en adelante recuperarse es cosa del cliente.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(perdidos).toHaveLength(3);
    expect(host.getView().acked["2"]).toBe(alDia);
  });

  it("un cambio nuevo reemplaza los reenvíos pendientes", async () => {
    let tirarDifusion = false;
    const { host, join } = room({ drop: (_msg, to) => tirarDifusion && to === "all" });
    const ana = join("da", "Ana");
    await settle();
    host.start(fakeToponyms());
    await settle();

    tirarDifusion = true;
    host.reveal();
    await settle();
    await vi.advanceTimersByTimeAsync(1000);
    host.next();
    await settle();

    tirarDifusion = false;
    await vi.advanceTimersByTimeAsync(2000);
    await settle();
    expect(gameOf(ana).current).toBe(1);
    expect(host.getView().acked["2"]).toBe(snapshotOf(host).version);
  });

  it("no se reenvía a quien avisó que se iba", async () => {
    const enviosDirigidos: string[] = [];
    const { host, join } = room({
      drop: (_msg, to) => {
        if (to !== "all" && to !== "host") enviosDirigidos.push(to);
        return false;
      },
    });
    const ana = join("da", "Ana");
    await settle();
    host.start(fakeToponyms());
    await settle();
    ana.leave();
    await settle();

    expect(gameOf(host).participants).toEqual(["1"]);
    host.reveal();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(enviosDirigidos).toEqual([]);
  });
});

describe("no alcanzar al host", () => {
  it("reintenta el hello y a los catorce segundos lo dice", async () => {
    const hellos: number[] = [];
    const { join } = room({ drop: (msg) => msg.t === "hello" && (hellos.push(1), true) });
    const ana = join("da", "Ana");
    await settle();

    expect(hellos).toHaveLength(1);
    expect(ana.getView().unreachable).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(hellos).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(4000);
    expect(hellos).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(8000);
    expect(hellos).toHaveLength(4);
    expect(ana.getView().unreachable).toBe(true);
    expect(ana.getView().snapshot).toBeNull();
  });

  it("refrescar limpia el aviso cuando el host vuelve a contestar", async () => {
    let incomunicado = true;
    const { join } = room({ drop: (msg) => incomunicado && msg.t === "hello" });
    const ana = join("da", "Ana");
    await vi.advanceTimersByTimeAsync(14_000);
    expect(ana.getView().unreachable).toBe(true);

    incomunicado = false;
    ana.refresh();
    await settle();
    expect(ana.getView().unreachable).toBe(false);
    expect(meOf(ana)).toBe("2");
  });
});

describe("irse y volver", () => {
  it("bye saca de la lista pero no del marcador, y hello repone", async () => {
    const { host, join } = room();
    const ana = join("da", "Ana");
    await settle();
    host.start(fakeToponyms());
    await settle();
    ana.answer(true);
    await settle();
    host.reveal();
    await settle();
    ana.leave();
    await settle();

    expect(gameOf(host).participants).toEqual(["1"]);
    expect(snapshotOf(host).players["2"]).toBeDefined();
    expect(score(gameOf(host), "2")).toBe(1);

    const devuelta = join("da", "Ana");
    await settle();
    expect(gameOf(host).participants).toEqual(["1", "2"]);
    expect(meOf(devuelta)).toBe("2");
  });
});

describe("jugar solo", () => {
  it("es una sala de un jugador que es su propio host y no se conecta a ninguna parte", async () => {
    const host = createHost({
      state: createSession("2345678", "d", "Vos", 0),
      transport: createNullTransport(),
      now: () => 4242,
    });
    host.start(fakeToponyms());
    expect(phase(gameOf(host))).toBe("answering");

    host.answer(true);
    // Se revela apenas responde, sin un segundo toque.
    expect(phase(gameOf(host))).toBe("revealed");
    expect(score(gameOf(host), "1")).toBe(1);

    host.next();
    expect(gameOf(host).current).toBe(1);
    expect(phase(gameOf(host))).toBe("answering");
  });

  it("llega al resumen con las quince rondas", async () => {
    const host = createHost({
      state: createSession("2345678", "d", "Vos", 0),
      transport: createNullTransport(),
      now: () => 4242,
    });
    host.start(fakeToponyms());
    for (let i = 0; i < ROUNDS; i++) {
      host.answer(i % 2 === 0);
      host.next();
    }
    expect(phase(gameOf(host))).toBe("summary");
    expect(gameOf(host).finishedAt).toBe(4242);
    expect(gameOf(host).rounds).toHaveLength(ROUNDS);
    expect(score(gameOf(host), "1")).toBe(ROUNDS);
  });
});

describe("una partida entera en grupo", () => {
  it("los dos lados terminan con el mismo marcador", async () => {
    const { host, join } = room();
    const ana = join("da", "Ana");
    const beto = join("db", "Beto");
    await settle();
    host.start(fakeToponyms());
    await settle();

    const respuestas: Record<string, Guess> = { "2": true, "3": false };
    for (let i = 0; i < ROUNDS; i++) {
      host.answer(i % 3 !== 0);
      ana.answer(respuestas["2"]);
      beto.answer(respuestas["3"]);
      await settle();
      host.reveal();
      await settle();
      host.next();
      await settle();
    }

    expect(phase(gameOf(ana))).toBe("summary");
    for (const runtime of [host, ana, beto]) {
      expect(score(gameOf(runtime), "2")).toBe(8);
      expect(score(gameOf(runtime), "3")).toBe(7);
      expect(score(gameOf(runtime), "1")).toBe(score(gameOf(host), "1"));
    }
    expect(host.getView().acked["2"]).toBe(snapshotOf(host).version);
  });

  it("empezar otra ronda manda la anterior al historial y no la reparte", async () => {
    const { host, join } = room();
    const ana = join("da", "Ana");
    await settle();
    host.start(fakeToponyms(0));
    await settle();
    for (let i = 0; i < ROUNDS; i++) {
      host.reveal();
      host.next();
    }
    await settle();
    host.start(fakeToponyms(1));
    await settle();

    expect(gameOf(ana).number).toBe(2);
    expect(gameOf(ana).rounds).toHaveLength(1);
    expect(phase(gameOf(ana))).toBe("answering");
    expect(JSON.stringify(snapshotOf(ana))).not.toContain("Real 0-");
  });
});

describe("gana la versión más alta", () => {
  it("un snapshot rezagado se descarta sin efecto", async () => {
    const bus = createLoopback();
    const host = bus.host();
    host.connect({ onClientMessage: () => {}, onHostMessage: () => {} });
    const ana = createClient({ transport: bus.client("da"), deviceId: "da", name: "Ana" });
    await settle();

    const state = createSession("2345678", "dh", "Nico", 0);
    const alDia = { ...project(state), version: 9 };
    host.broadcast({ t: "welcome", deviceId: "da", playerId: "2", state: alDia });
    await settle();
    expect(snapshotOf(ana).version).toBe(9);

    host.broadcast({ t: "snapshot", state: { ...alDia, version: 4, code: "VIEJO12" } });
    await settle();
    expect(snapshotOf(ana).version).toBe(9);
    expect(snapshotOf(ana).code).toBe("2345678");
  });
});

describe("estar al día", () => {
  it("nadie está atrasado antes del primer cambio que haya que acusar", async () => {
    const { host, join } = room();
    join("da", "Ana");
    join("db", "Beto");
    await settle();
    // Entrar sube la versión, pero entrar no es algo que nadie tenga que acusar.
    expect(host.getView().awaited).toBe(0);
  });

  it("se mide contra el último cambio que había que acusar, no contra la versión", async () => {
    const { host, join } = room();
    join("da", "Ana");
    join("db", "Beto");
    await settle();
    host.start(fakeToponyms());
    host.reveal();
    await settle();

    const awaited = host.getView().awaited;
    expect(awaited).toBe(snapshotOf(host).version);
    expect(host.getView().acked["2"]).toBeGreaterThanOrEqual(awaited);

    // Alguien entra con el reveal en pantalla: sube la versión y no la acusa nadie, pero eso
    // no deja atrasado a quien ya vio el resultado.
    join("dc", "Caro");
    await settle();
    expect(snapshotOf(host).version).toBeGreaterThan(awaited);
    expect(host.getView().awaited).toBe(awaited);
    expect(host.getView().acked["2"]).toBeGreaterThanOrEqual(host.getView().awaited);
  });
});
