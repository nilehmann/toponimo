import type { ReactNode } from "react";

import { BUTTON_SIGN } from "./components/ui";
import { Game } from "./Game";
import { useGameData } from "./hooks/useGameData";
import { useTheme } from "./hooks/useTheme";

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
      {children}
    </div>
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
        <button type="button" onClick={gameData.retry} className={BUTTON_SIGN}>
          Reintentar
        </button>
      </Screen>
    );
  }

  return <Game data={gameData.data} theme={theme} />;
}
