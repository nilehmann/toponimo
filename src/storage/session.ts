import { violations } from "../game/session";
import type { SessionState } from "../game/types";
import { isSessionState } from "../game/validate";
import { isLocal } from "../net/open";
import { readJson, remove, scopeForTesting, writeJson } from "./local";

/** Dos cajones, no uno. Que una sala y una partida en solitario se guarden aparte no es un
 *  campo de modo en el estado —ahí no hay ninguno— sino lo que hace falta al reabrir para saber
 *  qué transporte levantar y si hay a quién mostrarle el código: en el estado las dos se ven
 *  idénticas, con un solo jugador que es su propio host.
 *
 *  Y sobre todo: tocar «Jugar solo» no puede borrar la única copia autoritativa de una sala que
 *  está en curso, que es lo que pasaría con un cajón compartido. */
const KEYS = {
  room: "toponimo:sala",
  solo: "toponimo:solo",
} as const;

export type Slot = keyof typeof KEYS;

export const SLOTS: Slot[] = ["room", "solo"];

const scope = () => scopeForTesting(isLocal());

/** El host guarda la única copia autoritativa, así que al reabrir retoma exactamente donde iba.
 *  Un estado que no cumple los invariantes se descarta: seguir desde algo roto lo difundiría a
 *  toda la sala, y crear sala sortea un código nuevo igual. */
export function loadHostSession(slot: Slot): SessionState | null {
  try {
    const stored = readJson<unknown>(KEYS[slot], scope());
    if (!isSessionState(stored) || violations(stored).length > 0) return null;
    return stored;
  } catch {
    // Esto corre durante el primer render: dejar salir una excepción sería una pantalla en
    // blanco, sin nada que tocar para borrar lo que la está causando.
    return null;
  }
}

export function saveHostSession(slot: Slot, state: SessionState): void {
  writeJson(KEYS[slot], state, scope());
}

export function clearHostSession(slot: Slot): void {
  remove(KEYS[slot], scope());
}

export type Saved = Record<Slot, SessionState | null>;

export function loadSaved(): Saved {
  return { room: loadHostSession("room"), solo: loadHostSession("solo") };
}
