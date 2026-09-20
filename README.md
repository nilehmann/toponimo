# Topónimo

¿Esta localidad chilena existe o es chamullo? 15 letreros por partida, mitad reales y mitad inventados.

`dist/index.html` es autocontenido: se abre directo o se publica en GitHub Pages.

## Reconstruir

```sh
pip install -r requirements.txt
npm install
npm run data    # opcional: data/ ya está versionado
npm run build   # src/ + data/ -> dist/index.html
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
- `dist/` y `data/*.json` son generados: se edita `src/` y `scripts/`.
