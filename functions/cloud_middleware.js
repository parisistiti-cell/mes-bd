// ===========================================================
// Protection par code d'accès unique pour les BD listées ci-dessous.
//
// Comment ça marche :
// - Le code correct est défini par la variable d'environnement ACCESS_CODE
//   (à configurer dans le dashboard Cloudflare, jamais dans ce fichier).
// - Une fois le bon code entré, un cookie signé est posé pour tout le site :
//   les autres livres protégés s'ouvrent alors directement, sans redemander
//   le code, pendant 30 jours.
// - La vérification se fait entièrement côté serveur (Cloudflare) : le code
//   n'est jamais visible dans le code source envoyé au navigateur.
// ===========================================================

// Ajoute ici le slug de chaque BD à protéger (le nom de son dossier).
const PROTECTED_SLUGS = ["entre-deux-vies"];

const COOKIE_NAME = "bd_access";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

async function sign(secret, value) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

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

  const expectedToken = await sign(ACCESS_CODE, "granted");
  const cookieToken = getCookie(request, COOKIE_NAME);

  if (cookieToken === expectedToken) {
    return next();
  }

  if (request.method === "POST") {
    const form = await request.formData();
    const submitted = form.get("code");

    if (submitted === ACCESS_CODE) {
      const headers = new Headers();
      headers.set("Location", url.pathname);
      headers.append(
        "Set-Cookie",
        `${COOKIE_NAME}=${expectedToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`
      );
      return new Response(null, { status: 302, headers });
    }

    return renderForm(url.pathname, true);
  }

  return renderForm(url.pathname, false);
}
