import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

/** `export.py` escribe en data/processed/, pero Vite sirve public/. Se copia al arrancar dev y al
 *  construir, que es lo único que corre en el deploy: el workflow de Pages no ejecuta Python. */
function copyGameData(): Plugin {
  return {
    name: "copy-game-data",
    buildStart() {
      const from = resolve(root, "data/processed");
      mkdirSync(resolve(root, "public/geo"), { recursive: true });
      copyFileSync(resolve(from, "game_data.json"), resolve(root, "public/game_data.json"));

      // Solo los contornos que una partida puede llegar a pedir: `geo/` guarda las 12.089
      // entidades del censo y el juego sortea entre 3.943. El resto engordaría el sitio
      // publicado sin que nadie los pida nunca.
      const data = JSON.parse(readFileSync(resolve(from, "game_data.json"), "utf8")) as {
        R: Record<string, [string, number, number, string][]>;
      };
      for (const rows of Object.values(data.R)) {
        for (const [, , , geo] of rows) {
          if (geo) copyFileSync(resolve(from, `geo/${geo}.json`), resolve(root, `public/geo/${geo}.json`));
        }
      }
    },
  };
}

export default defineConfig({
  // El sitio se publica en nilehmann.github.io/toponimo/.
  base: "/toponimo/",
  plugins: [copyGameData(), react(), tailwindcss()],
});
