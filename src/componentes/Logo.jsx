import { useId } from "react";

// El logo de la app, "Disco de lomada": el círculo de la Lomada (azul, franja blanca y verde)
// con el tenedor y el cuchillo asomando por detrás, separados por un aro transparente.
// Los cubiertos toman el color del texto (currentColor): negros en claro, claros en oscuro.
// Medidas sacadas del diseño original (P Disco de lomada).
export const LOGO = {
  cx: 299,
  cy: 233.5,
  r: 177,
  corte: 199,
  azul: "#0165a0",
  verde: "#046a43",
  negro: "#2a2622",
  azulD: "M118.0,52.5 H480.0 V228.0 Q299.0,213.2 118.0,274.0 Z",
  verdeD: "M118.0,297.7 Q299.0,244.8 480.0,257.7 V414.5 H118.0 Z",
  tenedorD:
    "M36,132 H166 V190 C166,228 118,236 118,256 V413.5 A17.5,17.5 0 0 1 83,413.5 V256 C83,236 36,228 36,190 Z M35.75,48.25 A12.25,12.25 0 0 1 60.25,48.25 V140 H35.75 Z M88.25,48.5 A12.5,12.5 0 0 1 113.25,48.5 V140 H88.25 Z M141.25,48.5 A12.5,12.5 0 0 1 166.25,48.5 V140 H141.25 Z",
  cuchilloD: "M473,250 V60 C473,45 482,36 492,36 C520,40 540,90 540,150 V246 H521 V413.5 A17.5,17.5 0 0 1 486,413.5 V250 Z",
  // Caja cuadrada con el dibujo centrado.
  caja: "28 -26.5 520 520",
};

export default function Logo({ tam = 36, className = "" }) {
  const id = useId().replace(/:/g, "");
  const { cx, cy, r, corte } = LOGO;
  return (
    <svg className={`logo-app ${className}`.trim()} viewBox={LOGO.caja} width={tam} height={tam} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`disco-${id}`}><circle cx={cx} cy={cy} r={r} /></clipPath>
        <mask id={`aro-${id}`} maskUnits="userSpaceOnUse" x="-1000" y="-1000" width="3000" height="3000">
          <rect x="-1000" y="-1000" width="3000" height="3000" fill="#fff" />
          <circle cx={cx} cy={cy} r={corte} fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#aro-${id})`} fill="currentColor">
        <path d={LOGO.tenedorD} />
        <path d={LOGO.cuchilloD} />
      </g>
      <g className="logo-disco" clipPath={`url(#disco-${id})`}>
        <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill="#fff" />
        <path d={LOGO.azulD} fill={LOGO.azul} />
        <path d={LOGO.verdeD} fill={LOGO.verde} />
      </g>
    </svg>
  );
}
