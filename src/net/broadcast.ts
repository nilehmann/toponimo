import type { DeviceId, PlayerId, RoomCode } from "../game/types";
import {
  type ClientMessage,
  type HostMessage,
  type Transport,
  trackPlayerId,
  wrongSide,
} from "./transport";

/** `to: null` es la difusión a toda la sala. */
type Envelope =
  | { dir: "up"; msg: ClientMessage }
  | { dir: "down"; to: PlayerId | null; msg: HostMessage };

/** Host y jugador en pestañas distintas de la misma máquina. No sale del navegador: sirve para
 *  probar el protocolo entero sin depender de un broker público. */
export function createBroadcastTransport(
  code: RoomCode,
  role: "host" | "client",
  deviceId: DeviceId,
): Transport {
  const channel = new BroadcastChannel(`toponimo/${code}`);
  const post = (envelope: Envelope) => channel.postMessage(envelope);

  if (role === "host") {
    return {
      connect(handlers) {
        const onMessage = ({ data }: MessageEvent<Envelope>) => {
          if (data.dir === "up") handlers.onClientMessage(data.msg);
        };
        channel.addEventListener("message", onMessage);
        return () => {
          channel.removeEventListener("message", onMessage);
          channel.close();
        };
      },
      send: () => wrongSide("mandar como cliente"),
      broadcast: (msg) => post({ dir: "down", to: null, msg }),
      sendTo: (playerId, msg) => post({ dir: "down", to: playerId, msg }),
    };
  }

  const tracker = trackPlayerId(deviceId, () => {});
  return {
    connect(handlers) {
      const onMessage = ({ data }: MessageEvent<Envelope>) => {
        if (data.dir !== "down") return;
        tracker.observe(data.msg);
        // El canal es uno solo para toda la sala, así que el filtro por destinatario es acá.
        if (data.to !== null && data.to !== tracker.playerId) return;
        handlers.onHostMessage(data.msg);
      };
      channel.addEventListener("message", onMessage);
      return () => {
        channel.removeEventListener("message", onMessage);
        channel.close();
      };
    },
    send: (msg) => post({ dir: "up", msg }),
    broadcast: () => wrongSide("difundir como host"),
    sendTo: () => wrongSide("difundir como host"),
  };
}
