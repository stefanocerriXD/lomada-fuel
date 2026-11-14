import { useId } from "react";

// Ilustraciones de la fiesta en vectores: se ven igual en todos los celulares y a cualquier tamaño.

// Pelota de fútbol: el pentágono del medio y los parches del borde.
export function IconoGol({ tam = 16, apagado = false, ...resto }) {
  const id = useId().replace(/:/g, "");
  const negro = apagado ? "#8a8a8e" : "#1d1d1f";
  const borde = [[12, 1.2], [22.27, 8.66], [18.35, 20.74], [5.65, 20.74], [1.73, 8.66]];
  const rayos = [[12, 8.8, 12, 5], [15.04, 11.01, 18.66, 9.84], [13.88, 14.59, 16.11, 17.66], [10.12, 14.59, 7.89, 17.66], [8.96, 11.01, 5.34, 9.84]];
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true" {...resto}>
      <defs>
        <clipPath id={`pelota-${id}`}><circle cx="12" cy="12" r="10" /></clipPath>
        <radialGradient id={`brillo-${id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor={apagado ? "#d6d6d8" : "#dfe3ea"} />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill={`url(#brillo-${id})`} />
      <g clipPath={`url(#pelota-${id})`}>
        {borde.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3.1" fill={negro} />)}
        {rayos.map(([a, b, c, d]) => <line key={`${a}-${b}`} x1={a} y1={b} x2={c} y2={d} stroke={negro} strokeWidth="1.2" />)}
      </g>
      <path d="M12 8.8 15.04 11.01 13.88 14.59 10.12 14.59 8.96 11.01Z" fill={negro} />
      <circle cx="12" cy="12" r="10" fill="none" stroke={negro} strokeWidth="1.3" />
    </svg>
  );
}

// Resaca: carita mareada (ojos en espiral, boca ondulada) con la bolsa de hielo en la cabeza.
export function IconoResaca({ tam = 16, ...resto }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true" {...resto}>
      <defs>
        <radialGradient id={`cara-${id}`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.7" stopColor="#f2c14e" />
          <stop offset="1" stopColor="#c9d77a" />
        </radialGradient>
        <linearGradient id={`hielo-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9fd8ff" />
          <stop offset="1" stopColor="#3f9be0" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="13.4" r="9.2" fill={`url(#cara-${id})`} stroke="#8a6416" strokeWidth="0.8" />
      {/* Ojos en espiral */}
      <path d="M8.6 12.3a1 1 0 1 1-1-1 1.9 1.9 0 0 1 1.9 1.9 2.7 2.7 0 0 1-2.7 2.7" fill="none" stroke="#5a3d0c" strokeWidth="1" strokeLinecap="round" />
      <path d="M16.4 12.3a1 1 0 1 1-1-1 1.9 1.9 0 0 1 1.9 1.9 2.7 2.7 0 0 1-2.7 2.7" fill="none" stroke="#5a3d0c" strokeWidth="1" strokeLinecap="round" />
      {/* Boca ondulada */}
      <path d="M8.3 18.2q1-1 2 0t2 0 2 0 2 0" fill="none" stroke="#5a3d0c" strokeWidth="1.1" strokeLinecap="round" />
      {/* Bolsa de hielo */}
      <g transform="rotate(-18 14 4.6)">
        <rect x="8.2" y="2.4" width="11.6" height="5" rx="2.5" fill={`url(#hielo-${id})`} stroke="#2d6fa6" strokeWidth="0.7" />
        <rect x="18.6" y="3.4" width="2.4" height="3" rx="0.8" fill="#e85d75" />
        <path d="M10.6 3.9h3.4" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="0.9" strokeLinecap="round" />
      </g>
      {/* Gota de transpiración */}
      <path d="M4.3 9.6c.9 1.2 1.3 2 1.3 2.6a1.3 1.3 0 0 1-2.6 0c0-.6.4-1.4 1.3-2.6Z" fill="#7cc4f5" />
    </svg>
  );
}

// Copa de cóctel con rodaja de lima.
export function IconoTrago({ tam = 16, ...resto }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true" {...resto}>
      <defs>
        <linearGradient id={`trago-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7eb6" />
          <stop offset="1" stopColor="#c13ad8" />
        </linearGradient>
      </defs>
      <path d="M3.5 4.5h17L12 13.6Z" fill={`url(#trago-${id})`} />
      <path d="M3.5 4.5h17L12 13.6Z" fill="none" stroke="#ffffff" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M12 13.6v6.1M8.2 20.4h7.6" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17.6" cy="4.4" r="2.9" fill="#b6e36b" stroke="#ffffff" strokeWidth="1" />
      <path d="M17.6 2.2v4.4M15.4 4.4h4.4" stroke="#6f9e2b" strokeWidth="0.6" />
      <circle cx="9.2" cy="8" r="0.8" fill="#ffffff" fillOpacity="0.75" />
    </svg>
  );
}

// Corona dorada para el que hizo gol.
export function IconoCorona({ tam = 16, ...resto }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden="true" {...resto}>
      <defs>
        <linearGradient id={`oro-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset="0.55" stopColor="#f5b52e" />
          <stop offset="1" stopColor="#c27c0e" />
        </linearGradient>
      </defs>
      <path d="M3 8.5 7.6 12 12 5l4.4 7L21 8.5 19.2 18H4.8Z" fill={`url(#oro-${id})`} stroke="#9a5f06" strokeWidth="0.9" strokeLinejoin="round" />
      <rect x="4.8" y="17.4" width="14.4" height="2.8" rx="1" fill={`url(#oro-${id})`} stroke="#9a5f06" strokeWidth="0.9" />
      <circle cx="12" cy="4.6" r="1.4" fill="#e8394d" stroke="#9a5f06" strokeWidth="0.6" />
      <circle cx="3" cy="8.2" r="1.2" fill="#3fa9f5" stroke="#9a5f06" strokeWidth="0.6" />
      <circle cx="21" cy="8.2" r="1.2" fill="#3fa9f5" stroke="#9a5f06" strokeWidth="0.6" />
      <circle cx="12" cy="13.6" r="1.3" fill="#2fbf71" stroke="#9a5f06" strokeWidth="0.5" />
    </svg>
  );
}

// La etiqueta al lado del nombre: dibujo + qué significa.
export function EtiquetaFiesta({ tipo, chica = false }) {
  const datos = {
    fiesta: [IconoTrago, "Fiesta"],
    gol: [IconoGol, "Gol"],
    resaca: [IconoResaca, "Resaca"],
  }[tipo];
  if (!datos) return null;
  const [Icono, texto] = datos;
  return (
    <span className={`etiqueta-fiesta ${tipo}${chica ? " chica" : ""}`}>
      <Icono tam={chica ? 13 : 15} />
      {texto}
    </span>
  );
}
