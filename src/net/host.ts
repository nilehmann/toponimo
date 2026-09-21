import { type Action, project, reduce } from "../game/session";
import type { Guess, PlayerId, SessionState, Toponym } from "../game/types";
import { needsAck } from "./ack";
import { backoff } from "./retry";
import { type SessionRuntime, type SessionView, createStore } from "./runtime";
import type { ClientMessage, Transport } from "./transport";

export interface HostOptions {
  state: SessionState;
  transport: Transport;
  /** Se llama con cada estado nuevo. Es por dónde sale la única copia autoritativa. */
  onChange?(state: SessionState): void;
  now?(): number;
}

/** La única autoridad: nadie más modifica el estado. Difunde snapshots absolutos, lleva la
 *  cuenta de quién acusó recibo y reenvía a quien no. */
export function createHost({ state, transport, onChange, now = Date.now }: HostOptions): SessionRuntime {
  /** Efímero, solo acá. No se persiste ni se difunde. */
  const acked: Record<PlayerId, number> = {};
  const retries = new Map<PlayerId, { version: number; cancel: () => void }>();
  let awaited = 0;

  const store = createStore<SessionView>(() => ({
    snapshot: project(state),
    me: state.hostId,
    acked: { ...acked },
    awaited,
    unreachable: false,
    pending: null,
    late: false,
  }));

  function cancelRetries() {
    for (const { cancel } of retries.values()) cancel();
    retries.clear();
  }

  /** Reenvía por el topic personal para no repetirle el mensaje a toda la sala. Manda el estado
   *  del momento y no el de la versión que se perdió: el snapshot es absoluto, así que el más
   *  nuevo sirve igual o mejor. */
  function armRetries(version: number) {
    cancelRetries();
    for (const id of state.participants) {
      if (id === state.hostId || (acked[id] ?? 0) >= version) continue;
      const cancel = backoff(
        () => transport.sendTo(id, { t: "snapshot", state: project(state) }),
        () => {
          // Se rinde y queda mostrado como atrasado; de acá en adelante recuperarse es cosa
          // del `hello` que manda el cliente al volver a primer plano.
          retries.delete(id);
          store.notify();
        },
      );
      retries.set(id, { version, cancel });
    }
  }

  function apply(action: Action): boolean {
    const next = reduce(state, action);
    if (next === state) return false;
    const before = state.game;
    state = next;
    onChange?.(state);
    transport.broadcast({ t: "snapshot", state: project(state) });
    if (needsAck(before, state.game)) {
      awaited = state.version;
      armRetries(state.version);
    }
    store.notify();
    return true;
  }

  function onClientMessage(msg: ClientMessage) {
    switch (msg.t) {
      case "hello": {
        apply({ type: "join", deviceId: msg.deviceId, name: msg.name });
        const playerId = state.devices[msg.deviceId];
        if (!playerId) return;
        // Siempre la misma respuesta, sin que el cliente tenga que decir en qué versión viene.
        transport.broadcast({
          t: "welcome",
          deviceId: msg.deviceId,
          playerId,
          state: project(state),
        });
        return;
      }
      case "answer":
        apply({
          type: "answer",
          playerId: msg.playerId,
          gameNumber: msg.gameNumber,
          round: msg.round,
          guess: msg.guess,
        });
        return;
      case "ack": {
        if ((acked[msg.playerId] ?? 0) >= msg.version) return;
        acked[msg.playerId] = msg.version;
        const pending = retries.get(msg.playerId);
        if (pending && msg.version >= pending.version) {
          pending.cancel();
          retries.delete(msg.playerId);
        }
        store.notify();
        return;
      }
      case "bye":
        apply({ type: "bye", playerId: msg.playerId });
        return;
    }
  }

  const stopListening = transport.connect({ onClientMessage, onHostMessage: () => {} });

  function stop() {
    cancelRetries();
    stopListening();
  }

  return {
    subscribe: store.subscribe,
    getView: store.get,
    answer(guess: Guess) {
      const game = state.game;
      if (!game) return;
      apply({
        type: "answer",
        playerId: state.hostId,
        gameNumber: game.number,
        round: game.current,
        guess,
      });
    },
    reveal: () => void apply({ type: "reveal" }),
    next: () => void apply({ type: "next", at: now() }),
    start: (toponyms: Toponym[]) => void apply({ type: "start", toponyms }),
    /** El host ya tiene la verdad: refrescar es repetirla, por si alguien quedó atrasado. La
     *  cuenta de acuses es efímera, así que después de reabrir la aplicación no sabe quién
     *  sigue ahí; volver a pedirlos es lo que evita que la lista diga que están todos al día
     *  cuando en realidad no acusó nadie. */
    refresh() {
      transport.broadcast({ t: "snapshot", state: project(state) });
      if (!state.game) return;
      awaited = state.version;
      armRetries(state.version);
      store.notify();
    },
    leave: stop,
    stop,
  };
}
