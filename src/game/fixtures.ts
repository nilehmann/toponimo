import { ROUNDS } from "./toponyms";
import type { GameData, Toponym } from "./types";

/** Letreros deterministas para las pruebas: alterna real e inventado. */
export function fakeToponyms(seed = 0): Toponym[] {
  return Array.from({ length: ROUNDS }, (_, i): Toponym =>
    (i + seed) % 2 === 0
      ? { name: `Real ${seed}-${i}`, real: true, comuna: "Comuna", region: "Región" }
      : { name: `Falso ${seed}-${i}`, real: false },
  );
}

export const fakeGameData: GameData = {
  R: {
    a: [["Chanco", 0, 0]],
    b: [["Alto Hospicio", 0, 0]],
    c: [["La Higuera", 0, 0]],
  },
  F: { a: ["Chaiguimán"], b: ["Loma Colimahuida"], c: ["La Curaquilla"] },
  comunas: ["Comuna"],
  regions: ["Región"],
};
