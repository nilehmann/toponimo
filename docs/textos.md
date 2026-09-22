# Textos de interfaz

Todo lo que la aplicación le muestra o le lee a quien juega, ordenado por pantalla. Las
referencias apuntan a la línea donde vive el texto; entre llaves van las partes que se
completan en tiempo de ejecución. Los comentarios del código, los mensajes de `console` y los
errores internos que nunca llegan a la pantalla quedan fuera.

## Documento y marco común

| Texto | Dónde | Notas |
|---|---|---|
| Topónimo · Localidades de Chile | `index.html:6` | `<title>` de la pestaña |
| Topónimo | `src/App.tsx:39`, `src/Game.tsx:216` | Título grande en el inicio; en la partida es un botón que vuelve al inicio |
| Salir | `src/Game.tsx:229` | Pie de toda pantalla de partida |
| Localidades, aldeas y pueblos reales tomados de la cartografía del Censo 2017 (INE). Los nombres inventados se generaron a partir de esos mismos nombres y se verificó que no aparezcan en ese registro. | `src/Game.tsx:232` | Pie de toda pantalla de partida |

### Selector de tema (`src/components/ThemeToggle.tsx`)

| Texto | Dónde | Notas |
|---|---|---|
| Sistema · Claro · Oscuro | `:855-857` | Opciones del menú |
| Tema: {opción}. Cambiar tema. | `:923` | `aria-label` del botón |
| Tema: {opción} | `:924` | `title` (tooltip) del botón |
| Tema | `:935` | `aria-label` del menú |

## Carga de datos (`src/App.tsx`)

| Texto | Dónde | Notas |
|---|---|---|
| Cargando localidades… | `:72` | |
| No se pudieron cargar las localidades. | `:80` | Título del error |
| {mensaje} | `:81` | Ver [Mensajes de error](#mensajes-de-error) |
| Reintentar | `:83` | |

## Inicio (`src/components/Home.tsx`)

### Menú

| Texto | Dónde | Notas |
|---|---|---|
| Quince letreros por partida, mitad reales y mitad chamullo. Sola, o con quien tengas al lado. | `:168` | |
| Retomar {la sala CÓDIGO \| tu partida} | `:132-133` | Hay partida guardada, todavía en el lobby |
| Retomar {la sala CÓDIGO \| tu partida} en la ronda {n} | `:135` | |
| Volver al resumen de {la sala CÓDIGO \| tu partida} | `:134` | La partida guardada ya terminó |
| Olvidar la sala · Olvidar la partida | `:189` | Debajo de cada botón de retomar |
| Volver a la sala {CÓDIGO} | `:200` | Quien era jugador y cerró la app |
| Jugar solo | `:204` | |
| Crear sala | `:207` | |
| Entrar con código | `:210` | |

### Formulario de crear o entrar

| Texto | Dónde | Notas |
|---|---|---|
| Crear una sala · Entrar a una sala | `:222` | Título |
| Código de la sala | `:226` | Etiqueta, solo al entrar |
| 7 caracteres | `:229` | Placeholder del código |
| Tu nombre | `:236` | Etiqueta |
| Como te dicen | `:239` | Placeholder del nombre |
| Crear la sala · Entrar | `:248` | Botón de enviar |
| Volver | `:251` | |

### Mientras se abre la sesión (`src/hooks/useSession.ts`, se muestran en `src/App.tsx:41`)

| Texto | Dónde | Notas |
|---|---|---|
| Sorteando letreros… | `:139` | Jugar solo |
| Buscando un broker… | `:155` | Crear sala |
| Entrando a la sala… | `:173` | Entrar con código o volver a la sala |
| Reabriendo la sala… · Retomando la partida… | `:192` | Retomar sala o partida guardada |

### Si no se pudo abrir (`src/App.tsx`)

| Texto | Dónde | Notas |
|---|---|---|
| No se pudo abrir la sala. | `:45` | Título; sale también al fallar «Jugar solo» o «Retomar tu partida» |
| {mensaje} | `:46` | Ver [Mensajes de error](#mensajes-de-error) |
| Volver al inicio | `:48` | |

## Esperando identidad (`src/Game.tsx`)

| Texto | Dónde | Notas |
|---|---|---|
| Preguntándole al host quién eres… | `:84` | Hasta que llega el `welcome`; debajo va el bloque de conexión |

## Lobby (`src/components/Lobby.tsx`)

| Texto | Dónde | Notas |
|---|---|---|
| Cuando estén todos, empiezan. El host reparte los letreros y decide cuándo se revela cada uno. | `:310` | Host |
| Ya estás en la sala. Empieza cuando el host lo diga. | `:311` | Jugador |
| Pásales el código, el link o el QR | `:284` | Host, solo en sala |
| {ABC DEF1} | `:285` | El código, en grupos de a tres |
| Copiar link · Link copiado | `:297` | |
| Código QR para entrar a la sala | `src/components/Qr.tsx:581` | `aria-label` del QR |
| No se pudo dibujar el QR. Pásales el código o el link. | `src/components/Qr.tsx:569` | Si falla la carga del generador |
| Estás solo · {n} en la sala | `:317` | Título de la lista |
| Empezar la ruta | `:323` | Host |
| Esperando a que el host empiece. | `:326` | Jugador |

## Ronda

### Encabezado y progreso

| Texto | Dónde | Notas |
|---|---|---|
| Ronda {n} de 15 | `src/Game.tsx:110` | |
| {n} acierto · {n} aciertos | `src/Game.tsx:113` | |
| Progreso | `src/components/Ticks.tsx:978` | `aria-label` de la barra |
| Ronda {n} | `src/components/Ticks.tsx:982` | `aria-label` de cada marca |
| Cada letrero indica una localidad rural de Chile, o un nombre inventado para confundirte. | `src/Game.tsx:138` | Mientras se responde |

### Respuesta (`src/components/Choices.tsx`)

| Texto | Dónde | Notas |
|---|---|---|
| Existe · Inventado | `:23`, `:31` | |
| Teclado: E existe, I inventado | `:39` | Se reemplaza por el conteo de abajo al responder, si hay más de uno |

### Quién falta (`src/Game.tsx`)

| Texto | Dónde | Notas |
|---|---|---|
| Respondieron todos. · Falta uno por responder. · Faltan {n} por responder. | `:37-38` | Bajo los botones y como título de la lista |
| La sala | `:170` | Título de la lista cuando no hay conteo |
| Quién cayó | `:170` | Título de la lista tras revelar |
| Revelar el letrero | `:179` | Host |

### Lista de jugadores (`src/components/Players.tsx`)

| Texto | Dónde | Notas |
|---|---|---|
| tú · host | `:510`, `:512` | Marcas junto al nombre |
| Pensando · Respondió | `:522` | Antes de revelar |
| Acertó · Cayó · No respondió | `:518` | Después de revelar |
| atrasado | `:525` | Solo lo ve el host |

### Revelación (`src/components/Reveal.tsx`, `Sign.tsx`, `Place.tsx`)

| Texto | Dónde | Notas |
|---|---|---|
| Correcto, existe. · Correcto, es inventado. | `Reveal.tsx:599` | Acertó |
| Existe. · Es inventado. | `Reveal.tsx:597-598` | Falló o no respondió |
| Inventado | `Sign.tsx:681` | Franja cruzada sobre el letrero |
| {comuna} | `Sign.tsx:693` | Placa bajo el letrero real sin mapa |
| Comuna de {comuna}, {región}. | `Reveal.tsx:625`, `Place.tsx:462` | |
| Este nombre no figura entre las localidades del Censo 2017. | `Reveal.tsx:626` | |
| Mapa de {nombre} | `Place.tsx:454` | `aria-label` del mapa |
| No se pudo cargar el mapa. | `Place.tsx:448` | |
| Habitantes | `Place.tsx:468` | Ficha; el número va con formato `es-CL` |
| Referencia · {n} km de {lugar} | `Place.tsx:471-473` | Ficha |
| © OpenStreetMap | `Place.tsx:363` | Crédito del mapa |

### Avanzar (`src/components/Reveal.tsx`)

| Texto | Dónde | Notas |
|---|---|---|
| Siguiente letrero · Ver resultado | `:648` | Host; el segundo en la última ronda |
| {n} de {total} al día | `src/Game.tsx:100` | Debajo del botón, en sala |
| Esperando al host. · Esperando el resultado. | `:653` | Jugador |

## Resumen (`src/components/Summary.tsx`)

| Texto | Dónde | Notas |
|---|---|---|
| Tu resultado · El marcador | `:731` | Solo o en grupo |
| {n} de 15 | `:734` | |
| Ruta completa sin un error. | `:708` | 15 aciertos |
| Conoces bien los caminos rurales. | `:709` | 12 o más |
| Más acierto que azar. | `:710` | 9 o más |
| Los nombres inventados te engañaron seguido. | `:711` | Menos de 9 |
| tú | `:748` | En el marcador |
| Existe, en {comuna} · Inventado | `:766` | Detalle de cada letrero |
| Acertaste · Fallaste · Sin responder | `:771` | |
| Jugar otra ruta | `:780` | Host |
| Esperando a que el host reparta otra ruta. | `:784` | Jugador |

## Conexión del jugador (`src/components/Connection.tsx`)

| Texto | Dónde | Notas |
|---|---|---|
| No estamos alcanzando al host. Revisa la señal y vuelve a intentar. | `:64` | `unreachable` |
| Tu respuesta llegó después de que el host revelara, así que esta ronda no te cuenta. | `:69` | `late` |
| Lo que ves es lo último que dijo el host. Si algo no cuadra, refresca. | `:74` | Siempre |
| Refrescar | `:77` | |

## Mensajes de error

Llegan a la pantalla tal cual, como `message` de un `Error`.

| Texto | Dónde | Se ve en |
|---|---|---|
| El servidor respondió {status}. | `src/hooks/useGameData.ts:20` | Carga de datos |
| Ese código no corresponde a ninguna sala. | `src/net/mqtt.ts:163` | No se pudo abrir la sala |
| Ningún broker contestó. {url} no contestó; {url} no contestó… | `src/net/mqtt.ts:180`, `:65` | No se pudo abrir la sala |
| {mensaje de la librería MQTT o del navegador} | `src/net/mqtt.ts:86` | No se pudo abrir la sala; sin traducir |

## Banco de pruebas (`#banco`, solo desarrollo)

| Texto | Dónde |
|---|---|
| Armando el banco… | `src/App.tsx:91` |
| Banco de pruebas · sala {código} | `src/dev/Harness.tsx:127` |
| tirar difusiones · tirar respuestas · tirar hellos | `src/dev/Harness.tsx:25-27` |
| Agregar jugador | `src/dev/Harness.tsx:143` |
| host · no alcanza al host | `src/dev/Harness.tsx:72-73` |
| Nico, Ana, Beto, Caro, Dani, Eli, Fabi, Gabo | `src/dev/Harness.tsx:30`, `:106` |

## Cosas que saltan a la vista

Observaciones al recolectar; nada de esto está cambiado.

- **Trato y género.** Todo va de «tú» (`Revisa`, `Conoces`, `Acertaste`), pero el nombre por
  defecto de quien juega solo es «Vos» (`src/hooks/useSession.ts:144`). Hoy no se ve en ninguna
  pantalla, porque en solitario no se muestran ni la lista ni el marcador. El inicio dice «Sola, o
  con quien tengas al lado» y el lobby «Estás solo»; el botón es «Jugar solo».
- **«Host» y «broker»** quedan en inglés. «Buscando un broker…» y «Ningún broker contestó» son
  lo único que expone un término de infraestructura.
- **Errores técnicos a la vista.** «Ningún broker contestó» arrastra las URLs `wss://` de cada
  broker, y cualquier error de la librería MQTT se muestra sin traducir.
- **Controles de Leaflet** en inglés: los botones de zoom traen `title` «Zoom in» / «Zoom out»
  y el crédito agrega el enlace «Leaflet» por defecto; ninguno está configurado en `Place.tsx`.
- **«Existe» / «Inventado»** son los dos botones, pero la revelación dice «Es inventado.» y el
  resumen «Inventado» a secas; la franja del letrero también dice «Inventado».
