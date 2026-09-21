import type { ReactNode } from "react";

import { Home } from "./components/Home";
import { ThemeToggle } from "./components/ThemeToggle";
import { BUTTON_GHOST, BUTTON_SIGN } from "./components/ui";
import { Game } from "./Game";
import type { GameData } from "./game/types";
import { useGameData } from "./hooks/useGameData";
import { useSession } from "./hooks/useSession";
import { useTheme } from "./hooks/useTheme";
import { codeFromHash } from "./net/code";

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
      {children}
    </div>
  );
}

/** El código viaja en el fragmento, así que un link o un QR entran derecho a la sala. */
const invited = codeFromHash(typeof location === "undefined" ? "" : location.hash);

function Session({ data, theme }: { data: GameData; theme: ReturnType<typeof useTheme> }) {
  const session = useSession(data);

  if (session.status.status === "playing") return <Game session={session} theme={theme} />;

  return (
    <Screen>
      <div className="absolute top-4 right-5">
        <ThemeToggle pref={theme.pref} onCycle={theme.cycle} />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight">Topónimo</h1>

      {session.status.status === "opening" && <p className="text-muted">{session.status.message}</p>}

      {session.status.status === "failed" && (
        <>
          <p className="text-xl font-extrabold text-miss">No se pudo abrir la sala.</p>
          <p className="max-w-sm text-muted">{session.status.message}</p>
          <button type="button" onClick={session.controls.dismissError} className={BUTTON_SIGN}>
            Volver al inicio
          </button>
        </>
      )}

      {session.status.status === "home" && (
        <Home
          identity={session.identity}
          saved={session.saved}
          invited={invited}
          controls={session.controls}
        />
      )}
    </Screen>
  );
}

export default function App() {
  const theme = useTheme();
  const gameData = useGameData();

  if (gameData.status === "loading") {
    return (
      <Screen>
        <p className="text-muted">Cargando localidades…</p>
      </Screen>
    );
  }

  if (gameData.status === "error") {
    return (
      <Screen>
        <p className="text-xl font-extrabold text-miss">No se pudieron cargar las localidades.</p>
        <p className="text-muted">{gameData.message}</p>
        <button type="button" onClick={gameData.retry} className={BUTTON_GHOST}>
          Reintentar
        </button>
      </Screen>
    );
  }

  return <Session data={gameData.data} theme={theme} />;
}
