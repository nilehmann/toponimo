import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import type { GameData } from "../game/types";
import { ARROWS, PLATE_LETTERS, PLATE_ODDS, signage } from "./signage";

const game = JSON.parse(
  readFileSync(new URL("../../data/processed/game_data.json", import.meta.url), "utf8"),
) as GameData;
const real = Object.values(game.R).flatMap((rows) => rows.map(([name]) => name));
const fake = Object.values(game.F).flat();
const names = [...real, ...fake];

describe("signage", () => {
  it("un mismo nombre da siempre el mismo letrero", () => {
    for (const name of names.slice(0, 200)) expect(signage(name)).toEqual(signage(name));
  });

  it("usa las cinco flechas en proporciones parecidas", () => {
    const counts = new Map(ARROWS.map((a) => [a, 0]));
    for (const name of names) {
      const { arrow } = signage(name);
      counts.set(arrow, counts.get(arrow)! + 1);
    }
    for (const n of counts.values()) expect(n / names.length).toBeCloseTo(1 / ARROWS.length, 1);
  });

  it("pone placa más o menos una de cada cuatro veces", () => {
    const plated = names.filter((n) => signage(n).plate !== null).length;
    expect(plated / names.length).toBeCloseTo(PLATE_ODDS, 1);
  });

  it("la placa es una letra de rol y un número de dos o tres cifras", () => {
    for (const name of names) {
      const { plate } = signage(name);
      if (plate === null) continue;
      expect(plate).toMatch(/^[A-Z]-[1-9]\d{1,2}$/);
      expect(PLATE_LETTERS).toContain(plate[0]);
    }
  });

  it("reales e inventados reciben placa en la misma proporción", () => {
    const rate = (list: string[]) => list.filter((n) => signage(n).plate !== null).length / list.length;
    expect(Math.abs(rate(real) - rate(fake))).toBeLessThan(0.03);
  });
});
