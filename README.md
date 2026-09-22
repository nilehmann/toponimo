# Topónimo

¿Esta localidad chilena existe o es chamullo? 15 letreros por partida, mitad reales y mitad inventados.

Se juega solo o en grupo, cada uno en su teléfono, sin backend: los mensajes van por un broker MQTT
público. El diseño del modo en grupo está en [`docs/multijugador.md`](docs/multijugador.md).

Aplicación React (Vite + Tailwind). Se publica en GitHub Pages desde `.github/workflows/pages.yml`.

## Correr

```sh
npm install
npm run dev      # servidor de desarrollo
npm run build    # tsc, pruebas y -> dist/
npm test         # solo las pruebas
npm run preview  # sirve dist/ como en producción
```

Dos atajos para probar el modo en grupo sin broker:

- `#banco` monta host y jugadores simulados en una sola pestaña, con casillas para tirar
  difusiones, respuestas o hellos y ver los reenvíos en acción.
- `?transporte=local` cambia MQTT por un `BroadcastChannel`, que llega a otras pestañas de la
  misma máquina. Ahí la identidad va a `sessionStorage`, así que cada pestaña es un dispositivo.

Para regenerar los datos, que ya vienen versionados:

```sh
pip install -r requirements.txt
npm run data     # scripts/ -> data/processed/*.json
```

## Datos reales

Cartografía del Censo 2017 (INE), versión de [pachadotdev/censo2017-cartografias](https://github.com/pachadotdev/censo2017-cartografias) v0.4. `download.py` lee solo 4 tablas `.dbf` (~4 MB) del zip de 1,7 GB mediante HTTP Range.

Se usan localidades rurales de 40 a 3.000 habitantes (suma de sus entidades), más pueblos y aldeas. Se excluyen los nombres de comuna y los genéricos (Sector, Km, Indeterminada…).

## Geometría

`download.py` baja además los `.shp` de las tres capas (79 MB, contra 0,6 MB de solo los `.dbf`) y
`build_geo.py` escribe un GeoJSON Feature por topónimo en `data/processed/geo/{id}.json`: el
contorno del lugar, un punto garantizado dentro para el pin, y en `properties` lo que muestra la
ficha —habitantes cuando el censo los trae, y a cuántos kilómetros queda la capital regional o
provincial más cercana—. Los 3.943 topónimos jugables tienen geometría; la mediana pesa 2 KB y el
máximo 30 KB.

Cada fila de `game_data.json` lleva el id de su contorno. Va el id y no el nombre porque los
nombres se repiten entre comunas —hay 30 «El Manzano»— y el 39% de los nombres jugables calza con
más de una entidad del censo: buscar por nombre mostraba el pueblo equivocado. Los ids los arman
las funciones de `common.py` que comparten `build_geo.py` y `build_real.py`.

Las aldeas vienen partidas en manzanas censales —La Tirana son 181— y se unen con `shapely`. Los
polígonos que se pasan de 20 KB se vuelven a simplificar: son costas de fiordo de Aysén y
Magallanes, un solo borde continuo de miles de vértices que a escala de pantalla no se distingue.

Esto no corre en `npm run data`: se hace a mano cuando hace falta.

## Mapa

Al revelar un nombre real el letrero deja paso a `Place.tsx`: un mapa de Leaflet con el contorno
encima, el pin en el punto representativo, y debajo la ficha del lugar. Los nombres inventados no
tienen mapa —no hay dónde ir— y se quedan con el letrero y su sello.

El mapa base son los tiles estándar de OpenStreetMap, sin clave y sin cuenta. Cambiar de proveedor
es cambiar la URL y el crédito al principio de `Place.tsx`. Un reveal pide media docena de tiles,
bien dentro de la [política de uso](https://operations.osmfoundation.org/policies/tiles/) del
servidor de la OSMF.

Hay un solo estilo, así que el mapa se ve igual con el tema claro y con el oscuro. Teñirlo por CSS
para que siga al tema es lo que habría que hacer para acompañarlo, y se decidió no hacerlo.

No hay clave de API, y no la habría aunque quisiéramos esconderla: el sitio es estático, así que
cualquier clave del bundle es pública. Eso descartó a CARTO, que desde agosto de 2026 marca con
agua los tiles pedidos sin clave, y a Stadia, que autoriza por dominio o por clave.

El contorno se busca en `geo/{id}.json` del propio sitio, así que el plugin de `vite.config.ts`
copia a `public/geo/` los 3.943 que una partida puede llegar a pedir —de los 12.089 que tiene
`data/processed/geo/`— y son unos 11 MB del sitio publicado.

## Inventados

`build_fake.py` los genera de cinco formas:

- Cadena de Markov de caracteres de orden 3, un modelo por zona (norte, centro, sur), entrenada con nombres de una palabra sin terminaciones castellanas: *Chaiguimán*.
- Accidente geográfico + nombre indígena de otra localidad: *Loma Colimahuida*.
- Nombre real con otro modificador: *Budi Norte*.
- Artículo + sustantivo que aparece una sola vez en el censo: *La Curaquilla*.
- San/Santa + nombre de pila ausente del censo: *San Clodomiro*. El censo no usa santos de calendario —hay San Carlitos, Santa Fanny, Santa Olga—, así que el patrón es «San/Santa + nombre de pila». Algunos salen de cambiarle el género a un San que sí existe: de San Baldomero, *Santa Baldomera*.

Se descarta cualquiera que esté a distancia de Levenshtein menor que 2 de alguno de los 6.561 nombres del censo (localidades, aldeas, pueblos, ciudades y comunas). "Inventado" significa ausente del Censo 2017; un nombre genérico podría existir en otra fuente.

## Detalles no obvios

- `build_fake.py` usa semilla fija y tarda alrededor de un minuto. Cambiar el orden de sus secciones o cualquier filtro cambia todos los inventados. Una sección nueva al final no: las anteriores consumen el azar antes que ella y salen igual.
- `data/` se divide en dos: `raw/` es lo que se baja tal cual del censo y no se versiona;
  `processed/` es todo lo que generan los scripts y sí se versiona. Se edita `src/` y `scripts/`,
  nunca `processed/`.
- `export.py` escribe `data/processed/game_data.json`; un plugin de `vite.config.ts` lo copia a
  `public/` junto con los contornos, desde donde la app los pide con `fetch`. Esas copias no se
  versionan. El deploy de Pages corre solo `npm ci && npm run build`, sin Python: por eso
  `data/processed/` sí se versiona.
- `vite.config.ts` fija `base: '/toponimo/'`, la ruta del sitio en Pages. Si el repo cambia de nombre, hay que cambiarla.
- El modo en grupo no tiene un campo de modo: jugar solo es una sala de un jugador que es su propio
  host y no se conecta a ninguna parte. Lo único que cambia es el transporte.
- El tema vive en `<html data-theme>`: un script en `index.html` lo aplica antes del primer render y `useTheme` lo cicla entre sistema, claro y oscuro.
