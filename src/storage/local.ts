/** `localStorage` puede estar bloqueado (modo privado) y `setItem` puede tirar por cuota. Se
 *  resuelve en cada llamada en vez de al cargar el módulo, para no quedar pegado a un objeto
 *  que todavía no existía. */
function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = store()?.getItem(key);
    return raw === null || raw === undefined ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    // Sin persistencia la sesión dura lo que dure la pestaña, que es mejor que no jugar.
  }
}

export function remove(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {
    // Igual que arriba: no hay nada que hacer y no vale la pena romper la pantalla.
  }
}
