// ===========================================================
// Protection par code d'accès unique pour les BD listées ci-dessous.
//
// Comment ça marche :
// - Le code correct est défini par la variable d'environnement ACCESS_CODE
//   (à configurer dans le dashboard Cloudflare, jamais dans ce fichier).
// - Aucun cookie n'est posé : le code est redemandé systématiquement à
//   chaque nouvelle visite d'un livre protégé.
// - Une fois le bon code entré, la page (titre + planches) est renvoyée
//   directement en une seule réponse, images comprises (intégrées dans le
//   HTML), pour que rien ne redemande le code en cours de route.
// - La vérification se fait entièrement côté serveur (Cloudflare) : le code
//   n'est jamais visible dans le code source envoyé au navigateur.
// ===========================================================

// Ajoute ici le slug de chaque BD à protéger (le nom de son dossier).
const PROTECTED_SLUGS = ["entre-deux-vies", "Tranche-de-vie"];

function isProtectedPath(pathname) {
  return PROTECTED_SLUGS.some((slug) => pathname === `/${slug}` || pathname.startsWith(`/${slug}/`));
}

// La couverture (00-couverture.jpg) reste toujours visible, même pour une BD
// protégée : c'est elle qui s'affiche sur la table d'accueil, avant que le
// visiteur ait choisi un livre. Tout le reste (la page de lecture, les
// planches) reste protégé normalement.
function isPublicCover(pathname) {
  return /\/images\/00-couverture\.jpg$/i.test(pathname);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Récupère la page HTML demandée et remplace chaque image locale par sa
// version encodée directement dans le HTML (data URI), pour que la page
// s'affiche entièrement en une seule réponse, sans requêtes séparées que
// la protection bloquerait.
async function servePageWithInlinedImages(url, env) {
  const pageResponse = await env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
  const contentType = pageResponse.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return pageResponse;
  }

  let html = await pageResponse.text();
  const imgRegex = /src="([^":]+\.(?:jpg|jpeg|png|gif|webp))"/gi;
  const sources = [...new Set([...html.matchAll(imgRegex)].map((m) => m[1]))]
    .filter((src) => !/^(https?:)?\/\//i.test(src));

  const inlined = await Promise.all(
    sources.map(async (src) => {
      try {
        const assetUrl = new URL(src, url).toString();
        const imgRes = await env.ASSETS.fetch(new Request(assetUrl));
        if (!imgRes.ok) return null;
        const buffer = await imgRes.arrayBuffer();
        const mime = imgRes.headers.get("content-type") || "image/jpeg";
        return [src, `data:${mime};base64,${arrayBufferToBase64(buffer)}`];
      } catch {
        return null;
      }
    })
  );

  for (const entry of inlined) {
    if (!entry) continue;
    const [src, dataUri] = entry;
    const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(`src="${escaped}"`, "g"), `src="${dataUri}"`);
  }

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function renderForm(pathname, wrong) {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Accès protégé</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #2f2a25; font-family: -apple-system, sans-serif; }
  .box { background: #f2ead9; padding: 40px 32px; border-radius: 8px; max-width: 320px; width: 90%; text-align: center; }
  h1 { font-size: 1.1rem; margin: 0 0 18px; color: #2f2a25; }
  input[type=password] { width: 100%; padding: 10px 12px; font-size: 1rem; border: 1px solid #ccc;
                          border-radius: 6px; box-sizing: border-box; margin-bottom: 14px; }
  button { width: 100%; padding: 10px; font-size: 1rem; background: #9c4a47; color: #f2ead9;
           border: none; border-radius: 6px; cursor: pointer; }
  .err { color: #9c4a47; font-size: 0.85rem; margin-bottom: 12px; }
</style>
</head>
<body>
  <div class="box">
    <h1>Ce livre est protégé</h1>
    ${wrong ? '<p class="err">Code incorrect, réessaie.</p>' : ""}
    <form method="POST" action="${pathname}">
      <input type="password" name="code" placeholder="Code d'accès" autofocus required>
      <button type="submit">Valider</button>
    </form>
  </div>
</body>
</html>`;
  return new Response(html, { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  if (!isProtectedPath(url.pathname) || isPublicCover(url.pathname)) {
    return next();
  }

  const ACCESS_CODE = env.ACCESS_CODE;
  if (!ACCESS_CODE) {
    return new Response(
      "Configuration manquante : ajoute la variable d'environnement ACCESS_CODE dans le dashboard Cloudflare Pages.",
      { status: 500 }
    );
  }

  if (request.method === "POST") {
    const form = await request.formData();
    const submitted = form.get("code");

    if (submitted === ACCESS_CODE) {
      return servePageWithInlinedImages(url, env);
    }

    return renderForm(url.pathname, true);
  }

  return renderForm(url.pathname, false);
}
