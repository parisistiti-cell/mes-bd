// GET /api/stats → totaux par BD, vues des 7 derniers jours, et la BD la plus lue de la semaine.
const MIN_WEEK = 3;      // il faut au moins 3 vues sur la semaine pour afficher « la plus lue »
const CACHE_SECONDS = 300;

function parisDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function onRequestGet({ request, env }) {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": `public, max-age=${CACHE_SECONDS}` };
  if (!env.DB) return new Response(JSON.stringify({ ok: false }), { status: 503, headers: { ...headers, "Cache-Control": "no-store" } });

  const useCache = typeof caches !== "undefined" && caches.default;
  const cacheKey = new Request(new URL(request.url).origin + "/api/stats");
  if (useCache) {
    const hit = await caches.default.match(cacheKey);
    if (hit) return hit;
  }

  const today = parisDay();
  const from = parisDay(new Date(Date.now() - 6 * 24 * 3600 * 1000));   // aujourd'hui + les 6 jours précédents
  const totals = await env.DB.prepare("SELECT slug, n AS t FROM vues WHERE jour = 'total'").all();
  const weeks = await env.DB.prepare("SELECT slug, SUM(n) AS w FROM vues WHERE jour >= ?1 AND jour <= ?2 GROUP BY slug").bind(from, today).all();

  const total = {}, week = {};
  for (const r of totals.results || []) total[r.slug] = Number(r.t) || 0;
  for (const r of weeks.results || []) week[r.slug] = Number(r.w) || 0;

  const ranked = Object.keys(week)
    .filter((s) => week[s] >= MIN_WEEK)
    .sort((a, b) => week[b] - week[a] || (total[b] || 0) - (total[a] || 0));
  const top = ranked.length && (ranked.length === 1 || week[ranked[0]] > week[ranked[1]] || (total[ranked[0]] || 0) > (total[ranked[1]] || 0)) ? ranked[0] : null;

  const res = new Response(JSON.stringify({ ok: true, total, week, top, since: from }), { headers });
  if (useCache) await caches.default.put(cacheKey, res.clone());
  return res;
}
