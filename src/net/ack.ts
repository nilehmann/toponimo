import type { AnyGame } from "../game/session";

/** Las dos únicas versiones donde perderse un snapshot deja a alguien tirado sin saberlo: con
 *  los botones en pantalla mientras el resto ya vio el resultado, o en la ronda anterior. El
 *  snapshot que solo agrega una respuesta ajena no cambia nada de lo que estás mirando.
 *
 *  Una regla sola para los dos lados: el host arma los reenvíos con esto y el cliente decide
 *  con esto cuándo acusar, así que nunca puede haber un reenvío que nadie vaya a acusar. */
export function needsAck(before: AnyGame | null, after: AnyGame | null): boolean {
  if (!after) return false;
  // Partida nueva, o la primera que ve quien recién llega: la pantalla cambia entera.
  if (!before || before.number !== after.number) return true;
  if (before.current !== after.current) return true;
  if (!before.revealed && after.revealed) return true;
  return before.finishedAt === null && after.finishedAt !== null;
}
