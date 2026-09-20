interface SignProps {
  name: string;
  revealed: boolean;
  real: boolean;
  comuna?: string;
}

export function Sign({ name, revealed, real, comuna }: SignProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full overflow-hidden rounded-xl bg-sign p-1.5 shadow-md">
        <div className="flex min-h-44 flex-col items-center justify-center gap-1.5 rounded-lg border-4 border-white px-4 pt-5 pb-6 text-center">
          <svg viewBox="0 0 34 38" aria-hidden="true" className="h-9 w-8">
            <path d="M17 1 L33 17 H23 V37 H11 V17 H1 Z" fill="#fff" />
          </svg>
          <p className="wrap-anywhere hyphens-auto text-4xl leading-none font-extrabold text-white sm:text-5xl">
            {name}
          </p>
        </div>
        {revealed && !real && (
          <div className="pointer-events-none absolute -inset-x-8 top-5/6 -translate-y-1/2 -rotate-6 bg-warn py-1 text-center text-lg font-extrabold text-warn-ink">
            Inventado
          </div>
        )}
      </div>

      <div aria-hidden="true" className="flex w-7/12 justify-between">
        <span className="block h-8 w-2.5 rounded-b-sm bg-post" />
        <span className="block h-8 w-2.5 rounded-b-sm bg-post" />
      </div>

      {revealed && real && comuna && (
        <div className="relative -mt-6 max-w-[90%] rounded-lg border-4 border-sign bg-white px-4 py-1 text-center text-lg font-extrabold text-sign">
          {comuna}
        </div>
      )}
    </div>
  );
}
