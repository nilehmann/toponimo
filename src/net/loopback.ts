import type { DeviceId, PlayerId } from "../game/types";
import {
  type ClientMessage,
  type HostMessage,
  type Transport,
  type TransportHandlers,
  trackPlayerId,
  wrongSide,
} from "./transport";

/** A dónde iba el mensaje: al host, a toda la sala, o a un jugador por su canal dirigido. */
export type Destination = "host" | "all" | PlayerId;

export interface LoopbackOptions {
  /** Devolver true tira el mensaje, que es cómo se prueba un broker que pierde uno. */
  drop?(msg: ClientMessage | HostMessage, to: Destination): boolean;
}

export interface Loopback {
  host(): Transport;
  client(deviceId: DeviceId): Transport;
}

interface ClientEntry {
  handlers: TransportHandlers | null;
  playerId: PlayerId | null;
}

/** Varios jugadores simulados en una pestaña, para desarrollar sin broker. La entrega es
 *  asíncrona como la de verdad: si fuera directa, el host terminaría difundiendo desde adentro
 *  del handler del cliente y las pruebas no verían el mismo orden que la red. */
export function createLoopback(options: LoopbackOptions = {}): Loopback {
  let hostHandlers: TransportHandlers | null = null;
  const clients = new Set<ClientEntry>();

  const deliver = (msg: ClientMessage | HostMessage, to: Destination, run: () => void) => {
    if (options.drop?.(msg, to)) return;
    queueMicrotask(run);
  };

  return {
    host(): Transport {
      return {
        connect(handlers) {
          hostHandlers = handlers;
          return () => {
            if (hostHandlers === handlers) hostHandlers = null;
          };
        },
        send: () => wrongSide("mandar como cliente"),
        broadcast(msg) {
          deliver(msg, "all", () => {
            for (const client of [...clients]) client.handlers?.onHostMessage(msg, false);
          });
        },
        sendTo(playerId, msg) {
          deliver(msg, playerId, () => {
            for (const client of [...clients]) {
              if (client.playerId === playerId) client.handlers?.onHostMessage(msg, true);
            }
          });
        },
      };
    },

    client(deviceId): Transport {
      const entry: ClientEntry = { handlers: null, playerId: null };
      const tracker = trackPlayerId(deviceId, (id) => {
        entry.playerId = id;
      });
      return {
        connect(handlers) {
          entry.handlers = {
            onClientMessage: handlers.onClientMessage,
            onHostMessage(msg, direct) {
              tracker.observe(msg);
              handlers.onHostMessage(msg, direct);
            },
          };
          clients.add(entry);
          return () => {
            clients.delete(entry);
            entry.handlers = null;
          };
        },
        send(msg) {
          deliver(msg, "host", () => hostHandlers?.onClientMessage(msg));
        },
        broadcast: () => wrongSide("difundir como host"),
        sendTo: () => wrongSide("difundir como host"),
      };
    },
  };
}
