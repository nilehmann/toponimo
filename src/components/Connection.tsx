import { BUTTON_GHOST } from "./ui";

interface ConnectionProps {
  /** Tres `hello` seguidos sin respuesta. */
  unreachable: boolean;
  /** Su respuesta llegó después del reveal y el host la rechazó. */
  late: boolean;
  onRefresh: () => void;
}

/** Lo único que el jugador puede accionar de su conexión: volver a preguntar. De lo demás solo
 *  ve lo suyo, que es lo único sobre lo que quien mira esa pantalla puede hacer algo. */
export function Connection({ unreachable, late, onRefresh }: ConnectionProps) {
  return (
    <div className="mt-8 border-t border-line pt-3">
      {unreachable && (
        <p className="mb-2 text-sm font-semibold text-miss">
          No estamos alcanzando al host. Revisa la señal y vuelve a intentar.
        </p>
      )}
      {late && (
        <p className="mb-2 text-sm font-semibold text-miss">
          Tu respuesta llegó después de que el host revelara, así que esta ronda no te cuenta.
        </p>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted">
          Lo que ves es lo último que dijo el host. Si algo no cuadra, refresca.
        </p>
        <button type="button" onClick={onRefresh} className={`${BUTTON_GHOST} shrink-0`}>
          Refrescar
        </button>
      </div>
    </div>
  );
}
