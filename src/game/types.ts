/** Estructura del nombre: a = una palabra, b = dos palabras, c = artículo + palabra. */
export type Form = "a" | "b" | "c";

/** Fila compacta de `game_data.json`: los índices apuntan a `comunas` y `regions`. */
export type RealRow = [name: string, comuna: number, region: number];

export interface GameData {
  R: Record<Form, RealRow[]>;
  F: Record<Form, string[]>;
  regions: string[];
  comunas: string[];
}

/** Identifica al dispositivo entre reconexiones. Es lo que reconoce a quien vuelve. */
export type DeviceId = string;

/** Identifica a un jugador dentro de una sala. Lo asigna el host en orden de llegada. */
export type PlayerId = string;

/** 7 caracteres: broker + secreto. */
export type RoomCode = string;

export type RoundIndex = number;

/** Lo que responde un jugador: true = "existe", false = "inventado". */
export type Guess = boolean;

/** El contenido del letrero. Lo produce el sorteo desde `game_data.json`. */
export type Toponym =
  | { name: string; real: true; comuna: string; region: string }
  | { name: string; real: false };

/** El letrero mientras sigue tapado: viaja sin su `real`. */
export interface HiddenToponym {
  name: string;
}

/** Una ronda jugada: el letrero y lo que respondió cada quien. */
export interface Round {
  toponym: Toponym;
  /** Ausencia de entrada = no respondió. Escribir dos veces la misma clave es idempotente. */
  guesses: Record<PlayerId, Guess>;
}

export interface Player {
  id: PlayerId;
  name: string;
}

export interface Game {
  /** Correlativo dentro de la sala: 1, 2, 3… */
  number: number;
  rounds: Round[];
  /** Quiénes cuentan ahora en la lista de respuestas. Crece al entrar, se achica con `bye`. */
  participants: PlayerId[];
  /** La ronda en pantalla. Al terminar se queda en 14: el fin lo marca `finishedAt`. */
  current: RoundIndex;
  /** Si la ronda `current` ya fue revelada por el host. */
  revealed: boolean;
  /** epoch ms al cerrarse las 15 rondas; null mientras se juega. */
  finishedAt: number | null;
}

/** Lo que el host persiste y difunde. Única fuente de verdad. */
export interface SessionState {
  /** Monotónica. Se descarta cualquier snapshot con versión menor a la ya aplicada. */
  version: number;
  code: RoomCode;
  hostId: PlayerId;
  players: Record<PlayerId, Player>;
  /** La partida en curso, o la recién cerrada mientras se muestra el resumen. */
  game: Game | null;
  /** Partidas cerradas, en orden. */
  history: Game[];
  /** Qué dispositivo es qué jugador. Es lo que reconoce a quien vuelve. */
  devices: Record<DeviceId, PlayerId>;
  createdAt: number;
}

/** Lo que el cliente ve de una ronda. El letrero se destapa recién al revelar. */
export interface PublicRound {
  /** Solo el nombre hasta que el host revela; ahí llega el letrero entero. */
  toponym: HiddenToponym | Toponym;
  guesses: Record<PlayerId, Guess>;
}

/** La partida como viaja: sin las rondas que todavía no se juegan. */
export type PublicGame = Omit<Game, "rounds"> & { rounds: PublicRound[] };

/** Lo que se difunde. */
export type Snapshot = Omit<SessionState, "history" | "devices" | "game"> & {
  game: PublicGame | null;
};

/** Lo único que persiste un jugador que no es host. */
export interface Identity {
  deviceId: DeviceId;
  name: string;
  lastRoomCode: RoomCode | null;
}
