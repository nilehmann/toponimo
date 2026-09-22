import { COPY } from "../copy";
import { type AnyGame, revealedToponym } from "../game/session";
import type { PlayerId, Snapshot } from "../game/types";

interface PlayersProps {
  snapshot: Snapshot;
  game: AnyGame | null;
  me: PlayerId | null;
  /** Quiénes no acusaron el último cambio que había que acusar. Solo lo sabe el host. */
  behind?: Set<PlayerId>;
}

/** Quiénes están en la sala ahora. Con una partida abierta, de acá sale la marca de quién
 *  respondió; quien se fue no aparece, aunque sus respuestas sigan contando en el marcador. */
export function Players({ snapshot, game, me, behind }: PlayersProps) {
  const ids = snapshot.participants;
  const round = game?.rounds[game.current];
  const toponym = round ? revealedToponym(round) : null;

  return (
    <ul className="mt-6 border-t border-line">
      {ids.map((id) => {
        const player = snapshot.players[id];
        if (!player) return null;
        const guess = round?.guesses[id];
        const correct = toponym ? guess === toponym.real : null;
        return (
          <li key={id} className="flex items-baseline justify-between gap-3 border-b border-line py-2">
            <span className="font-semibold">
              {player.name}
              {id === me && <span className="ml-1.5 text-sm font-normal text-muted">{COPY.players.me}</span>}
              {id === snapshot.hostId && (
                <span className="ml-1.5 text-sm font-normal text-muted">{COPY.players.host}</span>
              )}
            </span>
            <span className="shrink-0 text-right text-sm">
              {game === null ? null : toponym ? (
                <span className={correct ? "font-semibold text-ok" : "font-semibold text-miss"}>
                  {guess === undefined
                    ? COPY.players.noAnswer
                    : correct
                      ? COPY.players.right
                      : COPY.players.wrong}
                </span>
              ) : (
                <span className={guess === undefined ? "text-muted" : "font-semibold text-ok"}>
                  {guess === undefined ? COPY.players.thinking : COPY.players.answered}
                </span>
              )}
              {behind?.has(id) && <span className="ml-2 text-muted">{COPY.players.behind}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
