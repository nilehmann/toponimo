import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

/** `export.py` escribe en data/, pero Vite sirve public/. Se copia al arrancar dev y al construir. */
function copyGameData(): Plugin {
  return {
    name: "copy-game-data",
    buildStart() {
      mkdirSync(resolve(root, "public"), { recursive: true });
      copyFileSync(resolve(root, "data/game_data.json"), resolve(root, "public/game_data.json"));
    },
  };
}

export default defineConfig({
  // El sitio se publica en nilehmann.github.io/toponimo/.
  base: "/toponimo/",
  plugins: [copyGameData(), react(), tailwindcss()],
});
