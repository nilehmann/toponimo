import re
import unicodedata
from pathlib import Path

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
