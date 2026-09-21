import type { Transport } from "./transport";

/** No hace nada. **Es** el modo solitario: un host que no le habla a nadie. */
export function createNullTransport(): Transport {
  return {
    connect: () => () => {},
    send: () => {},
    broadcast: () => {},
    sendTo: () => {},
  };
}
