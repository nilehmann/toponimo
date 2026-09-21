import type { Form, GameData, Toponym } from "./types";

export const ROUNDS = 15;

const FORMS: Form[] = ["a", "b", "c"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Elige la estructura del nombre con la misma proporción que tienen las localidades reales,
 *  para que la forma del nombre no delate si es real o inventado. */
function pickForm(data: GameData): Form {
  const weights = FORMS.map((f) => data.R[f].length);
  let r = Math.random() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < FORMS.length; i++) {
    r -= weights[i];
    if (r < 0) return FORMS[i];
  }
  return "a";
}

/** Arma los 15 letreros de una partida: 7 u 8 reales, en orden aleatorio y sin repetir nombres. */
export function buildToponyms(data: GameData): Toponym[] {
  const nReal = Math.random() < 0.5 ? 7 : 8;
  const flags = shuffle(Array.from({ length: ROUNDS }, (_, i) => i < nReal));
  const used = new Set<string>();
  const toponyms: Toponym[] = [];
  for (const real of flags) {
    let toponym: Toponym | null = null;
    while (!toponym || used.has(toponym.name)) {
      const f = pickForm(data);
      if (real) {
        const [name, c, r] = pick(data.R[f]);
        toponym = { name, real: true, comuna: data.comunas[c], region: data.regions[r] };
      } else {
        toponym = { name: pick(data.F[f]), real: false };
      }
    }
    used.add(toponym.name);
    toponyms.push(toponym);
  }
  return toponyms;
}
