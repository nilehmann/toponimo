import { type AnyGame, revealedToponym } from "../game/session";
import type { PlayerId, Snapshot } from "../game/types";

interface PlayersProps {
  snapshot: Snapshot;
  game: AnyGame | null;
  me: PlayerId | null;
  /** Solo lo tiene el host: hasta qué versión acusó cada quien. */
  acked?: Record<PlayerId, number>;
}

/** La lista de la sala. En el lobby son todos los que llegaron; con una partida abierta, los
 *  participantes, que es de donde sale la marca de quién respondió. */
export function Players({ snapshot, game, me, acked }: PlayersProps) {
  const ids = game ? game.participants : Object.keys(snapshot.players);
  const round = game?.rounds[game.current];
  const toponym = round ? revealedToponym(round) : null;

  return (
    <ul className="mt-6 border-t border-line">
      {ids.map((id) => {
        const player = snapshot.players[id];
        if (!player) return null;
        const guess = round?.guesses[id];
        const correct = toponym ? guess === toponym.real : null;
        const behind = acked !== undefined && id !== snapshot.hostId && (acked[id] ?? 0) < snapshot.version;
        return (
          <li key={id} className="flex items-baseline justify-between gap-3 border-b border-line py-2">
            <span className="font-semibold">
              {player.name}
              {id === me && <span className="ml-1.5 text-sm font-normal text-muted">vos</span>}
              {id === snapshot.hostId && (
                <span className="ml-1.5 text-sm font-normal text-muted">host</span>
              )}
            </span>
            <span className="shrink-0 text-right text-sm">
              {toponym ? (
                <span className={correct ? "font-semibold text-ok" : "font-semibold text-miss"}>
                  {guess === undefined ? "No respondió" : correct ? "Acertó" : "Cayó"}
                </span>
              ) : round ? (
                <span className={guess === undefined ? "text-muted" : "font-semibold text-ok"}>
                  {guess === undefined ? "Pensando" : "Respondió"}
                </span>
              ) : (
                <span className="text-muted">Listo</span>
              )}
              {behind && <span className="ml-2 text-muted">atrasado</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
