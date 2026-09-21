import { defineConfig } from "vitest/config";

// Config aparte de `vite.config.ts` para no arrastrar los plugins del sitio a las pruebas.
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
