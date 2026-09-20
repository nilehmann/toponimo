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
/** Identifica al dispositivo entre reconexiones. Es lo que reconoce a quien vuelve. */
type DeviceId = string;   // uuid v4, `crypto.randomUUID()` la primera vez, nunca se regenera

/** Identifica a un jugador dentro de una sala. Lo asigna el host en orden de llegada. */
type PlayerId = string;   // "1", "2", "3"… único solo dentro de esa sala

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
  /** Quiénes cuentan ahora para *"3 de 5 respondieron"*. Crece al entrar, se achica con `bye`. */
  participants: PlayerId[];
  /** La ronda en pantalla. Al terminar se queda en 14: el fin lo marca `finishedAt`. */
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
  /** Qué dispositivo es qué jugador. Es lo que reconoce a quien vuelve. */
  devices: Record<DeviceId, PlayerId>;
  createdAt: number;
}

/** Lo que el cliente ve de una ronda. El letrero se destapa recién al revelar. */
type PublicRound =
  | { revealed: false; name: string; answered: PlayerId[] }
  | { revealed: true; toponym: Toponym; guesses: Record<PlayerId, Guess> };

/** La partida como viaja: sin las rondas que todavía no se juegan. */
type PublicGame = Omit<Game, "rounds"> & { rounds: PublicRound[] };

/** Lo que se difunde. */
type Snapshot =
  Omit<SessionState, "history" | "devices" | "game"> & { game: PublicGame | null };
```

El host persiste más de lo que manda, por dos razones distintas.

Una es el tamaño. `history` son partidas terminadas que ningún cliente muestra, y `devices` es el
mapa que reconoce a quien vuelve: los dos son asunto del host. Dejarlos fuera del cable mantiene la
difusión chica, y con ella barata la redundancia de mandar el estado entero en cada cambio.

La otra es no repartir las respuestas. `rounds` se recorta en `current + 1`, así que las rondas que
faltan no viajan; y de la ronda en curso solo va el nombre del letrero hasta que el host revela. Las
respuestas ajenas tampoco: antes del reveal se manda `answered`, quiénes respondieron, sin qué. Eso
le alcanza al jugador para ver su propia respuesta confirmada y soltar la pendiente, y al host para
su contador, sin que nadie sepa qué eligió el otro.

Esto **no** hace el juego menos trampeable: `game_data.json` sigue estando entero en cada teléfono y
quien quiera buscar el letrero que tiene al frente puede hacerlo. Lo que evita es lo que no cuesta
nada — leerse las respuestas en el estado del propio dispositivo, y ver qué contestaron los demás
antes de que se destape.

El snapshot sigue siendo absoluto: es una proyección del estado, no un delta. Aplicarlo dos veces no
cambia nada y llegar atrasado se arregla con el siguiente.

### Invariantes

Son sobre el estado del host. `PublicGame` es una proyección y no los cumple: sus rondas llegan
recortadas.

- `game.rounds.length === 15`.
- `game.participants` contiene a `hostId`.
- Toda clave de `guesses` está en `players`.
- `version` solo crece, y solo la mueve el host.

### Fases

No se guardan: se derivan, para que no puedan contradecir al resto del estado.

| Fase | Condición |
|---|---|
| Lobby | `game === null` |
| Respondiendo | `game !== null && !game.revealed && game.finishedAt === null` |
| Revelado | `game !== null && game.revealed && game.finishedAt === null` |
| Resumen | `game !== null && game.finishedAt !== null` |

Las cuatro condiciones son mutuamente excluyentes y cada fila se lee suelta, sin depender del orden
de la tabla. Vale la pena escribirlas así: `game?.finishedAt !== null` parece equivalente a la
última, pero con `game === null` da `undefined !== null`, que es `true`, y el Lobby pasaría también
por Resumen.

Una partida cerrada se queda en `game` mientras se muestra el resumen, y pasa a `history` recién
cuando el host arranca la siguiente. Así el resumen es un estado real y no un caso especial. Por eso
`game === null` significa una sola cosa: que todavía no se juega la primera partida. Después de eso
siempre hay una en `game`, en curso o mostrando su resumen, y el ciclo queda Lobby → Respondiendo ⇄
Revelado → Resumen → Respondiendo.

### Puntaje

Se deriva sobre las rondas reveladas, las únicas donde el cliente tiene con qué compararse: un
acierto es `round.guesses[playerId] === round.toponym.real`. El marcador de la partida es sobre 15
para todos, incluido quien llegó tarde; las rondas que no le tocaron cuentan como no acertadas.

Se calcula sobre quienes aparecen en las `guesses` de la partida, no sobre `participants`: ese
conjunto se achica cuando alguien manda `bye`, e irse no debería borrar un puntaje ya jugado.

`history` guarda las partidas completas, así que cualquier marcador acumulado a lo largo de una
sesión se puede calcular después sin cambiar el estado. La UI hoy muestra solo la partida actual.

## El protocolo

```ts
type ClientMessage =
  /** El único mensaje que lleva el DeviceId. */
  | { t: "hello"; deviceId: DeviceId; name: string }
  | { t: "answer"; playerId: PlayerId; gameNumber: number; round: RoundIndex; guess: Guess }
  | { t: "ack"; playerId: PlayerId; version: number }
  | { t: "bye"; playerId: PlayerId };

type HostMessage =
  /** Respuesta a `hello`: le dice al cliente quién es en esta sala. */
  | { t: "welcome"; playerId: PlayerId; state: Snapshot }
  | { t: "snapshot"; state: Snapshot };
```

### Reglas

1. **Solo el host publica snapshots.** Cada cambio de estado incrementa `version` en uno.
2. **Gana la versión más alta.** Un cliente aplica un snapshot solo si su `version` supera a la que
   ya tiene. Los rezagados y los duplicados se descartan sin efecto.
3. **Las respuestas son idempotentes.** Están indexadas por `(gameNumber, round, playerId)`;
   reenviar la misma no cambia nada.
4. **El host solo acepta la ronda en curso.** Es decir
   `gameNumber === game.number && round === game.current && !game.revealed`. Una condición en vez
   de una lista de casos: cubre la ronda ya revelada, la partida vieja y la ronda futura, que de
   otro modo se registraría antes de tiempo. Sin esto el puntaje cambiaría después de que todos
   vieron el resultado.
5. **`hello` sirve de saludo y de resincronización.** Es el mismo mensaje al entrar por primera
   vez y al volver después de cerrar la app. Lleva el `DeviceId`, y el host **siempre** contesta
   lo mismo: `welcome` con quién es y el estado entero. Una sola respuesta, sin que el cliente
   tenga que decir en qué versión viene: cuesta un snapshot cada vez que alguien vuelve a primer
   plano, y a cambio no hay dos caminos que puedan divergir. Que la respuesta sea segura es lo que
   deja al cliente distinguir *estoy sincronizado* de *no alcanzo al host*.
6. **El host reparte los `PlayerId`.** Busca el `DeviceId` en `devices`: si ya está, devuelve el
   mismo jugador de antes; si no, asigna el siguiente número y lo registra. Un `PlayerId` no se
   reutiliza dentro de una sala aunque alguien se vaya, para que el historial siga siendo legible.
   El host se queda con el `1` al crear la sala, y jugando solo ese es el único que existe. El
   cliente no puede mandar nada más hasta que el host le diga quién es.
7. **El cliente reenvía lo que no ve confirmado.** Una respuesta se reenvía a los 2, 4 y 8 segundos
   mientras su `PlayerId` no aparezca en el `answered` de esa ronda.
8. **`bye` saca de `participants`, no de `players`.** Quien avisa que se va deja de contar en
   *"3 de 5 respondieron"*, pero sigue en `players` con sus respuestas intactas y en el marcador de
   la partida. Si vuelve con `hello`, se repone. El host nunca se saca a sí mismo, que es lo que
   mantiene el invariante. Que un `bye` no llegue —en el teléfono no hay evento de cierre
   confiable— no rompe nada: el contador queda inflado y el host revela igual, que es justamente
   para lo que ese botón nunca se bloquea.

### Una ronda

1. El host muestra el letrero. Todos están en la misma versión.
2. Un jugador toca **Existe** o **Inventado**. La UI marca su elección de inmediato y guarda la
   respuesta como pendiente; manda `answer`.
3. El host la registra, sube la versión y difunde. El cliente se encuentra en `answered` y suelta
   la pendiente. Mientras no se vea ahí, la reenvía: sin eso, un `answer` perdido no se notaría
   hasta el reveal, cuando ya no tiene arreglo.
4. El host ve *"3 de 5 respondieron"*, que sale del largo de `answered`. El botón de revelar está
   siempre activo: decide él, no un reloj ni un quórum. Quien no respondió queda sin acierto en esa
   ronda. Ese contador lo puede calcular cualquiera; mostrárselo o no al jugador es una decisión de
   interfaz, no de protocolo.
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
repetirle el mensaje a toda la sala, a los 2, 4 y 8 segundos. Al tercer intento sin respuesta se
rinde y lo muestra como atrasado, unos catorce segundos después del cambio; de ahí en adelante
recuperarse es cosa del `hello` que manda el cliente al volver a primer plano. Reenviar es
inofensivo: el snapshot es absoluto y aplicarlo dos veces no cambia nada.

Un `ack` prueba que el cliente recibió esa versión en algún momento, no que siga ahí. Es información
para el host, no un permiso: los botones de revelar y avanzar nunca se bloquean.

### Reconectarse

Quien cierra la app y vuelve conserva su `DeviceId`, manda `hello` y recibe su `PlayerId` junto al
estado entero. Vuelve como el mismo jugador, con sus respuestas intactas, no
como uno nuevo. Si tenía una respuesta sin confirmar, la reenvía apenas sabe quién es.

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
toponimo/{code}/host        host -> todos      snapshots y welcome
toponimo/{code}/c/{id}      host -> uno        reenvíos dirigidos
toponimo/{code}/in          clientes -> host   hello, answer, ack, bye
```

Los clientes se suscriben a `/host` y a su propio `/c/{id}`; el host, a `/in`.

El `welcome` va por `/host` aunque sea la respuesta a una persona: `/c/{id}` no sirve, porque para
suscribirse ahí hay que saber el `PlayerId` que ese mismo mensaje viene a entregar. Cada cliente
ignora los `welcome` con otro id. Son chicos y poco frecuentes, así que recibir los ajenos sale más
barato que un topic más.

- **Broker**: una lista de brokers públicos por `wss://`, fija en tiempo de build. El primer
  carácter del código es el índice en esa lista: lo elige el host y no cada cliente, que es lo que
  impide que la sala se parta. El sitio se sirve por HTTPS, así que `ws://` queda descartado por
  contenido mixto.
- **QoS 1** al publicar y al suscribirse.
- **Sesión persistente** (`clean: false`) con `clientId` derivado del código de sala y el
  `DeviceId`, para que una caída corta no pierda los mensajes que llegaron mientras tanto. Tiene
  que salir de esos dos: el `clientId` se elige al abrir la conexión, antes del primer mensaje, así
  que no puede depender del `PlayerId`, y un `PlayerId` solo es único dentro de su sala — dos salas
  con un jugador `"2"` chocarían, y ante un `clientId` repetido el broker desconecta al anterior.
- **Sin cifrado.** Los payloads viajan en claro. Derivar una clave del código no protegía nada,
  porque el código está en el topic: cualquiera que mire el broker la tendría igual. Cifrar de
  verdad pedía un secreto que no estuviera en el topic, y no hay dónde ponerlo en algo que se
  dicta en voz alta.

## Entrar a una sala

El código son 7 caracteres del alfabeto `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, que excluye los pares que
se confunden al dictar. El primero identifica el broker; los otros seis son el secreto de la sala.
El código completo nombra el topic.

Llevar el broker en el código es lo que garantiza que el host y los jugadores terminen en el mismo.
Si cada cliente eligiera por su cuenta, un failover podría partir la sala en dos mitades que no se
ven entre sí y que no dan ningún síntoma: cada una creería estar sola. El host prueba los brokers al
crear la sala, se queda con el primero que responde y lo publica en ese primer carácter. Si ese
broker se cae más tarde, la sala se pierde y el host reparte un código nuevo.

Que el primer carácter sea el índice en la lista de brokers da por supuesto que todos están
corriendo la misma versión de la aplicación. Es razonable: el sitio es estático, todos cargan el
mismo build de Pages y una sala dura minutos, no semanas. Lo que no cubre es un código guardado de
antes de un deploy que haya cambiado la lista — apuntaría a otro broker —, pero una sala no
sobrevive a un deploy de todas formas.

Se entra de tres formas: tecleándolo, por un link que lo lleva en el fragmento, o escaneando el QR
que el host muestra en pantalla. El QR es lo que sirve cuando están todos en la misma mesa.

Cada jugador elige su nombre al entrar. Si ya hay alguien con ese nombre, el host le agrega un
número —«Nico», «Nico 2»— y se lo devuelve así en el `welcome`. Nadie queda trabado eligiendo
otro, y es el host quien decide, como con todo lo demás.

Una sesión siempre tiene código, incluso jugando solo. No se muestra cuando no hay a quién
invitárselo, pero existir siempre es lo que permite que no haya ningún campo de modo en el estado.

## Persistencia

| Quién | Qué guarda |
|---|---|
| Host | `SessionState` completo. Es la única copia autoritativa. |
| Jugador | Su identidad y la respuesta que todavía no le confirman. |

```ts
interface Identity {
  deviceId: DeviceId;
  name: string;
  lastRoomCode: RoomCode | null;
  /** Respuesta mandada y no confirmada. Persiste para poder reenviarla tras cerrar la app. */
  pending: { gameNumber: number; round: RoundIndex; guess: Guess } | null;
}
```

Un jugador no guarda el estado de la partida: al volver lo pide, y así nunca muestra algo viejo como
si fuera actual. Lo único suyo que persiste es la respuesta sin confirmar, porque es lo único que se
perdería para siempre si cierra la app en el momento justo. Tampoco guarda su `PlayerId`: se lo dice
el host en cada `hello`, que es lo correcto porque es el host quien lo reparte.

El `DeviceId` no se redistribuye: el host nunca lo pone en un snapshot, así que lo que ven los
demás es el `PlayerId`, que no significa nada fuera de esa sala y no permite reconocerte en la
siguiente. Pero tampoco es un secreto: `hello` se publica en `/in` y en claro, así que cualquiera
suscrito a ese topic —un jugador de la sala, o alguien que dio con el código— lo lee. Es privado
frente a quien está afuera, no frente a quien está adentro, que es la misma confianza que el resto
del diseño ya asume.

## La interfaz

| Pantalla | Host | Jugador |
|---|---|---|
| Inicio | Jugar solo · Crear sala · Entrar con código | |
| Lobby | Código, QR, link, lista de jugadores, **Empezar** | Lista de jugadores, espera |
| Respondiendo | Letrero, sus botones, *"3 de 5 respondieron"*, **Revelar** | Letrero y sus botones |
| Revelado | Resultado, quién respondió qué, *"4 de 5 al día"*, **Siguiente** | Resultado y quién cayó |
| Resumen | Marcador, las 15 rondas, **Jugar otra ruta** | Marcador y las 15 rondas |

El host también juega: está en `players` y su respuesta cuenta.

El jugador ve la lista de `players`, pero no quién sigue conectado: eso vive en el `acked` del host,
que es efímero y no se difunde. De conexión muestra solo lo suyo —si alcanza al host o no, que sabe
por la respuesta al `hello`—, que además es lo único que quien mira esa pantalla puede accionar.

Jugando solo se revela apenas se responde, sin un segundo toque. No es un modo aparte ni un ajuste:
sale de la regla *"revelar automáticamente cuando ya respondieron todos y hay un solo
participante"*.

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

**Confianza total dentro de la sala.** Quien tenga el código puede publicar haciéndose pasar por
otro, o por el host: nada va firmado y el host no tiene cómo verificar el `playerId` que viene en un
`answer`. Es un juego entre conocidos.

**Todo viaja en claro por un broker ajeno.** Quien se suscriba a `toponimo/#` en el broker que le
tocó a la sala ve los nombres, las respuestas y los letreros de todas las partidas en curso, sin
tener que adivinar ningún código. Los seis caracteres de secreto sirven para que nadie caiga en tu
sala por accidente, no para esconder lo que pasa adentro. Es un juego de adivinar letreros y no hay
nada ahí que valga la pena proteger, así que no se intenta.

**Los brokers públicos no dan garantías.** Son servicios de prueba: pueden caerse, limitar tasa o
desaparecer. Como el broker queda fijado en el código, la caída del que le tocó a una sala termina
esa sala: no hay migración en caliente. Los reenvíos cubren mensajes sueltos perdidos, no eso.

**Una sala no se puede revivir.** Si el host pierde su `localStorage` pierde la única copia
autoritativa, y la salida es repartir un código nuevo y que todos entren de nuevo — crear sala
sortea siempre uno nuevo, así que es lo único que se puede hacer. Reusar el código viejo sería peor
que empezar de cero: los clientes que quedaron en una versión alta descartarían cada snapshot de la
sala nueva por traer una menor, y quedarían congelados sin ningún síntoma.

**Alrededor de ocho jugadores.** No por el protocolo, que es una estrella y manda pocos KB, sino
porque más gente en una mesa deja de ser un juego de adivinar letreros.

**El host es un punto único.** Si se va, la partida espera. Es una decisión, no un descuido: elegir
un host nuevo traería una elección, detección de ausencia y el caso de que el viejo vuelva y haya
dos.
