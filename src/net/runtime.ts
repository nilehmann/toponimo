import type { Guess, PlayerId, Snapshot, Toponym } from "../game/types";

/** Lo único que la interfaz ve de la sesión, igual jugando solo que en grupo. No hay un campo
 *  de modo: quien mira esto sabe que es host porque `me === snapshot.hostId`. */
export interface SessionView {
  snapshot: Snapshot | null;
  me: PlayerId | null;
  /** Solo lo llena el host: última versión que acusó cada jugador. Efímero, no se difunde. */
  acked: Record<PlayerId, number>;
  /** La última versión que hacía falta acusar, o 0 si todavía no hubo ninguna. Estar al día se
   *  mide contra esto y no contra la versión actual: una respuesta ajena también sube la
   *  versión, y nadie la acusa ni tiene por qué. */
  awaited: number;
  /** Solo el jugador: tres `hello` seguidos sin respuesta. */
  unreachable: boolean;
  /** Lo que el jugador acaba de tocar y el host todavía no confirmó. Se borra con el próximo
   *  snapshot, así que una respuesta perdida deselecciona los botones sola. */
  pending: Guess | null;
  /** Su respuesta llegó después del reveal y el host la rechazó. */
  late: boolean;
}

export interface SessionRuntime {
  subscribe(listener: () => void): () => void;
  getView(): SessionView;
  answer(guess: Guess): void;
  /** Solo el host; en el jugador no hacen nada, que es lo que deja a la interfaz sin ramas. */
  reveal(): void;
  next(): void;
  start(toponyms: Toponym[]): void;
  /** Volver a preguntar: en el jugador manda `hello`, en el host repite el snapshot. */
  refresh(): void;
  /** Avisar que se va y cortar. */
  leave(): void;
  stop(): void;
}

export const EMPTY_VIEW: SessionView = {
  snapshot: null,
  me: null,
  acked: {},
  awaited: 0,
  unreachable: false,
  pending: null,
  late: false,
};

/** El patrón que consume `useSyncExternalStore`: la vista cambia de identidad solo cuando
 *  cambió algo. */
export function createStore<T>(build: () => T) {
  const listeners = new Set<() => void>();
  let value = build();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get(): T {
      return value;
    },
    notify() {
      value = build();
      for (const listener of [...listeners]) listener();
    },
  };
}
