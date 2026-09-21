import type { Game, PublicGame, PublicRound, Round, SessionState, Snapshot } from "./types";

/** Lo que llega del cable y lo que vuelve de `localStorage` son las dos entradas que nadie de
 *  adentro escribió: el broker es público y cualquiera puede publicar ahí, y lo guardado puede
 *  venir de otra versión de la aplicación. No se trata de desconfiar de la sala —el diseño ya
 *  asume confianza total adentro— sino de que un payload raro no rompa la pantalla.
 *
 *  Se mira la forma, no el sentido: que las claves existan y sean del tipo que dicen. Lo que no
 *  cumpla se descarta entero, porque medio mensaje aplicado es peor que ninguno. */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecordOf(value: unknown, ok: (entry: unknown) => boolean): boolean {
  return isObject(value) && Object.values(value).every(ok);
}

function isGuesses(value: unknown): boolean {
  return isRecordOf(value, (guess) => typeof guess === "boolean");
}

function isPlayers(value: unknown): boolean {
  return isRecordOf(
    value,
    (player) => isObject(player) && typeof player.id === "string" && typeof player.name === "string",
  );
}

function isIds(value: unknown): boolean {
  return Array.isArray(value) && value.every((id) => typeof id === "string");
}

/** El letrero tapado trae solo el nombre; el destapado, además su `real` y de dónde es. */
function isToponym(value: unknown, revealed: boolean): boolean {
  if (!isObject(value) || typeof value.name !== "string") return false;
  if (!revealed) return true;
  if (value.real === false) return true;
  return value.real === true && typeof value.comuna === "string" && typeof value.region === "string";
}

function isRound(value: unknown, revealed: boolean): value is Round | PublicRound {
  return isObject(value) && isToponym(value.toponym, revealed) && isGuesses(value.guesses);
}

function hasGameShape(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  return (
    typeof value.number === "number" &&
    typeof value.current === "number" &&
    typeof value.revealed === "boolean" &&
    (value.finishedAt === null || typeof value.finishedAt === "number") &&
    Array.isArray(value.rounds)
  );
}

/** El del host: las quince rondas destapadas, porque es quien las sorteó. */
export function isGame(value: unknown): value is Game {
  return hasGameShape(value) && (value.rounds as unknown[]).every((round) => isRound(round, true));
}

/** El que viaja: recortado en `current + 1`, y con la ronda en curso tapada hasta el reveal. */
export function isPublicGame(value: unknown): value is PublicGame {
  if (!hasGameShape(value)) return false;
  const rounds = value.rounds as unknown[];
  const last = rounds.length - 1;
  return rounds.every((round, i) => isRound(round, i < last || value.revealed === true));
}

export function isSnapshot(value: unknown): value is Snapshot {
  if (!isObject(value)) return false;
  return (
    typeof value.version === "number" &&
    Number.isFinite(value.version) &&
    typeof value.code === "string" &&
    typeof value.hostId === "string" &&
    typeof value.createdAt === "number" &&
    isPlayers(value.players) &&
    isIds(value.participants) &&
    (value.game === null || isPublicGame(value.game))
  );
}

export function isSessionState(value: unknown): value is SessionState {
  if (!isObject(value)) return false;
  return (
    typeof value.version === "number" &&
    Number.isFinite(value.version) &&
    typeof value.code === "string" &&
    typeof value.hostId === "string" &&
    typeof value.createdAt === "number" &&
    isPlayers(value.players) &&
    isIds(value.participants) &&
    isRecordOf(value.devices, (id) => typeof id === "string") &&
    Array.isArray(value.history) &&
    value.history.every(isGame) &&
    (value.game === null || isGame(value.game))
  );
}
