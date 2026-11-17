import { useId } from "react";

// El logo de la app: el plato con el círculo de Lomada adentro y los cubiertos al costado, sin fondo.
// Los cubiertos toman el color del texto (currentColor), así se ven en cualquier tema y sobre cualquier fondo.
export const TENEDOR = "M9.5 15v9a3.5 3.5 0 0 0 3.5 3.5h0a3.5 3.5 0 0 0 3.5-3.5v-9M13 15v35";
export const CUCHILLO = "M52 50V15c-3.6 1.6-5 6-5 11 0 3 1.8 5 5 5";
const ESCALA = 11.4 / 49;
const LOMADA = `translate(${32 - 50 * ESCALA} ${33 - 50 * ESCALA}) scale(${ESCALA})`;

export function Plato() {
  const id = useId().replace(/:/g, "");
  return (
    <>
      <defs><clipPath id={`lomada-${id}`}><circle cx="50" cy="50" r="49" /></clipPath></defs>
      <circle cx="32" cy="34" r="15.5" fill="#000" opacity=".14" />
      <circle cx="32" cy="33" r="15.5" fill="#fff" />
      <circle cx="32" cy="33" r="12.4" fill="none" stroke="#dcd6cf" strokeWidth=".8" />
      <g transform={LOMADA}>
        <g clipPath={`url(#lomada-${id})`}>
          <rect width="100" height="100" fill="#0165a0" />
          <path d="M0 63C25 52 60 47 100 49V100H0Z" fill="#fff" />
          <path d="M0 69C25 58 60 54 100 56V100H0Z" fill="#046a43" />
        </g>
      </g>
    </>
  );
}

export default function Logo({ tam = 36, className = "" }) {
  return (
    <svg className={`logo-app ${className}`.trim()} viewBox="4.75 6.5 52 52" width={tam} height={tam} aria-hidden="true" focusable="false">
      <Plato />
      <path d={TENEDOR} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d={CUCHILLO} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
