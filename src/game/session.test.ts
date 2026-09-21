import { describe, expect, it } from "vitest";

import {
  HOST_ID,
  type Action,
  createSession,
  guessOf,
  phase,
  project,
  reduce,
  revealedToponym,
  score,
  scoreboard,
  scorers,
  violations,
} from "./session";
import { fakeToponyms } from "./fixtures";
import { ROUNDS } from "./toponyms";
import type { SessionState } from "./types";

const HOST_DEVICE = "device-host";

function fresh(): SessionState {
  return createSession("A234567", HOST_DEVICE, "Nico", 1000);
}

function run(state: SessionState, ...actions: Action[]): SessionState {
  return actions.reduce(reduce, state);
}

/** Sala con host + `names.length` invitados, sin partida empezada. */
function withGuests(...names: string[]): SessionState {
  return run(
    fresh(),
    ...names.map((name, i): Action => ({ type: "join", deviceId: `device-${i}`, name })),
  );
}

const start = (seed = 0): Action => ({ type: "start", toponyms: fakeToponyms(seed) });
const answer = (playerId: string, round: number, guess: boolean, gameNumber = 1): Action => ({
  type: "answer",
  playerId,
  gameNumber,
  round,
  guess,
});

describe("createSession", () => {
  it("deja al host como jugador 1 y sin partida", () => {
    const state = fresh();
    expect(state.hostId).toBe(HOST_ID);
    expect(state.players).toEqual({ "1": { id: "1", name: "Nico" } });
    expect(state.devices).toEqual({ [HOST_DEVICE]: "1" });
    expect(state.game).toBeNull();
    expect(phase(state.game)).toBe("lobby");
    expect(violations(state)).toEqual([]);
  });
});

describe("join", () => {
  it("reparte los PlayerId en orden de llegada", () => {
    const state = withGuests("Ana", "Beto");
    expect(Object.keys(state.players)).toEqual(["1", "2", "3"]);
    expect(state.players["3"].name).toBe("Beto");
  });

  it("devuelve el mismo jugador al mismo dispositivo y no sube la versión", () => {
    const first = run(fresh(), { type: "join", deviceId: "d", name: "Ana" });
    const again = reduce(first, { type: "join", deviceId: "d", name: "Ana" });
    expect(again).toBe(first);
    expect(again.devices["d"]).toBe("2");
  });

  it("numera los nombres repetidos", () => {
    const state = withGuests("Ana", "Ana", "Ana");
    const names = Object.values(state.players).map((p) => p.name);
    expect(names).toEqual(["Nico", "Ana", "Ana 2", "Ana 3"]);
  });

  it("no se numera contra sí mismo al volver con el mismo nombre", () => {
    const state = run(withGuests("Ana"), { type: "join", deviceId: "device-0", name: "Ana" });
    expect(state.players["2"].name).toBe("Ana");
  });

  it("deja cambiarse el nombre al volver", () => {
    const state = run(withGuests("Ana"), { type: "join", deviceId: "device-0", name: "Anita" });
    expect(state.players["2"].name).toBe("Anita");
  });

  it("no reutiliza el PlayerId de quien se fue", () => {
    const state = run(withGuests("Ana", "Beto"), start(), { type: "bye", playerId: "2" }, {
      type: "join",
      deviceId: "device-nuevo",
      name: "Caro",
    });
    expect(state.players["4"].name).toBe("Caro");
    expect(state.game!.participants).toEqual(["1", "3", "4"]);
  });

  it("mete a quien llega con la partida abierta", () => {
    const state = run(fresh(), start(), { type: "join", deviceId: "tarde", name: "Ana" });
    expect(state.game!.participants).toEqual(["1", "2"]);
  });
});

describe("answer", () => {
  it("registra la respuesta de la ronda en curso", () => {
    const state = run(withGuests("Ana"), start(), answer("2", 0, true));
    expect(state.game!.rounds[0].guesses).toEqual({ "2": true });
    expect(guessOf(state.game!, "2")).toBe(true);
  });

  it("es idempotente: la misma respuesta no sube la versión", () => {
    const before = run(withGuests("Ana"), start(), answer("2", 0, true));
    expect(reduce(before, answer("2", 0, true))).toBe(before);
  });

  it("rechaza la ronda futura, la vieja y la partida que no es", () => {
    const base = run(withGuests("Ana"), start());
    expect(reduce(base, answer("2", 1, true))).toBe(base);
    expect(reduce(base, answer("2", 0, true, 2))).toBe(base);
    const later = run(base, { type: "reveal" }, { type: "next", at: 0 });
    expect(reduce(later, answer("2", 0, true))).toBe(later);
  });

  it("rechaza la respuesta que llega después del reveal", () => {
    const revealed = run(withGuests("Ana"), start(), { type: "reveal" });
    expect(reduce(revealed, answer("2", 0, true))).toBe(revealed);
  });

  it("rechaza a quien no está en players", () => {
    const base = run(fresh(), start());
    expect(reduce(base, answer("9", 0, true))).toBe(base);
  });
});

describe("revelar solo", () => {
  it("revela apenas responde el único participante", () => {
    const state = run(fresh(), start(), answer("1", 0, true));
    expect(state.game!.revealed).toBe(true);
    expect(phase(state.game)).toBe("revealed");
  });

  it("no revela solo cuando hay más de un participante", () => {
    const state = run(withGuests("Ana"), start(), answer("1", 0, true), answer("2", 0, true));
    expect(state.game!.revealed).toBe(false);
  });

  it("no arrastra el revelado a la ronda siguiente", () => {
    const state = run(fresh(), start(), answer("1", 0, true), { type: "next", at: 0 });
    expect(state.game!.current).toBe(1);
    expect(state.game!.revealed).toBe(false);
  });
});

describe("reveal y next", () => {
  it("revela y avanza una ronda", () => {
    const state = run(withGuests("Ana"), start(), { type: "reveal" }, { type: "next", at: 5 });
    expect(state.game!.current).toBe(1);
    expect(state.game!.revealed).toBe(false);
    expect(state.game!.finishedAt).toBeNull();
  });

  it("no avanza sin revelar ni revela dos veces", () => {
    const base = run(withGuests("Ana"), start());
    expect(reduce(base, { type: "next", at: 0 })).toBe(base);
    const revealed = reduce(base, { type: "reveal" });
    expect(reduce(revealed, { type: "reveal" })).toBe(revealed);
  });

  it("cierra la partida en la ronda 14 dejando current donde estaba", () => {
    let state = run(withGuests("Ana"), start());
    for (let i = 0; i < ROUNDS; i++) {
      state = run(state, { type: "reveal" }, { type: "next", at: 777 });
    }
    expect(state.game!.current).toBe(ROUNDS - 1);
    expect(state.game!.finishedAt).toBe(777);
    expect(phase(state.game)).toBe("summary");
    expect(reduce(state, { type: "next", at: 999 })).toBe(state);
  });
});

describe("start", () => {
  it("numera las partidas y manda la anterior a history", () => {
    let state = run(withGuests("Ana"), start(1));
    for (let i = 0; i < ROUNDS; i++) state = run(state, { type: "reveal" }, { type: "next", at: 1 });
    expect(state.history).toHaveLength(0);
    state = reduce(state, start(2));
    expect(state.game!.number).toBe(2);
    expect(state.history).toHaveLength(1);
    expect(state.history[0].number).toBe(1);
    expect(violations(state)).toEqual([]);
  });

  it("ignora un sorteo que no traiga 15 letreros", () => {
    const base = withGuests("Ana");
    expect(reduce(base, { type: "start", toponyms: fakeToponyms().slice(0, 3) })).toBe(base);
  });

  it("arranca con todos los del lobby y arrastra a los participantes después", () => {
    const lobby = withGuests("Ana", "Beto");
    const first = run(lobby, start());
    expect(first.game!.participants).toEqual(["1", "2", "3"]);
    let state = run(first, { type: "bye", playerId: "3" });
    for (let i = 0; i < ROUNDS; i++) state = run(state, { type: "reveal" }, { type: "next", at: 1 });
    state = reduce(state, start(1));
    expect(state.game!.participants).toEqual(["1", "2"]);
  });
});

describe("bye", () => {
  it("saca de participants pero no de players ni del marcador", () => {
    const state = run(
      withGuests("Ana"),
      start(),
      answer("2", 0, true),
      { type: "reveal" },
      { type: "bye", playerId: "2" },
    );
    expect(state.game!.participants).toEqual(["1"]);
    expect(state.players["2"]).toBeDefined();
    expect(score(state.game!, "2")).toBe(1);
    expect(scorers(state.game!)).toEqual(["2"]);
    expect(violations(state)).toEqual([]);
  });

  it("el host nunca se saca a sí mismo", () => {
    const base = run(withGuests("Ana"), start());
    expect(reduce(base, { type: "bye", playerId: "1" })).toBe(base);
  });

  it("repone a quien vuelve con hello", () => {
    const state = run(
      withGuests("Ana"),
      start(),
      { type: "bye", playerId: "2" },
      { type: "join", deviceId: "device-0", name: "Ana" },
    );
    expect(state.game!.participants).toEqual(["1", "2"]);
  });
});

describe("versión", () => {
  it("solo crece, y de a uno por cambio", () => {
    let state = fresh();
    const seen = [state.version];
    for (const action of [
      { type: "join", deviceId: "d", name: "Ana" },
      start(),
      answer("2", 0, true),
      { type: "reveal" },
      { type: "next", at: 0 },
      { type: "bye", playerId: "2" },
    ] as Action[]) {
      state = reduce(state, action);
      seen.push(state.version);
    }
    expect(seen).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("puntaje", () => {
  it("cuenta solo las rondas reveladas", () => {
    // La ronda 0 es real: responder "existe" acierta, pero recién cuenta al revelarla.
    const answered = run(withGuests("Ana"), start(), answer("2", 0, true));
    expect(score(answered.game!, "2")).toBe(0);
    expect(score(reduce(answered, { type: "reveal" }).game!, "2")).toBe(1);
  });

  it("es sobre 15 para quien llegó tarde", () => {
    let state = run(withGuests("Ana"), start());
    for (let i = 0; i < 10; i++) state = run(state, { type: "reveal" }, { type: "next", at: 1 });
    state = run(state, { type: "join", deviceId: "tarde", name: "Caro" });
    state = run(state, answer("3", 10, true), { type: "reveal" });
    expect(state.game!.participants).toEqual(["1", "2", "3"]);
    expect(score(state.game!, "3")).toBe(1);
  });

  it("ordena el marcador de más a menos", () => {
    const state = run(
      withGuests("Ana"),
      start(),
      answer("1", 0, false),
      answer("2", 0, true),
      { type: "reveal" },
    );
    expect(scoreboard(state.game!)).toEqual([
      { id: "2", score: 1 },
      { id: "1", score: 0 },
    ]);
  });
});

describe("proyección", () => {
  it("no manda history ni devices", () => {
    const snapshot = project(run(withGuests("Ana"), start()));
    expect(snapshot).not.toHaveProperty("history");
    expect(snapshot).not.toHaveProperty("devices");
    expect(JSON.stringify(snapshot)).not.toContain("device-0");
  });

  it("recorta las rondas que faltan y tapa la ronda en curso", () => {
    const state = run(withGuests("Ana"), start(), { type: "reveal" }, { type: "next", at: 0 });
    const game = project(state).game!;
    expect(game.rounds).toHaveLength(2);
    expect(revealedToponym(game.rounds[0])).not.toBeNull();
    expect(revealedToponym(game.rounds[1])).toBeNull();
    expect(game.rounds[1].toponym.name).toBe(state.game!.rounds[1].toponym.name);
  });

  it("destapa la ronda en curso al revelarla", () => {
    const state = run(withGuests("Ana"), start(), { type: "reveal" });
    const game = project(state).game!;
    expect(revealedToponym(game.rounds[0])).toEqual(state.game!.rounds[0].toponym);
  });

  it("no filtra el resultado de las 15 rondas antes de jugarlas", () => {
    const state = run(withGuests("Ana"), start());
    const wire = JSON.stringify(project(state));
    for (const round of state.game!.rounds.slice(1)) {
      expect(wire).not.toContain(round.toponym.name);
    }
  });

  it("manda las guesses también antes del reveal", () => {
    const state = run(withGuests("Ana"), start(), answer("2", 0, false));
    expect(project(state).game!.rounds[0].guesses).toEqual({ "2": false });
  });

  it("deja las 15 rondas destapadas en el resumen", () => {
    let state = run(withGuests("Ana"), start());
    for (let i = 0; i < ROUNDS; i++) state = run(state, { type: "reveal" }, { type: "next", at: 1 });
    const game = project(state).game!;
    expect(game.rounds).toHaveLength(ROUNDS);
    expect(game.rounds.every((r) => revealedToponym(r) !== null)).toBe(true);
    expect(phase(game)).toBe("summary");
  });

  it("los selectores dan lo mismo sobre el estado del host y sobre el snapshot", () => {
    const state = run(
      withGuests("Ana"),
      start(),
      answer("1", 0, true),
      answer("2", 0, false),
      { type: "reveal" },
    );
    const game = project(state).game!;
    expect(scoreboard(game)).toEqual(scoreboard(state.game!));
    expect(phase(game)).toBe(phase(state.game));
    expect(guessOf(game, "2")).toBe(guessOf(state.game!, "2"));
  });
});
