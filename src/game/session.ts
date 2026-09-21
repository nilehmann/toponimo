import { ROUNDS } from "./toponyms";
import type {
  DeviceId,
  Game,
  Guess,
  Player,
  PlayerId,
  PublicGame,
  PublicRound,
  RoomCode,
  Round,
  RoundIndex,
  SessionState,
  Snapshot,
  Toponym,
} from "./types";

/** Lo que el host le hace al estado. Todo lo que depende del reloj recibe `at`, para que el
 *  reducer siga siendo una función pura del estado y la acción. */
export type Action =
  | { type: "join"; deviceId: DeviceId; name: string }
  | { type: "answer"; playerId: PlayerId; gameNumber: number; round: RoundIndex; guess: Guess }
  | { type: "reveal" }
  | { type: "next"; at: number }
  | { type: "start"; toponyms: Toponym[] }
  | { type: "bye"; playerId: PlayerId };

/** El host se queda con el `1` al crear la sala; jugando solo ese es el único que existe. */
export const HOST_ID: PlayerId = "1";

export function createSession(
  code: RoomCode,
  deviceId: DeviceId,
  name: string,
  at: number,
): SessionState {
  return {
    version: 1,
    code,
    hostId: HOST_ID,
    players: { [HOST_ID]: { id: HOST_ID, name } },
    participants: [HOST_ID],
    game: null,
    history: [],
    devices: { [deviceId]: HOST_ID },
    createdAt: at,
  };
}

/** Un `PlayerId` no se reutiliza dentro de una sala aunque alguien se vaya, para que el
 *  historial siga siendo legible. */
function nextPlayerId(players: Record<PlayerId, Player>): PlayerId {
  const used = Object.keys(players).map(Number);
  return String(Math.max(0, ...used) + 1);
}

/** Si ya hay alguien con ese nombre, se le agrega un número: «Nico», «Nico 2». */
function uniqueName(players: Record<PlayerId, Player>, name: string, except?: PlayerId): string {
  const taken = new Set(
    Object.values(players)
      .filter((p) => p.id !== except)
      .map((p) => p.name),
  );
  if (!taken.has(name)) return name;
  for (let n = 2; ; n++) {
    const candidate = `${name} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Jugando solo no hay un segundo toque: sale de revelar apenas respondieron todos y hay un
 *  solo participante. No es un modo aparte ni un ajuste, y por eso también cierra la ronda
 *  cuando el que se va deja al host respondiendo solo. */
function withAutoReveal(game: Game | null, participants: PlayerId[]): Game | null {
  if (!game || game.revealed || participants.length !== 1) return game;
  const { guesses } = game.rounds[game.current];
  return participants.every((id) => id in guesses) ? { ...game, revealed: true } : game;
}

function withCurrentRound(game: Game, round: Round): Game {
  const rounds = game.rounds.slice();
  rounds[game.current] = round;
  return { ...game, rounds };
}

function join(state: SessionState, deviceId: DeviceId, name: string): SessionState {
  const known = state.devices[deviceId];
  if (known && state.players[known]) return rejoin(state, known, name);

  const id = nextPlayerId(state.players);
  const player: Player = { id, name: uniqueName(state.players, name) };
  return {
    ...state,
    version: state.version + 1,
    players: { ...state.players, [id]: player },
    devices: { ...state.devices, [deviceId]: id },
    // Quien llega con una partida abierta entra a jugarla desde la ronda en curso.
    participants: [...state.participants, id],
  };
}

/** Vuelve el mismo jugador de antes, con sus respuestas intactas. Repone su fila en la lista
 *  si se había ido con `bye`, y le deja cambiarse el nombre. */
function rejoin(state: SessionState, id: PlayerId, name: string): SessionState {
  const current = state.players[id];
  const renamed = name === current.name ? current.name : uniqueName(state.players, name, id);
  const missing = !state.participants.includes(id);
  if (renamed === current.name && !missing) return state;
  return {
    ...state,
    version: state.version + 1,
    players: { ...state.players, [id]: { id, name: renamed } },
    participants: missing ? [...state.participants, id] : state.participants,
  };
}

/** Pura sobre `SessionState`: no conoce el transporte ni React, y es la misma en los dos modos.
 *  Devolver el estado tal cual significa "esto no cambia nada": ni sube la versión ni se difunde. */
export function reduce(state: SessionState, action: Action): SessionState {
  const game = state.game;
  switch (action.type) {
    case "join":
      return join(state, action.deviceId, action.name);

    case "answer": {
      // El host solo acepta la ronda en curso: cubre la ronda ya revelada, la partida vieja y
      // la ronda futura, que de otro modo se registraría antes de tiempo.
      if (!game) return state;
      if (action.gameNumber !== game.number || action.round !== game.current) return state;
      if (game.revealed) return state;
      if (!state.players[action.playerId]) return state;
      const round = game.rounds[game.current];
      if (round.guesses[action.playerId] === action.guess) return state;
      const guesses = { ...round.guesses, [action.playerId]: action.guess };
      return {
        ...state,
        version: state.version + 1,
        game: withAutoReveal(withCurrentRound(game, { ...round, guesses }), state.participants),
      };
    }

    case "reveal":
      if (!game || game.revealed || game.finishedAt !== null) return state;
      return { ...state, version: state.version + 1, game: { ...game, revealed: true } };

    case "next": {
      if (!game || !game.revealed || game.finishedAt !== null) return state;
      // Al terminar `current` se queda en 14: el fin lo marca `finishedAt`.
      const advanced: Game =
        game.current + 1 < ROUNDS
          ? { ...game, current: game.current + 1, revealed: false }
          : { ...game, finishedAt: action.at };
      return {
        ...state,
        version: state.version + 1,
        game: withAutoReveal(advanced, state.participants),
      };
    }

    case "start": {
      if (action.toponyms.length !== ROUNDS) return state;
      const rounds = action.toponyms.map((toponym) => ({ toponym, guesses: {} }));
      // La partida cerrada pasa a `history` recién ahora, no al terminarse.
      const fresh: Game = {
        number: game ? game.number + 1 : 1,
        rounds,
        current: 0,
        revealed: false,
        finishedAt: null,
      };
      return {
        ...state,
        version: state.version + 1,
        history: game ? [...state.history, game] : state.history,
        game: fresh,
      };
    }

    case "bye": {
      // El host nunca se saca a sí mismo, que es lo que mantiene el invariante.
      if (action.playerId === state.hostId) return state;
      if (!state.participants.includes(action.playerId)) return state;
      // Irse puede dejar la ronda con todos respondidos: sin esto, el host que ya contestó se
      // queda solo mirando una ronda sin revelar y sin botón para revelarla.
      const participants = state.participants.filter((id) => id !== action.playerId);
      return {
        ...state,
        version: state.version + 1,
        participants,
        game: withAutoReveal(game, participants),
      };
    }
  }
}

// --- Proyección pública -------------------------------------------------------------------

/** `history` y `devices` son asunto del host, y las rondas se recortan en `current + 1` para no
 *  repartir el resultado por adelantado. */
export function project(state: SessionState): Snapshot {
  return {
    version: state.version,
    code: state.code,
    hostId: state.hostId,
    players: state.players,
    participants: state.participants,
    game: state.game && projectGame(state.game),
    createdAt: state.createdAt,
  };
}

function projectGame(game: Game): PublicGame {
  const rounds: PublicRound[] = game.rounds
    .slice(0, game.current + 1)
    .map(({ toponym, guesses }, i) => ({
      toponym: i < game.current || game.revealed ? toponym : { name: toponym.name },
      guesses,
    }));
  return {
    number: game.number,
    current: game.current,
    revealed: game.revealed,
    finishedAt: game.finishedAt,
    rounds,
  };
}

/** Lo único que pueden ver los dos lados de una ronda: el host tiene `Round`, el cliente
 *  `PublicRound`, y todo lo derivado se escribe una sola vez contra esto. */
export type AnyRound = Round | PublicRound;
export type AnyGame = Game | PublicGame;

/** El letrero destapado, o null si todavía viaja tapado. */
export function revealedToponym(round: AnyRound): Toponym | null {
  return "real" in round.toponym ? round.toponym : null;
}

// --- Selectores derivados -----------------------------------------------------------------

export type Phase = "lobby" | "answering" | "revealed" | "summary";

/** No se guarda: se deriva, para que no pueda contradecir al resto del estado. Cada condición
 *  se lee suelta, sin depender del orden. */
export function phase(game: AnyGame | null): Phase {
  if (game === null) return "lobby";
  if (!game.revealed && game.finishedAt === null) return "answering";
  if (game.revealed && game.finishedAt === null) return "revealed";
  return "summary";
}

/** Cuántas rondas ya fueron reveladas: las únicas donde hay con qué compararse. */
export function revealedRounds(game: AnyGame): number {
  return game.revealed ? game.current + 1 : game.current;
}

/** El marcador es sobre 15 para todos, incluido quien llegó tarde: las rondas que no le tocaron
 *  cuentan como no acertadas. */
export function score(game: AnyGame, playerId: PlayerId): number {
  let n = 0;
  for (const round of game.rounds.slice(0, revealedRounds(game))) {
    const toponym = revealedToponym(round);
    if (toponym && round.guesses[playerId] === toponym.real) n++;
  }
  return n;
}

/** Quienes aparecen en las `guesses` de la partida. No es `participants`: ese conjunto se achica
 *  con `bye`, e irse no debería borrar un puntaje ya jugado. */
export function scorers(game: AnyGame): PlayerId[] {
  const ids = new Set<PlayerId>();
  for (const round of game.rounds) for (const id of Object.keys(round.guesses)) ids.add(id);
  return [...ids].sort((a, b) => Number(a) - Number(b));
}

/** El marcador de la partida, de más a menos aciertos. */
export function scoreboard(game: AnyGame): { id: PlayerId; score: number }[] {
  return scorers(game)
    .map((id) => ({ id, score: score(game, id) }))
    .sort((a, b) => b.score - a.score || Number(a.id) - Number(b.id));
}

/** Lo que eligió un jugador en la ronda en pantalla, o undefined si no respondió. */
export function guessOf(game: AnyGame, playerId: PlayerId): Guess | undefined {
  return game.rounds[game.current]?.guesses[playerId];
}

/** De acá sale la marca en la lista de quién respondió. */
export function answered(game: AnyGame): Set<PlayerId> {
  return new Set(Object.keys(game.rounds[game.current]?.guesses ?? {}));
}

export function playersOf(snapshot: Snapshot, ids: Iterable<PlayerId>): Player[] {
  const out: Player[] = [];
  for (const id of ids) {
    const player = snapshot.players[id];
    if (player) out.push(player);
  }
  return out;
}

// --- Invariantes --------------------------------------------------------------------------

/** Sobre el estado del host. `PublicGame` es una proyección y no los cumple: sus rondas llegan
 *  recortadas. Se usa en las pruebas y al releer `localStorage`. */
export function violations(state: SessionState): string[] {
  const bad: string[] = [];
  if (!state.players[state.hostId]) bad.push("el host no está en players");
  if (!state.participants.includes(state.hostId)) bad.push("el host no está en participants");
  for (const id of state.participants) {
    if (!state.players[id]) bad.push(`participa ${id}, que no está en players`);
  }
  for (const game of [...state.history, ...(state.game ? [state.game] : [])]) {
    if (game.rounds.length !== ROUNDS) bad.push(`la partida ${game.number} no tiene 15 rondas`);
    for (const round of game.rounds) {
      for (const id of Object.keys(round.guesses)) {
        if (!state.players[id]) bad.push(`la partida ${game.number} tiene una respuesta de ${id}`);
      }
    }
  }
  return bad;
}
