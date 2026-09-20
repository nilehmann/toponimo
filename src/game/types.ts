/** Estructura del nombre: a = una palabra, b = dos palabras, c = artículo + palabra. */
export type Form = "a" | "b" | "c";

/** Fila compacta de `game_data.json`: los índices apuntan a `comunas` y `regions`. */
export type RealRow = [name: string, comuna: number, region: number];

export interface GameData {
  R: Record<Form, RealRow[]>;
  F: Record<Form, string[]>;
  regions: string[];
  comunas: string[];
}

export interface Round {
  name: string;
  real: boolean;
  comuna?: string;
  region?: string;
}
