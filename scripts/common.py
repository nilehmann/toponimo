import re
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any, Iterator

from dbfread import DBF

ROOT: Path = Path(__file__).resolve().parent.parent
DATA: Path = ROOT / "data"
# Lo que se baja tal cual de la fuente, y lo que generan los scripts a partir de eso. La
# división es lo que deja borrar `processed/` entero y rehacerlo sin volver a descargar.
RAW: Path = DATA / "raw"
PROCESSED: Path = DATA / "processed"


def slug(s: str) -> str:
    """Parte de nombre apta para un nombre de archivo y una URL."""
    return norm(s).replace("Ñ", "N").lower().replace(" ", "-")


# Identidad de cada entidad del censo, con la misma clave con la que el censo la identifica.
# Viven acá porque las arma `build_geo.py` al escribir los contornos y las rehace `build_real.py`
# para saber qué contorno le toca a cada topónimo: si se separaran, el juego quedaría pidiendo
# archivos que no existen. Buscar por nombre no sirve —hay 30 «El Manzano»— y el 39% de los
# nombres jugables calza con más de una entidad.
def loc_id(comuna: str, distrito: int, loc_zon: int) -> str:
    return f"l-{comuna}-{distrito}-{loc_zon}"


def urb_id(comuna: str, urbano: str) -> str:
    return f"u-{comuna}-{slug(urbano)}"


def ald_id(comuna: str, aldea: str) -> str:
    return f"a-{comuna}-{slug(aldea)}"


def norm(s: str) -> str:
    """Clave de comparación: mayúsculas, sin tildes ni puntuación, pero conserva la Ñ."""
    s = unicodedata.normalize("NFD", s.upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn" or c == "\u0303")
    return re.sub(r"[^A-Z Ñ]", "", s).strip()


def table(name: str) -> Iterator[dict[str, Any]]:
    """Filas de una tabla del censo, sin cargarla entera: las manzanas son 151.545."""
    return iter(DBF(RAW / f"{name}.dbf", encoding="utf-8"))


# Las dos mitades de la población, cada una con la clave de su capa. Están acá porque las usan
# `build_geo.py` para la ficha del lugar y `build_real.py` para desempatar los nombres repetidos,
# y tienen que dar lo mismo en los dos lados.
def rural_pop() -> Counter[str]:
    """Habitantes por localidad rural, sumando las entidades que la componen. Clave: `loc_id`."""
    pop: Counter[str] = Counter()
    for e in table("entidades_indeterminadas_16r"):
        pop[loc_id(e["comuna"], e["distrito"], e["loc_zon"])] += e["total_pers"] or 0
    return pop


def urban_pop() -> Counter[str]:
    """Habitantes por área urbana —ciudad o pueblo—. Clave: `urb_id`.

    Ninguna tabla los trae directo: la población urbana está por manzana y la manzana no nombra
    su ciudad. `zonas_16r` es el puente, porque dice a qué área urbana pertenece cada zona censal;
    se suma por zona y después se agrupa por el nombre que esa tabla les pone.

    Las aldeas quedan afuera y se quedan sin el dato: el censo las clasifica como rurales, no
    figuran en `zonas_16r`, y su capa de manzanas no trae población ni una clave con qué cruzarla.
    """
    zonas: Counter[tuple[str, int, int]] = Counter()
    for m in table("manzanas_indeterminadas_16r"):
        zonas[(m["comuna"], m["distrito"], m["loc_zon"])] += m["total_pers"] or 0
    pop: Counter[str] = Counter()
    for z in table("zonas_16r"):
        pop[urb_id(z["comuna"], z["urbano"])] += zonas[(z["comuna"], z["distrito"], z["loc_zon"])]
    return pop
