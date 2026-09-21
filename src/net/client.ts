import { needsAck } from "./ack";
import type { DeviceId, Guess, PlayerId, RoundIndex, Snapshot } from "../game/types";
import { backoff } from "./retry";
import { type SessionRuntime, type SessionView, createStore } from "./runtime";
import type { HostMessage, Transport } from "./transport";

export interface ClientOptions {
  transport: Transport;
  deviceId: DeviceId;
  name: string;
}

/** La respuesta que el jugador ya tocó y el host todavía no confirmó. */
interface Pending {
  gameNumber: number;
  round: RoundIndex;
  guess: Guess;
}

/** La ronda que contestó ya está cerrada y su elección no figura: el toque llegó tarde. Hay que
 *  decírselo con todas sus letras en vez de dejarla creyendo que se perdió. */
function arrivedLate(pending: Pending, snapshot: Snapshot, me: PlayerId): boolean {
  const game = snapshot.game;
  if (!game || game.number !== pending.gameNumber) return false;
  const round = game.rounds[pending.round];
  if (!round) return false;
  const closed = game.current > pending.round || game.revealed;
  return closed && round.guesses[me] === undefined;
}

/** Manda su respuesta y espera; lo que ve en pantalla es siempre lo último que dijo el host.
 *  No guarda nada de la partida: le basta con la última versión que aplicó, en memoria. */
export function createClient({ transport, deviceId, name }: ClientOptions): SessionRuntime {
  let snapshot: Snapshot | null = null;
  let me: PlayerId | null = null;
  let unreachable = false;
  let pending: Pending | null = null;
  let lateAt: { gameNumber: number; round: RoundIndex } | null = null;
  let cancelHello: (() => void) | null = null;

  const store = createStore<SessionView>(() => {
    const game = snapshot?.game ?? null;
    const onThisRound = (at: { gameNumber: number; round: RoundIndex } | null) =>
      at !== null && game !== null && game.number === at.gameNumber && game.current === at.round;
    return {
      snapshot,
      me,
      acked: {},
      awaited: 0,
      unreachable,
      pending: onThisRound(pending) ? pending!.guess : null,
      late: onThisRound(lateAt),
    };
  });

  function ack(version: number) {
    if (me) transport.send({ t: "ack", playerId: me, version });
  }

  /** Gana la versión más alta: un snapshot rezagado se descarta sin efecto. Uno de la misma
   *  versión no cambia el estado pero sí repinta, que es lo que hace que refrescar sirva aunque
   *  el host no tenga nada nuevo que contar. Devuelve si hay que avisarle a la pantalla. */
  function receive(next: Snapshot, direct: boolean): boolean {
    if (snapshot && next.version < snapshot.version) return false;
    const before = snapshot;
    const fresh = snapshot === null || next.version > snapshot.version;
    if (fresh) snapshot = next;
    // Si ya sabemos quiénes somos, ver la partida avanzar desmiente el aviso: seguir diciendo
    // que no alcanzamos al host mientras la pantalla se mueve sola sería mentir. Sin `me` no,
    // porque ahí lo que falta es justamente que nuestros mensajes lleguen.
    const wasUnreachable = unreachable;
    if (me) unreachable = false;

    const wasPending = pending;
    if (wasPending && me && arrivedLate(wasPending, next, me)) {
      lateAt = { gameNumber: wasPending.gameNumber, round: wasPending.round };
    }
    // Todo lo que muestra —incluida su propia elección— sale del último snapshot.
    pending = null;

    // Por el canal personal solo llega lo que el host está reenviando porque no le acusamos,
    // así que se acusa siempre: si se esperara a que la pantalla cambie, un `ack` perdido no
    // se recuperaría nunca y el host se rendiría dando por atrasado a quien está al día.
    if (direct || (fresh && needsAck(before?.game ?? null, next.game))) ack(next.version);
    return fresh || wasPending !== null || wasUnreachable !== unreachable;
  }

  function onHostMessage(msg: HostMessage, direct: boolean) {
    if (msg.t === "snapshot") {
      if (receive(msg.state, direct)) store.notify();
      return;
    }
    // Cada cliente ignora los `welcome` con otro dispositivo: van por el topic de todos.
    if (msg.deviceId !== deviceId) return;
    cancelHello?.();
    cancelHello = null;
    unreachable = false;
    me = msg.playerId;
    // Acusa siempre, aunque el estado no traiga nada nuevo: es lo que pone al día la cuenta del
    // host después de que alguien vuelve a primer plano.
    ack(msg.state.version);
    receive(msg.state, false);
    store.notify();
  }

  const stopListening = transport.connect({ onClientMessage: () => {}, onHostMessage });

  /** Refrescar es volver a preguntar. Es el único disparador del lado del cliente, y el único
   *  mensaje que se reintenta solo: sin respuesta la persona no sabe ni si está en la sala. */
  function hello() {
    cancelHello?.();
    const msg = { t: "hello", deviceId, name } as const;
    transport.send(msg);
    cancelHello = backoff(
      () => transport.send(msg),
      () => {
        cancelHello = null;
        unreachable = true;
        store.notify();
      },
    );
  }

  function stop() {
    cancelHello?.();
    cancelHello = null;
    stopListening();
  }

  hello();

  return {
    subscribe: store.subscribe,
    getView: store.get,
    answer(guess: Guess) {
      const game = snapshot?.game;
      if (!me || !game || game.revealed || game.finishedAt !== null) return;
      // La UI marca la elección de inmediato; si el `answer` se perdió, el snapshot vuelve sin
      // ella y los botones se deseleccionan solos.
      pending = { gameNumber: game.number, round: game.current, guess };
      lateAt = null;
      transport.send({
        t: "answer",
        playerId: me,
        gameNumber: game.number,
        round: game.current,
        guess,
      });
      store.notify();
    },
    reveal: () => {},
    next: () => {},
    start: () => {},
    refresh: hello,
    leave() {
      if (me) transport.send({ t: "bye", playerId: me });
      stop();
    },
    stop,
  };
}
