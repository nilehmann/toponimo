import type { Ref } from "react";

import { type AnyGame, revealedToponym, scoreboard } from "../game/session";
import { ROUNDS } from "../game/toponyms";
import type { PlayerId, Snapshot } from "../game/types";
import { BUTTON_SIGN } from "./ui";

const NOTES: [min: number, note: string][] = [
  [15, "Ruta completa sin un error."],
  [12, "Conoces bien los caminos rurales."],
  [9, "Más acierto que azar."],
  [0, "Los nombres inventados te engañaron seguido."],
];

interface SummaryProps {
  snapshot: Snapshot;
  game: AnyGame;
  me: PlayerId | null;
  /** Solo el host reparte la ruta siguiente. */
  onRestart?: () => void;
  ref?: Ref<HTMLButtonElement>;
}

export function Summary({ snapshot, game, me, onRestart, ref }: SummaryProps) {
  const table = scoreboard(game);
  const mine = table.find((row) => row.id === me);
  const score = mine?.score ?? 0;

  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold text-muted">
        {table.length > 1 ? "El marcador" : "Tu resultado"}
      </h2>
      <p className="my-1 text-6xl leading-none font-extrabold text-sign">
        {score} de {ROUNDS}
      </p>
      <p className="mb-6">{NOTES.find(([min]) => score >= min)?.[1]}</p>

      {table.length > 1 && (
        <ol className="mb-6 border-t border-line">
          {table.map((row, i) => (
            <li
              key={row.id}
              className="flex items-baseline justify-between gap-3 border-b border-line py-2"
            >
              <span className="font-semibold">
                <span className="mr-2 text-muted">{i + 1}.</span>
                {snapshot.players[row.id]?.name ?? row.id}
                {row.id === me && <span className="ml-1.5 text-sm font-normal text-muted">vos</span>}
              </span>
              <span className="shrink-0 font-extrabold text-sign">{row.score}</span>
            </li>
          ))}
        </ol>
      )}

      <ol className="mb-6 border-t border-line">
        {game.rounds.map((round, i) => {
          const toponym = revealedToponym(round);
          if (!toponym) return null;
          const guess = me === null ? undefined : round.guesses[me];
          const correct = guess === toponym.real;
          return (
            <li key={i} className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-line py-2.5">
              <span className="col-start-1 row-start-1 font-extrabold">{toponym.name}</span>
              <span className="col-start-1 row-start-2 text-sm text-muted">
                {toponym.real ? `Existe, en ${toponym.comuna}` : "Inventado"}
              </span>
              <span
                className={`col-start-2 row-span-2 row-start-1 self-center text-sm font-semibold ${correct ? "text-ok" : "text-miss"}`}
              >
                {guess === undefined ? "Sin responder" : correct ? "Acertaste" : "Fallaste"}
              </span>
            </li>
          );
        })}
      </ol>

      {onRestart ? (
        <button ref={ref} type="button" onClick={onRestart} className={`${BUTTON_SIGN} w-full`}>
          Jugar otra ruta
        </button>
      ) : (
        <p className="text-center text-sm text-muted">
          Esperando a que el host reparta otra ruta.
        </p>
      )}
    </section>
  );
}
