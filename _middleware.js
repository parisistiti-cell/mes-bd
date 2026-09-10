// ===========================================================
// Protection par code d'accès unique pour les BD listées ci-dessous.
//
// Comment ça marche :
// - Le code correct est défini par la variable d'environnement ACCESS_CODE
//   (à configurer dans le dashboard Cloudflare, jamais dans ce fichier).
// - Aucun cookie n'est posé : le code est redemandé systématiquement à
//   chaque nouvelle visite d'un livre protégé, même si tu l'as déjà
//   entré une minute avant.
// - La vérification se fait entièrement côté serveur (Cloudflare) : le code
//   n'est jamais visible dans le code source envoyé au navigateur.
// ===========================================================

// Ajoute ici le slug de chaque BD à protéger (le nom de son dossier).
const PROTECTED_SLUGS = ["entre-deux-vies"];

function isProtectedPath(pathname) {
  return PROTECTED_SLUGS.some((slug) => pathname === `/${slug}` || pathname.startsWith(`/${slug}/`));
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

  if (!isProtectedPath(url.pathname)) {
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
      // Code correct : on sert directement le contenu de la page pour
      // cette visite, sans poser de cookie. La prochaine visite redemandera
      // le code depuis le début.
      const getRequest = new Request(url.toString(), { method: "GET", headers: request.headers });
      return next(getRequest);
    }

    return renderForm(url.pathname, true);
  }

  return renderForm(url.pathname, false);
}
