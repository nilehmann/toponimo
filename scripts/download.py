"""Extrae del zip de cartografías del Censo 2017 (1,7 GB) solo lo que se usa, con HTTP Range."""
import io
import sys
import urllib.request
import zipfile

from common import RAW

URL: str = "https://github.com/pachadotdev/censo2017-cartografias/releases/download/v0.4/cartografias-censo2017.zip"

# Tablas de atributos: población, nombres, comuna y región.
DBF: list[str] = [
    "localidades_16r.dbf",
    "entidades_indeterminadas_16r.dbf",
    "limites_urbanos_16r.dbf",
    "manzanas_aldeas_16r.dbf",
]

# Geometría de las tres capas de las que salen los topónimos jugables. Son 79 MB contra los
# 0,6 MB de los .dbf, así que el salto por tamaño de abajo es lo que hace tolerable repetir
# la corrida. pyshp pide .shp y .shx junto al .dbf del mismo nombre.
GEO: list[str] = ["localidades_16r", "limites_urbanos_16r", "manzanas_aldeas_16r"]

FILES: list[str] = DBF + [f"{n}.{ext}" for n in GEO for ext in ("shp", "shx")]


class HttpRangeFile(io.RawIOBase):
    def __init__(self, url: str) -> None:
        with urllib.request.urlopen(urllib.request.Request(url, method="HEAD")) as r:
            self.url: str = r.geturl()  # URL final tras la redirección de GitHub
            self.size: int = int(r.headers["Content-Length"])
        self.pos: int = 0

    def seekable(self) -> bool:
        return True

    def readable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, off: int, whence: int = 0) -> int:
        self.pos = [off, self.pos + off, self.size + off][whence]
        return self.pos

    def read(self, n: int = -1) -> bytes:
        if n < 0:
            n = self.size - self.pos
        if n == 0 or self.pos >= self.size:
            return b""
        end: int = min(self.pos + n, self.size) - 1
        req = urllib.request.Request(self.url, headers={"Range": f"bytes={self.pos}-{end}"})
        with urllib.request.urlopen(req) as r:
            data: bytes = r.read()
        self.pos += len(data)
        return data


def main() -> None:
    force: bool = "--force" in sys.argv
    RAW.mkdir(parents=True, exist_ok=True)
    z = zipfile.ZipFile(HttpRangeFile(URL))  # type: ignore[arg-type]
    for name in FILES:
        dest = RAW / name
        size: int = z.getinfo(name).file_size
        # Comparar contra el tamaño que declara el índice del zip descarta además una
        # descarga cortada a la mitad, que un simple exists() daría por buena.
        if not force and dest.exists() and dest.stat().st_size == size:
            print("ya está", name)
            continue
        dest.write_bytes(z.read(name))
        print("ok", name, f"{size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
