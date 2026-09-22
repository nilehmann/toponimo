"""Genera data/processed/real.json: localidades reales jugables y el listado completo de nombres para verificar inventados."""
import collections
import json
import re
from typing import Any

from dbfread import DBF

from common import PROCESSED, RAW, ald_id, loc_id, norm, rural_pop, urb_id, urban_pop

# Nombres administrativos o genéricos que no sirven como localidad.
BAD = re.compile(
    r"\d|INDETERMINAD|SECTOR|COMUNIDAD|CAMINO|RUTA|KM|KIL[OÓ]METRO|PARCELA|LOTE|FUNDO|HIJUELA|REDUCCI|"
    r"CARRETERA|CRUCE|POBLACI|VILLA |CAMPAMENTO|\bSIN\b|\(|/|\.|,|-|\b[A-Z]\b$"
)
MIN_POP, MAX_POP = 40, 3000


def read(name: str) -> list[dict[str, Any]]:
    return list(DBF(RAW / name, encoding="utf-8"))


def main() -> None:
    loc = read("localidades_16r.dbf")
    urb = read("limites_urbanos_16r.dbf")
    ald = read("manzanas_aldeas_16r.dbf")

    # Las localidades no traen población: se suma la de sus entidades rurales. Los pueblos
    # tampoco, y la suya hay que armarla por zona censal. Las aldeas se quedan en 0, así que
    # abajo solo ganan un nombre que nadie más reclame.
    pop = rural_pop() + urban_pop()

    comunas: set[str] = {norm(l["nom_comuna"]) for l in loc}
    all_names: set[str] = {norm(l["nom_locali"]) for l in loc} | comunas
    all_names |= {norm(u["urbano"]) for u in urb} | {norm(a["nom_aldea"]) for a in ald}
    # Algunos nombres son compuestos ("EL CARMEN - LA HIGUERA"): cada parte cuenta como real.
    for full in [u["urbano"] for u in urb] + [a["nom_aldea"] for a in ald]:
        all_names |= {norm(p) for p in re.split(r" - |-", full)}

    def keep(n: str) -> bool:
        return not (BAD.search(n) or norm(n) in comunas or len(n.split()) > 3 or len(n) < 4)

    # Candidatos, en el orden en que los trae el censo. Un mismo nombre puede tener varios.
    cand: list[dict[str, Any]] = []
    for l in loc:
        n: str = l["nom_locali"].strip()
        i = loc_id(l["comuna"], l["distrito"], l["loc_zon"])
        if keep(n) and MIN_POP <= pop[i] <= MAX_POP:
            cand.append({"name": n, "comuna": l["nom_comuna"], "region": l["nom_region"], "id": i})

    # Pueblos y aldeas no pasan por el filtro de tamaño: un pueblo del censo es por definición de
    # 1.001 a 5.000 habitantes, y de las aldeas no se sabe.
    extra = [(u["urbano"], u["nom_comuna"], u["nom_region"], urb_id(u["comuna"], u["urbano"]))
             for u in urb if u["nom_categ"] == "PUEBLO"]
    # La capa de aldeas viene por manzana —La Tirana son 181 filas—, así que hay que unificarlas.
    extra += list(dict.fromkeys(
        (a["nom_aldea"], a["nom_comuna"], a["nom_region"], ald_id(a["comuna"], a["nom_aldea"]))
        for a in ald))
    for n, c, r, i in extra:
        n = n.strip()
        if keep(n):
            cand.append({"name": n, "comuna": c, "region": r, "id": i})

    # Un nombre, un lugar. A 1.231 de los nombres jugables los reclama más de una entidad —hay 24
    # «El Manzano»— y hay que quedarse con una sola. Gana la más poblada, no la primera del
    # archivo: al revelar se muestran el mapa y la ficha del lugar, así que apuntar al caserío de
    # 163 habitantes existiendo el de 1.864 con ese nombre se lee como un error del juego.
    # `max` devuelve el primero de los empatados, así que los empates —que son muchos, entre
    # aldeas que van todas con 0— siguen resolviéndose por el orden del censo, como antes.
    por_nombre: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
    for c in cand:
        por_nombre[norm(c["name"])].append(c)
    real: list[dict[str, Any]] = [max(v, key=lambda c: pop[c["id"]]) for v in por_nombre.values()]

    print(len(real), "reales,", len(all_names), "nombres para verificar")
    out = {"real": real, "all": sorted(all_names)}
    PROCESSED.mkdir(parents=True, exist_ok=True)
    (PROCESSED / "real.json").write_text(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
