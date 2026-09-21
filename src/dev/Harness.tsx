import { useMemo, useRef, useState } from "react";

import { Game } from "../Game";
import { createSession } from "../game/session";
import { buildToponyms } from "../game/toponyms";
import type { GameData, Guess } from "../game/types";
import { type Session, useSessionView } from "../hooks/useSession";
import type { ThemePref } from "../hooks/useTheme";
import { createClient } from "../net/client";
import { newCode } from "../net/code";
import { createHost } from "../net/host";
import { type Destination, createLoopback } from "../net/loopback";
import type { SessionRuntime } from "../net/runtime";
import type { ClientMessage, HostMessage } from "../net/transport";

/** Qué se tira a propósito. Es lo que deja ver a mano que los reenvíos y el botón de refrescar
 *  hacen lo que dicen. */
interface Losses {
  broadcasts: boolean;
  answers: boolean;
  hellos: boolean;
}

const LOSSES: [key: keyof Losses, label: string][] = [
  ["broadcasts", "tirar difusiones"],
  ["answers", "tirar respuestas"],
  ["hellos", "tirar hellos"],
];

const NAMES = ["Ana", "Beto", "Caro", "Dani", "Eli", "Fabi", "Gabo"];

type Theme = { pref: ThemePref; cycle: () => void };

interface SeatProps {
  runtime: SessionRuntime;
  isHost: boolean;
  code: string;
  data: GameData;
  theme: Theme;
  title: string;
}

/** Una pantalla entera, con los mismos componentes que usa la aplicación. */
function Seat({ runtime, isHost, code, data, theme, title }: SeatProps) {
  const view = useSessionView(runtime);
  const nada = () => {};
  const session: Session = {
    status: { status: "playing" },
    view,
    code,
    isHost,
    identity: { deviceId: "", name: title, lastRoomCode: code },
    saved: { room: null, solo: null },
    answer: (guess: Guess) => runtime.answer(guess),
    reveal: () => runtime.reveal(),
    next: () => runtime.next(),
    newGame: () => runtime.start(buildToponyms(data)),
    refresh: () => runtime.refresh(),
    controls: {
      playSolo: nada,
      createRoom: nada,
      joinRoom: nada,
      resume: nada,
      forgetSaved: nada,
      goHome: nada,
      dismissError: nada,
    },
  };

  return (
    <div className="min-w-0 rounded-lg border-2 border-line">
      <p className="border-b border-line bg-btn px-3 py-1.5 text-sm font-extrabold">
        {title}
        {isHost && <span className="ml-2 font-normal text-muted">host</span>}
        {view.unreachable && <span className="ml-2 font-normal text-miss">no alcanza al host</span>}
      </p>
      <div className="max-h-[80vh] overflow-y-auto">
        <Game session={session} theme={theme} keyboard={false} />
      </div>
    </div>
  );
}

/** Varios jugadores simulados en una pestaña, para desarrollar sin broker. No persiste nada: los
 *  asientos comparten el `localStorage` del navegador y se pisarían entre ellos. */
export function Harness({ data, theme }: { data: GameData; theme: Theme }) {
  const [losses, setLosses] = useState<Losses>({
    broadcasts: false,
    answers: false,
    hellos: false,
  });
  const [guests, setGuests] = useState(2);

  // El filtro lee la referencia, así que marcar una casilla no rearma el bus ni tira la sala.
  const current = useRef(losses);
  current.current = losses;

  const room = useMemo(() => {
    const drop = (msg: ClientMessage | HostMessage, to: Destination) => {
      const { broadcasts, answers, hellos } = current.current;
      if (broadcasts && to === "all" && msg.t === "snapshot") return true;
      if (answers && msg.t === "answer") return true;
      return hellos && msg.t === "hello";
    };
    const bus = createLoopback({ drop });
    const code = newCode(0);
    const host = createHost({
      state: createSession(code, "banco-host", "Nico", Date.now()),
      transport: bus.host(),
    });
    const seats = new Map<number, SessionRuntime>();
    return {
      code,
      host,
      guest(i: number): SessionRuntime {
        const seat = seats.get(i);
        if (seat) return seat;
        const deviceId = `banco-${i}`;
        const fresh = createClient({ transport: bus.client(deviceId), deviceId, name: NAMES[i] });
        seats.set(i, fresh);
        return fresh;
      },
    };
  }, []);

  return (
    <div className="px-4 py-4">
      <header className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <h1 className="text-lg font-extrabold">Banco de pruebas · sala {room.code}</h1>
        {LOSSES.map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={losses[key]}
              onChange={(event) => setLosses((it) => ({ ...it, [key]: event.target.checked }))}
            />
            {label}
          </label>
        ))}
        <button
          type="button"
          className="cursor-pointer rounded-md border border-line px-2 py-1 text-sm font-semibold"
          onClick={() => setGuests((n) => Math.min(n + 1, NAMES.length))}
        >
          Agregar jugador
        </button>
      </header>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(20rem,1fr))] gap-4">
        <Seat runtime={room.host} isHost code={room.code} data={data} theme={theme} title="Nico" />
        {Array.from({ length: guests }, (_, i) => (
          <Seat
            key={i}
            runtime={room.guest(i)}
            isHost={false}
            code={room.code}
            data={data}
            theme={theme}
            title={NAMES[i]}
          />
        ))}
      </div>
    </div>
  );
}
