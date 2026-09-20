import type { Round } from "../game/types";

interface TicksProps {
  rounds: Round[];
  guesses: boolean[];
  current: number;
}

export function Ticks({ rounds, guesses, current }: TicksProps) {
  return (
    <ol aria-label="Progreso" className="mb-7 grid grid-cols-15 gap-1">
      {rounds.map((round, i) => {
        const guess: boolean | undefined = guesses[i];
        const color =
          guess === undefined
            ? i === current
              ? "bg-ink"
              : "bg-line"
            : guess === round.real
              ? "bg-ok"
              : "bg-warn";
        return <li key={i} aria-label={`Ronda ${i + 1}`} className={`h-1.5 rounded-full ${color}`} />;
      })}
    </ol>
  );
}
