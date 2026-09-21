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
npm run data     # scripts/ -> data/*.json
```

## Datos reales

Cartografía del Censo 2017 (INE), versión de [pachadotdev/censo2017-cartografias](https://github.com/pachadotdev/censo2017-cartografias) v0.4. `download.py` lee solo 4 tablas `.dbf` (~4 MB) del zip de 1,7 GB mediante HTTP Range.

Se usan localidades rurales de 40 a 3.000 habitantes (suma de sus entidades), más pueblos y aldeas. Se excluyen los nombres de comuna y los genéricos (Sector, Km, Indeterminada…).

## Inventados

`build_fake.py` los genera de cuatro formas:

- Cadena de Markov de caracteres de orden 3, un modelo por zona (norte, centro, sur), entrenada con nombres de una palabra sin terminaciones castellanas: *Chaiguimán*.
- Accidente geográfico + nombre indígena de otra localidad: *Loma Colimahuida*.
- Nombre real con otro modificador: *Budi Norte*.
- Artículo + sustantivo que aparece una sola vez en el censo: *La Curaquilla*.

Se descarta cualquiera que esté a distancia de Levenshtein menor que 2 de alguno de los 6.561 nombres del censo (localidades, aldeas, pueblos, ciudades y comunas). "Inventado" significa ausente del Censo 2017; un nombre genérico podría existir en otra fuente.

## Detalles no obvios

- `build_fake.py` usa semilla fija y tarda alrededor de un minuto. Cambiar el orden de sus secciones o cualquier filtro cambia todos los inventados.
- `data/*.json` son generados: se edita `src/` y `scripts/`.
- `export.py` escribe `data/game_data.json`; un plugin de `vite.config.ts` lo copia a `public/`, desde donde la app lo pide con `fetch`. Ese `public/game_data.json` es una copia y no se versiona.
- `vite.config.ts` fija `base: '/toponimo/'`, la ruta del sitio en Pages. Si el repo cambia de nombre, hay que cambiarla.
- El modo en grupo no tiene un campo de modo: jugar solo es una sala de un jugador que es su propio
  host y no se conecta a ninguna parte. Lo único que cambia es el transporte.
- El tema vive en `<html data-theme>`: un script en `index.html` lo aplica antes del primer render y `useTheme` lo cicla entre sistema, claro y oscuro.
