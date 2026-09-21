import type { DeviceId, Guess, PlayerId, RoundIndex, Snapshot } from "../game/types";
import { isSnapshot } from "../game/validate";

export type ClientMessage =
  /** El único mensaje que lleva el DeviceId. */
  | { t: "hello"; deviceId: DeviceId; name: string }
  | { t: "answer"; playerId: PlayerId; gameNumber: number; round: RoundIndex; guess: Guess }
  | { t: "ack"; playerId: PlayerId; version: number }
  | { t: "bye"; playerId: PlayerId };

export type HostMessage =
  /** Respuesta a `hello`: le dice al cliente quién es en esta sala. Repite el `deviceId` que
   *  saludó porque el welcome viaja por el topic de todos, y quien recién llega no tiene otra
   *  forma de reconocer que es suyo: su PlayerId es justamente lo que este mensaje trae. */
  | { t: "welcome"; deviceId: DeviceId; playerId: PlayerId; state: Snapshot }
  | { t: "snapshot"; state: Snapshot };

export interface TransportHandlers {
  onClientMessage(msg: ClientMessage): void;
  /** `direct` distingue el canal personal del de todos. El host solo manda por el personal
   *  cuando está esperando un acuse, así que verlo llegar ahí ya es la señal de que hay que
   *  acusar: no hace falta deducirlo de si la pantalla cambió. */
  onHostMessage(msg: HostMessage, direct: boolean): void;
}

export interface Transport {
  /** Empieza a escuchar. Devuelve cómo dejar de hacerlo. */
  connect(handlers: TransportHandlers): () => void;
  send(msg: ClientMessage): void;
  broadcast(msg: HostMessage): void;
  /** host -> uno, para reenvíos. */
  sendTo(playerId: PlayerId, msg: HostMessage): void;
}

/** El cliente necesita su PlayerId para escuchar el canal dirigido, y solo lo sabe cuando llega
 *  el primer `welcome`. Los transportes lo aprenden mirando pasar los mensajes del host. */
export function trackPlayerId(deviceId: DeviceId, onAssigned: (id: PlayerId) => void) {
  let assigned: PlayerId | null = null;
  return {
    get playerId(): PlayerId | null {
      return assigned;
    },
    observe(msg: HostMessage): void {
      if (msg.t !== "welcome" || msg.deviceId !== deviceId || msg.playerId === assigned) return;
      assigned = msg.playerId;
      onAssigned(assigned);
    },
  };
}

/** Lo que llega por un topic público no lo escribió necesariamente alguien de la sala, así que
 *  se mira la forma antes de entregarlo. Un mensaje que no la cumple se descarta entero: medio
 *  aplicado sería peor, y el diseño ya tiene con qué recuperarse de uno perdido. */
export function isClientMessage(value: unknown): value is ClientMessage {
  if (typeof value !== "object" || value === null) return false;
  const msg = value as Record<string, unknown>;
  switch (msg.t) {
    case "hello":
      return typeof msg.deviceId === "string" && typeof msg.name === "string";
    case "answer":
      return (
        typeof msg.playerId === "string" &&
        typeof msg.gameNumber === "number" &&
        typeof msg.round === "number" &&
        typeof msg.guess === "boolean"
      );
    case "ack":
      return typeof msg.playerId === "string" && typeof msg.version === "number";
    case "bye":
      return typeof msg.playerId === "string";
    default:
      return false;
  }
}

export function isHostMessage(value: unknown): value is HostMessage {
  if (typeof value !== "object" || value === null) return false;
  const msg = value as Record<string, unknown>;
  if (msg.t === "snapshot") return isSnapshot(msg.state);
  return (
    msg.t === "welcome" &&
    typeof msg.deviceId === "string" &&
    typeof msg.playerId === "string" &&
    isSnapshot(msg.state)
  );
}

/** Un transporte que el host no usa para mandar, y viceversa. Llamar al lado que no es sería un
 *  error de cableado, no algo que pueda pasar en producción. */
export function wrongSide(what: string): never {
  throw new Error(`este transporte no puede ${what}`);
}
