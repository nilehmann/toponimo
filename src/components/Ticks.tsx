import type { Guess, Toponym } from "../game/types";

interface TicksProps {
  toponyms: Toponym[];
  guesses: (Guess | undefined)[];
  current: number;
}

export function Ticks({ toponyms, guesses, current }: TicksProps) {
  return (
    <ol aria-label="Progreso" className="mb-7 grid grid-cols-15 gap-1">
      {toponyms.map((toponym, i) => {
        const guess = guesses[i];
        const color =
          guess === undefined
            ? i === current
              ? "bg-ink"
              : "bg-line"
            : guess === toponym.real
              ? "bg-ok"
              : "bg-warn";
        return <li key={i} aria-label={`Ronda ${i + 1}`} className={`h-1.5 rounded-full ${color}`} />;
      })}
    </ol>
  );
}
