import type { Ref } from "react";

import type { Guess, Toponym } from "../game/types";
import { BUTTON_NEUTRAL } from "./ui";

interface RevealProps {
  toponym: Toponym;
  /** undefined cuando no respondió: esa ronda cuenta como no acertada. */
  guess: Guess | undefined;
  last: boolean;
  /** Solo el host avanza. El resto ve el resultado y espera. */
  onNext?: () => void;
  /** «4 de 5 al día»: cuántos acusaron recibo del reveal. */
  upToDate?: string;
  ref?: Ref<HTMLButtonElement>;
}

function verdict(toponym: Toponym, guess: Guess | undefined): string {
  if (guess === undefined) return toponym.real ? "Existe." : "Es inventado.";
  if (guess !== toponym.real) return toponym.real ? "Existe." : "Es inventado.";
  return toponym.real ? "Correcto, existe." : "Correcto, es inventado.";
}

export function Reveal({ toponym, guess, last, onNext, upToDate, ref }: RevealProps) {
  const correct = guess === toponym.real;
  return (
    <div className="mt-6">
      <p className={`text-xl font-extrabold ${correct ? "text-ok" : "text-miss"}`}>
        {verdict(toponym, guess)}
      </p>
      <p className="mt-1 mb-4">
        {toponym.real
          ? `Comuna de ${toponym.comuna}, ${toponym.region}.`
          : "Este nombre no figura entre las localidades del Censo 2017."}
      </p>
      {onNext ? (
        <button ref={ref} type="button" onClick={onNext} className={`${BUTTON_NEUTRAL} w-full`}>
          {last ? "Ver resultado" : "Siguiente letrero"}
          {upToDate && <span className="block text-sm font-semibold text-muted">{upToDate}</span>}
        </button>
      ) : (
        <p className="text-center text-sm text-muted">
          {last ? "Esperando el resultado." : "Esperando al host."}
        </p>
      )}
    </div>
  );
}
