import type { Ref } from "react";

import { ROUNDS } from "../game/rounds";
import type { Round } from "../game/types";
import { BUTTON_SIGN } from "./ui";

const NOTES: [min: number, note: string][] = [
  [15, "Ruta completa sin un error."],
  [12, "Conoces bien los caminos rurales."],
  [9, "Más acierto que azar."],
  [0, "Los nombres inventados te engañaron seguido."],
];

interface SummaryProps {
  rounds: Round[];
  guesses: boolean[];
  score: number;
  onRestart: () => void;
  ref?: Ref<HTMLButtonElement>;
}

export function Summary({ rounds, guesses, score, onRestart, ref }: SummaryProps) {
  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold text-muted">Tu resultado</h2>
      <p className="my-1 text-6xl leading-none font-extrabold text-sign">
        {score} de {ROUNDS}
      </p>
      <p className="mb-6">{NOTES.find(([min]) => score >= min)?.[1]}</p>

      <ol className="mb-6 border-t border-line">
        {rounds.map((round, i) => {
          const correct = guesses[i] === round.real;
          return (
            <li key={i} className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-line py-2.5">
              <span className="col-start-1 row-start-1 font-extrabold">{round.name}</span>
              <span className="col-start-1 row-start-2 text-sm text-muted">
                {round.real ? `Existe, en ${round.comuna}` : "Inventado"}
              </span>
              <span
                className={`col-start-2 row-span-2 row-start-1 self-center text-sm font-semibold ${correct ? "text-ok" : "text-miss"}`}
              >
                {correct ? "Acertaste" : "Fallaste"}
              </span>
            </li>
          );
        })}
      </ol>

      <button ref={ref} type="button" onClick={onRestart} className={`${BUTTON_SIGN} w-full`}>
        Jugar otra ruta
      </button>
    </section>
  );
}
