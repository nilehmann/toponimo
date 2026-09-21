import type { DeviceId, RoomCode } from "../game/types";
import { createBroadcastTransport } from "./broadcast";
import { newCode } from "./code";
import type { Transport } from "./transport";

export type Role = "host" | "client";

/** Para probar sin broker: `?transporte=local` cambia MQTT por un BroadcastChannel, que no sale
 *  del navegador pero sí llega a otra pestaña de la misma máquina. */
export function isLocal(): boolean {
  if (typeof location === "undefined") return false;
  return new URLSearchParams(location.search).get("transporte") === "local";
}

/** `mqtt` se carga con `import()` recién acá, así que quien solo juega solo nunca lo descarga. */
export async function openRoom(
  code: RoomCode,
  role: Role,
  deviceId: DeviceId,
): Promise<Transport> {
  if (isLocal()) return createBroadcastTransport(code, role, deviceId);
  const { openRoom: open } = await import("./mqtt");
  return open(code, role, deviceId);
}

export async function createRoom(
  deviceId: DeviceId,
): Promise<{ code: RoomCode; transport: Transport }> {
  if (isLocal()) {
    const code = newCode(0);
    return { code, transport: createBroadcastTransport(code, "host", deviceId) };
  }
  const { createRoom: create } = await import("./mqtt");
  return create(deviceId);
}
