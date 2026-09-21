Ver README.md para el método. El diseño del modo en grupo está en `docs/multijugador.md` y es la
referencia: si el código y ese documento no coinciden, hay que arreglar uno de los dos.

- Tras editar `src/`: `npm run build` (corre `tsc`, las pruebas y luego Vite). Tras editar
  `scripts/`: `npm run data && npm run build`. Las pruebas solas: `npm test`.
- La geometría va **aparte** de `npm run data`, porque la descarga pasa de 0,6 MB a 79 MB:
  `cd scripts && python3 download.py && python3 build_geo.py`. `download.py` salta lo que ya
  está en `data/raw/` con el tamaño correcto (`--force` lo fuerza), y `build_geo.py` escribe
  `data/processed/geo/{id}.json`, un GeoJSON Feature por topónimo. Toma unos 45 s.
- Los colores son tokens de `@theme` en `src/index.css`; el tema oscuro solo redefine esas variables
  en `:root[data-theme="dark"]`. No hace falta `dark:` en las utilidades.
- Al tocar los filtros de `build_fake.py`, revisar a mano una muestra de inventados: los filtros son
  heurísticos y los fallos típicos son palabras comunes o casi copias de nombres reales.

## Cómo está armado el modo en grupo

- `game/session.ts` es un reducer puro sobre `SessionState`. Devolver el mismo estado significa
  «esto no cambia nada»: ni sube la versión ni se difunde. Toda acción que dependa del reloj recibe
  su `at`, para que el reducer no lea `Date.now()`.
- El protocolo vive en `net/host.ts` y `net/client.ts`, TypeScript puro sin React. Ahí están los
  reenvíos y los reintentos, y por eso se prueban enteros con relojes falsos en
  `net/runtime.test.ts`. `hooks/useSession.ts` es solo el enganche a React.
- `participants` vive en `SessionState`, no en `Game`: es quién está en la sala *ahora*, y en el
  lobby también se entra y se sale. Con la lista adentro de la partida, quien se iba del lobby
  volvía de fantasma en cada ronda.
- `game/validate.ts` valida lo que entra de afuera: el cable y `localStorage`. Todo lo que no
  cumple la forma se descarta entero. Un `hello` con un nombre que no es texto se guardaba en
  `players`, se persistía, y rompía la pantalla del host en cada reapertura.
- `net/ack.ts` tiene **una sola** regla de cuándo hace falta un acuse, usada por los dos lados: el
  host arma los reenvíos con ella y el cliente decide con ella cuándo acusar. Si se separaran,
  podría quedar un reenvío que nadie va a acusar nunca.
- Estar al día se mide contra `awaited` (la última versión que había que acusar), no contra
  `version`: una respuesta ajena también sube la versión y nadie la acusa.
- Un snapshot de versión **menor** se descarta; uno de la **misma** versión repinta igual. Eso es lo
  que hace que refrescar sirva cuando el host no tiene nada nuevo que contar, que es justo el caso
  para el que existe ese botón. Y todo lo que llega por el canal personal se acusa siempre: el host
  solo manda ahí lo que está reenviando, así que verlo ahí ya significa que le falta un acuse. Sin
  esa regla un `ack` perdido no se recupera nunca, porque el reenvío no le cambia nada al cliente.
- `unreachable` es «no alcanzo al host», no «no me llega nada». Ver la partida avanzar lo desmiente
  solo si ya sabemos quiénes somos; sin `PlayerId` lo que falta es justamente que nuestros mensajes
  lleguen, y ahí la pantalla no ofrece tablero porque no habría nada que tocar.
- El `welcome` repite el `deviceId` que saludó. Va por el topic de todos, y quien recién llega no
  tiene otra forma de reconocer que es suyo: su `PlayerId` es lo que ese mensaje viene a entregarle.
- `storage/session.ts` guarda en dos cajones, sala y solitario. No es un campo de modo —en el estado
  las dos se ven idénticas— sino lo que hace falta al reabrir para saber qué transporte levantar. Y
  con un cajón solo, tocar «Jugar solo» borraría la única copia autoritativa de una sala en curso.
- Todo lo que se lee de `localStorage` se valida antes de usarlo y nunca deja salir una excepción:
  corre durante el primer render, así que un estado a medio guardar dejaría la pantalla en blanco
  y sin nada que tocar para borrarlo.
- Probar con dos pestañas: `?transporte=local` usa `BroadcastChannel` y manda la identidad a
  `sessionStorage`, porque el `localStorage` es uno solo por máquina y las dos pestañas serían el
  mismo dispositivo.
