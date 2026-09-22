"""Genera data/processed/fake.json: nombres inventados que no existen en el Censo 2017.

Todas las fuentes aleatorias comparten una semilla; reordenar las secciones cambia todos los resultados.
"""
import collections
import json
import random
import re
from typing import Any, Optional

from common import PROCESSED, norm

Real = dict[str, Any]
Model = dict[str, collections.Counter[str]]

random.seed(2026)
data: dict[str, Any] = json.loads((PROCESSED / "real.json").read_text())
real: list[Real] = data["real"]
all_norm: set[str] = set(data["all"])

ARTICLES = {"EL", "LA", "LOS", "LAS"}
SPANISH = ARTICLES | {"DE", "DEL", "SAN", "SANTA", "ALTO", "BAJO"}
# Terminaciones castellanas: se excluyen para que el modelo aprenda toponimia indígena.
SP_SUF = re.compile(
    r"(ITO|ITA|ILLO|ILLA|ILLOS|ILLAS|AL|ALES|ERO|ERA|EROS|ADA|ADO|ADOS|IDO|OS|AS|ES|ÓN|CIA|ENTO|ENTA|EZ|IA|ANTE|ENTE|ENSE)$"
)
ACCENTS = set("ÁÉÍÓÚ")
# Salidas del modelo que parecen palabras comunes; revisadas a mano.
MANUAL_REJECT = {"BELLA", "COLASA", "TOLETA"}


def zone(region: str) -> str:
    if any(x in region for x in ["ARICA", "TARAPAC", "ANTOFAGASTA", "ATACAMA", "COQUIMBO"]):
        return "norte"
    if any(x in region for x in ["BIOB", "ARAUC", "LOS R", "LOS LAGOS", "AYS", "MAGALL", "ÑUBLE"]):
        return "sur"
    return "centro"


def lev(a: str, b: str) -> int:
    """Levenshtein; devuelve 3 sin calcular si los largos difieren en más de 2."""
    if abs(len(a) - len(b)) > 2:
        return 3
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


by_len: dict[int, list[str]] = collections.defaultdict(list)
for n in sorted(all_norm):
    by_len[len(n)].append(n)


def too_close(name: str) -> bool:
    """Rechaza nombres reales o a distancia 1 de uno real (variantes de escritura)."""
    k = norm(name)
    return k in all_norm or any(lev(k, o) < 2 for L in range(len(k) - 1, len(k) + 2) for o in by_len.get(L, []))


fakes: list[dict[str, str]] = []


def add(name: str, style: str, kind: str) -> None:
    fakes.append({"name": name, "style": style, "kind": kind})


def exists(name: str) -> bool:
    return too_close(name) or any(f["name"] == name for f in fakes)


# ---------- 1. Cadena de Markov de caracteres, orden 3, un modelo por zona ----------
ORDER = 3
TARGETS = {"sur": 170, "norte": 70, "centro": 70}


def train(words: list[str]) -> Model:
    m: Model = collections.defaultdict(collections.Counter)
    for w in words:
        s = "^" * ORDER + w + "$"
        for i in range(len(s) - ORDER):
            m[s[i : i + ORDER]][s[i + ORDER]] += 1
    return m


def sample(m: Model) -> str:
    ctx, out = "^" * ORDER, ""
    while len(out) < 14:
        c = m[ctx]
        ch = random.choices(list(c), weights=list(c.values()))[0]
        if ch == "$":
            break
        out += ch
        ctx = ctx[1:] + ch
    return out


def plausible(w: str, words: list[str]) -> bool:
    k = norm(w)
    return (
        5 <= len(w) <= 11
        and sum(c in ACCENTS for c in w) <= 1
        and k[-1] in "AEIOUNLRY"
        and k not in MANUAL_REJECT
        and not SP_SUF.search(k)
        and w not in words
        and not too_close(w)
        # evita copias casi literales: mismo inicio largo y mismo final que un nombre real
        and not any(w[:6] == x[:6] and w[-4:] == x[-4:] for x in words)
    )


single: dict[str, list[tuple[str, Real]]] = collections.defaultdict(list)
for r in real:
    w = r["name"].split()
    if len(w) == 1 and not SP_SUF.search(norm(w[0])):
        single[zone(r["region"])].append((w[0], r))

for z, items in single.items():
    words = [w for w, _ in items]
    m = train(words)
    regions = collections.Counter(r["region"] for _, r in items)
    got, tries = 0, 0
    while got < TARGETS[z] and tries < 200_000:
        tries += 1
        w = sample(m)
        if not plausible(w, words):
            continue
        style = random.choices(list(regions), weights=list(regions.values()))[0]
        add(w, style, "markov")
        words.append(w)  # impide repetir el mismo inventado
        got += 1

# ---------- 2. Accidente geográfico + nombre indígena de otra localidad ----------
HEADS = "CERRO ESTERO LOMA ISLA PUNTA QUEBRADA CALETA VEGA LLANO PUERTO BAJO ALTO PAMPA ROBLE PEÑA POZO".split()
propers: list[tuple[str, Real]] = []
heads_seen: collections.Counter[str] = collections.Counter()
for r in real:
    w = r["name"].split()
    if len(w) == 2 and w[0] in HEADS:
        heads_seen[w[0]] += 1
        propers.append((w[1], r))
    elif len(w) == 1 and zone(r["region"]) == "sur":
        propers.append((w[0], r))
propers = [(p, r) for p, r in propers if not SP_SUF.search(norm(p))]
heads = [h for h, c in heads_seen.items() if c >= 3]
got = 0
while got < 110:
    h = random.choice(heads)
    p, r = random.choice(propers)
    if p in SPANISH or len(p) < 4 or exists(f"{h} {p}"):
        continue
    add(f"{h} {p}", r["region"], "head")
    got += 1

# ---------- 3. Nombre real con otro modificador de orientación o tamaño ----------
MODS = "ALTO BAJO CHICO GRANDE NORTE SUR ORIENTE PONIENTE ADENTRO AFUERA".split()
base = [
    r for r in real
    if len(r["name"].split()) == 2 and r["name"].split()[1] in MODS and r["name"].split()[0] not in SPANISH
]
got = 0
while got < 60:
    r = random.choice(base)
    a, b = r["name"].split()
    mod = random.choice([x for x in MODS if x != b])
    if norm(a).endswith("A") and mod in ("ALTO", "BAJO", "CHICO"):
        mod = mod[:-1] + "A"
    if norm(a) in ("PUERTO", "MONTE", "CERRO", "LOMA", "ALTO", "BAJO") or exists(f"{a} {mod}"):
        continue
    add(f"{a} {mod}", r["region"], "mod")
    got += 1

# ---------- 4. Artículo + sustantivo castellano poco frecuente ----------
STOP = SPANISH | set(
    "SANTO ALTA BAJA CHICO CHICA GRANDE NORTE SUR ORIENTE PONIENTE ADENTRO AFUERA NUEVO NUEVA VIEJO VIEJA CENTRO".split()
)


def article(w: str) -> Optional[str]:
    """Artículo inferido de la terminación; None si es ambigua."""
    k = norm(w)
    if k.endswith("OS"):
        return "LOS"
    if k.endswith("AS"):
        return "LAS"
    if k.endswith(("A", "ÓN", "ION", "DAD")) and not k.endswith("MA"):
        return "LA"
    if k.endswith(("O", "AL", "AR", "OR", "ÉN", "EN", "ÍN", "IN", "ILLO", "ITO", "E")):
        return "EL"
    return None


# Solo palabras que aparecen una vez en todo el censo: con palabras comunes
# ("EL PUENTE") es probable que el lugar exista fuera de este registro.
wc: collections.Counter[str] = collections.Counter(w for n in all_norm for w in n.split())
nouns: list[tuple[str, Real]] = [
    (w, r)
    for r in real
    for w in r["name"].split()
    if w not in STOP and len(w) >= 5 and SP_SUF.search(norm(w)) and article(w)
    and wc[norm(w)] == 1 and norm(w) not in all_norm
]
got, tries = 0, 0
while got < 90 and tries < 5000:  # hay menos candidatos que el objetivo; el tope evita un bucle infinito
    tries += 1
    w, r = random.choice(nouns)
    n = f"{article(w)} {w}"
    if exists(n):
        continue
    add(n, r["region"], "art")
    got += 1

# ---------- 5. San/Santa + nombre de pila ausente del censo ----------
# El censo no usa santos de calendario: hay SAN CARLITOS, SAN NICANOR, SANTA FANNY, SANTA OLGA.
# El patrón real es «San/Santa + nombre de pila», normalmente el de la familia del fundo, así que
# un nombre de pila que no esté en el censo alcanza para pasar por topónimo.
#
# La lista mezcla santos de calendario con nombres de pila a secas a propósito: entre los reales
# están los canónicos de siempre —San José, San Juan, Santa Rosa—, y si los inventados fueran solo
# rarezas, «santo conocido» pasaría a significar «real» y el prefijo volvería a delatar.
#
# «Santo X» queda afuera: el castellano solo lo usa antes de To- y Do-, y los tres santos
# plausibles con esa inicial ya están en el censo, así que no hay con qué armar uno inventado.
# `form()` en export.py tampoco lo acepta, por la misma razón.
NAMES_M = """ABELARDO ADRIÁN ALBERTO ALEJANDRO ALEJO ALFREDO AMADEO AMBROSIO ANACLETO ANICETO
ANSELMO AQUILINO ARCADIO ARMANDO ARTURO ATILIO AURELIO BALDOMERO BALTASAR BASILIO BENIGNO BENITO
BERNABÉ BONIFACIO BRUNO CALIXTO CÁNDIDO CASIMIRO CAYETANO CELESTINO CEFERINO CIPRIANO CIRIACO
CIRILO CLAUDIO CLODOMIRO CONRADO COSME DÁMASO DAMIÁN DEMETRIO DESIDERIO DIONISIO EDMUNDO EDUARDO
ELEUTERIO ELISEO EPIFANIO ERASMO ERNESTO EUSEBIO EUSTAQUIO EVARISTO EZEQUIEL FAUSTINO FEDERICO
FIDEL FILIBERTO FORTUNATO FULGENCIO GASPAR GENARO GERVASIO GONZALO GRACIANO GUMERSINDO HERIBERTO
HIGINIO HILARIO HIPÓLITO HONORIO HORACIO HUMBERTO ILDEFONSO INOCENCIO ISMAEL JACINTO JACOBO
JUSTINIANO JUSTINO LEANDRO LEOCADIO LEOPOLDO LIBORIO LISANDRO LUCAS LUCIANO MACARIO MAMERTO
MARCELO MARCIAL MARCIANO MATEO MAXIMILIANO MELCHOR MELITÓN NAZARIO NEMESIO NICASIO NORBERTO
OCTAVIO OLEGARIO OSVALDO PASCUAL PAULINO PLÁCIDO POLICARPO PORFIRIO PRIMITIVO PRUDENCIO QUINTÍN
RAMIRO REMIGIO RENATO RICARDO RIGOBERTO RÓMULO ROSENDO RUFINO RUPERTO SALOMÓN SANDALIO SATURNINO
SEGUNDO SERAFÍN SERVANDO SEVERINO SILVERIO SILVESTRE SIMEÓN SIMÓN SIXTO TADEO TELÉSFORO TEODORO
TEÓFILO TIBURCIO TIMOTEO UBALDO URBANO VALERIANO VALERIO VENANCIO VIDAL VIRGILIO WENCESLAO
ZACARÍAS ZENÓN""".split()
NAMES_F = """ADELAIDA ADELINA AGRIPINA ALBERTINA ALEJANDRINA ALTAGRACIA ANACLETA ANTONINA AQUILINA
AURORA BALBINA BASILISA BEATRIZ BENIGNA BERNARDITA BIBIANA BRÍGIDA CANDELARIA CÁNDIDA CASILDA
CASIMIRA CELEDONIA CELESTINA CESÁREA CIPRIANA CLEMENTINA CLOTILDE COLUMBA CORALIA CRESCENCIA
CUSTODIA DAMIANA DEMETRIA DOMINGA DOROTEA EDELMIRA ELEUTERIA ELODIA EMERENCIANA ENRIQUETA
ERMELINDA ESCOLÁSTICA ESPERANZA ESTEFANÍA EUFEMIA EUFRASIA EULALIA EVANGELINA FABIOLA FAUSTINA
FELICIA FERMINA FIDELIA FLAVIA FLORA FORTUNATA GENOVEVA GRISELDA HERMINIA HILDA HONORIA HORTENSIA
IDALIA ILDEFONSA ILUMINADA JACINTA JAVIERA JESUSA JOAQUINA JOVITA JUSTINA LEOCADIA LEONOR LEONTINA
LIBORIA MACARIA MANUELA MARCELINA MICAELA MODESTA NAZARIA NICOLASA NORBERTA OBDULIA OCTAVIA OTILIA
PASCUALA PASTORA PAULINA PERPETUA PETRONILA PLÁCIDA POLICARPA PORFIRIA PRUDENCIA RAMONA RESTITUTA
ROGELIA ROSALBA ROSALÍA RUFINA SABINA SALOMÉ SATURNINA SEGUNDA SERAFINA SERVANDA SEVERINA SILVANA
SILVINA SIMONA SOLEDAD TECLA TEODORA TEÓFILA TIBURCIA TIMOTEA TOMASA UBALDA URBANA ÚRSULA VALERIA
VENANCIA VERÓNICA VICENTA ZENAIDA ZOILA""".split()

# Los «San X» que el censo ya tiene sirven igual, cambiados de género: la base está atestiguada en
# esta misma toponimia, así que «Santa Baldomera» suena más de acá que un nombre sacado de la
# lista. Se exige que la base sea nombre de pila; si no, de SAN QUILCO sale «Santa Quilca».
# Y no todo masculino tiene femenino: los que no, a mano.
SWAP_REJECT = {"ALEJA"}
saints = [r for r in real if len(r["name"].split()) == 2 and r["name"].split()[0] in ("SAN", "SANTA")]
used_m = {r["name"].split()[1] for r in saints if r["name"].split()[0] == "SAN"}
used_f = {r["name"].split()[1] for r in saints if r["name"].split()[0] == "SANTA"}
swaps = sorted(
    w[:-1] + "A" for w in used_m
    if w in NAMES_M and w.endswith("O") and w[:-1] + "A" not in used_f
    and w[:-1] + "A" not in SWAP_REJECT
)

SAINT_TARGET, SWAP_TARGET = 22, 5


def saint_style() -> str:
    """Región de un San/Santa real, para que el inventado no quede sin zona."""
    return random.choice(saints)["region"]


got = 0
while got < SWAP_TARGET and swaps:
    w = swaps.pop(random.randrange(len(swaps)))
    n = f"SANTA {w}"
    if exists(n):
        continue
    add(n, saint_style(), "saint")
    got += 1

tries = 0
while got < SAINT_TARGET and tries < 5000:
    tries += 1
    # El artículo sigue la proporción de los reales, por lo mismo que `pickForm` sortea la forma
    # con los pesos de los reales: si el reparto no calzara, «Santa» sería pista.
    art = random.choices(("SAN", "SANTA"), weights=(len(used_m), len(used_f)))[0]
    n = f"{art} {random.choice(NAMES_M if art == 'SAN' else NAMES_F)}"
    if exists(n):
        continue
    add(n, saint_style(), "saint")
    got += 1

print(collections.Counter(f["kind"] for f in fakes))
(PROCESSED / "fake.json").write_text(json.dumps(fakes, ensure_ascii=False))
