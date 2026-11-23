if (typeof window !== "undefined" && !window.__mostrarInstalar) Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true });
// Doble de prueba de supabase-js: datos en memoria, sin tocar el proyecto real.
const YO = "u1";
const usuario = { id: YO, email: "yo@prueba.test", user_metadata: { nombre: "Steve", } };
const escuchas = [];
const sesion = { user: usuario, access_token: "token-prueba" };
const hoy = (d = 0) => { const x = new Date(); x.setDate(x.getDate() - d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const foto = (a, b, e) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600'><defs><linearGradient id='g' x2='1' y2='1'><stop stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='800' height='600' fill='url(#g)'/><text x='400' y='360' font-size='220' text-anchor='middle'>${e}</text></svg>`);
const ts = (d, h) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, 12); return x.toISOString(); };
const c = (id, u, tipo, d, h, desc, kcal, p, cc, g, fp) => ({ id, usuario_id: u, tipo, fecha: hoy(d), foto_path: fp || null, descripcion: desc, calorias: kcal, proteinas: p, carbohidratos: cc, grasas: g, macros_editados: false, alimentos: [], creado_en: ts(d, h) });

const db = {
  perfiles: [
    { id: "u1", nombre: "Steve", emoji: "🧉", color: "#E4572E", meta_calorias: 2200, modo_total: "mayor" },
    { id: "u2", nombre: "Nahuel", emoji: "🍕", color: "#3F7FD9", meta_calorias: 2500 },
    { id: "u3", nombre: "Juan", emoji: "🥑", color: "#3FA45B", meta_calorias: 1900 },
    { id: "u4", nombre: "Tobi", emoji: "🥩", color: "#7A5CD6", meta_calorias: 2800 },
  ],
  comidas: [
    c("c1", "u1", "desayuno", 0, 8, "Tostadas con palta y café", 420, 12, 48, 19, "f1"),
    c("c2", "u1", "almuerzo", 0, 13, "Milanesa con puré", 780, 42, 62, 36, "f2"),
    c("c3", "u2", "almuerzo", 0, 13, "Pizza de muzzarella", 950, 36, 110, 38, "f3"),
    c("c13", "u2", "cena", 2, 21, "Pizza de muzzarella", 900, 30, 100, 35),
    c("c4", "u3", "desayuno", 0, 9, "Yogur con granola", 310, 14, 44, 8, "f4"),
    c("c5", "u3", "almuerzo", 0, 12, "Ensalada con pollo", 480, 38, 22, 24, null),
    c("c6", "u1", "cena", 1, 21, "Asado con ensalada", 1050, 62, 18, 78, "f5"),
    c("c7", "u1", "almuerzo", 1, 13, "Ñoquis con tuco", 720, 18, 120, 14),
    c("c8", "u1", "almuerzo", 2, 13, "Pollo con arroz", 690, 48, 80, 14),
    c("c9", "u1", "cena", 3, 21, "Empanadas de carne", 1180, 40, 110, 58),
    c("c10", "u2", "cena", 1, 21, "Hamburguesa completa", 1200, 52, 80, 70, "f6"),
    c("c11", "u4", "almuerzo", 2, 13, "Locro", 620, 32, 60, 26),
    c("c12", "u1", "almuerzo", 5, 13, "Tarta de verdura", 900, 22, 70, 50),
  ],
  mensajes: [
    { id: "m1", usuario_id: "u2", texto: "Hoy pizza. No me juzguen", creado_en: ts(1, 20) },
    { id: "m2", usuario_id: "u3", texto: "Te juzgamos", creado_en: ts(1, 20) },
    { id: "m3", usuario_id: "u1", texto: "Yo vengo de un asado así que no digo nada", creado_en: ts(1, 21) },
    { id: "m4", usuario_id: "u2", texto: "Así me gusta", creado_en: ts(0, 12) },
    { id: "m5", usuario_id: "u2", texto: "Quién se suma el sábado?", creado_en: ts(0, 12) },
    { id: "m6", usuario_id: "u1", texto: "Yo voy", creado_en: ts(0, 13) },
  ],
};
db.whoop_dias = [
  { usuario_id: "u1", fecha: hoy(0), recuperacion: 72, hrv: 58.4, fc_reposo: 49, sueno_porcentaje: 88, sueno_horas: 7.4, strain: 13.2, calorias_quemadas: 2640 },
  { usuario_id: "u1", fecha: hoy(1), recuperacion: 41, hrv: 39.1, fc_reposo: 55, sueno_porcentaje: 63, sueno_horas: 5.8, strain: 16.8, calorias_quemadas: 3100 },
];
db.perfiles_salud = typeof window !== "undefined" && window.__plan
  ? [{ usuario_id: "u1", sexo: "masculino", anio_nacimiento: 1998, altura_cm: 178, peso_kg: 81.2, dias_actividad: 4, peso_objetivo: 76, ritmo: 0.5 }]
  : [];
db.pesos = typeof window !== "undefined" && window.__plan
  ? [[28, 84.1], [24, 83.8], [20, 83.2], [16, 83.3], [12, 82.6], [8, 82.2], [4, 81.9], [0, 81.2]].map(([d, peso_kg]) => ({ usuario_id: "u1", fecha: hoy(d), peso_kg }))
  : [];
db.reacciones = [
  { comida_id: "c3", usuario_id: "u1", emoji: "🔥" },
  { comida_id: "c3", usuario_id: "u3", emoji: "🔥" },
  { comida_id: "c3", usuario_id: "u4", emoji: "🐷" },
  { comida_id: "c2", usuario_id: "u2", emoji: "🤤" },
];
// pizza-detalle
db.comidas.find((x) => x.id === "c7").alimentos = [
  { nombre: "Papines", fuente: "importado", gramos: 150, kcal: 120, p: 2, c: 26, g: 1, por100: { kcal: 80, p: 1.3, c: 17.3, g: 0.7 } },
  { nombre: "Pollo a la plancha", fuente: "tipico", gramos: 200, unidad: { nombre: "g", g: 1 }, cantidad: 200, por100: { kcal: 165, p: 31, c: 0, g: 3.6 } },
];
db.comidas.find((x) => x.id === "c3").alimentos = [
  { nombre: "Pizza de muzzarella", fuente: "tipico", gramos: 300, por100: { kcal: 260, p: 10, c: 30, g: 11 }, unidad: { nombre: "porción", g: 100 }, cantidad: 3, kcal: 780, p: 30, c: 90, g: 33 },
  { nombre: "Cerveza", fuente: "importado", medida: "1 lata", kcal: 170, p: 6, c: 20, g: 5, estimado: true },
];
db.mensajes.push({ id: "bot1", usuario_id: null, bot_semana: hoy(9), creado_en: ts(0, 9), texto: "🏆 Premios de la semana (26/10 al 01/11)\n\n🍽️ Más comió: Tobi, 18.400 kcal\n💪 Más proteína: Nahuel, 820 g\n📅 Más constante: Juan, 7 de 7 días\n📸 Más comidas subidas: Steve, 21" });
db.favoritas = [{ id: "fav1", usuario_id: "u1", nombre: "Tostadas con palta", creado_en: ts(3, 9), alimentos: [{ nombre: "Palta", fuente: "tipico", gramos: 100, por100: { kcal: 160, p: 2, c: 8.5, g: 15 } }] }];
db.comentarios = [{ id: "k1", comida_id: "c3", usuario_id: "u3", texto: "Esa pizza no se comparte", creado_en: ts(0, 13) }];
db.agua = [{ usuario_id: "u1", fecha: hoy(0), ml: 1250 }, { usuario_id: "u3", fecha: hoy(0), ml: 2000 }];
db.ayunos = [];
db.tokens_salud = [];
db.salud_comidas = [];
if (window.__fotoJpg) db.comidas.unshift(c("cj", "u2", "merienda", 0, 17, "Torta", 400, 5, 50, 20, "u2/torta-1.jpg"));
db.desafios = [
  { id: "d1", tipo: "proteina", meta: 40, inicio: hoy(3), fin: hoy(-3), creado_por: "u1", creado_en: ts(3, 9) },
  { id: "d2", tipo: "fotos", meta: 3, inicio: hoy(12), fin: hoy(6), creado_por: "u2", creado_en: ts(12, 9) },
];
db.medallas = [{ usuario_id: "u2", codigo: "racha:1" }, { usuario_id: "u3", codigo: "comidas:1" }];
window.__db = db;
db.comidas.push(c("cs", "u1", "resumen", 1, 23, "Resumen de Apple Salud", 1800, 90, 200, 60));
db.reacciones_mensajes = [{ mensaje_id: "m5", usuario_id: "u3", emoji: "😂" }];
db.lecturas = [{ usuario_id: "u2", hasta: new Date(Date.now() + 86400000).toISOString() }, { usuario_id: "u3", hasta: "2000-01-01T00:00:00Z" }];
// Chat largo y hasta dónde leíste vos (sin leer desde la marca).
if (window.__chatLargo) {
  for (let i = 0; i < 40; i++) db.mensajes.push({ id: `ml${i}`, usuario_id: i % 3 === 0 ? "u1" : i % 2 ? "u2" : "u3", texto: `Mensaje viejo número ${i} con algo de texto para ocupar lugar`, creado_en: new Date(Date.now() - (5 * 86400000) + i * 60000).toISOString() });
  db.mensajes.sort((a, b) => (a.creado_en < b.creado_en ? -1 : 1));
}
if (window.__lecturaYo) db.lecturas.push({ usuario_id: "u1", hasta: window.__lecturaYo === "todo" ? new Date(Date.now() + 86400000).toISOString() : ts(1, 21) });
// Una comida con muchos alimentos para el desplegable.
if (window.__muchosAlimentos) db.comidas.find((x) => x.id === "c3").alimentos = Array.from({ length: 14 }, (_, i) => ({ nombre: `Alimento ${i + 1}`, fuente: "manual", kcal: 60, p: 2, c: 8, g: 2, medida: "1 porción" }));
db.mejoras = [{ id: "mj1", usuario_id: "u2", texto: "Modo oscuro más oscuro", hecha: false, creado_en: ts(1, 12) }, ...(window.__mejoraOtro ? [{ id: "mj2", usuario_id: "u9", grupo_id: "g-otro", texto: "Pedido de otro grupo", hecha: false, creado_en: ts(1, 10) }] : [])];
db.preferencias_avisos = [];
db.administradores = [{ usuario_id: "u1" }];
db.invitaciones_comida = [];
db.recetas_propias = [];
if (window.__recetaJuan) {
  db.recetas_propias.push({ id: "r1", usuario_id: "u3", nombre: "Budín de banana", porciones: 8, peso_final: 800, compartida: true, ...(window.__pasosJuan ? { pasos: "1. Pisar las bananas\nPaso 2: mezclar con la harina\n- Hornear 40 minutos" } : {}), ingredientes: [{ nombre: "Banana", gramos: 300, por100: { kcal: 89, p: 1.1, c: 23, g: 0.3 } }, { nombre: "Harina", gramos: 250, por100: { kcal: 364, p: 10, c: 76, g: 1 } }] });
  db.comidas.find((x) => x.id === "c4").alimentos = [{ nombre: "Budín de banana", receta_id: "r1", marca: "Tu receta", fuente: "receta", gramos: 100, unidad: { nombre: "porción (1/8)", g: 100 }, cantidad: 1, por100: { kcal: 160, p: 3, c: 38, g: 0.5 } }];
}
db.multas = [];
// Salida en grupo de esta noche: Nahuel la arma y suma a Steve; Juan ya cargó sus vasos.
if (window.__salida) {
  const vaso = (nombre, kcal, alcohol) => ({ nombre, fuente: "trago", ml: 300, medida: "300 ml", kcal, p: 0, c: 10, g: 0, alcohol });
  db.comidas.push(
    { ...c("fz5", "u2", "fiesta", 0, 22, "Fiesta: 2 vasos", 380, 0, 20, 0), salida: "fz5", salida_con: ["u1", "u3"], alimentos: [vaso("Fernet con coca", 190, 24), vaso("Fernet con coca", 190, 24)] },
    { ...c("fz6", "u3", "fiesta", 0, 22, "Fiesta: 3 vasos", 450, 0, 30, 0, "f4"), salida: "fz5", salida_con: [], gol: true, alimentos: [vaso("Gin tonic", 150, 20), vaso("Gin tonic", 150, 20), vaso("Aperol spritz", 150, 12)] },
  );
}
// Fiestas: la de anoche (Nahuel, con gol) y una de hace dos noches (Juan).
if (window.__fiestas) {
  const vaso = (nombre, kcal, alcohol) => ({ nombre, fuente: "trago", ml: 300, medida: "300 ml", kcal, p: 0, c: 10, g: 0, alcohol });
  db.comidas.push(
    { ...c("fz1", "u2", "fiesta", 1, 23, "Fiesta: 4 vasos", 720, 0, 40, 0), gol: true, alimentos: [vaso("Fernet con coca", 190, 24), vaso("Fernet con coca", 190, 24), vaso("Fernet con coca", 190, 24), vaso("Gin tonic", 150, 20)] },
    { ...c("fz2", "u3", "fiesta", 2, 23, "Fiesta: 1 vaso", 150, 0, 10, 0), gol: false, alimentos: [vaso("Aperol spritz", 150, 12)] },
  );
}
// Tu noche de fiesta de hoy, con 3 fotos y gol (para compartir en Instagram).
if (window.__miFiesta) {
  const vaso = (nombre, kcal, alcohol) => ({ nombre, fuente: "trago", ml: 300, medida: "300 ml", kcal, p: 0, c: 10, g: 0, alcohol });
  db.comidas.push({ ...c("fz9", "u1", "fiesta", 0, 23, "Fiesta: 3 vasos", 530, 0, 30, 0, "f5"), fotos_extra: ["f2", "f1"], gol: true, alimentos: [vaso("Fernet con coca", 190, 24), vaso("Fernet con coca", 190, 24), vaso("Gin tonic", 150, 20)] });
}
// Calavera: dos semanas seguidas sin fotos.
if (window.__calavera) for (let n = 1; n <= 14; n++) db.multas.push({ usuario_id: window.__calavera, fecha: hoy(n), fotos: 0 });
if (window.__calavera) db.comidas.filter((x) => x.usuario_id === window.__calavera && x.fecha === hoy(0)).forEach((x) => { x.foto_path = null; });
// Las columnas del postre (SQL 040).
if (window.__columnasPostre) db.comidas.forEach((x) => Object.assign(x, { postre_nombre: null, postre_foto: null, postre_en: null }, x.id === window.__columnasPostre ? { postre_nombre: "Flan con dulce de leche", postre_foto: "f6", postre_en: new Date().toISOString() } : {}));
db.bocha_evo = [];
db.ajustes_grupo = window.__sinImagenesBocha ? [] : [{ clave: "bocha", valor: "u1/bocha/bocha.webp" }, { clave: "bocha_evo", valor: "u1/bocha/bocha-evo.webp" }];
// Grupos: sin "mock-grupo" es la base de antes (sin grupos). "viejos": grupo sin Bocha. "sin": quedaste afuera.
const modoGrupo = typeof localStorage !== "undefined" ? localStorage.getItem("mock-grupo") : null;
db.grupos = [{ id: "00000000-0000-4000-8000-00000000a001", nombre: "Lomada", con_bocha: true }, { id: "g2", nombre: "Lomada Viejos", con_bocha: false }];
if (modoGrupo) db.perfiles.forEach((pf) => { pf.grupo_id = modoGrupo === "viejos" ? "g2" : db.grupos[0].id; });
// Sin RLS en el doble: los grupos que devuelve son "los míos". Con "dos", estoy en Lomada y en Viejos.
const todosLosGrupos = db.grupos;
if (modoGrupo && modoGrupo !== "dos") db.grupos = modoGrupo === "viejos" ? [todosLosGrupos[1]] : modoGrupo === "sin" ? [] : [todosLosGrupos[0]];
if (modoGrupo === "sin") db.perfiles.find((pf) => pf.id === "u1").grupo_id = null;
const fotos = { "u1/bocha/bocha.webp": "https://prueba.local/bocha.webp", "u1/bocha/bocha-evo.webp": "https://prueba.local/bocha-evo.webp", f1: foto("#8BAA5B", "#E6D9A8", "🥑"), f2: foto("#C9853B", "#F2DDB4", "🍽️"), f3: foto("#D9542C", "#F4C95D", "🍕"), f4: foto("#F0E2D0", "#C8A2C8", "🥣"), f5: foto("#7A2E1D", "#C76B3B", "🥩"), f6: foto("#B5651D", "#F2C14E", "🍔"), "u2/torta-1.jpg": foto("#6B3E26", "#E8B98A", "🍰") };

class Consulta {
  constructor(tabla) { Object.assign(this, { tabla, op: "select", filtros: [], orden: null, tope: null, unico: false, fila: null }); }
  select() { if (this.op === "select" || this.op === "insert") this.devuelve = true; return this; }
  eq(k, v) { this.filtros.push((f) => f[k] === v); return this; }
  in(k, v) { this.filtros.push((f) => v.includes(f[k])); return this; }
  gte(k, v) { this.filtros.push((f) => f[k] >= v); return this; }
  order(k, o) { this.orden = [k, o?.ascending]; return this; }
  limit(n) { this.tope = n; return this; }
  range(a, b) { this.rango = [a, b]; return this; }
  single() { this.unico = true; return this; }
  maybeSingle() { this.unico = true; return this; }
  insert(fila) { this.op = "insert"; this.fila = fila; return this; }
  upsert(fila, o) { this.op = "upsert"; this.fila = fila; this.clave = o?.onConflict?.split(","); return this; }
  update(fila) { this.op = "update"; this.fila = fila; return this; }
  delete() { this.op = "delete"; return this; }
  then(ok, mal) {
    const demora = this.op === "insert" && this.tabla === "mensajes" ? window.__demoraInsert || 0 : 0;
    return new Promise((listo) => setTimeout(listo, demora)).then(() => this.correr()).then(ok, mal);
  }
  correr() {
    const t = db[this.tabla];
    if (!t) return { data: null, error: { message: `relation "${this.tabla}" does not exist`, code: "42P01" } };
    window.__llamadas = window.__llamadas || [];
    window.__llamadas.push({ tabla: this.tabla, op: this.op, fila: this.fila });
    if (window.__sinRed && this.tabla === "comidas" && this.op === "insert") return { data: null, error: { message: "Failed to fetch" } };
    if (this.op === "insert") {
      const nuevas = [].concat(this.fila).map((f, i) => ({ id: `n${Date.now()}${i}`, creado_en: new Date().toISOString(), inicio: new Date().toISOString(), fin: null, ...f }));
      nuevas.forEach((f) => t.unshift(this.tabla === "comidas" ? { macros_editados: false, ...f } : f));
      return { data: this.unico ? nuevas[0] : nuevas, error: null };
    }
    if (window.__sinRed && this.tabla === "comidas" && ["insert", "update", "delete"].includes(this.op)) return { data: null, error: { message: "Failed to fetch" } };
    if (this.op === "update") { const cambiadas = t.filter((f) => this.filtros.every((x) => x(f))); cambiadas.forEach((f) => Object.assign(f, this.fila)); return { data: cambiadas.map((f) => ({ id: f.id })), error: null }; }
    if (this.op === "delete") { db[this.tabla] = t.filter((f) => !this.filtros.every((x) => x(f))); return { data: null, error: null }; }
    if (this.op === "upsert") {
      if (this.tabla !== "perfiles") {
        const i = t.findIndex((f) => this.clave.every((k) => f[k] === this.fila[k]));
        if (i >= 0) t[i] = { ...t[i], ...this.fila };
        else t.push(this.fila);
      }
      return { data: null, error: null };
    }
    let r = t.filter((f) => this.filtros.every((x) => x(f)));
    if (this.orden) { const [k, asc] = this.orden; r = [...r].sort((a, b) => (a[k] < b[k] ? -1 : 1) * (asc === false ? -1 : 1)); }
    if (this.tope) r = r.slice(0, this.tope);
    if (this.rango) r = r.slice(this.rango[0], this.rango[1] + 1);
    if (this.unico) return { data: r[0] ? { ...r[0] } : null, error: null };
    return { data: r.map((f) => ({ ...f })), error: null };
  }
}

// SQL 063: bio y destacadas del perfil.
if (window.__con063) {
  db.perfiles.forEach((pf) => { pf.bio = pf.bio ?? null; });
  if (window.__bio) Object.assign(db.perfiles.find((pf) => pf.id === "u2"), { bio: window.__bio });
  db.destacadas = window.__destacadas || [];
  db.destacadas_fotos = window.__destacadasFotos || [];
}
// SQL 065: fotos fijadas en el perfil.
if (window.__con065) db.comidas.forEach((x) => { x.fijada_en = (window.__fijadas || {})[x.id] || null; });
// SQL 062: comidas planeadas (y una de Nahuel que todavía no comió, que no se tiene que ver).
if (window.__con062) {
  db.comidas.forEach((x) => { x.planeada = false; });
  db.comidas.push({ ...c("cp2", "u2", "cena", 0, 12, "Salmón planeado", 640, 40, 30, 35), planeada: true });
}
if (window.__con061) db.recetas_videos = window.__videos || [];
if (window.__con054) db.productos = window.__productos || [];
if (window.__con057) db.salud_exportadas = window.__exportadas || [];
if (window.__con053) db.recordatorios = window.__recordatorios || [];
if (window.__con052) db.motivacion = window.__motivacion ? [window.__motivacion] : [];
if (!window.__sinRegistros) { db.registros_config = window.__registrosConfig ? [window.__registrosConfig] : []; db.registros_diarios = window.__registrosDiarios || []; }
window.__auth = () => supabase.auth;
window.__canalChat = () => [...(window.__canales || [])].reverse().find((c) => String(c.nombre).startsWith("chat-vivo"));
window.__canalDatos = () => [...(window.__canales || [])].reverse().find((c) => String(c.nombre).startsWith("grupo-"));
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: window.__sinSesion ? null : sesion } }),
    onAuthStateChange: (f) => { escuchas.push(f); return { data: { subscription: { unsubscribe() {} } } }; },
    signOut: async () => { window.__salio = true; },
    signInWithOtp: async () => ({ error: null }),
    signInWithPassword: async ({ email, password }) => {
      window.__ingreso = { email, password };
      if (window.__mailSinConfirmar) return { data: { session: null }, error: { code: "email_not_confirmed", message: "Email not confirmed" } };
      window.__sinSesion = false;
      escuchas.forEach((f) => f("SIGNED_IN", sesion));
      return { data: { session: sesion }, error: null };
    },
    resend: async (d) => { (window.__reenvios = window.__reenvios || []).push(d); return { error: null }; },
    signUp: async (d) => {
      window.__registro = d;
      if (window.__confirmarMail) return { data: { session: null, user: { id: "nuevo" } }, error: null };
      window.__sinSesion = false;
      escuchas.forEach((f) => f("SIGNED_IN", sesion));
      return { data: { session: sesion }, error: null };
    },
    resetPasswordForEmail: async (mail, o) => { window.__recuperacion = { mail, ...o }; return { error: null }; },
    disparar: (e) => escuchas.forEach((f) => f(e, sesion)),
    updateUser: async (d) => {
      window.__claveNueva = d;
      Object.assign(usuario.user_metadata, d.data);
      escuchas.forEach((f) => f("USER_UPDATED", { ...sesion, user: { ...usuario } }));
      return { data: { user: usuario }, error: null };
    },
  },
  from: (t) => new Consulta(t),
  rpc: async (nombre, p) => {
    (window.__rpc = window.__rpc || []).push(nombre);
    if (nombre === "buscar_productos") {
      if (!db.productos) return { data: null, error: { message: "no existe" } };
      const n = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      const ws = n(p.p_texto).split(/\s+/).filter((w) => w.length >= 2);
      return { data: db.productos.filter((r) => ws.every((w) => n(`${r.nombre} ${r.marca}`).split(/\s+/).some((x) => x.startsWith(w.replace(/(es|s)$/, ""))))), error: null };
    }
    if (nombre === "guardar_producto") {
      (window.__guardados = window.__guardados || []).push(p);
      return { data: [], error: db.productos ? null : { message: "no existe" } };
    }
    if (nombre === "eliminar_mensaje") {
      const m = db.mensajes.find((x) => x.id === p.p_id);
      if (!m || m.usuario_id !== YO || m.eliminado_en || Date.now() - new Date(m.creado_en).getTime() > 4 * 3600000) return { data: null, error: { message: "no_se_puede_eliminar" } };
      const adjunto = m.adjunto_path || null;
      Object.assign(m, { texto: "", adjunto_path: null, sticker: null, receta_id: null, eliminado_en: new Date().toISOString() });
      return { data: adjunto, error: null };
    }
    if (nombre === "mail_de_ingreso") {
      if (p.p_usuario === "bloqueado") return { data: null, error: { message: "demasiados_intentos" } };
      return { data: p.p_clave === "correcta123" ? "yo@prueba.test" : null, error: null };
    }
    if (nombre === "cambiar_grupo") {
      if (!db.grupos.some((g) => g.id === p.p_grupo)) return { data: null, error: { message: "no_es_tu_grupo" } };
      db.perfiles.find((pf) => pf.id === "u1").grupo_id = p.p_grupo;
      return { data: null, error: null };
    }
    if (nombre === "salir_de_grupo") {
      db.grupos = db.grupos.filter((g) => g.id !== p.p_grupo);
      const yo = db.perfiles.find((pf) => pf.id === "u1");
      if (yo.grupo_id === p.p_grupo) yo.grupo_id = db.grupos[0]?.id || null;
      return { data: null, error: null };
    }
    if (nombre === "unirme_a_grupo") {
      if (p.p_codigo.toLowerCase() !== "viejos") return { data: null, error: { message: "codigo_invalido" } };
      if (!db.grupos.some((g) => g.id === "g2")) db.grupos.push(todosLosGrupos[1]);
      db.perfiles.find((pf) => pf.id === "u1").grupo_id = "g2";
      return { data: "Lomada Viejos", error: null };
    }
    // Grupos con admin (SQL 046). __admin: administro el grupo que estoy viendo. __pedidos: los que esperan.
    if (nombre === "grupos_que_administro") return window.__sin046 ? { data: null, error: { message: "Could not find the function" } } : { data: window.__admin ? [db.perfiles.find((pf) => pf.id === "u1").grupo_id, ...(window.__creados || [])] : (window.__creados || []), error: null };
    if (nombre === "pedidos_pendientes") return { data: (window.__pedidos || []).filter((x) => !x.estado).length, error: null };
    if (nombre === "codigo_de_grupo") return { data: "lomada-1234", error: null };
    if (nombre === "solicitudes_de_grupo") return { data: (window.__pedidos || []).filter((x) => !x.estado), error: null };
    if (nombre === "responder_solicitud") {
      const x = (window.__pedidos || []).find((q) => q.id === p.p_id);
      if (!x || x.estado) return { data: null, error: { message: "sin_pedido" } };
      x.estado = p.p_aceptar ? "aceptada" : "rechazada";
      if (p.p_aceptar) db.perfiles.push({ ...db.perfiles[1], id: x.usuario_id, nombre: x.nombre, usuario: x.usuario });
      return { data: null, error: null };
    }
    if (nombre === "sacar_de_grupo") { db.perfiles = db.perfiles.filter((pf) => pf.id !== p.p_usuario); return { data: null, error: null }; }
    if (nombre === "mis_solicitudes") return { data: window.__misPedidos || [], error: null };
    if (nombre === "cancelar_solicitud") { window.__misPedidos = (window.__misPedidos || []).filter((x) => x.grupo_id !== p.p_grupo); return { data: null, error: null }; }
    if (nombre === "pedir_entrar_a_grupo") {
      if (window.__sin046) return { data: null, error: { message: "Could not find the function public.pedir_entrar_a_grupo" } };
      if (p.p_codigo.toLowerCase() !== "viejos") return { data: null, error: { message: "codigo_invalido" } };
      window.__misPedidos = [...(window.__misPedidos || []), { grupo_id: "g2", nombre: "Lomada Viejos", creado_en: new Date().toISOString() }];
      return { data: { estado: "pendiente", id: "g2", nombre: "Lomada Viejos" }, error: null };
    }
    if (nombre === "crear_grupo") {
      if (p.p_nombre.trim().length < 2) return { data: null, error: { message: "nombre_invalido" } };
      const g = { id: "g-nuevo", nombre: p.p_nombre.trim(), con_bocha: false };
      db.grupos.push(g);
      db.perfiles.find((pf) => pf.id === "u1").grupo_id = g.id;
      window.__creados = [...(window.__creados || []), g.id];
      return { data: { ...g, codigo: "nuevo-0001" }, error: null };
    }
    if (nombre === "es_dueno") return { data: !window.__noDueno, error: null };
    if (nombre === "responder_mejora") {
      if (window.__sin060) return { data: null, error: { code: "PGRST202", message: "Could not find the function public.responder_mejora" } };
      const m = db.mejoras.find((x) => x.id === p.p_id);
      const t = String(p.p_respuesta || "").trim() || null;
      Object.assign(m, { respuesta: t, no_va: Boolean(p.p_no_va), respondida_en: t ? new Date().toISOString() : null });
      return { data: null, error: null };
    }
    if (nombre === "borrar_mi_cuenta") {
      (window.__borrados = window.__borrados || []).push(p.p_confirmacion);
      if (window.__sin055) return { data: null, error: { code: "PGRST202", message: "Could not find the function public.borrar_mi_cuenta(p_confirmacion)" } };
      if (!window.__noDueno) return { data: null, error: { message: "es_dueno" } };
      if (p.p_confirmacion !== "BORRAR") return { data: null, error: { message: "falta_confirmar" } };
      return { data: "ok", error: null };
    }
    if (nombre === "admin_insights") {
      const hoyD = new Date();
      const por_dia = Array.from({ length: 14 }, (_, i) => { const d = new Date(hoyD); d.setDate(d.getDate() - 13 + i); return { fecha: d.toLocaleDateString("en-CA"), comidas: [3, 5, 8, 6, 9, 12, 4, 7, 10, 11, 6, 9, 13, 5][i], personas: [2, 3, 4, 3, 4, 5, 2, 3, 5, 5, 3, 4, 6, 3][i] }; });
      return { data: { usuarios: 23, usuarios_nuevos_7: 4, activos_7: 14, activos_30: 19, grupos: 4, comidas: 1840, comidas_7: 62, fotos_7: 41, mensajes_7: 318, kcal_dia: 2140, por_dia, por_hora: [0,0,0,0,0,0,1,4,9,6,3,5,14,18,9,4,3,6,8,12,16,11,5,2], top_alimentos: [{ nombre: "Huevo", veces: 34 }, { nombre: "Pollo", veces: 29 }, { nombre: "Banana", veces: 21 }, { nombre: "Arroz", veces: 18 }, { nombre: "Yogur", veces: 12 }], mas_activos: [{ nombre: "Juan", comidas: 19 }, { nombre: "Nahuel", comidas: 15 }], grupos_lista: [{ nombre: "Lomada", miembros: 9, con_bocha: true, creado_en: "2026-01-01" }, { nombre: "Los Pibes", miembros: 5, con_bocha: false, creado_en: "2026-11-16" }], vasos_30: 57, registros_7: { creatina: 22, gym: 15 } }, error: null };
    }
    if (nombre === "admin_usuarios") return { data: db.perfiles.map((pf, i) => ({ id: pf.id, nombre: pf.nombre, usuario: pf.usuario || pf.nombre.toLowerCase(), color: pf.color, creado_en: "2026-10-0" + (i + 1) + "T12:00:00Z", grupos: ["Lomada"], comidas: 40 - i * 7, comidas_7_dias: 8 - i, fotos: 20, ultima_comida: new Date().toLocaleDateString("en-CA") })), error: null };
    if (nombre === "uso_de_la_app") return { data: { fotos_bytes: 780 * 1048576, fotos_cantidad: 3412, fotos_bytes_30_dias: 95 * 1048576, fotos_limite: 1073741824, base_bytes: 42 * 1048576, base_limite: 524288000, ia_sin_cupo: "2026-11-10" }, error: null };
    if (nombre === "crear_token_salud") { db.tokens_salud.push({ usuario_id: "u1" }); return { data: "a".repeat(48), error: null }; }
    if (nombre === "revisar_registro") return { data: p.p_codigo && p.p_codigo !== "grupo" ? "codigo" : p.p_usuario === "ocupado" ? "usuario_ocupado" : "ok", error: null };
    if (nombre === "usar_comodin") {
      if (db.comodines.some((c) => c.usuario_id === "u1")) return { data: null, error: { message: "comodin_usado" } };
      db.comodines.push({ usuario_id: "u1", fecha: p.p_fecha });
      db.multas = db.multas.filter((m) => !(m.usuario_id === "u1" && m.fecha === p.p_fecha));
      return { data: null, error: null };
    }
    if (nombre === "invitar_a_comida") {
      const c = db.comidas.find((x) => x.id === p.p_comida);
      c.grupo_comida = c.grupo_comida || c.id;
      let n = 0;
      for (const u of p.p_para) {
        if (db.invitaciones_comida.some((i) => i.comida_id === c.id && i.para_usuario === u)) continue;
        db.invitaciones_comida.push({ id: `inv${Date.now()}${n}`, comida_id: c.id, de_usuario: "u1", para_usuario: u, estado: "pendiente", creado_en: new Date().toISOString() });
        n += 1;
      }
      return { data: n, error: null };
    }
    if (nombre === "responder_invitacion") {
      const i = db.invitaciones_comida.find((x) => x.id === p.p_id);
      if (!p.p_acepta) { i.estado = "rechazada"; return { data: null, error: null }; }
      const c = db.comidas.find((x) => x.id === i.comida_id);
      const copia = { ...c, id: `copia${Date.now()}`, usuario_id: i.para_usuario, grupo_comida: c.id, creado_en: new Date().toISOString() };
      db.comidas.unshift(copia);
      Object.assign(i, { estado: "aceptada", copia_id: copia.id });
      return { data: copia.id, error: null };
    }
    return { data: null, error: null };
  },
  storage: {
    from: () => ({
      createSignedUrls: async (rutas) => (window.__firmas = (window.__firmas || 0) + 1, { data: rutas.map((path) => ({ path, signedUrl: fotos[path] || foto("#556", "#99a", "📷") })) }),
      upload: async (ruta, archivo, op) => ((window.__subidas = window.__subidas || []).push({ ruta, tipo: archivo?.type, peso: archivo?.size, contentType: op?.contentType }), { error: null }),
      remove: async (rutas) => ((window.__quitados = window.__quitados || []).push(...rutas), { error: null }),
      list: async (ruta, op) => {
        const arbol = window.__archivos || {};
        const todo = arbol[ruta] || [];
        return { data: todo.slice(op?.offset || 0, (op?.offset || 0) + (op?.limit || 100)), error: null };
      },
      copy: async (de, a) => ((window.__copias = window.__copias || []).push([de, a]), { error: null }),
    }),
  },
  channel: (nombre) => {
    const oyentes = [];
    const c = {
      nombre,
      on(tipo, filtro, f) { oyentes.push([tipo === "presence" ? "presence" : tipo === "broadcast" ? `broadcast:${filtro.event}` : filtro.table, f]); return this; },
      send(m) { (window.__enviados = window.__enviados || []).push(m); return Promise.resolve("ok"); },
      difundir(evento, payload) { oyentes.filter(([t]) => t === `broadcast:${evento}`).forEach(([, f]) => f({ payload })); },
      track(estado) { (window.__rastreos = window.__rastreos || []).push(estado); return Promise.resolve("ok"); },
      presenceState() { return window.__presencia || {}; },
      subscribe(f) { c.estado = f; (window.__canales = window.__canales || []).push(c); setTimeout(() => f?.("SUBSCRIBED"), 0); return this; },
      emitir(tabla, datos) { oyentes.filter(([t]) => t === tabla).forEach(([, f]) => f(datos)); },
    };
    return c;
  },
  removeChannel: () => {},
};
