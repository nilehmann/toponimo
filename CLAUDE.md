Ver README.md para el método.

- Tras editar `src/`: `npm run build` (corre `tsc` y luego Vite). Tras editar `scripts/`: `npm run data && npm run build`.
- Los colores son tokens de `@theme` en `src/index.css`; el tema oscuro solo redefine esas variables en `:root[data-theme="dark"]`. No hace falta `dark:` en las utilidades.
- Al tocar los filtros de `build_fake.py`, revisar a mano una muestra de inventados: los filtros son heurísticos y los fallos típicos son palabras comunes o casi copias de nombres reales.
