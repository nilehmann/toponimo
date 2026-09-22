import { useState } from "react";

import { COPY } from "../copy";
import type { PlayerId, RoomCode, Snapshot } from "../game/types";
import { roomLink } from "../net/code";
import { Players } from "./Players";
import { Qr } from "./Qr";
import { BUTTON_GHOST, BUTTON_SIGN } from "./ui";

interface LobbyProps {
  snapshot: Snapshot;
  me: PlayerId | null;
  /** null jugando solo: la sala tiene código igual, pero no hay a quién invitárselo. */
  code: RoomCode | null;
  onStart?: () => void;
}

/** El código se muestra en grupos de a tres para que se dicte sin perder el hilo. */
function spaced(code: RoomCode): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function Invite({ code }: { code: RoomCode }) {
  const link = roomLink(code);
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <p className="text-sm text-muted">{COPY.lobby.invite}</p>
      <p className="font-mono text-4xl font-extrabold tracking-[0.2em] text-sign">{spaced(code)}</p>
      <Qr value={link} className="h-44 w-44 rounded-lg border-4 border-white shadow-md" />
      <button
        type="button"
        className={BUTTON_GHOST}
        onClick={() => {
          void navigator.clipboard?.writeText(link).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
      >
        {copied ? COPY.lobby.linkCopied : COPY.lobby.copyLink}
      </button>
    </div>
  );
}

export function Lobby({ snapshot, me, code, onStart }: LobbyProps) {
  const waiting = snapshot.participants.length;

  return (
    <section aria-live="polite">
      <p className="mt-1.5 max-w-lg text-muted">
        {onStart
          ? COPY.lobby.hostIntro
          : COPY.lobby.guestIntro}
      </p>

      {code && onStart && <Invite code={code} />}

      <h2 className="mt-8 text-base font-semibold text-muted">
        {COPY.lobby.count(waiting)}
      </h2>
      <Players snapshot={snapshot} game={null} me={me} />

      {onStart ? (
        <button type="button" onClick={onStart} className={`${BUTTON_SIGN} mt-6 w-full`}>
          {COPY.lobby.start}
        </button>
      ) : (
        <p className="mt-6 text-center text-sm text-muted">{COPY.lobby.waitingStart}</p>
      )}
    </section>
  );
}
