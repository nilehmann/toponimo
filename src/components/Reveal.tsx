import type { Ref } from "react";

import type { Round } from "../game/types";
import { BUTTON_NEUTRAL } from "./ui";

interface RevealProps {
  round: Round;
  correct: boolean;
  last: boolean;
  onNext: () => void;
  ref?: Ref<HTMLButtonElement>;
}

export function Reveal({ round, correct, last, onNext, ref }: RevealProps) {
  const verdict = round.real
    ? correct
      ? "Correcto, existe."
      : "Existe."
    : correct
      ? "Correcto, es inventado."
      : "Es inventado.";

  return (
    <div className="mt-6">
      <p className={`text-xl font-extrabold ${correct ? "text-ok" : "text-miss"}`}>{verdict}</p>
      <p className="mt-1 mb-4">
        {round.real
          ? `Comuna de ${round.comuna}, ${round.region}.`
          : "Este nombre no figura entre las localidades del Censo 2017."}
      </p>
      <button ref={ref} type="button" onClick={onNext} className={`${BUTTON_NEUTRAL} w-full`}>
        {last ? "Ver resultado" : "Siguiente letrero"}
      </button>
    </div>
  );
}
