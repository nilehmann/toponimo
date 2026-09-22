import { COPY } from "../copy";
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
          {COPY.round.real}
        </button>
        <button
          type="button"
          aria-pressed={selected === false}
          className={`${BUTTON_WARN} ${selected === false ? SELECTED : ""}`}
          onClick={() => onAnswer(false)}
        >
          {COPY.round.fake}
        </button>
      </div>
      <p className="mt-2.5 text-center text-sm text-muted">
        {selected !== null && waiting !== null ? (
          waiting
        ) : (
          <>
            {COPY.round.keyboard} <kbd className={KBD}>E</kbd> {COPY.round.keyReal},{" "}
            <kbd className={KBD}>I</kbd> {COPY.round.keyFake}
          </>
        )}
      </p>
    </div>
  );
}
