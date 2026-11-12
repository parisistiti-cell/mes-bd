// POST /api/vue  { "slug": "lieux" }  → ajoute 1 vue à la BD pour aujourd'hui.
// On ne garde que des totaux par BD et par jour : ni cookie, ni adresse IP, ni identité.
const SLUGS = new Set([
  "enncre", "ardeche-2026", "conf", "entre-deux-vies", "lieux", "moto", "avance", "laffaire-de-la-souris",
  "hotel", "eusk", "leym", "code", "bloi", "ia", "tranche-de-vie", "sola", "clis", "meca", "jard",
  "corezlot", "opti", "phrases", "irla", "dolo", "tp", "reseaux", "venus", "drone", "bre", "catha", "nowoman","choco"
]);
const ALIAS = { ardeche: "ardeche-2026" };
const BOTS = /bot|crawl|spider|slurp|preview|headless|monitor|curl|wget|python|httpclient|facebookexternalhit/i;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// Jour au fuseau de Paris (AAAA-MM-JJ)
function parisDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: "base non liée" }, 503);
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false }, 403);
  const ua = request.headers.get("User-Agent") || "";
  if (!ua || BOTS.test(ua)) return json({ ok: true, counted: false });
  let body;
  try { body = await request.json(); } catch { return json({ ok: false }, 400); }
  let slug = String((body && body.slug) || "").toLowerCase().replace(/-solo$/, "");
  slug = ALIAS[slug] || slug;
  if (!SLUGS.has(slug)) return json({ ok: false }, 400);
  // Deux compteurs : le total de la BD (ligne « total ») et celui du jour. On garde 14 jours de détail seulement.
  const up = env.DB.prepare("INSERT INTO vues (slug, jour, n) VALUES (?1, ?2, 1) ON CONFLICT(slug, jour) DO UPDATE SET n = n + 1");
  await env.DB.batch([up.bind(slug, "total"), up.bind(slug, parisDay())]);
  if (Math.random() < 0.02) {
    await env.DB.prepare("DELETE FROM vues WHERE jour <> 'total' AND jour < ?1").bind(parisDay(new Date(Date.now() - 14 * 24 * 3600 * 1000))).run();
  }
  return json({ ok: true, counted: true });
}

export async function onRequest() {
  return new Response("Méthode non autorisée", { status: 405, headers: { Allow: "POST" } });
}
