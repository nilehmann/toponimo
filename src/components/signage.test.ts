import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import type { GameData } from "../game/types";
import { ARROWS, KM_MAX, KM_ODDS, signage } from "./signage";

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

  it("marca la distancia más o menos una de cada cuatro veces", () => {
    const marked = names.filter((n) => signage(n).km !== null).length;
    expect(marked / names.length).toBeCloseTo(KM_ODDS, 1);
  });

  it("la distancia es un entero de 2 a KM_MAX", () => {
    for (const name of names) {
      const { km } = signage(name);
      if (km === null) continue;
      expect(Number.isInteger(km)).toBe(true);
      expect(km).toBeGreaterThanOrEqual(2);
      expect(km).toBeLessThanOrEqual(KM_MAX);
    }
  });

  it("reales e inventados reciben distancia en la misma proporción", () => {
    const rate = (list: string[]) => list.filter((n) => signage(n).km !== null).length / list.length;
    expect(Math.abs(rate(real) - rate(fake))).toBeLessThan(0.03);
  });
});
