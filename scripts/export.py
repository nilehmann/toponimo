"""Genera data/processed/game_data.json, el formato compacto que se incrusta en el HTML."""
import json
import re
from typing import Any, Optional

from common import PROCESSED

LOWER_AFTER_DE = {"la", "las", "los", "el"}


def title(s: str) -> str:
    """Mayúsculas de topónimo: 'SAN JUAN DE LA COSTA' -> 'San Juan de la Costa', pero 'Padre Las Casas'."""
    out: list[str] = []
    for i, w in enumerate(s.lower().split()):
        prev = out[-1].lower() if out else ""
        lower = i > 0 and (w in ("de", "del", "y") or (w in LOWER_AFTER_DE and prev in ("de", "del")))
        out.append(w if lower else w[:1].upper() + w[1:])
    t = re.sub(r"O'h", "O'H", " ".join(out))
    if t.startswith("Región"):  # nombres oficiales con artículo en mayúscula
        for a, b in [("de los Lagos", "de Los Lagos"), ("de los Ríos", "de Los Ríos"), ("de la Araucanía", "de La Araucanía")]:
            t = t.replace(a, b)
    return t


def form(n: str) -> Optional[str]:
    """Estructura del nombre. El juego sortea la forma antes que el nombre para que no delate la respuesta.
    a: una palabra; b: dos palabras; c: artículo + palabra. El resto no se usa."""
    w = n.split()
    if len(w) == 1:
        return "a"
    if len(w) == 2 and w[0] in ("EL", "LA", "LOS", "LAS"):
        return "c"
    if len(w) == 2 and w[0] not in ("SAN", "SANTA", "SANTO"):
        return "b"
    return None


def main() -> None:
    real: list[dict[str, Any]] = json.loads((PROCESSED / "real.json").read_text())["real"]
    fake: list[dict[str, str]] = json.loads((PROCESSED / "fake.json").read_text())
    regions: list[str] = []
    comunas: list[str] = []

    def idx(lst: list[str], v: str) -> int:
        if v not in lst:
            lst.append(v)
        return lst.index(v)

    out: dict[str, Any] = {"R": {"a": [], "b": [], "c": []}, "F": {"a": [], "b": [], "c": []}}
    for r in real:
        if f := form(r["name"]):
            out["R"][f].append([title(r["name"]), idx(comunas, title(r["comuna"])), idx(regions, title(r["region"]))])
    for x in fake:
        if f := form(x["name"]):
            out["F"][f].append(title(x["name"]))
    out["regions"], out["comunas"] = regions, comunas
    print({k: {f: len(v) for f, v in out[k].items()} for k in "RF"})
    (PROCESSED / "game_data.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
