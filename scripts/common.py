import re
import unicodedata
from pathlib import Path

ROOT: Path = Path(__file__).resolve().parent.parent
DATA: Path = ROOT / "data"
# Lo que se baja tal cual de la fuente, y lo que generan los scripts a partir de eso. La
# división es lo que deja borrar `processed/` entero y rehacerlo sin volver a descargar.
RAW: Path = DATA / "raw"
PROCESSED: Path = DATA / "processed"


def norm(s: str) -> str:
    """Clave de comparación: mayúsculas, sin tildes ni puntuación, pero conserva la Ñ."""
    s = unicodedata.normalize("NFD", s.upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn" or c == "\u0303")
    return re.sub(r"[^A-Z Ñ]", "", s).strip()
