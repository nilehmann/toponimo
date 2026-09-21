const BASE =
  "min-h-13 cursor-pointer rounded-lg border-2 px-4 py-4 text-lg font-extrabold " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warn";

export const BUTTON_NEUTRAL = `${BASE} border-ink bg-btn text-ink hover:bg-btn-hover`;
export const BUTTON_SIGN = `${BASE} border-sign bg-sign text-white hover:bg-sign-hover`;
export const BUTTON_WARN = `${BASE} border-warn bg-warn text-warn-ink hover:bg-warn-hover`;

/** Para lo secundario: refrescar, volver, cancelar. */
export const BUTTON_GHOST =
  "cursor-pointer rounded-md border border-line px-2 py-1 text-sm font-semibold text-muted " +
  "hover:bg-btn-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warn";

export const INPUT =
  "w-full min-h-13 rounded-lg border-2 border-line bg-btn px-4 py-3 text-lg text-ink " +
  "placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warn";

export const KBD = "rounded border border-line px-1 font-semibold";

/** El anillo que marca la elección propia mientras el host no revela. */
export const SELECTED = "outline-3 outline-offset-2 outline-ink";
