import { COPY } from "../copy";
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
          {COPY.connection.unreachable}
        </p>
      )}
      {late && (
        <p className="mb-2 text-sm font-semibold text-miss">
          {COPY.connection.late}
        </p>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted">
          {COPY.connection.hint}
        </p>
        <button type="button" onClick={onRefresh} className={`${BUTTON_GHOST} shrink-0`}>
          {COPY.connection.refresh}
        </button>
      </div>
    </div>
  );
}
