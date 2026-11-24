// ============================================================================
// functions/api/dashboard.js : données du bouton « Visites » (quota + visites des sites)
//
// Le jeton Cloudflare reste ici, côté serveur : il n'est jamais envoyé au navigateur.
// Réglages à créer dans Cloudflare : mes-bd → Paramètres → Variables et secrets (Production) :
//   CF_API_TOKEN   (secret)  jeton API « Account Analytics : Read »
//   ACCOUNT_ID     (texte)   identifiant de compte Cloudflare
//   DASHBOARD_KEY  (secret)  clé d'accès au tableau de bord (à saisir une fois sur chaque appareil)
// ============================================================================

// « prefix » : début du chemin de la page sur ce domaine ("" = tout le domaine).
const SITES = [
  { key: "dordogne", label: "Se baigner en Dordogne", host: "parisistiti-cell.github.io", prefix: "/Se-baigner-en-Dordogne" },
  { key: "cle", label: "Générateur de clés", host: "parisistiti-cell.github.io", prefix: "/stegano-web2" },
  { key: "bd", label: "Mes BD", host: "mes-bd.pages.dev", prefix: "" },
];
const DAILY_LIMIT = 100000;
const API_URL = "https://api.cloudflare.com/client/v4/graphql";

class ApiError extends Error {
  constructor(message, graphql = false, status = 502) { super(message); this.graphql = graphql; this.status = status; }
}

function matchSite(host, path) {
  let p = path || "/";
  try { p = decodeURIComponent(p); } catch (e) { /* chemin non décodable : on le garde tel quel */ }
  p = p.toLowerCase();
  for (const s of SITES) {
    if (s.host !== host) continue;
    const pref = s.prefix.toLowerCase().replace(/\/+$/, "");
    if (pref === "" || p === pref || p.startsWith(pref + "/")) return s.key;
  }
  return null;
}

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const isoSec = (ms) => new Date(ms).toISOString().slice(0, 19) + "Z";
const dayStartMs = (ms) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };

function sameKey(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
});

async function gql(env, query, variables) {
  let res, body;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + env.CF_API_TOKEN, "Content-Type": "application/json", "User-Agent": "mes-bd-dashboard/1.0" },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e) {
    throw new ApiError("Pas de connexion à Cloudflare (" + e.message + ").");
  }
  if ([400, 401, 403].includes(res.status)) {
    let detail = "";
    try { const b = await res.json(); detail = (b.errors && b.errors[0] && b.errors[0].message) || ""; } catch (e) { /* corps vide */ }
    throw new ApiError("Jeton refusé par Cloudflare (code " + res.status + (detail ? " : " + detail : "") +
      "). Vérifie CF_API_TOKEN (le jeton seul, sans guillemets) et son droit « Account Analytics : Read ».");
  }
  try { body = await res.json(); } catch (e) { throw new ApiError("Réponse illisible de Cloudflare (HTTP " + res.status + ")."); }
  if (body.errors && body.errors.length) throw new ApiError("Cloudflare : " + (body.errors[0].message || "erreur inconnue"), true);
  const accounts = body && body.data && body.data.viewer && body.data.viewer.accounts;
  if (!accounts) throw new ApiError("Réponse inattendue de Cloudflare.");
  if (!accounts.length) throw new ApiError("Aucun compte trouvé : vérifie ACCOUNT_ID et les droits du jeton.");
  return accounts[0];
}

const QUOTA_QUERY = `query($accountTag: String!, $start: Time!, $end: Time!) { viewer { accounts(filter: {accountTag: $accountTag}) {
  workersInvocationsAdaptive(limit: 10000, filter: {datetime_geq: $start, datetime_leq: $end}) {
    dimensions { scriptName } sum { requests errors subrequests } } } } }`;

async function fetchQuota(env, nowMs) {
  const acc = await gql(env, QUOTA_QUERY, { accountTag: env.ACCOUNT_ID, start: isoSec(dayStartMs(nowMs)), end: isoSec(nowMs) });
  const per = {};
  let errors = 0;
  for (const r of acc.workersInvocationsAdaptive || []) {
    const name = (r.dimensions && r.dimensions.scriptName) || "(inconnu)";
    const s = r.sum || {};
    per[name] = (per[name] || 0) + Number(s.requests || 0);
    errors += Number(s.errors || 0);
  }
  const scripts = Object.entries(per).sort((a, b) => b[1] - a[1]);
  return { day: isoDay(nowMs), at: new Date(nowMs).toISOString(), total: scripts.reduce((t, x) => t + x[1], 0), errors, scripts: scripts.slice(0, 6) };
}

function dayQuery(withVisits, withBot) {
  return "query($accountTag: String!, $since: Time!, $until: Time!) { viewer { accounts(filter: {accountTag: $accountTag}) { " +
    "rumPageloadEventsAdaptiveGroups(limit: 1000, filter: {datetime_geq: $since, datetime_lt: $until" + (withBot ? ", bot: 0" : "") + "}) { " +
    (withVisits ? "count sum { visits }" : "count") + " dimensions { requestHost requestPath refererHost } } } } }";
}

// Une requête par jour (UTC) : sur de longues périodes Cloudflare renverrait des estimations arrondies.
async function fetchDays(env, days, nowMs) {
  const flags = { visits: true, bot: true };
  const one = async (day) => {
    const since = Date.parse(day + "T00:00:00Z");
    const until = Math.min(since + 86400000, nowMs);
    if (until <= since) return [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const acc = await gql(env, dayQuery(flags.visits, flags.bot), { accountTag: env.ACCOUNT_ID, since: isoSec(since), until: isoSec(until) });
        const per = {};
        for (const r of acc.rumPageloadEventsAdaptiveGroups || []) {
          const d = r.dimensions || {};
          const key = matchSite(d.requestHost, d.requestPath);
          if (key === null) continue;
          const c = per[key] || (per[key] = { pages: 0, visits: 0 });
          c.pages += Number(r.count || 0);
          c.visits += Number((r.sum && r.sum.visits) || 0);
        }
        return Object.entries(per).map(([site, c]) => ({ site, date: day, pages: c.pages, visits: c.visits }));
      } catch (e) {
        const msg = String(e.message).toLowerCase();
        if (e.graphql && flags.visits && msg.includes("visits")) flags.visits = false;
        else if (e.graphql && flags.bot && msg.includes("bot")) flags.bot = false;
        else throw e;
      }
    }
    throw new ApiError("Cloudflare refuse la requête.", true);
  };
  // le premier jour sert de test (il règle les options acceptées), les autres suivent par petits lots
  const rows = [...(await one(days[0]))];
  for (let i = 1; i < days.length; i += 8) {
    const batch = await Promise.all(days.slice(i, i + 8).map(one));
    batch.forEach((b) => rows.push(...b));
  }
  return { rows, firstDay: days[0], hasVisits: flags.visits, botsExcluded: flags.bot };
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  // Les valeurs collées dans Cloudflare contiennent parfois un retour à la ligne ou une espace invisible.
  // Le jeton collé avec ses guillemets, une virgule ou « "token": » devant est aussi nettoyé.
  const rawToken = String(context.env.CF_API_TOKEN || "");
  const rawAccount = String(context.env.ACCOUNT_ID || "");
  const env = {
    CF_API_TOKEN: (rawToken.match(/[A-Za-z0-9_-]{30,}/) || [rawToken.trim()])[0],
    ACCOUNT_ID: (rawAccount.match(/[0-9a-fA-F]{32}/) || [rawAccount.trim()])[0],
    DASHBOARD_KEY: String(context.env.DASHBOARD_KEY || "").trim(),
  };
  if (!env.CF_API_TOKEN || !env.ACCOUNT_ID || !env.DASHBOARD_KEY) {
    return json({ error: "Configuration incomplète : il manque CF_API_TOKEN, ACCOUNT_ID ou DASHBOARD_KEY dans les variables du projet Pages." }, 500);
  }
  if (!sameKey((request.headers.get("X-Access-Key") || "").trim(), env.DASHBOARD_KEY)) {
    await new Promise((r) => setTimeout(r, 500));          // ralentit les essais de clés au hasard
    return json({ error: "Clé d'accès refusée" }, 401);
  }
  const n = Math.max(1, Math.min(31, parseInt(url.searchParams.get("days"), 10) || 3));
  const nowMs = Date.now();
  const days = [];
  for (let i = n - 1; i >= 0; i--) days.push(isoDay(dayStartMs(nowMs) - i * 86400000));
  try {
    const [quota, visits] = await Promise.all([fetchQuota(env, nowMs), fetchDays(env, days, nowMs)]);
    return json({ now: new Date(nowMs).toISOString(), limit: DAILY_LIMIT, sites: SITES, quota, visits });
  } catch (e) {
    return json({ error: e.message || String(e) }, e.status || 502);
  }
}
