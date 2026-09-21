import { describe, expect, it } from "vitest";

import { BROKERS } from "./brokers";
import {
  ALPHABET,
  CODE_LENGTH,
  brokerFor,
  brokerIndex,
  codeFromHash,
  isValidCode,
  newCode,
  normalizeCode,
} from "./code";

describe("alfabeto", () => {
  it("no tiene los caracteres que se confunden al dictar", () => {
    for (const c of "01ILO") expect(ALPHABET).not.toContain(c);
  });

  it("alcanza para nombrar todos los brokers", () => {
    expect(BROKERS.length).toBeLessThanOrEqual(ALPHABET.length);
    expect(BROKERS.length).toBeGreaterThan(0);
  });

  it("todos los brokers son wss, que es lo único que carga un sitio HTTPS", () => {
    for (const url of BROKERS) expect(url.startsWith("wss://")).toBe(true);
  });
});

describe("newCode", () => {
  it("nombra el broker en el primer carácter y sortea los otros seis", () => {
    for (let i = 0; i < BROKERS.length; i++) {
      const code = newCode(i);
      expect(code).toHaveLength(CODE_LENGTH);
      expect(brokerIndex(code)).toBe(i);
      expect(brokerFor(code)).toBe(BROKERS[i]);
      expect(isValidCode(code)).toBe(true);
    }
  });

  it("no repite: mil sorteos dan mil códigos distintos", () => {
    const codes = new Set(Array.from({ length: 1000 }, () => newCode(0)));
    expect(codes.size).toBe(1000);
  });

  it("usa todo el alfabeto en el secreto", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) for (const c of newCode(0).slice(1)) seen.add(c);
    expect(seen.size).toBe(ALPHABET.length);
  });

  it("no inventa un broker que no existe", () => {
    expect(() => newCode(BROKERS.length)).toThrow();
    expect(() => newCode(-1)).toThrow();
  });
});

describe("isValidCode", () => {
  it("rechaza el largo que no es, las letras de afuera y el broker inexistente", () => {
    expect(isValidCode("234567")).toBe(false);
    expect(isValidCode("23456789")).toBe(false);
    expect(isValidCode("234567O")).toBe(false);
    expect(isValidCode("")).toBe(false);
    const sinBroker = ALPHABET[ALPHABET.length - 1];
    expect(isValidCode(`${sinBroker}234567`)).toBe(BROKERS.length === ALPHABET.length);
  });

  it("no le busca broker a un código inválido", () => {
    expect(brokerFor("234567O")).toBeNull();
    expect(brokerFor("Z234567")).toBeNull();
  });
});

describe("normalizeCode", () => {
  it("limpia sin validar: quien teclea ve el código armado antes de que se rechace", () => {
    expect(isValidCode(normalizeCode("A234567"))).toBe(false);
    expect(normalizeCode("A234567")).toHaveLength(CODE_LENGTH);
  });

  it("acepta minúsculas, espacios y guiones", () => {
    expect(normalizeCode(" a23-45 67 ")).toBe("A234567");
  });

  it("corta en siete y descarta lo que no es del alfabeto", () => {
    expect(normalizeCode("A234567890")).toBe("A234567");
    expect(normalizeCode("aoil23456789")).toBe("A234567");
  });
});

describe("codeFromHash", () => {
  it("lee el código del fragmento", () => {
    expect(codeFromHash("#2345678")).toBe("2345678");
    expect(codeFromHash("#2abcdef")).toBe("2ABCDEF");
  });

  it("ignora un fragmento que no es un código", () => {
    expect(codeFromHash("")).toBeNull();
    expect(codeFromHash("#dev")).toBeNull();
    expect(codeFromHash("#A23456O")).toBeNull();
  });
});
