import { BUTTON_SIGN, BUTTON_WARN, KBD } from "./ui";

export function Choices({ onAnswer }: { onAnswer: (real: boolean) => void }) {
  return (
    <div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" className={BUTTON_SIGN} onClick={() => onAnswer(true)}>
          Existe
        </button>
        <button type="button" className={BUTTON_WARN} onClick={() => onAnswer(false)}>
          Inventado
        </button>
      </div>
      <p className="mt-2.5 text-center text-sm text-muted">
        Teclado: <kbd className={KBD}>E</kbd> existe, <kbd className={KBD}>I</kbd> inventado
      </p>
    </div>
  );
}
