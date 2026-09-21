import { useEffect, useState } from "react";

/** El QR es lo que sirve cuando están todos en la misma mesa. Se dibuja como un solo `path`
 *  para que escale sin bordes borrosos y tome los colores del tema. */
export function Qr({ value, className = "" }: { value: string; className?: string }) {
  const [code, setCode] = useState<{ path: string; size: number } | null>(null);

  useEffect(() => {
    let vigente = true;
    void import("qrcode-generator").then(({ default: qrcode }) => {
      const qr = qrcode(0, "M");
      qr.addData(value);
      qr.make();
      const size = qr.getModuleCount();
      let path = "";
      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          if (qr.isDark(row, col)) path += `M${col} ${row}h1v1h-1z`;
        }
      }
      if (vigente) setCode({ path, size });
    });
    return () => {
      vigente = false;
    };
  }, [value]);

  if (!code) return <div aria-hidden="true" className={`animate-pulse bg-line ${className}`} />;

  const margin = 2;
  const box = code.size + margin * 2;
  return (
    <svg
      viewBox={`0 0 ${box} ${box}`}
      role="img"
      aria-label="Código QR para entrar a la sala"
      className={className}
      shapeRendering="crispEdges"
    >
      <rect width={box} height={box} fill="#fff" />
      <path d={code.path} transform={`translate(${margin} ${margin})`} fill="#000" />
    </svg>
  );
}
