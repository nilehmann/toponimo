import { useEffect, useReducer, useRef } from "react";

import { Choices } from "./components/Choices";
import { Reveal } from "./components/Reveal";
import { Sign } from "./components/Sign";
import { Summary } from "./components/Summary";
import { ThemeToggle } from "./components/ThemeToggle";
import { Ticks } from "./components/Ticks";
import { ROUNDS, buildRounds } from "./game/rounds";
import type { GameData, Round } from "./game/types";
import type { ThemePref } from "./hooks/useTheme";

interface State {
  rounds: Round[];
  /** Ronda en pantalla. Ya respondida si `guesses` tiene una entrada para ella. */
  current: number;
  guesses: boolean[];
  done: boolean;
}

type Action = { type: "answer"; guess: boolean } | { type: "next" } | { type: "restart"; rounds: Round[] };

function init(rounds: Round[]): State {
  return { rounds, current: 0, guesses: [], done: false };
}

function reducer(state: State, action: Action): State {
  const answered = state.guesses.length > state.current;
  switch (action.type) {
    case "answer":
      if (answered) return state;
      return { ...state, guesses: [...state.guesses, action.guess] };
    case "next":
      if (!answered) return state;
      return state.current + 1 < ROUNDS
        ? { ...state, current: state.current + 1 }
        : { ...state, done: true };
    case "restart":
      return init(action.rounds);
  }
}

interface GameProps {
  data: GameData;
  theme: { pref: ThemePref; cycle: () => void };
}

export function Game({ data, theme }: GameProps) {
  const [state, dispatch] = useReducer(reducer, data, (d: GameData) => init(buildRounds(d)));
  const { rounds, current, guesses, done } = state;

  const answered = guesses.length > current;
  const round = rounds[current];
  const score = guesses.reduce((n, guess, i) => n + (guess === rounds[i].real ? 1 : 0), 0);

  const nextRef = useRef<HTMLButtonElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (answered && !done) nextRef.current?.focus({ preventScroll: true });
  }, [answered, done, current]);

  useEffect(() => {
    if (done) againRef.current?.focus({ preventScroll: true });
  }, [done]);

  useEffect(() => {
    if (done || answered) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "e") dispatch({ type: "answer", guess: true });
      else if (key === "i") dispatch({ type: "answer", guess: false });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [answered, done]);

  return (
    <main className="mx-auto max-w-xl px-5 pt-5 pb-10">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-extrabold tracking-tight">Topónimo</h1>
        <div className="flex items-baseline gap-3">
          {!done && (
            <p className="text-right text-sm text-muted">
              <span className="block">
                Ronda {current + 1} de {ROUNDS}
              </span>
              <span className="block font-semibold text-ink">
                {score} {score === 1 ? "acierto" : "aciertos"}
              </span>
            </p>
          )}
          <ThemeToggle pref={theme.pref} onCycle={theme.cycle} />
        </div>
      </header>

      {done ? (
        <Summary
          ref={againRef}
          rounds={rounds}
          guesses={guesses}
          score={score}
          onRestart={() => dispatch({ type: "restart", rounds: buildRounds(data) })}
        />
      ) : (
        <section aria-live="polite">
          <p className="mt-1.5 mb-4 max-w-lg text-muted">
            Cada letrero indica una localidad rural de Chile, o un nombre inventado para confundirte.
          </p>

          <Ticks rounds={rounds} guesses={guesses} current={current} />
          <Sign name={round.name} revealed={answered} real={round.real} comuna={round.comuna} />

          {answered ? (
            <Reveal
              ref={nextRef}
              round={round}
              correct={guesses[current] === round.real}
              last={current + 1 === ROUNDS}
              onNext={() => dispatch({ type: "next" })}
            />
          ) : (
            <Choices onAnswer={(guess) => dispatch({ type: "answer", guess })} />
          )}
        </section>
      )}

      <footer className="mt-10 border-t border-line pt-3 text-xs text-muted">
        Localidades, aldeas y pueblos reales tomados de la cartografía del Censo 2017 (INE). Los nombres
        inventados se generaron a partir de esos mismos nombres y se verificó que no aparezcan en ese
        registro.
      </footer>
    </main>
  );
}
