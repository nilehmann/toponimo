import type { Ref } from "react";

import { COPY } from "../copy";
import type { Guess, Toponym } from "../game/types";
import { BUTTON_NEUTRAL } from "./ui";

function sentence(toponym: Toponym, guess: Guess | undefined): string {
  if (guess === undefined || guess !== toponym.real) {
    return toponym.real ? COPY.reveal.isReal : COPY.reveal.isFake;
  }
  return toponym.real ? COPY.reveal.rightReal : COPY.reveal.rightFake;
}

interface VerdictProps {
  toponym: Toponym;
  /** undefined cuando no respondió: esa ronda cuenta como no acertada. */
  guess: Guess | undefined;
}

/** El resultado de la ronda. Va arriba de todo porque es lo primero que se busca al revelar, y
 *  en las rondas reales lo que sigue es un mapa que se llevaría media pantalla. */
export function Verdict({ toponym, guess }: VerdictProps) {
  const correct = guess === toponym.real;
  return (
    <p className={`mt-5 text-xl font-extrabold ${correct ? "text-ok" : "text-miss"}`}>
      {sentence(toponym, guess)}
    </p>
  );
}

/** De dónde es, para las rondas que no muestran mapa: los nombres inventados y el puñado de
 *  localidades reales que se quedaron sin contorno. Cuando hay mapa, esto lo dice la ficha. */
export function Detail({ toponym }: { toponym: Toponym }) {
  return (
    <p className="mt-3">
      {toponym.real
        ? COPY.reveal.where(toponym.comuna, toponym.region)
        : COPY.reveal.notInCensus}
    </p>
  );
}

interface NextProps {
  last: boolean;
  /** Solo el host avanza. El resto ve el resultado y espera. */
  onNext?: () => void;
  /** «4 de 5 al día»: cuántos acusaron recibo del reveal. */
  upToDate?: string;
  ref?: Ref<HTMLButtonElement>;
}

/** El botón de avanzar, pegado al pie mientras se recorre la pantalla. En las rondas reales el
 *  mapa y la ficha empujan todo lo demás fuera de vista, y el host lo necesita a mano sin tener
 *  que buscarlo ronda tras ronda. */
export function Next({ last, onNext, upToDate, ref }: NextProps) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-6 border-t border-line bg-ground px-5 py-3">
      {onNext ? (
        <button ref={ref} type="button" onClick={onNext} className={`${BUTTON_NEUTRAL} w-full`}>
          {last ? COPY.round.seeResult : COPY.round.next}
          {upToDate && <span className="block text-sm font-semibold text-muted">{upToDate}</span>}
        </button>
      ) : (
        <p className="text-center text-sm text-muted">
          {last ? COPY.round.waitingResult : COPY.round.waitingHost}
        </p>
      )}
    </div>
  );
}
