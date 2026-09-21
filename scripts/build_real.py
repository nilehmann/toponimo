"""Genera data/processed/real.json: localidades reales jugables y el listado completo de nombres para verificar inventados."""
import collections
import json
import re
from typing import Any

from dbfread import DBF

from common import PROCESSED, RAW, norm

# Nombres administrativos o genéricos que no sirven como localidad.
BAD = re.compile(
    r"\d|INDETERMINAD|SECTOR|COMUNIDAD|CAMINO|RUTA|KM|KIL[OÓ]METRO|PARCELA|LOTE|FUNDO|HIJUELA|REDUCCI|"
    r"CARRETERA|CRUCE|POBLACI|VILLA |CAMPAMENTO|\bSIN\b|\(|/|\.|,|-|\b[A-Z]\b$"
)
MIN_POP, MAX_POP = 40, 3000


def read(name: str) -> list[dict[str, Any]]:
    return list(DBF(RAW / name, encoding="utf-8"))


def main() -> None:
    ent = read("entidades_indeterminadas_16r.dbf")
    loc = read("localidades_16r.dbf")
    urb = read("limites_urbanos_16r.dbf")
    ald = read("manzanas_aldeas_16r.dbf")

    # Las localidades no traen población: se suma la de sus entidades rurales.
    pop: collections.Counter[str] = collections.Counter()
    for e in ent:
        pop[f"{e['comuna']}-{e['distrito']}-{e['loc_zon']}"] += e["total_pers"] or 0

    comunas: set[str] = {norm(l["nom_comuna"]) for l in loc}
    all_names: set[str] = {norm(l["nom_locali"]) for l in loc} | comunas
    all_names |= {norm(u["urbano"]) for u in urb} | {norm(a["nom_aldea"]) for a in ald}
    # Algunos nombres son compuestos ("EL CARMEN - LA HIGUERA"): cada parte cuenta como real.
    for full in [u["urbano"] for u in urb] + [a["nom_aldea"] for a in ald]:
        all_names |= {norm(p) for p in re.split(r" - |-", full)}

    real: list[dict[str, Any]] = []
    seen: set[str] = set()

    def keep(n: str) -> bool:
        k = norm(n)
        return not (BAD.search(n) or k in comunas or k in seen or len(n.split()) > 3 or len(n) < 4)

    for l in loc:
        n: str = l["nom_locali"].strip()
        p = pop.get(f"{l['comuna']}-{l['distrito']}-{l['loc_zon']}", 0)
        if keep(n) and MIN_POP <= p <= MAX_POP:
            seen.add(norm(n))
            real.append({"name": n, "comuna": l["nom_comuna"], "region": l["nom_region"]})

    # Pueblos y aldeas no tienen población en estas tablas; entran sin filtro de tamaño.
    extra = [(u["urbano"], u["nom_comuna"], u["nom_region"]) for u in urb if u["nom_categ"] == "PUEBLO"]
    extra += [(a["nom_aldea"], a["nom_comuna"], a["nom_region"]) for a in ald]
    for n, c, r in extra:
        n = n.strip()
        if keep(n):
            seen.add(norm(n))
            real.append({"name": n, "comuna": c, "region": r})

    print(len(real), "reales,", len(all_names), "nombres para verificar")
    out = {"real": real, "all": sorted(all_names)}
    PROCESSED.mkdir(parents=True, exist_ok=True)
    (PROCESSED / "real.json").write_text(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
