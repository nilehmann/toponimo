import type { MqttClient } from "mqtt";

import type { DeviceId, RoomCode } from "../game/types";
import { BROKERS, topics } from "./brokers";
import { brokerFor, newCode } from "./code";
import {
  type ClientMessage,
  type HostMessage,
  type Transport,
  type TransportHandlers,
  isClientMessage,
  isHostMessage,
  trackPlayerId,
  wrongSide,
} from "./transport";

export type Role = "host" | "client";

/** Un mensaje y por cuál de los dos canales llegó. */
interface Delivery {
  msg: unknown;
  direct: boolean;
}

/** Cuánto se le da a un broker público para contestar antes de probar el siguiente. */
const CONNECT_TIMEOUT = 6000;

/** El clientId sale del código y del DeviceId: se elige al abrir la conexión, antes del primer
 *  mensaje, así que no puede depender del PlayerId — y un PlayerId solo es único dentro de su
 *  sala, así que dos salas con un jugador "2" chocarían y el broker desconectaría al anterior. */
function clientId(code: RoomCode, deviceId: DeviceId): string {
  return `tn-${code}-${deviceId.replaceAll("-", "").slice(0, 8)}`;
}

/** Lo que llega es de un broker público: cualquiera puede publicar cualquier cosa en el topic,
 *  así que se comprueba entero antes de entregarlo. Un `hello` con un nombre que no es texto se
 *  guardaría en `players`, se persistiría, y rompería la pantalla del host en cada reapertura. */
function parse(payload: Uint8Array, valid: (value: unknown) => boolean): unknown | null {
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(payload));
    return valid(value) ? value : null;
  } catch {
    return null;
  }
}

/** Abre una conexión, o se rinde. Todo lo que arma para esperar se desarma al terminar: un
 *  `error` posterior es cosa de la reconexión de la librería, y matar el cliente ahí dejaría el
 *  transporte mudo sin que nadie se entere. */
function open(url: string, id: string): Promise<MqttClient> {
  return new Promise((resolve, reject) => {
    void import("mqtt").then(({ default: mqtt }) => {
      // Sesión persistente para que una caída corta no pierda lo que llegó mientras tanto.
      const client = mqtt.connect(url, {
        clientId: id,
        clean: false,
        protocolVersion: 4,
        keepalive: 30,
        connectTimeout: CONNECT_TIMEOUT,
        reconnectPeriod: 2000,
      });

      let settled = false;
      // `connectTimeout` reintenta en vez de rendirse, así que el plazo se pone acá.
      const timer = setTimeout(() => fail(new Error(`${url} no contestó`)), CONNECT_TIMEOUT);
      function done() {
        settled = true;
        clearTimeout(timer);
        client.off("connect", win);
        client.off("error", fail);
        // Tiene que quedar alguno: el EventEmitter de la librería vuelve a tirar el error si
        // nadie lo escucha, y con `reconnectPeriod` cada reintento fallido sería una excepción
        // sin atrapar. No hay nada que hacer con estos: la librería reconecta sola, y de que la
        // sala siga al día se ocupan el reenvío del host y el `hello` del cliente.
        client.on("error", () => {});
      }
      function win() {
        if (settled) return;
        done();
        resolve(client);
      }
      function fail(error: unknown) {
        if (settled) return;
        done();
        client.end(true);
        reject(error instanceof Error ? error : new Error(String(error)));
      }

      client.on("connect", win);
      client.on("error", fail);
    }, reject);
  });
}

/** Separado de la conexión para poder probar el ruteo de topics sin un broker. */
export function wrapClient(client: MqttClient, code: RoomCode, role: Role, deviceId: DeviceId): Transport {
  const topic = topics(code);
  const valid = role === "host" ? isClientMessage : isHostMessage;
  /** Lo que llegó antes de que el runtime se enganche. Sin esto habría una ventana entre
   *  suscribirse y escuchar en la que un `hello` se perdería. */
  const queued: Delivery[] = [];
  let handlers: TransportHandlers | null = null;

  const deliver = ({ msg, direct }: Delivery) => {
    if (!handlers) {
      queued.push({ msg, direct });
      return;
    }
    if (role === "host") handlers.onClientMessage(msg as ClientMessage);
    else handlers.onHostMessage(msg as HostMessage, direct);
  };

  const tracker = trackPlayerId(deviceId, (playerId) => {
    client.subscribe(topic.direct(playerId), { qos: 1 });
  });

  const onMessage = (received: string, payload: Uint8Array) => {
    const msg = parse(payload, valid);
    if (msg === null) return;
    if (role === "host") {
      if (received !== topic.inbox) return;
      deliver({ msg, direct: false });
      return;
    }
    tracker.observe(msg as HostMessage);
    deliver({ msg, direct: received !== topic.host });
  };

  client.on("message", onMessage);
  client.subscribe(role === "host" ? topic.inbox : topic.host, { qos: 1 });

  const publish = (to: string, msg: ClientMessage | HostMessage) => {
    client.publish(to, JSON.stringify(msg), { qos: 1 });
  };

  return {
    connect(next) {
      handlers = next;
      for (const msg of queued.splice(0)) deliver(msg);
      return () => {
        handlers = null;
        client.off("message", onMessage);
        client.end();
      };
    },
    send: (msg) => (role === "client" ? publish(topic.inbox, msg) : wrongSide("mandar como cliente")),
    // El welcome va por el topic de todos aunque sea la respuesta a una persona: para escuchar
    // el canal dirigido hay que saber el PlayerId que ese mismo mensaje viene a entregar.
    broadcast: (msg) => (role === "host" ? publish(topic.host, msg) : wrongSide("difundir como host")),
    sendTo: (playerId, msg) =>
      role === "host" ? publish(topic.direct(playerId), msg) : wrongSide("difundir como host"),
  };
}

/** Abre la sala que nombra el código. Es lo que usan el jugador que entra y el host que
 *  reabre la aplicación. */
export async function openRoom(
  code: RoomCode,
  role: Role,
  deviceId: DeviceId,
): Promise<Transport> {
  const url = brokerFor(code);
  if (!url) throw new Error("Ese código no corresponde a ninguna sala.");
  return wrapClient(await open(url, clientId(code, deviceId)), code, role, deviceId);
}

/** El host prueba los brokers al crear la sala y se queda con el primero que responde. El
 *  código sale recién ahí, porque su primer carácter es justamente ese broker. */
export async function createRoom(deviceId: DeviceId): Promise<{ code: RoomCode; transport: Transport }> {
  const failures: string[] = [];
  for (let i = 0; i < BROKERS.length; i++) {
    const code = newCode(i);
    try {
      const client = await open(BROKERS[i], clientId(code, deviceId));
      return { code, transport: wrapClient(client, code, "host", deviceId) };
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(`Ningún broker contestó. ${failures.join("; ")}`);
}
