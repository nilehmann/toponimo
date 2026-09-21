import type { Identity, RoomCode } from "../game/types";
import { isLocal } from "../net/open";
import { readJson, scopeForTesting, writeJson } from "./local";

const KEY = "toponimo:identity";
const scope = () => scopeForTesting(isLocal());

/** `crypto.randomUUID` pide contexto seguro; en uno inseguro se arma igual con bytes al azar,
 *  porque lo único que se le pide al DeviceId es no repetirse. */
function newDeviceId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isIdentity(value: unknown): value is Identity {
  if (typeof value !== "object" || value === null) return false;
  const it = value as Partial<Identity>;
  return (
    typeof it.deviceId === "string" &&
    it.deviceId.length > 0 &&
    typeof it.name === "string" &&
    (it.lastRoomCode === null || typeof it.lastRoomCode === "string")
  );
}

/** El DeviceId se sortea la primera vez y nunca se regenera: es lo que reconoce a quien vuelve. */
export function loadIdentity(): Identity {
  const stored = readJson<unknown>(KEY, scope());
  if (isIdentity(stored)) return stored;
  const identity: Identity = { deviceId: newDeviceId(), name: "", lastRoomCode: null };
  writeJson(KEY, identity, scope());
  return identity;
}

export function saveIdentity(identity: Identity): Identity {
  writeJson(KEY, identity, scope());
  return identity;
}

export function rememberRoom(identity: Identity, code: RoomCode | null): Identity {
  return saveIdentity({ ...identity, lastRoomCode: code });
}

export function rememberName(identity: Identity, name: string): Identity {
  return saveIdentity({ ...identity, name });
}
