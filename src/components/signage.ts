/** Hacia dónde apunta la flecha del letrero. Las diagonales son las de salida próxima. */
export type Arrow = "left" | "up-left" | "up" | "up-right" | "right";

export const ARROWS: readonly Arrow[] = ["left", "up-left", "up", "up-right", "right"];

/** Una de cada cuatro. Si saliera siempre, la distancia dejaría de verse y pasaría a ser decorado. */
export const KM_ODDS = 1 / 4;

/** Lo más lejos que marca un letrero. Pasado eso ya no se indica un pueblo sino una ciudad. */
export const KM_MAX = 199;

export interface Signage {
  arrow: Arrow;
  /** Kilómetros hasta el lugar, o null si este letrero no los marca. */
  km: number | null;
}

/** FNV-1a de 32 bits. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (const unit of new TextEncoder().encode(text)) {
    h ^= unit;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: saca varios números de un mismo hash sin que queden atados entre sí. */
function stream(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

function pick<T>(items: ArrayLike<T>, r: number): T {
  return items[Math.floor(r * items.length)];
}

/** Sale solo del nombre, nunca de `Math.random()`: en una sala todos tienen que ver el mismo
 *  letrero, y un mismo nombre se ve igual cada vez que vuelve. Tampoco mira si es real. */
export function signage(name: string): Signage {
  const next = stream(hash(name));
  const arrow = pick(ARROWS, next());
  if (next() >= KM_ODDS) return { arrow, km: null };
  // Al cuadrado para que abunden los números chicos: los letreros de pueblo suelen estar cerca.
  return { arrow, km: 2 + Math.floor(next() ** 2 * (KM_MAX - 1)) };
}
