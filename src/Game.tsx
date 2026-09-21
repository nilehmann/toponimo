import { useEffect, useRef } from "react";

import { Choices } from "./components/Choices";
import { Connection } from "./components/Connection";
import { Lobby } from "./components/Lobby";
import { Players } from "./components/Players";
import { Reveal } from "./components/Reveal";
import { Sign } from "./components/Sign";
import { Summary } from "./components/Summary";
import { ThemeToggle } from "./components/ThemeToggle";
import { Ticks } from "./components/Ticks";
import { BUTTON_GHOST } from "./components/ui";
import { type AnyGame, answered, guessOf, phase, revealedToponym, score } from "./game/session";
import { ROUNDS } from "./game/toponyms";
import type { PlayerId, Snapshot } from "./game/types";
import type { Session } from "./hooks/useSession";
import type { SessionView } from "./net/runtime";
import type { ThemePref } from "./hooks/useTheme";

/** Quiénes no acusaron el último cambio que había que acusar. El host cuenta siempre al día:
 *  es de donde sale la verdad. Un ack prueba que llegó, no que siga ahí, así que esto es
 *  información y no un permiso: los botones de revelar y avanzar nunca se bloquean. */
function behind(snapshot: Snapshot, game: AnyGame, view: SessionView): Set<PlayerId> {
  if (view.awaited === 0) return new Set();
  return new Set(
    game.participants.filter(
      (id) => id !== snapshot.hostId && (view.acked[id] ?? 0) < view.awaited,
    ),
  );
}

function missing(game: AnyGame): string | null {
  if (game.participants.length < 2) return null;
  const done = answered(game);
  const left = game.participants.filter((id) => !done.has(id)).length;
  if (left === 0) return "Respondieron todos.";
  return left === 1 ? "Falta uno por responder." : `Faltan ${left} por responder.`;
}

interface GameProps {
  session: Session;
  theme: { pref: ThemePref; cycle: () => void };
  /** El banco de loopback monta varias pantallas a la vez y ahí el atajo sobra. */
  keyboard?: boolean;
}

export function Game({ session, theme, keyboard = true }: GameProps) {
  const { view, isHost, code } = session;
  const { snapshot, me } = view;
  const game = snapshot?.game ?? null;
  const where = phase(game);

  const nextRef = useRef<HTMLButtonElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (where === "revealed" && isHost) nextRef.current?.focus({ preventScroll: true });
  }, [where, isHost, game?.current]);

  useEffect(() => {
    if (where === "summary" && isHost) againRef.current?.focus({ preventScroll: true });
  }, [where, isHost]);

  const answering = where === "answering" && keyboard;
  useEffect(() => {
    if (!answering) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement) return;
      const key = event.key.toLowerCase();
      if (key === "e") session.answer(true);
      else if (key === "i") session.answer(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [answering, session]);

  if (!snapshot) {
    return (
      <Shell theme={theme} onLeave={session.controls.goHome}>
        <p className="mt-6 text-muted">Preguntándole al host quién eres…</p>
        <Connection unreachable={view.unreachable} late={false} onRefresh={session.refresh} />
      </Shell>
    );
  }

  const mine = game ? (me === null ? undefined : guessOf(game, me)) : undefined;
  const selected = view.pending ?? mine ?? null;
  const round = game?.rounds[game.current];
  const toponym = round ? revealedToponym(round) : null;
  const alone = (game?.participants.length ?? 1) < 2;
  const late = game && isHost ? behind(snapshot, game, view) : undefined;
  const upToDate =
    game && late ? `${game.participants.length - late.size} de ${game.participants.length} al día` : undefined;

  return (
    <Shell
      theme={theme}
      onLeave={session.controls.goHome}
      progress={
        game && where !== "summary" ? (
          <p className="text-right text-sm text-muted">
            <span className="block">
              Ronda {game.current + 1} de {ROUNDS}
            </span>
            <span className="block font-semibold text-ink">
              {me === null ? "" : `${score(game, me)} ${score(game, me) === 1 ? "acierto" : "aciertos"}`}
            </span>
          </p>
        ) : null
      }
    >
      {where === "lobby" || !game ? (
        <Lobby
          snapshot={snapshot}
          me={me}
          code={code}
          onStart={isHost ? session.newGame : undefined}
        />
      ) : where === "summary" ? (
        <Summary
          ref={againRef}
          snapshot={snapshot}
          game={game}
          me={me}
          onRestart={isHost ? session.newGame : undefined}
        />
      ) : (
        <section aria-live="polite">
          <p className="mt-1.5 mb-4 max-w-lg text-muted">
            Cada letrero indica una localidad rural de Chile, o un nombre inventado para
            confundirte.
          </p>

          <Ticks game={game} me={me} />
          <Sign
            name={round!.toponym.name}
            revealed={toponym !== null}
            real={toponym?.real ?? false}
            comuna={toponym?.real ? toponym.comuna : undefined}
          />

          {toponym ? (
            <Reveal
              ref={nextRef}
              toponym={toponym}
              guess={mine}
              last={game.current + 1 === ROUNDS}
              onNext={isHost ? session.next : undefined}
              upToDate={alone ? undefined : upToDate}
            />
          ) : (
            <Choices onAnswer={session.answer} selected={selected} waiting={missing(game)} />
          )}

          {!alone && (isHost || toponym !== null) && (
            <>
              <h2 className="mt-8 text-base font-semibold text-muted">
                {toponym ? "Quién cayó" : (missing(game) ?? "La sala")}
              </h2>
              <Players snapshot={snapshot} game={game} me={me} behind={late} />
              {isHost && !toponym && (
                <button
                  type="button"
                  onClick={session.reveal}
                  className="mt-4 min-h-13 w-full cursor-pointer rounded-lg border-2 border-ink bg-btn px-4 py-4 text-lg font-extrabold text-ink hover:bg-btn-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warn"
                >
                  Revelar el letrero
                </button>
              )}
            </>
          )}
        </section>
      )}

      {!isHost && (
        <Connection unreachable={view.unreachable} late={view.late} onRefresh={session.refresh} />
      )}
    </Shell>
  );
}

interface ShellProps {
  children: React.ReactNode;
  theme: { pref: ThemePref; cycle: () => void };
  onLeave: () => void;
  progress?: React.ReactNode;
}

function Shell({ children, theme, onLeave, progress }: ShellProps) {
  return (
    <main className="mx-auto max-w-xl px-5 pt-5 pb-10">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-extrabold tracking-tight">
          <button type="button" onClick={onLeave} className="cursor-pointer">
            Topónimo
          </button>
        </h1>
        <div className="flex items-baseline gap-3">
          {progress}
          <ThemeToggle pref={theme.pref} onCycle={theme.cycle} />
        </div>
      </header>

      {children}

      <footer className="mt-10 border-t border-line pt-3 text-xs text-muted">
        <button type="button" onClick={onLeave} className={`${BUTTON_GHOST} mb-3`}>
          Salir
        </button>
        <p>
          Localidades, aldeas y pueblos reales tomados de la cartografía del Censo 2017 (INE). Los
          nombres inventados se generaron a partir de esos mismos nombres y se verificó que no
          aparezcan en ese registro.
        </p>
      </footer>
    </main>
  );
}
