import { type KeyboardEvent, type ReactElement, useEffect, useRef, useState } from "react";

import { COPY } from "../copy";
import type { ThemePref } from "../hooks/useTheme";

/** Los tres íconos comparten caja, grosor y remate para que el botón no cambie de peso al pasar
 *  de un tema al otro. */
const LINE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const BOX = "h-5 w-5 shrink-0";

/** "Sistema" va como círculo mitad lleno: es la convención de "automático" y entra en el mismo
 *  cuadrado que el sol y la luna. */
function Auto() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={BOX}>
      <circle cx="12" cy="12" r="9" {...LINE} />
      <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" />
    </svg>
  );
}

function Sun() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={BOX}>
      <circle cx="12" cy="12" r="5" {...LINE} />
      <path
        d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        {...LINE}
      />
    </svg>
  );
}

function Moon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={BOX}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" {...LINE} />
    </svg>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3 w-3 shrink-0">
      <path d="M6 9.5l6 6 6-6" {...LINE} />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path d="M4 12.5l5 5 11-11" {...LINE} />
    </svg>
  );
}

const OPTIONS: { pref: ThemePref; label: string; Icon: () => ReactElement }[] = [
  { pref: "system", label: COPY.theme.system, Icon: Auto },
  { pref: "light", label: COPY.theme.light, Icon: Sun },
  { pref: "dark", label: COPY.theme.dark, Icon: Moon },
];

const ITEM = "[role='menuitemradio']";

interface ThemeToggleProps {
  pref: ThemePref;
  onPick: (pref: ThemePref) => void;
}

/** El ícono dice de qué se trata y el menú nombra las tres opciones. Antes era una sola palabra
 *  ("Sistema", "Claro", "Oscuro") que cicla al tocarla: no se leía como control, no se veía que
 *  hubiera tres estados y el header se movía al cambiar de palabra. */
export function ThemeToggle({ pref, onPick }: ThemeToggleProps) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = OPTIONS.find((option) => option.pref === pref) ?? OPTIONS[0];

  /* Se escucha en captura para que el menú también se cierre al tocar el mapa, que se queda con
     los eventos que le llegan. */
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [open]);

  /* Al abrir, el foco va a la opción activa: es de donde se mueve con las flechas. */
  useEffect(() => {
    if (open) box.current?.querySelector<HTMLButtonElement>(`${ITEM}[aria-checked="true"]`)?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (!open) {
      setOpen(true);
      return;
    }
    const items = [...(box.current?.querySelectorAll<HTMLButtonElement>(ITEM) ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(at + step + items.length) % items.length]?.focus();
  };

  return (
    <div ref={box} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={COPY.theme.button(current.label)}
        title={COPY.theme.tooltip(current.label)}
        className="flex cursor-pointer items-center gap-0.5 rounded-md border border-line py-1.5 pr-1 pl-1.5 text-muted hover:bg-btn-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warn"
      >
        <current.Icon />
        <Chevron />
      </button>

      {open && (
        /* Los controles de Leaflet viven en z-index 1000, así que el menú tiene que ir arriba. */
        <div
          role="menu"
          aria-label={COPY.theme.menu}
          className="absolute top-full right-0 z-[1100] mt-1 w-40 overflow-hidden rounded-md border border-line bg-btn py-1 shadow-lg"
        >
          {OPTIONS.map(({ pref: option, label, Icon }) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === pref}
              onClick={() => {
                onPick(option);
                close();
              }}
              className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-btn-hover focus-visible:bg-btn-hover focus-visible:outline-none ${
                option === pref ? "font-semibold text-ink" : "text-muted"
              }`}
            >
              <Icon />
              <span className="flex-1">{label}</span>
              {option === pref && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
