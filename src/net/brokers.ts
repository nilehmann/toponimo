/** Lista fija en tiempo de build. El primer carácter del código de sala es el índice acá, así
 *  que agregar brokers al final es seguro y reordenarlos rompe los códigos ya repartidos —
 *  cosa que igual no sobrevive a un deploy. El sitio se sirve por HTTPS, así que `ws://` queda
 *  descartado por contenido mixto. */
export const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
];

/** Los topics de una sala. Los clientes se suscriben a `host` y a su propio `direct`; el host,
 *  a `inbox`. */
export function topics(code: string) {
  return {
    host: `toponimo/${code}/host`,
    inbox: `toponimo/${code}/in`,
    direct: (playerId: string) => `toponimo/${code}/c/${playerId}`,
  };
}
