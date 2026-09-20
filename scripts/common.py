import re
import unicodedata
from pathlib import Path

ROOT: Path = Path(__file__).resolve().parent.parent
RAW: Path = ROOT / "data" / "raw"
DATA: Path = ROOT / "data"


def norm(s: str) -> str:
    """Clave de comparación: mayúsculas, sin tildes ni puntuación, pero conserva la Ñ."""
    s = unicodedata.normalize("NFD", s.upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn" or c == "\u0303")
    return re.sub(r"[^A-Z Ñ]", "", s).strip()
