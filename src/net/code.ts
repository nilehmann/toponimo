import { BROKERS } from "./brokers";
import type { RoomCode } from "../game/types";

/** Excluye los pares que se confunden al dictar: 0 y O, 1 e I y L. */
export const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 7;

/** Sortea sin sesgo: descarta los bytes que no caben en un número entero de vueltas al alfabeto. */
function randomChars(n: number): string {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  const buf = new Uint8Array(n * 2);
  let out = "";
  while (out.length < n) {
    crypto.getRandomValues(buf);
    for (const byte of buf) {
      if (byte >= limit) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === n) break;
    }
  }
  return out;
}

/** El primer carácter es el índice del broker: lo elige el host y no cada cliente, que es lo que
 *  impide que la sala se parta en dos mitades que no se ven entre sí. */
export function newCode(brokerIndex: number): RoomCode {
  if (brokerIndex < 0 || brokerIndex >= BROKERS.length) {
    throw new Error(`no hay un broker ${brokerIndex}`);
  }
  return ALPHABET[brokerIndex] + randomChars(CODE_LENGTH - 1);
}

export function brokerIndex(code: string): number {
  return ALPHABET.indexOf(code[0] ?? "");
}

/** El broker que le tocó a la sala, o null si el código no nombra ninguno. */
export function brokerFor(code: string): string | null {
  return isValidCode(code) ? BROKERS[brokerIndex(code)] : null;
}

export function isValidCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  if (![...code].every((c) => ALPHABET.includes(c))) return false;
  return brokerIndex(code) < BROKERS.length;
}

/** Lo que alguien teclea: se ignoran mayúsculas, espacios y guiones. Las letras que el alfabeto
 *  excluyó no se adivinan, porque adivinar mal lleva a otra sala en silencio. */
export function normalizeCode(input: string): string {
  return [...input.toUpperCase()]
    .filter((c) => ALPHABET.includes(c))
    .join("")
    .slice(0, CODE_LENGTH);
}

/** El código viaja en el fragmento, que no llega al servidor de Pages. */
export function codeFromHash(hash: string): RoomCode | null {
  const code = hash.replace(/^#/, "").toUpperCase();
  return isValidCode(code) ? code : null;
}

/** Se lleva la query tal cual: es lo que hace que un link armado con `?transporte=local` siga
 *  siendo local del otro lado, en vez de mandar a esa pestaña a buscar un broker. */
export function roomLink(code: RoomCode): string {
  return `${location.origin}${import.meta.env.BASE_URL}${location.search}#${code}`;
}
