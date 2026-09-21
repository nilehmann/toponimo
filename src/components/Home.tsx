import { type FormEvent, useState } from "react";

import { phase } from "../game/session";
import type { Identity, RoomCode, SessionState } from "../game/types";
import { CODE_LENGTH, isValidCode, normalizeCode } from "../net/code";
import type { SessionControls } from "../hooks/useSession";
import { SLOTS, type Saved, type Slot } from "../storage/session";
import { BUTTON_GHOST, BUTTON_NEUTRAL, BUTTON_SIGN, BUTTON_WARN, INPUT } from "./ui";

interface HomeProps {
  identity: Identity;
  saved: Saved;
  /** El código que venía en el link o en el QR. */
  invited: RoomCode | null;
  controls: SessionControls;
}

const NAME_LIMIT = 16;

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength: number;
  mono?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label className="block text-left">
      <span className="text-sm font-semibold text-muted">{props.label}</span>
      <input
        className={`${INPUT} mt-1 ${props.mono ? "font-mono tracking-[0.2em] uppercase" : ""}`}
        value={props.value}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        autoFocus={props.autoFocus}
        autoComplete="off"
        onChange={(event) => props.onChange(event.target.value)}
      />
    </label>
  );
}

/** Qué dice el botón de retomar. Lo guardado por el host es la única copia autoritativa que
 *  existe de esa sala, así que conviene que se note qué se está por retomar. */
function savedLabel(slot: Slot, state: SessionState): string {
  const game = state.game;
  const what = slot === "room" ? `la sala ${state.code}` : "tu partida";
  if (game === null) return `Retomar ${what}`;
  if (phase(game) === "summary") return `Volver al resumen de ${what}`;
  return `Retomar ${what} en la ronda ${game.current + 1}`;
}

export function Home({ identity, saved, invited, controls }: HomeProps) {
  const [mode, setMode] = useState<"menu" | "create" | "join">(invited ? "join" : "menu");
  const [name, setName] = useState(identity.name);
  const [code, setCode] = useState(invited ?? identity.lastRoomCode ?? "");

  /** Quien cerró la app siendo jugador vuelve con un toque: su DeviceId y su nombre siguen
   *  guardados, y el host lo reconoce por el `hello`. La sala que hosteaba uno mismo no entra
   *  acá: esa se retoma con su propio estado, que es la única copia autoritativa. */
  const back =
    identity.lastRoomCode &&
    identity.name &&
    identity.lastRoomCode !== saved.room?.code &&
    isValidCode(identity.lastRoomCode)
      ? identity.lastRoomCode
      : null;

  const trimmed = name.trim();
  const clean = normalizeCode(code);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed) return;
    if (mode === "create") controls.createRoom(trimmed);
    else if (isValidCode(clean)) controls.joinRoom(clean, trimmed);
  };

  if (mode === "menu") {
    return (
      <>
        <p className="max-w-sm text-muted">
          Quince letreros por partida, mitad reales y mitad chamullo. Sola, o con quien tengas al
          lado.
        </p>
        <div className="mt-2 flex w-full max-w-xs flex-col gap-3">
          {SLOTS.map((slot) => {
            const state = saved[slot];
            if (!state) return null;
            return (
              <div key={slot} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => controls.resume(slot)}
                  className={BUTTON_NEUTRAL}
                >
                  {savedLabel(slot, state)}
                </button>
                <button
                  type="button"
                  onClick={() => controls.forgetSaved(slot)}
                  className={BUTTON_GHOST}
                >
                  {slot === "room" ? "Olvidar la sala" : "Olvidar la partida"}
                </button>
              </div>
            );
          })}
          {back && (
            <button
              type="button"
              onClick={() => controls.joinRoom(back, identity.name)}
              className={BUTTON_NEUTRAL}
            >
              Volver a la sala {back}
            </button>
          )}
          <button type="button" onClick={controls.playSolo} className={BUTTON_SIGN}>
            Jugar solo
          </button>
          <button type="button" onClick={() => setMode("create")} className={BUTTON_WARN}>
            Crear sala
          </button>
          <button type="button" onClick={() => setMode("join")} className={BUTTON_NEUTRAL}>
            Entrar con código
          </button>
        </div>
      </>
    );
  }

  // Entrar necesita un código que nombre una sala; crear, solo un nombre.
  const blocked = !trimmed || (mode === "join" && !isValidCode(clean));
  return (
    <form onSubmit={submit} className="flex w-full max-w-xs flex-col gap-4">
      <h2 className="text-xl font-extrabold">
        {mode === "create" ? "Crear una sala" : "Entrar a una sala"}
      </h2>
      {mode === "join" && (
        <Field
          label="Código de la sala"
          value={code}
          onChange={setCode}
          placeholder="7 caracteres"
          maxLength={CODE_LENGTH + 4}
          mono
          autoFocus={!invited}
        />
      )}
      <Field
        label="Tu nombre"
        value={name}
        onChange={setName}
        placeholder="Como te dicen"
        maxLength={NAME_LIMIT}
        autoFocus={mode === "create" || invited !== null}
      />
      <button
        type="submit"
        disabled={blocked}
        className={`${BUTTON_SIGN} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {mode === "create" ? "Crear la sala" : "Entrar"}
      </button>
      <button type="button" onClick={() => setMode("menu")} className={BUTTON_GHOST}>
        Volver
      </button>
    </form>
  );
}
