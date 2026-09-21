import type { Guess } from "../game/types";
import { BUTTON_SIGN, BUTTON_WARN, KBD, SELECTED } from "./ui";

interface ChoicesProps {
  onAnswer: (guess: Guess) => void;
  /** Lo elegido: sale del snapshot, o de lo recién tocado mientras el host no confirma. */
  selected: Guess | null;
  /** Cuántos faltan, o null cuando no hay a quién esperar. */
  waiting: string | null;
}

export function Choices({ onAnswer, selected, waiting }: ChoicesProps) {
  return (
    <div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          aria-pressed={selected === true}
          className={`${BUTTON_SIGN} ${selected === true ? SELECTED : ""}`}
          onClick={() => onAnswer(true)}
        >
          Existe
        </button>
        <button
          type="button"
          aria-pressed={selected === false}
          className={`${BUTTON_WARN} ${selected === false ? SELECTED : ""}`}
          onClick={() => onAnswer(false)}
        >
          Inventado
        </button>
      </div>
      <p className="mt-2.5 text-center text-sm text-muted">
        {selected !== null && waiting !== null ? (
          waiting
        ) : (
          <>
            Teclado: <kbd className={KBD}>E</kbd> existe, <kbd className={KBD}>I</kbd> inventado
          </>
        )}
      </p>
    </div>
  );
}
