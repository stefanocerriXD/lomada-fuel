// Los sonidos de la app, armados con el sintetizador del navegador: no se descarga nada.
// En iPhone suenan después del primer toque en la app y no suenan con el celular en silencio.
// Se pueden apagar en Ajustes > Apariencia (se recuerda en este celu).
let contexto = null;
const CLAVE = "lomada-sonidos";

export function sonidosPrendidos() {
  try {
    return localStorage.getItem(CLAVE) !== "no";
  } catch {
    return true;
  }
}

export function prenderSonidos(si) {
  try {
    localStorage.setItem(CLAVE, si ? "si" : "no");
  } catch {
    // Sin memoria en este navegador: queda como estaba.
  }
}

function audio() {
  if (contexto) return contexto;
  const Clase = window.AudioContext || window.webkitAudioContext;
  if (!Clase) return null;
  // "ambient": en iPhone respeta la tecla de silencio y no corta la música que esté sonando.
  try {
    if (navigator.audioSession) navigator.audioSession.type = "ambient";
  } catch {
    // Navegador sin audioSession.
  }
  contexto = new Clase();
  return contexto;
}

// Listo para sonar: prendido, con audio y ya destrabado por un toque.
function listo() {
  if (!sonidosPrendidos()) return null;
  const ctx = audio();
  return ctx && ctx.state === "running" ? ctx : null;
}

// Una nota con volumen que sube rápido y se apaga sola.
function nota(ctx, salida, { frecuencia, desde, dura, tipo = "sine", volumen = 1, hasta = null }) {
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(frecuencia, desde);
  if (hasta) osc.frequency.exponentialRampToValueAtTime(hasta, desde + dura * 0.6);
  vol.gain.setValueAtTime(0.0001, desde);
  vol.gain.exponentialRampToValueAtTime(volumen, desde + 0.012);
  vol.gain.exponentialRampToValueAtTime(0.0001, desde + dura);
  osc.connect(vol).connect(salida);
  osc.start(desde);
  osc.stop(desde + dura + 0.05);
}

function mezcla(ctx, volumen) {
  const salida = ctx.createGain();
  salida.gain.value = volumen;
  salida.connect(ctx.destination);
  return salida;
}

// Al publicar una comida: un "ding-ding" de campanita, dos notas para arriba.
export function ding() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.22);
  for (const [frecuencia, desde] of [[880, 0], [1318.5, 0.11]]) {
    nota(ctx, salida, { frecuencia, desde: t + desde, dura: 0.55 });
    nota(ctx, salida, { frecuencia: frecuencia * 2.76, desde: t + desde, dura: 0.18, volumen: 0.18 }); // el brillo de la campana
  }
}

// Logro o subida de nivel: una fanfarria corta (do-mi-sol-do y el acorde que queda sonando).
export function fanfarria({ grande = false } = {}) {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, grande ? 0.2 : 0.16);
  const notas = [523.25, 659.25, 783.99, 1046.5];
  notas.forEach((frecuencia, i) => nota(ctx, salida, { frecuencia, desde: t + i * 0.09, dura: 0.22, tipo: "triangle" }));
  const final = t + notas.length * 0.09;
  for (const frecuencia of notas) nota(ctx, salida, { frecuencia, desde: final, dura: grande ? 1.4 : 0.9, tipo: "triangle", volumen: 0.5 });
  if (grande) [1318.5, 1568, 2093].forEach((frecuencia, i) => nota(ctx, salida, { frecuencia, desde: final + 0.25 + i * 0.08, dura: 0.5, volumen: 0.3 }));
}

// Un vaso más en modo fiesta: el "clink" de dos vasos que chocan.
export function clink() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.2);
  // Parciales desafinados entre sí: suena a vidrio y no a nota musical.
  for (const [frecuencia, volumen, dura] of [[2350, 1, 0.5], [3480, 0.6, 0.35], [5120, 0.35, 0.22], [6900, 0.2, 0.12]]) {
    nota(ctx, salida, { frecuencia, desde: t, dura, volumen });
    nota(ctx, salida, { frecuencia: frecuencia * 1.06, desde: t + 0.07, dura: dura * 0.7, volumen: volumen * 0.45 });
  }
}

// Un vaso de agua: una gota ("plip") que cae y una burbujita.
export function gota() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.24);
  nota(ctx, salida, { frecuencia: 1400, hasta: 420, desde: t, dura: 0.13 });
  nota(ctx, salida, { frecuencia: 900, hasta: 1500, desde: t + 0.09, dura: 0.08, volumen: 0.4 });
}

// El +: un "pop" chiquito, apenas se nota.
export function pop() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.16);
  nota(ctx, salida, { frecuencia: 320, hasta: 760, desde: t, dura: 0.07 });
}

// Mandar un mensaje: un "fiu" de aire que sube.
export function fiu() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.28);
  const aire = ruido(ctx, 0.2);
  const filtro = ctx.createBiquadFilter();
  const vol = ctx.createGain();
  filtro.type = "bandpass";
  filtro.Q.value = 3;
  filtro.frequency.setValueAtTime(700, t);
  filtro.frequency.exponentialRampToValueAtTime(3800, t + 0.16);
  vol.gain.setValueAtTime(0.0001, t);
  vol.gain.exponentialRampToValueAtTime(1, t + 0.04);
  vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
  aire.connect(filtro).connect(vol).connect(salida);
  aire.start(t);
}

// Soltar para actualizar: un "clic" seco.
export function clic() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.2);
  nota(ctx, salida, { frecuencia: 1900, desde: t, dura: 0.03 });
  nota(ctx, salida, { frecuencia: 420, desde: t, dura: 0.05, volumen: 0.5 });
}

// Te aceptaron en un grupo o alguien pide entrar al tuyo: una campanita (dos golpes).
export function campanita() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.18);
  for (const desde of [0, 0.16]) {
    for (const [frecuencia, volumen, dura] of [[1568, 1, 0.9], [3136, 0.35, 0.5], [4704, 0.15, 0.3]]) {
      nota(ctx, salida, { frecuencia, desde: t + desde, dura, volumen });
    }
  }
}

// Subiste la foto que te salva de la caca: un suspiro de alivio (tres notas suaves para arriba).
export function alivio() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.18);
  [392, 523.25, 659.25].forEach((frecuencia, i) => nota(ctx, salida, { frecuencia, desde: t + i * 0.13, dura: 0.6 - i * 0.05, volumen: 0.8 }));
}

// Abrir el informe semanal: una musiquita corta.
export function musiquita() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.15);
  [[523.25, 0], [659.25, 0.12], [783.99, 0.24], [659.25, 0.36], [1046.5, 0.5]].forEach(([frecuencia, desde], i, todas) => {
    nota(ctx, salida, { frecuencia, desde: t + desde, dura: i === todas.length - 1 ? 0.7 : 0.18, tipo: "triangle" });
  });
}

// Cerrar con la cruz: un "pff" corto que baja.
export function cerrar() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.14);
  nota(ctx, salida, { frecuencia: 620, hasta: 260, desde: t, dura: 0.08 });
}

// Tildar un registro (creatina, gym, magnesio): un "tic" corto y suave.
export function tic() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.2);
  nota(ctx, salida, { frecuencia: 660, hasta: 1320, desde: t, dura: 0.09 });
  nota(ctx, salida, { frecuencia: 1760, desde: t + 0.05, dura: 0.12, volumen: 0.35 });
}

// Llega un mensaje con el chat abierto: un "plop" de burbuja, suave, como en WhatsApp.
export function recibido() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.2);
  nota(ctx, salida, { frecuencia: 520, hasta: 980, desde: t, dura: 0.09 });
  nota(ctx, salida, { frecuencia: 1240, desde: t + 0.06, dura: 0.1, volumen: 0.35 });
}

// Reaccionar (a una comida o a un mensaje): un "blip" chiquito que sube.
export function reaccion() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.16);
  nota(ctx, salida, { frecuencia: 880, hasta: 1760, desde: t, dura: 0.08, tipo: "triangle" });
}

// Borrar algo: un "fffp" de papel que se va para abajo.
export function borrado() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.22);
  const aire = ruido(ctx, 0.22);
  const filtro = ctx.createBiquadFilter();
  const vol = ctx.createGain();
  filtro.type = "bandpass";
  filtro.Q.value = 2;
  filtro.frequency.setValueAtTime(3200, t);
  filtro.frequency.exponentialRampToValueAtTime(500, t + 0.2);
  vol.gain.setValueAtTime(0.0001, t);
  vol.gain.exponentialRampToValueAtTime(1, t + 0.03);
  vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.21);
  aire.connect(filtro).connect(vol).connect(salida);
  aire.start(t);
  nota(ctx, salida, { frecuencia: 300, hasta: 140, desde: t + 0.05, dura: 0.12, volumen: 0.4 });
}

// Copiar una comida: dos "clic" seguidos, como sacar una fotocopia.
export function copiado() {
  const ctx = listo();
  if (!ctx) return;
  const t = ctx.currentTime;
  const salida = mezcla(ctx, 0.18);
  nota(ctx, salida, { frecuencia: 1500, desde: t, dura: 0.035 });
  nota(ctx, salida, { frecuencia: 2000, desde: t + 0.08, dura: 0.05 });
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
  const ctx = listo();
  if (!ctx) return;
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
  const ctx = listo();
  if (!ctx) return;
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
