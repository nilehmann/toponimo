"""Genera data/processed/geo/{id}.json: un GeoJSON Feature por topónimo, listo para servir.

Cada archivo es lo que la app pide al revelar un letrero real: el contorno del lugar, un punto
para el pin y los datos de la ficha. Es GeoJSON y no un formato propio porque Leaflet lo consume
tal cual, sin traducción.

Se procesan las tres capas de las que salen los topónimos jugables, incluso las que los filtros de
`build_real.py` después descartan: así cambiar un filtro no obliga a reprocesar los 93 MB de
geometría, que es lo caro. Las 10.863 localidades tardan unos segundos; la descarga tarda más.
"""
import json
import math
from collections import defaultdict
from typing import Any, Iterator, Optional

import shapefile
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import unary_union

from common import PROCESSED, RAW, ald_id, loc_id, norm, rural_pop, urb_id, urban_pop
from export import title

# Tolerancia de simplificación en grados. 0,0003° son ~33 m, que deja unos 86 puntos por
# localidad contra los 660 del censo. Es la perilla principal para iterar sobre el peso.
TOL: float = 0.0003

# Decimales de las coordenadas. 5 son ~1 m, bastante más fino que la simplificación de arriba,
# así que no es acá donde se pierde precisión.
DEC: int = 5

# Tope por archivo. Con TOL sola, la mediana queda en 2 KB pero unas pocas localidades de
# Aysén y Magallanes se van a cientos de KB: son costas de fiordo, un solo borde continuo que
# serpentea —Puerto Edén es un polígono de 11.441 puntos—, así que no hay partes que unir y lo
# único que baja el peso es simplificar más. Los que no entran se vuelven a simplificar.
MAX_BYTES: int = 20 * 1024

OUT = PROCESSED / "geo"


def clean(geom: Any) -> Optional[Any]:
    """Arregla polígonos que se cruzan a sí mismos, que el censo trae de a ratos."""
    if geom.is_empty:
        return None
    if not geom.is_valid:
        geom = geom.buffer(0)
    return geom if not geom.is_empty and geom.is_valid else None


def round_coords(obj: Any) -> Any:
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(float(c), DEC) for c in obj]
        return [round_coords(o) for o in obj]
    return obj


def capitals() -> list[tuple[str, float, float]]:
    """Capitales regionales y provinciales, para decir a qué distancia queda el lugar.

    «A 18 km de Curicó» ubica a cualquiera; un par de coordenadas no. Son 56 nombres que todo
    el mundo conoce, que es justo lo que se necesita de una referencia.
    """
    urb = shapefile.Reader(str(RAW / "limites_urbanos_16r"))
    out: list[tuple[str, float, float]] = []
    for r, s in zip(urb.records(), urb.shapes()):
        if r["tipo"] in ("CAPITAL REGIONAL", "CAPITAL PROVINCIAL"):
            c = shape(s.__geo_interface__).centroid
            out.append((title(r["urbano"].strip()), c.x, c.y))
    return out


def km(lon_a: float, lat_a: float, lon_b: float, lat_b: float) -> float:
    r, p = 6371.0, math.pi / 180
    h = (
        math.sin((lat_b - lat_a) * p / 2) ** 2
        + math.cos(lat_a * p) * math.cos(lat_b * p) * math.sin((lon_b - lon_a) * p / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(h))


def entities() -> Iterator[tuple[str, str, str, str, Any]]:
    """(id, nombre, comuna, región, geometría) de las tres capas."""
    loc = shapefile.Reader(str(RAW / "localidades_16r"))
    for r, s in zip(loc.records(), loc.shapes()):
        key = loc_id(r["comuna"], r["distrito"], r["loc_zon"])
        yield key, r["nom_locali"], r["nom_comuna"], r["nom_region"], shape(s.__geo_interface__)

    urb = shapefile.Reader(str(RAW / "limites_urbanos_16r"))
    for r, s in zip(urb.records(), urb.shapes()):
        key = urb_id(r["comuna"], r["urbano"])
        yield key, r["urbano"], r["nom_comuna"], r["nom_region"], shape(s.__geo_interface__)

    # Una aldea son muchas manzanas censales sueltas —La Tirana tiene 181—, así que hay que
    # unirlas. La unión real y no el casco convexo: el casco rellenaría los huecos entre
    # manzanas con superficie que no es parte del pueblo.
    ald = shapefile.Reader(str(RAW / "manzanas_aldeas_16r"))
    groups: dict[tuple[str, str], list[Any]] = defaultdict(list)
    meta: dict[tuple[str, str], tuple[str, str, str]] = {}
    for r, s in zip(ald.records(), ald.shapes()):
        k = (r["comuna"], r["nom_aldea"])
        groups[k].append(shape(s.__geo_interface__))
        meta[k] = (r["nom_aldea"], r["nom_comuna"], r["nom_region"])
    for comuna, aldea in groups:
        name, nom_comuna, region = meta[(comuna, aldea)]
        pieces = [p for p in (clean(g) for g in groups[(comuna, aldea)]) if p is not None]
        if not pieces:
            continue
        yield ald_id(comuna, name), name, nom_comuna, region, unary_union(pieces)


def count_points(geom: Any) -> int:
    m = mapping(geom)
    polys = m["coordinates"] if m["type"] == "MultiPolygon" else [m["coordinates"]]
    return sum(len(ring) for poly in polys for ring in poly)


def render(props: dict[str, Any], geom: Any, refs: list[tuple[str, float, float]]) -> Optional[tuple[str, Any, int]]:
    """Simplifica subiendo la tolerancia hasta entrar en MAX_BYTES.

    Devuelve (json, geometría, intentos). No siempre se logra: una aldea de 181 manzanas
    sueltas tiene un piso, porque `preserve_topology` no deja que ninguna desaparezca.
    """
    tol: float = TOL
    text: str = ""
    simple: Any = geom
    for attempt in range(12):
        simple = clean(geom.simplify(tol, preserve_topology=True)) or geom
        if not isinstance(simple, (Polygon, MultiPolygon)):
            return None
        # Garantizado dentro del polígono, a diferencia del centroide de área, que en una
        # localidad partida por un río o con islas puede caer en el agua o en la vecina.
        pt = simple.representative_point()
        if "ref" not in props:
            near = min(refs, key=lambda c: km(pt.x, pt.y, c[1], c[2]))
            props["ref"], props["km"] = near[0], round(km(pt.x, pt.y, near[1], near[2]))
        feature: dict[str, Any] = {
            "type": "Feature",
            "properties": {**props, "point": [round(pt.x, DEC), round(pt.y, DEC)]},
            "geometry": round_coords(mapping(simple)),
        }
        text = json.dumps(feature, ensure_ascii=False, separators=(",", ":"))
        if len(text) <= MAX_BYTES:
            return text, simple, attempt
        tol *= 2
    return text, simple, 12


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.json"):
        old.unlink()

    # Localidades y áreas urbanas; las aldeas no tienen de dónde sacarla y quedan sin la línea.
    pop = rural_pop() + urban_pop()
    refs = capitals()
    n = total = points = capped = over = 0
    biggest: tuple[int, str] = (0, "")

    for key, name, comuna, region, geom in entities():
        g = clean(geom)
        if g is None:
            continue
        props: dict[str, Any] = {
            "id": key,
            "name": title(name.strip()),
            "comuna": title(comuna),
            "region": title(region),
        }
        # La capital más cercana no puede ser el lugar mismo: dejaría «A 0 km de Rancagua».
        near = [c for c in refs if norm(c[0]) != norm(name)]
        if pop.get(key):
            props["pop"] = pop[key]
        out = render(props, g, near)
        if out is None:
            continue
        text, simple, attempts = out

        (OUT / f"{key}.json").write_text(text)
        n += 1
        total += len(text)
        points += count_points(simple)
        capped += 1 if attempts else 0
        over += 1 if len(text) > MAX_BYTES else 0
        if len(text) > biggest[0]:
            biggest = (len(text), key)

    print(f"{n} topónimos en {OUT}")
    print(f"  peso total      {total / 1e6:.1f} MB")
    print(f"  promedio        {total / n / 1024:.1f} KB  ({points / n:.0f} puntos)")
    print(f"  el más pesado   {biggest[1]} con {biggest[0] / 1024:.1f} KB")
    print(f"  con población   {sum(1 for k in pop if pop[k])}")
    print(f"  simplificados de más para entrar en {MAX_BYTES // 1024} KB: {capped}")
    print(f"  no lograron entrar igual: {over}")


if __name__ == "__main__":
    main()
