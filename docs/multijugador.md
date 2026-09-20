# Topónimo en grupo

Varias personas juegan la misma partida, cada una en su teléfono. Uno es el host: reparte un
código, controla el ritmo y decide cuándo se revela cada letrero. Los demás solo responden.

No hay backend. El sitio es estático y los mensajes viajan por un broker MQTT público.

## Principios

**El host es la única autoridad.** Nadie más modifica el estado. Un jugador manda su respuesta y
espera; lo que ve en pantalla es siempre lo último que dijo el host.

**Se difunden snapshots absolutos, no deltas.** Cada cambio produce el estado completo con una
versión mayor. Un mensaje perdido no deja al receptor inconsistente: lo deja atrasado, y el
siguiente snapshot lo pone al día sin reconstruir nada. Es lo que hace que reconectarse sea trivial.

**Un solo modelo para jugar solo y en grupo.** El solitario es una sala de un jugador que es su
propio host y no se conecta a ninguna parte. Mismo estado, mismo reducer, misma pantalla de
resumen. No existe un campo que diga en qué modo estamos.

**Nada depende de una conexión permanente.** Se manda un mensaje cuando alguien responde, cuando el
host revela o avanza, y cuando alguien llega o se va; cada uno arrastra su acuse de recibo y, si
hace falta, unos pocos reintentos acotados. No hay latidos ni sondeo: entre una acción y la
siguiente no circula nada.

## El estado

```ts
type PlayerId = string;   // uuid v4, generado una vez por dispositivo
type RoomCode = string;   // 7 caracteres: broker + secreto
type RoundIndex = number; // 0..14

/** Lo que responde un jugador: true = "existe", false = "inventado". */
type Guess = boolean;

/** El contenido del letrero. Lo produce el sorteo desde game_data.json. */
type Toponym =
  | { name: string; real: true; comuna: string; region: string }
  | { name: string; real: false };

/** Una ronda jugada: el letrero y lo que respondió cada quien. */
interface Round {
  toponym: Toponym;
  /** Ausencia de entrada = no respondió. Escribir dos veces la misma clave es idempotente. */
  guesses: Record<PlayerId, Guess>;
}

interface Player {
  id: PlayerId;
  name: string;
}

interface Game {
  /** Correlativo dentro de la sala: 1, 2, 3… */
  number: number;
  rounds: Round[];
  /** Quiénes juegan esta partida. Crece si alguien se une a mitad. */
  participants: PlayerId[];
  current: RoundIndex;
  /** Si la ronda `current` ya fue revelada por el host. */
  revealed: boolean;
  /** epoch ms al cerrarse las 15 rondas; null mientras se juega. */
  finishedAt: number | null;
}

/** Lo que el host persiste y difunde. Única fuente de verdad. */
interface SessionState {
  /** Monotónica. Se descarta cualquier snapshot con versión menor a la ya aplicada. */
  version: number;
  code: RoomCode;
  hostId: PlayerId;
  players: Record<PlayerId, Player>;
  /** La partida en curso, o la recién cerrada mientras se muestra el resumen. */
  game: Game | null;
  /** Partidas cerradas, en orden. */
  history: Game[];
  createdAt: number;
}
```

### Invariantes

- `game.rounds.length === 15`.
- `game.participants` contiene a `hostId`.
- Toda clave de `guesses` está en `players`.
- `version` solo crece, y solo la mueve el host.

### Fases

No se guardan: se derivan, para que no puedan contradecir al resto del estado.

| Fase | Condición |
|---|---|
| Lobby | `game === null && history.length === 0` |
| Entre partidas | `game === null && history.length > 0` |
| Respondiendo | `game !== null && !game.revealed && game.finishedAt === null` |
| Revelado | `game !== null && game.revealed && game.finishedAt === null` |
| Resumen | `game?.finishedAt !== null` |

Una partida cerrada se queda en `game` mientras se muestra el resumen, y pasa a `history` recién
cuando el host arranca la siguiente. Así el resumen es un estado real y no un caso especial.

### Puntaje

Se deriva: un acierto es `round.guesses[playerId] === round.toponym.real`. El marcador de la partida
es sobre 15 para todos, incluido quien llegó tarde; las rondas que no le tocaron cuentan como no
acertadas.

`history` guarda las partidas completas, así que cualquier marcador acumulado a lo largo de una
sesión se puede calcular después sin cambiar el estado. La UI hoy muestra solo la partida actual.

## El protocolo

```ts
type ClientMessage =
  | { t: "hello"; playerId: PlayerId; name: string; haveVersion: number }
  | { t: "answer"; playerId: PlayerId; gameNumber: number; round: RoundIndex; guess: Guess }
  | { t: "ack"; playerId: PlayerId; version: number }
  | { t: "bye"; playerId: PlayerId };

type HostMessage =
  | { t: "snapshot"; state: SessionState }
  | { t: "upToDate"; version: number };
```

### Reglas

1. **Solo el host publica snapshots.** Cada cambio de estado incrementa `version` en uno.
2. **Gana la versión más alta.** Un cliente aplica un snapshot solo si su `version` supera a la que
   ya tiene. Los rezagados y los duplicados se descartan sin efecto.
3. **Las respuestas son idempotentes.** Están indexadas por `(gameNumber, round, playerId)`;
   reenviar la misma no cambia nada.
4. **El host rechaza respuestas de una ronda ya revelada**, y de un `gameNumber` que no sea el
   actual. Sin esto el puntaje cambiaría después de que todos vieron el resultado.
5. **`hello` sirve de saludo y de resincronización.** Es el mismo mensaje al entrar por primera
   vez y al volver después de cerrar la app. Lleva `haveVersion`, y el host **siempre** contesta:
   con un snapshot si el cliente está atrasado, o con `upToDate` si ya está al día. Que la respuesta
   sea segura es lo que deja al cliente distinguir *estoy sincronizado* de *no alcanzo al host*.
6. **El cliente reenvía lo que no ve confirmado.** Una respuesta se reenvía a los 2, 4 y 8 segundos
   mientras no aparezca en un snapshot.

### Una ronda

1. El host muestra el letrero. Todos están en la misma versión.
2. Un jugador toca **Existe** o **Inventado**. La UI marca su elección de inmediato y guarda la
   respuesta como pendiente; manda `answer`.
3. El host la registra, sube la versión y difunde. El cliente ve su respuesta confirmada en el
   snapshot y suelta la pendiente. Mientras no la vea, la reenvía: sin eso, un `answer` perdido no
   se notaría hasta el reveal, cuando ya no tiene arreglo.
4. El host ve *"3 de 5 respondieron"*. El botón de revelar está siempre activo: decide él, no un
   reloj ni un quórum. Quien no respondió queda sin acierto en esa ronda.
5. Al revelar, `revealed` pasa a `true`, sube la versión y se difunde. Todos ven el resultado y
   quién cayó.
6. El host avanza. El botón muestra *"4 de 5 al día"* — cuántos acusaron recibo del reveal — y
   tampoco bloquea: si alguien tiene el teléfono apagado, no secuestra la partida.

Si una respuesta llega después del reveal, el host la rechaza y esa persona figura como que no
respondió. La UI se lo dice con todas sus letras en vez de dejarla creyendo que su toque se perdió.

### Acuse de recibo y reenvíos

MQTT no ofrece confirmación extremo a extremo: el PUBACK de QoS 1 lo manda el broker, no el
suscriptor. Como el broker es público y sin garantías, un snapshot perdido dejaría a alguien pegado
en la ronda anterior **en silencio**, sin nada que lo despierte a preguntar.

Por eso cada cliente responde con `ack` de la versión que aplicó, y el host lleva la cuenta:

```ts
/** Efímero, solo en el host. No se persiste. */
interface HostRuntime {
  /** Última versión que acusó cada jugador. De acá salen los contadores de la UI. */
  acked: Record<PlayerId, number>;
  retries: Record<PlayerId, { version: number; attempt: number }>;
}

/** Solo en el cliente. `pending` se persiste; `version` es efímera. */
interface ClientRuntime {
  /** Última versión aplicada. */
  version: number;
  /** Respuesta enviada y todavía no confirmada. Se reenvía hasta verla en un snapshot. */
  pending: { gameNumber: number; round: RoundIndex; guess: Guess } | null;
}
```

Tras difundir la versión N, el host reenvía a quien no haya acusado, por su topic personal para no
repetirle el mensaje a toda la sala, con espera creciente de 2, 4 y 8 segundos. A los 30 segundos se
rinde y lo muestra como atrasado. Reenviar es inofensivo: el snapshot es absoluto y aplicarlo dos
veces no cambia nada.

Un `ack` prueba que el cliente recibió esa versión en algún momento, no que siga ahí. Es información
para el host, no un permiso: los botones de revelar y avanzar nunca se bloquean.

### Reconectarse

Quien cierra la app y vuelve conserva su `playerId`, manda `hello` con la última versión que tenía y
recibe el estado completo. Vuelve como el mismo jugador, con sus respuestas intactas, no como uno
nuevo; si tenía una respuesta sin confirmar, la reenvía.

El cliente además manda `hello` cada vez que la pestaña vuelve a primer plano, escuchando
`visibilitychange`. Ese es el caso real —el teléfono guardado en el bolsillo— y es el único
disparador del lado del cliente: fuera de eso, quien quedó atrasado depende de los reenvíos del
host. Si el `hello` no obtiene respuesta en unos segundos, la UI muestra que no alcanza al host.

Si el host cierra la app, la partida queda congelada: nadie puede avanzar, porque nadie más tiene
autoridad. Su estado está en `localStorage`, así que al reabrir retoma exactamente donde iba y
difunde. No hay elección de un host nuevo.

## El transporte

Todo lo anterior es independiente de por dónde viajen los mensajes.

```ts
interface TransportHandlers {
  onClientMessage(msg: ClientMessage): void;
  onHostMessage(msg: HostMessage): void;
}

interface Transport {
  /** Empieza a escuchar. Devuelve cómo dejar de hacerlo. */
  connect(handlers: TransportHandlers): () => void;
  send(msg: ClientMessage): void;      // cliente -> host
  broadcast(msg: HostMessage): void;   // host -> todos
  sendTo(playerId: PlayerId, msg: HostMessage): void;  // host -> uno, para reenvíos
}
```

| Implementación | Para qué |
|---|---|
| `MqttTransport` | La real. |
| `NullTransport` | No hace nada. **Es** el modo solitario. |
| `LoopbackTransport` | Varios jugadores simulados en una pestaña, para desarrollar sin broker. |
| `BroadcastChannelTransport` | Host y jugador en pestañas distintas de la misma máquina. |

`MqttTransport` se carga con `import()` dinámico al entrar a una sala, así que quien solo juega solo
nunca descarga la librería.

### Mapeo a MQTT

```
toponimo/{code}/host        host -> todos      snapshots
toponimo/{code}/c/{id}      host -> uno        reenvíos dirigidos
toponimo/{code}/in          clientes -> host   hello, answer, ack, bye
```

Los clientes se suscriben a `/host` y a su propio `/c/{id}`; el host, a `/in`.

- **Broker**: una lista de brokers públicos por `wss://`, fija en tiempo de build. Cuál se usa lo
  decide el primer carácter del código, no cada cliente. El sitio se sirve por HTTPS, así que
  `ws://` queda descartado por contenido mixto.
- **QoS 1** al publicar y al suscribirse.
- **Sesión persistente** (`clean: false`) con `clientId` derivado del `playerId`, para que una caída
  corta no pierda los mensajes que llegaron mientras tanto.
- **Cifrado**: el código de sala deriva una clave con HKDF y los payloads van con AES-GCM por
  WebCrypto, con nonce por mensaje. El topic es público; el contenido no.

## Entrar a una sala

El código son 7 caracteres del alfabeto `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, que excluye los pares que
se confunden al dictar. El primero identifica el broker; los otros seis son el secreto de la sala.
El código completo nombra el topic y deriva la clave.

Llevar el broker en el código es lo que garantiza que el host y los jugadores terminen en el mismo.
Si cada cliente eligiera por su cuenta, un failover podría partir la sala en dos mitades que no se
ven entre sí y que no dan ningún síntoma: cada una creería estar sola. El host prueba los brokers al
crear la sala, se queda con el primero que responde y lo publica en ese primer carácter. Si ese
broker se cae más tarde, la sala se pierde y el host reparte un código nuevo.

Se entra de tres formas: tecleándolo, por un link que lo lleva en el fragmento, o escaneando el QR
que el host muestra en pantalla. El QR es lo que sirve cuando están todos en la misma mesa.

Cada jugador elige su nombre al entrar; el host desambigua los repetidos.

Una sesión siempre tiene código, incluso jugando solo. No se muestra cuando no hay a quién
invitárselo, pero existir siempre es lo que permite que no haya ningún campo de modo en el estado.

## Persistencia

| Quién | Qué guarda |
|---|---|
| Host | `SessionState` completo. Es la única copia autoritativa. |
| Jugador | Su identidad y la respuesta que todavía no le confirman. |

```ts
interface Identity {
  playerId: PlayerId;
  name: string;
  lastRoomCode: RoomCode | null;
  /** Respuesta mandada y no confirmada. Persiste para poder reenviarla tras cerrar la app. */
  pending: { gameNumber: number; round: RoundIndex; guess: Guess } | null;
}
```

Un jugador no guarda el estado de la partida: al volver lo pide, y así nunca muestra algo viejo como
si fuera actual. Lo único suyo que persiste es la respuesta sin confirmar, porque es lo único que se
perdería para siempre si cierra la app en el momento justo.

## La interfaz

| Pantalla | Host | Jugador |
|---|---|---|
| Inicio | Jugar solo · Crear sala · Entrar con código | |
| Lobby | Código, QR, link, lista de jugadores, **Empezar** | Lista de jugadores, espera |
| Respondiendo | Letrero, sus botones, *"3 de 5 respondieron"*, **Revelar** | Letrero y sus botones |
| Revelado | Resultado, quién respondió qué, *"4 de 5 al día"*, **Siguiente** | Resultado y quién cayó |
| Resumen | Marcador, las 15 rondas, **Jugar otra ruta** | Marcador y las 15 rondas |

El host también juega: está en `players` y su respuesta cuenta.

Jugando solo se revela apenas se responde, sin un segundo toque. No es un modo aparte ni un ajuste:
sale de la regla *"revelar automáticamente cuando ya respondieron todos y hay un solo
participante"*. Cuando entra un segundo jugador, el reveal pasa a ser manual, que es justo lo que
corresponde.

Las pantallas se deciden mirando el estado — cuántos participantes hay, si la ronda está revelada —
y no una bandera de modo que haya que arrastrar por las props.

## Estructura

```
src/
  game/
    types.ts       Toponym, Round, Player, Game, SessionState, Identity
    toponyms.ts    pickToponyms(data) -> Toponym[]
    session.ts     reducer, acciones y selectores derivados
  net/
    transport.ts   la interfaz y los tipos de mensaje
    mqtt.ts        null.ts   loopback.ts   broadcast.ts
    crypto.ts      derivación de clave y cifrado
    code.ts        generación y validación del código
  storage/
    session.ts     persistencia del host
    identity.ts    persistencia del jugador
  hooks/
    useSession.ts  une reducer, transporte y persistencia
  components/
```

El reducer de `session.ts` es una función pura sobre `SessionState`: no conoce el transporte ni
React, y es el mismo en los dos modos.

## Límites conocidos

**El juego es trampeable.** `game_data.json` se descarga entero en cada teléfono con las listas de
nombres reales e inventados. Cualquiera puede buscar el letrero que tiene al frente. No hay defensa
posible mientras los datos sean un archivo estático público, así que no se intenta ninguna.

**Confianza total dentro de la sala.** Todos comparten la misma clave simétrica, así que quien tenga
el código puede publicar haciéndose pasar por otro, o por el host. Es un juego entre conocidos y no
se firma nada.

**El código es una clave débil.** Sus seis caracteres de secreto son unos 30 bits. Alguien que esté raspando el
broker público mientras juegas podría romperlo. Lo que protege es el descuido, no a un atacante.

**Los brokers públicos no dan garantías.** Son servicios de prueba: pueden caerse, limitar tasa o
desaparecer. Como el broker queda fijado en el código, la caída del que le tocó a una sala termina
esa sala: no hay migración en caliente. Los reenvíos cubren mensajes sueltos perdidos, no eso.

**Alrededor de ocho jugadores.** No por el protocolo, que es una estrella y manda pocos KB, sino
porque más gente en una mesa deja de ser un juego de adivinar letreros.

**El host es un punto único.** Si se va, la partida espera. Es una decisión, no un descuido: elegir
un host nuevo traería una elección, detección de ausencia y el caso de que el viejo vuelva y haya
dos.
