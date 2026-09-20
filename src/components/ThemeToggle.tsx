import type { ThemePref } from "../hooks/useTheme";

const LABELS: Record<ThemePref, string> = {
  system: "Sistema",
  light: "Claro",
  dark: "Oscuro",
};

export function ThemeToggle({ pref, onCycle }: { pref: ThemePref; onCycle: () => void }) {
  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={`Tema: ${LABELS[pref]}. Cambiar tema.`}
      className="cursor-pointer rounded-md border border-line px-2 py-1 text-sm font-semibold text-muted hover:bg-btn-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warn"
    >
      {LABELS[pref]}
    </button>
  );
}
