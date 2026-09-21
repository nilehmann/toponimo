import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

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
import { type HostRecord, clearHostSession, loadHostSession, saveHostSession } from "../storage/session";

export type SessionStatus =
  | { status: "home" }
  | { status: "opening"; message: string }
  | { status: "failed"; message: string }
  | { status: "playing" };

export interface SessionControls {
  playSolo(): void;
  createRoom(name: string): void;
  joinRoom(code: RoomCode, name: string): void;
  /** Reabrir la sala guardada. La del host es la única copia autoritativa que hay. */
  resume(): void;
  forgetSaved(): void;
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
  /** La sala que quedó guardada, para ofrecer retomarla desde el inicio. */
  saved: HostRecord | null;
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
  const [saved, setSaved] = useState<HostRecord | null>(loadHostSession);
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

    /** El host de una sala guarda; el jugador no guarda nada de la partida. */
    const hostOn = (state: SessionState, transport: Transport, shared: boolean): SessionRuntime => {
      saveHostSession({ shared, state });
      setSaved({ shared, state });
      return createHost({
        state,
        transport,
        onChange: (next) => {
          const record = { shared, state: next };
          saveHostSession(record);
          setSaved(record);
        },
      });
    };

    return {
      playSolo() {
        const token = begin("Sorteando letreros…");
        // Una sala de un jugador que es su propio host y no se conecta a ninguna parte.
        const state = createSession(
          newCode(0),
          identity.deviceId,
          identity.name || "Vos",
          Date.now(),
        );
        const runtime = hostOn(state, createNullTransport(), false);
        runtime.start(buildToponyms(data));
        if (!current(token)) return runtime.stop();
        setLive({ runtime, role: "host", code: null });
        setStatus({ status: "playing" });
      },

      createRoom(name: string) {
        const token = begin("Buscando un broker…");
        setIdentity(rememberName(identity, name));
        void createRoom(identity.deviceId)
          .then(({ code, transport }) => {
            const state = createSession(code, identity.deviceId, name, Date.now());
            const runtime = hostOn(state, transport, true);
            if (!current(token)) return runtime.stop();
            setIdentity(rememberRoom(rememberName(identity, name), code));
            setLive({ runtime, role: "host", code });
            setStatus({ status: "playing" });
          })
          .catch((error: unknown) => {
            if (current(token)) setStatus({ status: "failed", message: message(error) });
          });
      },

      joinRoom(code: RoomCode, name: string) {
        const token = begin("Entrando a la sala…");
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

      resume() {
        const record = loadHostSession();
        if (!record) return;
        const token = begin(record.shared ? "Reabriendo la sala…" : "Retomando la partida…");
        const transport = record.shared
          ? openRoom(record.state.code, "host", identity.deviceId)
          : Promise.resolve<Transport>(createNullTransport());
        void transport
          .then((it) => {
            const runtime = hostOn(record.state, it, record.shared);
            if (!current(token)) return runtime.stop();
            setLive({ runtime, role: "host", code: record.shared ? record.state.code : null });
            setStatus({ status: "playing" });
            // Difundir al reabrir es lo que pone al día a quienes quedaron esperando.
            runtime.refresh();
          })
          .catch((error: unknown) => {
            if (current(token)) setStatus({ status: "failed", message: message(error) });
          });
      },

      forgetSaved() {
        clearHostSession();
        setSaved(null);
      },

      goHome() {
        attempt.current += 1;
        // El jugador avisa que se va; el host nunca se saca a sí mismo de su propia sala.
        liveRef.current?.runtime.leave();
        setLive(null);
        setStatus({ status: "home" });
        setSaved(loadHostSession());
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
