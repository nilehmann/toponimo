import { violations } from "../game/session";
import type { SessionState } from "../game/types";
import { readJson, remove, writeJson } from "./local";

const KEY = "toponimo:host";

/** `shared` no es parte del estado —ahí no hay ningún campo que diga en qué modo estamos— sino
 *  lo que hace falta para saber qué transporte reabrir y si hay a quién mostrarle el código.
 *  Jugar solo es una sala de un jugador que no se conecta a ninguna parte, y eso no se puede
 *  deducir de un estado donde todavía no entró nadie. */
export interface HostRecord {
  shared: boolean;
  state: SessionState;
}

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
 *  Un estado que no cumple los invariantes se descarta: seguir desde algo roto lo difundiría a
 *  toda la sala, y crear sala sortea un código nuevo igual. */
export function loadHostSession(): HostRecord | null {
  const stored = readJson<unknown>(KEY);
  if (typeof stored !== "object" || stored === null) return null;
  const record = stored as Partial<HostRecord>;
  if (typeof record.shared !== "boolean" || !isSessionState(record.state)) return null;
  return violations(record.state).length > 0 ? null : { shared: record.shared, state: record.state };
}

export function saveHostSession(record: HostRecord): void {
  writeJson(KEY, record);
}

export function clearHostSession(): void {
  remove(KEY);
}
