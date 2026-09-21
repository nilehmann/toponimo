import { violations } from "../game/session";
import type { SessionState } from "../game/types";
import { readJson, remove, writeJson } from "./local";

const KEY = "toponimo:host";

function isSessionState(value: unknown): value is SessionState {
  if (typeof value !== "object" || value === null) return false;
  const it = value as Partial<SessionState>;
  return (
    typeof it.version === "number" &&
    typeof it.code === "string" &&
    typeof it.hostId === "string" &&
    typeof it.createdAt === "number" &&
    typeof it.players === "object" &&
    it.players !== null &&
    typeof it.devices === "object" &&
    it.devices !== null &&
    Array.isArray(it.history) &&
    (it.game === null || typeof it.game === "object")
  );
}

/** El host guarda la única copia autoritativa, así que al reabrir retoma exactamente donde iba.
 *  Un estado que no cumple los invariantes se descarta: seguir desde algo roto difundiría el
 *  problema a toda la sala, y crear sala sortea un código nuevo igual. */
export function loadHostSession(): SessionState | null {
  const stored = readJson<unknown>(KEY);
  if (!isSessionState(stored) || violations(stored).length > 0) return null;
  return stored;
}

export function saveHostSession(state: SessionState): void {
  writeJson(KEY, state);
}

export function clearHostSession(): void {
  remove(KEY);
}
