import type { CSSProperties } from "react";

import { COPY } from "../copy";
import { type Arrow, signage } from "./signage";

interface SignProps {
  name: string;
  revealed: boolean;
  real: boolean;
  comuna?: string;
}

const ROTATION: Record<Arrow, number> = {
  left: -90,
  "up-left": -45,
  up: 0,
  "up-right": 45,
  right: 90,
};

function ArrowIcon({ arrow }: { arrow: Arrow }) {
  return (
    <svg viewBox="0 0 38 38" aria-hidden="true" className="size-10 shrink-0">
      <path
        d="M19 1 L35 17 H25 V37 H13 V17 H3 Z"
        fill="#fff"
        transform={`rotate(${ROTATION[arrow]} 19 19)`}
      />
    </svg>
  );
}

/** Ancho de las letras de Overpass 800, en em, medido en el navegador sobre todos los caracteres
 *  de los nombres del juego. Las que no están aquí andan entre 0,55 y 0,6. Un promedio fijo no
 *  sirve: «Domeyko» no pasa de 0,6 por letra en promedio pero igual se partía en un teléfono. */
const NARROW: Record<string, number> = {
  i: 0.3,
  í: 0.3,
  j: 0.3,
  l: 0.3,
  I: 0.3,
  "'": 0.26,
  f: 0.37,
  t: 0.4,
  r: 0.43,
  s: 0.5,
};
const WIDE: Record<string, number> = { m: 0.89, w: 0.76, M: 0.81, W: 0.85 };

function charEm(c: string): number {
  return NARROW[c] ?? WIDE[c] ?? (c === c.toUpperCase() ? 0.73 : 0.6);
}

/** Lo que ocupan la flecha y su separación cuando va al costado del nombre. */
const SIDE_ARROW = "3.25rem";

/** Separación entre el nombre y los kilómetros, en em para que se achique junto con la letra. */
const KM_GAP = 0.5;

function textEm(text: string): number {
  return [...text].reduce((em, c) => em + charEm(c), 0);
}

/** Tamaño máximo para que la palabra más ancha, y los kilómetros al lado si los hay, quepan enteros
 *  en el ancho que queda, con un 5% de aire. Sin esto la flecha al costado partía «Aeropuerto». */
function fit(name: string, km: number | null, reserve: string): string {
  const widest = Math.max(...name.split(/\s+/).map(textEm));
  const extra = km === null ? 0 : KM_GAP + textEm(String(km));
  return `calc((100cqi - ${reserve}) / ${((widest + extra) * 1.05).toFixed(2)})`;
}

export function Sign({ name, revealed, real, comuna }: SignProps) {
  const { arrow, km } = signage(name);
  // La flecha va del lado al que apunta, como manda el manual; la que sigue derecho va arriba.
  const side = arrow === "left" || arrow === "up-left" ? "start" : arrow === "up" ? null : "end";
  const style = {
    "--fit": fit(name, km, side === null ? "0rem" : SIDE_ARROW),
    columnGap: `${KM_GAP}em`,
  } as CSSProperties;
  // Los kilómetros van a la derecha del nombre y con la misma letra, como en la ruta.
  const label = (
    <div
      style={style}
      className="flex items-center text-[length:min(var(--text-4xl),var(--fit))] leading-none font-extrabold text-white sm:text-[length:min(var(--text-5xl),var(--fit))]"
    >
      <p className="wrap-anywhere hyphens-auto">{name}</p>
      {km !== null && <span className="shrink-0">{km}</span>}
    </div>
  );

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full overflow-hidden rounded-xl bg-sign p-1.5 shadow-md">
        <div className="flex min-h-44 flex-col items-center @container justify-center gap-2 rounded-lg border-4 border-white px-4 pt-5 pb-6 text-center">
          {side === null ? (
            <>
              <ArrowIcon arrow={arrow} />
              {label}
            </>
          ) : (
            <div className="flex items-center gap-3 text-left">
              {side === "start" && <ArrowIcon arrow={arrow} />}
              {label}
              {side === "end" && <ArrowIcon arrow={arrow} />}
            </div>
          )}
        </div>
        {revealed && !real && (
          <div className="pointer-events-none absolute -inset-x-8 top-5/6 -translate-y-1/2 -rotate-6 bg-warn py-1 text-center text-lg font-extrabold text-warn-ink">
            {COPY.reveal.fakeBand}
          </div>
        )}
      </div>

      <div aria-hidden="true" className="flex w-7/12 justify-between">
        <span className="block h-8 w-2.5 rounded-b-sm bg-post" />
        <span className="block h-8 w-2.5 rounded-b-sm bg-post" />
      </div>

      {revealed && real && comuna && (
        <div className="relative -mt-6 max-w-[90%] rounded-lg border-4 border-sign bg-white px-4 py-1 text-center text-lg font-extrabold text-sign">
          {comuna}
        </div>
      )}
    </div>
  );
}
