/** Dónde guardar. `session` es por pestaña y sobrevive a recargar. */
export type Scope = "local" | "session";

/** El almacenamiento puede estar bloqueado (modo privado) y `setItem` puede tirar por cuota. Se
 *  resuelve en cada llamada en vez de al cargar el módulo, para no quedar pegado a un objeto
 *  que todavía no existía. */
function store(scope: Scope): Storage | null {
  try {
    return (scope === "session" ? globalThis.sessionStorage : globalThis.localStorage) ?? null;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, scope: Scope = "local"): T | null {
  try {
    const raw = store(scope)?.getItem(key);
    return raw === null || raw === undefined ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown, scope: Scope = "local"): void {
  try {
    store(scope)?.setItem(key, JSON.stringify(value));
  } catch {
    // Sin persistencia la sesión dura lo que dure la pestaña, que es mejor que no jugar.
  }
}

export function remove(key: string, scope: Scope = "local"): void {
  try {
    store(scope)?.removeItem(key);
  } catch {
    // Igual que arriba: no hay nada que hacer y no vale la pena romper la pantalla.
  }
}

/** `?transporte=local` sirve para probar con dos pestañas de la misma máquina, y ahí compartir
 *  `localStorage` haría que las dos fueran el mismo dispositivo: el host les daría el mismo
 *  PlayerId y no habría sala que probar. `sessionStorage` es por pestaña. */
export function scopeForTesting(local: boolean): Scope {
  return local ? "session" : "local";
}
