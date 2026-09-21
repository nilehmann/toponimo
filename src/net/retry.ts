/** Se reintenta solo lo que nadie puede arreglar mirando la pantalla. Las esperas se suman, así
 *  que el tercer intento cae unos catorce segundos después del cambio. */
export const RETRY_DELAYS = [2000, 4000, 8000];

/** Corre `attempt` tras cada espera y llama a `giveUp` cuando se acabaron. Devuelve cómo
 *  cancelar, que es lo que hace el acuse de recibo. */
export function backoff(attempt: (n: number) => void, giveUp: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const step = (i: number) => {
    timer = setTimeout(() => {
      attempt(i + 1);
      if (i + 1 < RETRY_DELAYS.length) step(i + 1);
      else giveUp();
    }, RETRY_DELAYS[i]);
  };
  step(0);
  return () => clearTimeout(timer);
}
