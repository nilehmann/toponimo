import { useCallback, useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";

const ORDER: ThemePref[] = ["system", "light", "dark"];
const KEY = "theme";

function storedPref(): ThemePref {
  try {
    const value = localStorage.getItem(KEY);
    if (value === "system" || value === "light" || value === "dark") return value;
  } catch {
    // localStorage puede estar bloqueado (modo privado); se cae a "system".
  }
  return "system";
}

/** Escribe el tema resuelto en <html data-theme>, que es lo que leen las variables del CSS. */
export function useTheme(): { pref: ThemePref; cycle: () => void } {
  const [pref, setPref] = useState<ThemePref>(storedPref);

  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = pref === "dark" || (pref === "system" && query.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      // Sin persistencia, el tema dura lo que dure la pestaña.
    }
    if (pref !== "system") return;
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [pref]);

  const cycle = useCallback(() => {
    setPref((current) => ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
  }, []);

  return { pref, cycle };
}
