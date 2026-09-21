import { type AnyGame, revealedRounds, revealedToponym } from "../game/session";
import { ROUNDS } from "../game/toponyms";
import type { PlayerId } from "../game/types";

/** Una ronda revelada sin respuesta propia no es un fallo: es una que no te tocó. */
function color(game: AnyGame, me: PlayerId | null, i: number): string {
  if (i >= revealedRounds(game)) return i === game.current ? "bg-ink" : "bg-line";
  const toponym = revealedToponym(game.rounds[i]);
  const guess = me === null ? undefined : game.rounds[i].guesses[me];
  if (!toponym || guess === undefined) return "bg-post";
  return guess === toponym.real ? "bg-ok" : "bg-warn";
}

export function Ticks({ game, me }: { game: AnyGame; me: PlayerId | null }) {
  return (
    <ol aria-label="Progreso" className="mb-7 grid grid-cols-15 gap-1">
      {Array.from({ length: ROUNDS }, (_, i) => (
        <li
          key={i}
          aria-label={`Ronda ${i + 1}`}
          className={`h-1.5 rounded-full ${color(game, me, i)}`}
        />
      ))}
    </ol>
  );
}
