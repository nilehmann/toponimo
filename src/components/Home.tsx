import { type FormEvent, useState } from "react";

import { phase } from "../game/session";
import type { Identity, RoomCode } from "../game/types";
import { CODE_LENGTH, isValidCode, normalizeCode } from "../net/code";
import type { SessionControls } from "../hooks/useSession";
import type { HostRecord } from "../storage/session";
import { BUTTON_GHOST, BUTTON_NEUTRAL, BUTTON_SIGN, BUTTON_WARN, INPUT } from "./ui";

interface HomeProps {
  identity: Identity;
  saved: HostRecord | null;
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

/** Qué dice el botón de retomar. Una sala guardada es la única copia autoritativa que existe. */
function savedLabel(saved: HostRecord): string {
  const where = phase(saved.state.game);
  const what = saved.shared ? `la sala ${saved.state.code}` : "tu partida";
  if (where === "lobby") return `Retomar ${what}`;
  if (where === "summary") return `Volver al resumen de ${what}`;
  return `Retomar ${what} en la ronda ${saved.state.game!.current + 1}`;
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
    identity.lastRoomCode !== saved?.state.code &&
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
          {saved && (
            <div className="flex flex-col gap-1">
              <button type="button" onClick={controls.resume} className={BUTTON_NEUTRAL}>
                {savedLabel(saved)}
              </button>
              <button type="button" onClick={controls.forgetSaved} className={BUTTON_GHOST}>
                Olvidarla
              </button>
            </div>
          )}
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
