import type { Ref } from "react";

import type { Toponym } from "../game/types";
import { BUTTON_NEUTRAL } from "./ui";

interface RevealProps {
  toponym: Toponym;
  correct: boolean;
  last: boolean;
  onNext: () => void;
  ref?: Ref<HTMLButtonElement>;
}

export function Reveal({ toponym, correct, last, onNext, ref }: RevealProps) {
  const verdict = toponym.real
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
        {toponym.real
          ? `Comuna de ${toponym.comuna}, ${toponym.region}.`
          : "Este nombre no figura entre las localidades del Censo 2017."}
      </p>
      <button ref={ref} type="button" onClick={onNext} className={`${BUTTON_NEUTRAL} w-full`}>
        {last ? "Ver resultado" : "Siguiente letrero"}
      </button>
    </div>
  );
}
