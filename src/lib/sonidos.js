// Sonidos del Bocha armados con el sintetizador del navegador: no se descarga nada.
// En iPhone suenan después del primer toque en la app y no suenan con el celular en silencio.
let contexto = null;

function audio() {
  if (contexto) return contexto;
  const Clase = window.AudioContext || window.webkitAudioContext;
  if (!Clase) return null;
  contexto = new Clase();
  return contexto;
}

// El navegador solo deja sonar después de que la persona toca algo.
export function prepararSonidos() {
  const destrabar = () => {
    const ctx = audio();
    if (ctx?.state === "suspended") ctx.resume().catch(() => {});
  };
  window.addEventListener("pointerdown", destrabar, { passive: true });
  return () => window.removeEventListener("pointerdown", destrabar);
}

function ruido(ctx, segundos) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * segundos), ctx.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < datos.length; i += 1) datos[i] = Math.random() * 2 - 1;
  const fuente = ctx.createBufferSource();
  fuente.buffer = buffer;
  return fuente;
}

// La caca que se estrella contra la pantalla: un golpe grave y un chapoteo húmedo que se apaga.
export function splat(fuerza = 1) {
  const ctx = audio();
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime;
  const salida = ctx.createGain();
  salida.gain.value = 0.55 * fuerza;
  salida.connect(ctx.destination);

  const golpe = ctx.createOscillator();
  const golpeVolumen = ctx.createGain();
  golpe.type = "sine";
  golpe.frequency.setValueAtTime(140, t);
  golpe.frequency.exponentialRampToValueAtTime(45, t + 0.18);
  golpeVolumen.gain.setValueAtTime(0.9, t);
  golpeVolumen.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  golpe.connect(golpeVolumen).connect(salida);
  golpe.start(t);
  golpe.stop(t + 0.25);

  const chapoteo = ruido(ctx, 0.45);
  const filtro = ctx.createBiquadFilter();
  const chapoteoVolumen = ctx.createGain();
  filtro.type = "lowpass";
  filtro.Q.value = 6;
  filtro.frequency.setValueAtTime(2600, t);
  filtro.frequency.exponentialRampToValueAtTime(180, t + 0.4);
  chapoteoVolumen.gain.setValueAtTime(0.001, t);
  chapoteoVolumen.gain.exponentialRampToValueAtTime(0.8, t + 0.015);
  chapoteoVolumen.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
  chapoteo.connect(filtro).connect(chapoteoVolumen).connect(salida);
  chapoteo.start(t);
}

// Una risa de villano: "jo jo jo jo" que va bajando. El Bocha Evo se ríe más grave y más largo.
export function risa({ evo = false } = {}) {
  const ctx = audio();
  if (!ctx || ctx.state !== "running") return;
  const t0 = ctx.currentTime;
  const salida = ctx.createGain();
  salida.gain.value = 0.32;
  salida.connect(ctx.destination);
  const silabas = evo ? 7 : 5;
  const base = evo ? 120 : 210;

  for (let i = 0; i < silabas; i += 1) {
    const t = t0 + i * 0.19;
    const voz = ctx.createOscillator();
    voz.type = "sawtooth";
    const tono = base * (1 - i * 0.045);
    voz.frequency.setValueAtTime(tono * 1.12, t);
    voz.frequency.exponentialRampToValueAtTime(tono, t + 0.12);

    // Dos formantes de la "o": la voz suena a boca y no a pitido.
    const volumen = ctx.createGain();
    volumen.gain.setValueAtTime(0.001, t);
    volumen.gain.exponentialRampToValueAtTime(1, t + 0.02);
    volumen.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    for (const [frecuencia, nivel] of [[500, 1], [900, 0.5]]) {
      const formante = ctx.createBiquadFilter();
      formante.type = "bandpass";
      formante.frequency.value = frecuencia;
      formante.Q.value = 5;
      const mezcla = ctx.createGain();
      mezcla.gain.value = nivel;
      voz.connect(formante).connect(mezcla).connect(volumen);
    }
    volumen.connect(salida);
    voz.start(t);
    voz.stop(t + 0.17);
  }
}
