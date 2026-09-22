import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { COPY } from "../copy";
import { createSession } from "../game/session";
import { buildToponyms } from "../game/toponyms";
import type { GameData, Guess, Identity, RoomCode, SessionState } from "../game/types";
import { createClient } from "../net/client";
import { newCode } from "../net/code";
import { createHost } from "../net/host";
import { createNullTransport } from "../net/null";
import { createRoom, openRoom } from "../net/open";
import { EMPTY_VIEW, type SessionRuntime, type SessionView } from "../net/runtime";
import type { Transport } from "../net/transport";
import { loadIdentity, rememberName, rememberRoom } from "../storage/identity";
import {
  type Saved,
  type Slot,
  clearHostSession,
  loadHostSession,
  loadSaved,
  saveHostSession,
} from "../storage/session";

export type SessionStatus =
  | { status: "home" }
  | { status: "opening"; message: string }
  | { status: "failed"; message: string }
  | { status: "playing" };

export interface SessionControls {
  playSolo(): void;
  createRoom(name: string): void;
  joinRoom(code: RoomCode, name: string): void;
  /** Reabrir lo guardado. Del lado del host es la única copia autoritativa que hay. */
  resume(slot: Slot): void;
  forgetSaved(slot: Slot): void;
  goHome(): void;
  dismissError(): void;
}

export interface Session {
  status: SessionStatus;
  view: SessionView;
  /** null jugando solo: existe igual, pero no hay a quién invitárselo. */
  code: RoomCode | null;
  isHost: boolean;
  identity: Identity;
  /** Lo que quedó guardado, para ofrecerlo desde el inicio. */
  saved: Saved;
  answer(guess: Guess): void;
  reveal(): void;
  next(): void;
  newGame(): void;
  refresh(): void;
  controls: SessionControls;
}

/** El enganche del runtime a React. Separado para que el banco de loopback arme sus asientos
 *  con los mismos componentes que la aplicación. */
export function useSessionView(runtime: SessionRuntime | null): SessionView {
  const subscribe = useCallback(
    (onChange: () => void) => runtime?.subscribe(onChange) ?? (() => {}),
    [runtime],
  );
  const getView = useCallback(() => runtime?.getView() ?? EMPTY_VIEW, [runtime]);
  return useSyncExternalStore(subscribe, getView, getView);
}

type Role = "host" | "guest";

interface Live {
  runtime: SessionRuntime;
  role: Role;
  /** null cuando no hay a quién invitar. */
  code: RoomCode | null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Une reducer, transporte y persistencia. Es lo único que sabe qué transporte le toca a cada
 *  modo; de ahí para arriba las pantallas solo miran el estado. */
export function useSession(data: GameData): Session {
  const [identity, setIdentity] = useState<Identity>(loadIdentity);
  const [saved, setSaved] = useState<Saved>(loadSaved);
  const [status, setStatus] = useState<SessionStatus>({ status: "home" });
  const [live, setLive] = useState<Live | null>(null);

  // El pedido en curso: si alguien vuelve al inicio mientras se abre una sala, lo que llegue
  // después se descarta en vez de pisar la pantalla.
  const attempt = useRef(0);
  const liveRef = useRef<Live | null>(null);

  // Solo el runtime vivo se apaga, y recién cuando lo reemplaza otro o se desmonta todo.
  useEffect(() => {
    liveRef.current = live;
    return () => live?.runtime.stop();
  }, [live]);

  const view = useSessionView(live?.runtime ?? null);

  /** El teléfono guardado en el bolsillo es el caso real, y el único disparador del cliente. */
  useEffect(() => {
    if (!live || live.role !== "guest") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") live.runtime.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [live]);

  const controls = useMemo<SessionControls>(() => {
    const begin = (what: string) => {
      attempt.current += 1;
      setStatus({ status: "opening", message: what });
      return attempt.current;
    };
    const current = (token: number) => token === attempt.current;

    /** El host guarda en su cajón; el jugador no guarda nada de la partida. Todavía no escribe
     *  nada: si el pedido ya quedó viejo, este runtime se descarta sin haber pisado nada. */
    const hostOn = (state: SessionState, transport: Transport, slot: Slot): SessionRuntime =>
      createHost({
        state,
        transport,
        onChange: (next) => {
          saveHostSession(slot, next);
          setSaved((it) => ({ ...it, [slot]: next }));
        },
      });

    const keep = (slot: Slot, state: SessionState) => {
      saveHostSession(slot, state);
      setSaved((it) => ({ ...it, [slot]: state }));
    };

    return {
      playSolo() {
        const token = begin(COPY.opening.solo);
        // Una sala de un jugador que es su propio host y no se conecta a ninguna parte.
        const state = createSession(
          newCode(0),
          identity.deviceId,
          identity.name || COPY.home.soloName,
          Date.now(),
        );
        const runtime = hostOn(state, createNullTransport(), "solo");
        if (!current(token)) return runtime.stop();
        runtime.start(buildToponyms(data));
        setLive({ runtime, role: "host", code: null });
        setStatus({ status: "playing" });
      },

      createRoom(name: string) {
        const token = begin(COPY.opening.create);
        setIdentity(rememberName(identity, name));
        void createRoom(identity.deviceId)
          .then(({ code, transport }) => {
            const state = createSession(code, identity.deviceId, name, Date.now());
            const runtime = hostOn(state, transport, "room");
            if (!current(token)) return runtime.stop();
            keep("room", state);
            setIdentity(rememberRoom(rememberName(identity, name), code));
            setLive({ runtime, role: "host", code });
            setStatus({ status: "playing" });
          })
          .catch((error: unknown) => {
            if (current(token)) setStatus({ status: "failed", message: message(error) });
          });
      },

      joinRoom(code: RoomCode, name: string) {
        const token = begin(COPY.opening.join);
        setIdentity(rememberName(identity, name));
        void openRoom(code, "client", identity.deviceId)
          .then((transport) => {
            const runtime = createClient({ transport, deviceId: identity.deviceId, name });
            if (!current(token)) return runtime.stop();
            setIdentity(rememberRoom(rememberName(identity, name), code));
            setLive({ runtime, role: "guest", code });
            setStatus({ status: "playing" });
          })
          .catch((error: unknown) => {
            if (current(token)) setStatus({ status: "failed", message: message(error) });
          });
      },

      resume(slot: Slot) {
        const state = loadHostSession(slot);
        if (!state) return;
        const shared = slot === "room";
        const token = begin(shared ? COPY.opening.reopenRoom : COPY.opening.resumeSolo);
        const transport = shared
          ? openRoom(state.code, "host", identity.deviceId)
          : Promise.resolve<Transport>(createNullTransport());
        void transport
          .then((it) => {
            const runtime = hostOn(state, it, slot);
            if (!current(token)) return runtime.stop();
            setLive({ runtime, role: "host", code: shared ? state.code : null });
            setStatus({ status: "playing" });
            // Difundir al reabrir es lo que pone al día a quienes quedaron esperando.
            runtime.refresh();
          })
          .catch((error: unknown) => {
            if (current(token)) setStatus({ status: "failed", message: message(error) });
          });
      },

      forgetSaved(slot: Slot) {
        const state = loadHostSession(slot);
        clearHostSession(slot);
        setSaved((it) => ({ ...it, [slot]: null }));
        // Olvidar la sala que uno mismo hosteaba también borra el atajo para volver a ella:
        // si no, el inicio ofrecería entrar como jugador a una sala que ya no tiene host.
        if (state && identity.lastRoomCode === state.code) {
          setIdentity(rememberRoom(identity, null));
        }
      },

      goHome() {
        attempt.current += 1;
        // El jugador avisa que se va; el host nunca se saca a sí mismo de su propia sala.
        liveRef.current?.runtime.leave();
        // Salir a mano es terminar con esa sala: cerrar la app no, y por eso ahí sí se ofrece
        // volver. El host no la olvida, que su estado es la única copia autoritativa.
        if (liveRef.current?.role === "guest") setIdentity(rememberRoom(identity, null));
        setLive(null);
        setStatus({ status: "home" });
        setSaved(loadSaved());
      },

      dismissError() {
        attempt.current += 1;
        setStatus({ status: "home" });
      },
    };
  }, [data, identity]);

  const runtime = live?.runtime;
  return {
    status,
    view,
    code: live?.code ?? null,
    isHost: live?.role === "host",
    identity,
    saved,
    answer: useCallback((guess: Guess) => runtime?.answer(guess), [runtime]),
    reveal: useCallback(() => runtime?.reveal(), [runtime]),
    next: useCallback(() => runtime?.next(), [runtime]),
    newGame: useCallback(() => runtime?.start(buildToponyms(data)), [runtime, data]),
    refresh: useCallback(() => runtime?.refresh(), [runtime]),
    controls,
  };
}
