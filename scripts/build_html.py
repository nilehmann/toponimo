"""Incrusta datos y JS compilado en la plantilla -> dist/index.html (un solo archivo, sin dependencias)."""
from common import DATA, ROOT


def main() -> None:
    html = (ROOT / "src" / "template.html").read_text()
    data = (DATA / "game_data.json").read_text()
    app = (ROOT / "build" / "game.js").read_text()
    out = html.replace("/*DATA*/", f"const DATA = {data};").replace("/*APP*/", app)
    (ROOT / "dist").mkdir(exist_ok=True)
    (ROOT / "dist" / "index.html").write_text(out)


if __name__ == "__main__":
    main()
