import { useCallback, useEffect, useState } from "react";

import type { GameData } from "../game/types";

type Status =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: GameData };

/** Carga `game_data.json` desde los assets del sitio. */
export function useGameData(): Status & { retry: () => void } {
  const [status, setStatus] = useState<Status>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus({ status: "loading" });
    fetch(`${import.meta.env.BASE_URL}game_data.json`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}.`);
        return res.json() as Promise<GameData>;
      })
      .then((data) => setStatus({ status: "ready", data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setStatus({ status: "error", message: err instanceof Error ? err.message : String(err) });
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...status, retry };
}
