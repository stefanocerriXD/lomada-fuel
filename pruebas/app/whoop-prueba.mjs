// Prueba del backend de WHOOP con todos los servicios externos simulados. No sale a internet.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

Object.assign(process.env, {
  APP_URL: "https://app.prueba",
  WHOOP_CLIENT_ID: "cliente",
  WHOOP_CLIENT_SECRET: "secreto",
  SUPABASE_SECRET_KEY: "sb_secret_prueba",
  SUPABASE_URL: "https://proyecto.supabase.test",
  SUPABASE_ANON_KEY: "publica",
});

const USUARIO = "11111111-1111-4111-8111-111111111111";
const bd = { whoop_conexiones: [], whoop_dias: [] };
const llamadas = [];
let refreshValido = "refresh-1";
let tokenVence = 3600;

const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = async (entrada, opciones = {}) => {
  const url = new URL(String(entrada.url || entrada));
  const metodo = opciones.method || "GET";
  llamadas.push(`${metodo} ${url.hostname}${url.pathname}`);

  if (url.pathname === "/auth/v1/user") return opciones.headers.Authorization === "Bearer bueno" ? json({ id: USUARIO }) : json({}, 401);

  if (url.pathname === "/oauth/oauth2/token") {
    const c = Object.fromEntries(new URLSearchParams(String(opciones.body)));
    assert.equal(opciones.headers["content-type"], "application/x-www-form-urlencoded");
    assert.equal(c.client_secret, "secreto");
    if (c.grant_type === "authorization_code") {
      assert.equal(c.code, "codigo-ok");
      assert.equal(c.redirect_uri, "https://app.prueba/api/whoop");
      return json({ access_token: "acceso-1", refresh_token: "refresh-1", expires_in: tokenVence });
    }
    assert.equal(c.scope, "offline");
    if (c.refresh_token !== refreshValido) return json({ error: "invalid_grant" }, 400);
    refreshValido = "refresh-2";
    return json({ access_token: "acceso-2", refresh_token: "refresh-2", expires_in: 3600 });
  }

  if (url.hostname === "api.prod.whoop.com") {
    const auth = opciones.headers?.Authorization;
    assert.match(auth, /^Bearer acceso-/);
    if (url.pathname === "/developer/v2/cycle") {
      return json({
        records: [
          { id: 2, start: "2026-11-04T02:30:00.000Z", end: "2026-11-05T02:00:00.000Z", timezone_offset: "-03:00", score_state: "SCORED", score: { strain: 12.34, kilojoule: 10460 } },
          { id: 1, start: "2026-11-03T03:30:00.000Z", end: null, timezone_offset: "-03:00", score_state: "PENDING_SCORE", score: null },
        ],
      });
    }
    if (url.pathname === "/developer/v2/recovery") {
      return json({ records: [{ cycle_id: 2, sleep_id: "s2", score_state: "SCORED", score: { recovery_score: 67.4, hrv_rmssd_milli: 54.32, resting_heart_rate: 51 } }] });
    }
    if (url.pathname === "/developer/v2/activity/sleep") {
      return json({
        records: [
          { id: "siesta", cycle_id: 2, nap: true, score_state: "SCORED", score: { sleep_performance_percentage: 10, stage_summary: { total_in_bed_time_milli: 3600000, total_awake_time_milli: 0, total_no_data_time_milli: 0 } } },
          { id: "s2", cycle_id: 2, nap: false, score_state: "SCORED", score: { sleep_performance_percentage: 91, stage_summary: { total_in_bed_time_milli: 27000000, total_awake_time_milli: 1800000, total_no_data_time_milli: 0 } } },
        ],
      });
    }
    if (url.pathname === "/developer/v2/user/access") return new Response(null, { status: 204 });
  }

  if (url.pathname.startsWith("/rest/v1/")) {
    const tabla = url.pathname.split("/").pop();
    const filtro = url.searchParams.get("usuario_id")?.replace("eq.", "");
    const filas = () => bd[tabla].filter((f) => !filtro || f.usuario_id === filtro);
    if (metodo === "GET") {
      const r = filas();
      return String(opciones.headers?.get?.("Accept") || opciones.headers?.Accept || "").includes("pgrst.object") ? (r[0] ? json(r[0]) : new Response(null, { status: 406 })) : json(r);
    }
    if (metodo === "POST") {
      const nuevas = [].concat(JSON.parse(opciones.body));
      const clave = url.searchParams.get("on_conflict")?.split(",") || ["usuario_id"];
      for (const n of nuevas) {
        const i = bd[tabla].findIndex((f) => clave.every((k) => f[k] === n[k]));
        if (i >= 0) bd[tabla][i] = { ...bd[tabla][i], ...n };
        else bd[tabla].push(n);
      }
      return new Response(null, { status: 201 });
    }
    if (metodo === "PATCH") { filas().forEach((f) => Object.assign(f, JSON.parse(opciones.body))); return new Response(null, { status: 204 }); }
    if (metodo === "DELETE") { bd[tabla] = bd[tabla].filter((f) => f.usuario_id !== filtro); return new Response(null, { status: 204 }); }
  }
  throw new Error(`Salida no simulada: ${metodo} ${url}`);
};

function respuesta() {
  const r = {
    statusCode: 200, cabeceras: {}, cuerpo: null,
    setHeader(k, v) { this.cabeceras[k.toLowerCase()] = v; },
    status(c) { this.statusCode = c; return this; },
    json(d) { this.cuerpo = d; return this; },
    end() { return this; },
  };
  return r;
}

const ruta = process.argv[2] || new URL("../../api/whoop.js", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const { default: handler, armarDias } = await import(pathToFileURL(ruta).href);
const post = async (accion, token = "bueno", extra = {}) => {
  const res = respuesta();
  await handler({ method: "POST", query: { accion, ...extra }, headers: { authorization: `Bearer ${token}` } }, res);
  return res;
};
const volver = async (query, cookie) => {
  const res = respuesta();
  await handler({ method: "GET", query, headers: { cookie } }, res);
  return res;
};

// 1. Sin sesión no entra
assert.equal((await post("conectar", "malo")).statusCode, 401);

// 2. Conectar genera la dirección correcta
const r1 = await post("conectar");
const url = new URL(r1.cuerpo.url);
const estado = url.searchParams.get("state");
assert.equal(url.origin + url.pathname, "https://api.prod.whoop.com/oauth/oauth2/auth");
assert.equal(estado.length, 8);
assert.equal(url.searchParams.get("redirect_uri"), "https://app.prueba/api/whoop");
assert.ok(url.searchParams.get("scope").split(" ").includes("offline"));
const cookie = r1.cabeceras["set-cookie"].split(";")[0];
assert.match(r1.cabeceras["set-cookie"], /HttpOnly/);
assert.match(r1.cabeceras["set-cookie"], /Secure/);

// 3. Cookie falsificada o estado distinto: rechazado
assert.match((await volver({ code: "codigo-ok", state: "otro1234" }, cookie)).cabeceras.location, /whoop=error/);
const [nombre, valor] = cookie.split("=");
const [e, , f] = valor.split(".");
assert.match((await volver({ code: "codigo-ok", state: e }, `${nombre}=${e}.22222222-2222-4222-8222-222222222222.${f}`)).cabeceras.location, /whoop=error/);
assert.equal(bd.whoop_conexiones.length, 0);

// 4. Cancelar en WHOOP
assert.match((await volver({ error: "access_denied" }, cookie)).cabeceras.location, /whoop=cancelado/);

// 5. Autorización correcta: guarda tokens y datos del día
const r2 = await volver({ code: "codigo-ok", state: estado }, cookie);
assert.match(r2.cabeceras.location, /whoop=conectado/);
assert.equal(bd.whoop_conexiones[0].refresh_token, "refresh-1");
console.log("día armado:", JSON.stringify(bd.whoop_dias[0]));
assert.equal(bd.whoop_dias.length, 1, "el ciclo pendiente no genera fila");
const d = bd.whoop_dias[0];
assert.equal(d.fecha, "2026-11-04");
assert.equal(d.recuperacion, 67);
assert.equal(d.hrv, 54.3);
assert.equal(d.sueno_porcentaje, 91, "usa el sueño principal, no la siesta");
assert.equal(d.sueno_horas, 7);
assert.equal(d.strain, 12.3);
assert.equal(d.calorias_quemadas, 2500);

// 6. Dentro de la espera no vuelve a llamar a WHOOP
const antes = llamadas.filter((l) => l.includes("whoop.com/developer")).length;
assert.equal((await post("sincronizar")).cuerpo.conectado, true);
assert.equal(llamadas.filter((l) => l.includes("whoop.com/developer")).length, antes);

// 7. Token vencido: renueva, rota y guarda el nuevo
bd.whoop_conexiones[0].expira_en = new Date(Date.now() - 1000).toISOString();
await post("sincronizar", "bueno", { forzar: "1" });
assert.equal(bd.whoop_conexiones[0].refresh_token, "refresh-2");
assert.equal(bd.whoop_conexiones[0].access_token, "acceso-2");

// 8. WHOOP caído: conserva la conexión y lo último guardado
const originalFetch = globalThis.fetch;
globalThis.fetch = async (e, o) => (String(e.url || e).includes("/developer/v2/cycle") ? json({}, 503) : originalFetch(e, o));
const caida = await post("sincronizar", "bueno", { forzar: "1" });
globalThis.fetch = originalFetch;
assert.deepEqual(caida.cuerpo, { disponible: true, conectado: true, desactualizado: true });
assert.equal(bd.whoop_conexiones.length, 1);
assert.equal(bd.whoop_dias.length, 1);

// 9. Desconectar borra tokens y datos
assert.equal((await post("desconectar")).cuerpo.conectado, false);
assert.equal(bd.whoop_conexiones.length, 0);
assert.equal(bd.whoop_dias.length, 0);
assert.ok(llamadas.includes("DELETE api.prod.whoop.com/developer/v2/user/access"));

// 10. Permiso revocado en WHOOP: pide conectar de nuevo en lugar de fallar siempre
bd.whoop_conexiones.push({ usuario_id: USUARIO, access_token: "acceso-3", refresh_token: "revocado", expira_en: new Date(Date.now() - 1000).toISOString() });
const revocado = await post("sincronizar", "bueno", { forzar: "1" });
assert.deepEqual(revocado.cuerpo, { disponible: true, conectado: false });
assert.equal(bd.whoop_conexiones.length, 0);

// 11. Otro dispositivo renovó el token al mismo tiempo: usa el que quedó guardado
bd.whoop_conexiones.push({ usuario_id: USUARIO, access_token: "acceso-viejo", refresh_token: "refresh-viejo", expira_en: new Date(Date.now() - 1000).toISOString() });
const sinCarrera = globalThis.fetch;
globalThis.fetch = async (e, o) => {
  if (String(e.url || e).endsWith("/oauth/oauth2/token")) {
    bd.whoop_conexiones[0].refresh_token = "refresh-otro";
    bd.whoop_conexiones[0].access_token = "acceso-otro";
    return json({}, 400);
  }
  return sinCarrera(e, o);
};
const carrera = await post("sincronizar", "bueno", { forzar: "1" });
globalThis.fetch = sinCarrera;
assert.deepEqual(carrera.cuerpo, { disponible: true, conectado: true });
assert.equal(bd.whoop_conexiones.length, 1);

// 12. La respuesta nunca incluye tokens
assert.ok(!JSON.stringify(r1.cuerpo).includes("secreto"));
assert.equal(typeof armarDias, "function");
console.log("\nbackend de WHOOP: todas las pruebas pasaron");
