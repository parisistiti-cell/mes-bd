// ===========================================================
// Protection par code d'accès unique pour les BD listées ci-dessous.
//
// Comment ça marche :
// - Le code correct est défini par la variable d'environnement ACCESS_CODE
//   (à configurer dans le dashboard Cloudflare, jamais dans ce fichier).
// - La page du livre elle-même redemande TOUJOURS le code à chaque visite.
// - Une fois le bon code entré, un cookie très temporaire (5 minutes) est
//   posé pour laisser les images de PLANCHES de cette page se charger
//   normalement, sans redemander le code à chaque image. Passé ce délai,
//   ou lors d'une nouvelle visite, le code est de nouveau demandé.
// - La vérification se fait entièrement côté serveur (Cloudflare) : le code
//   n'est jamais visible dans le code source envoyé au navigateur.
// ===========================================================

// Ajoute ici le slug de chaque BD à protéger (le nom de son dossier).
const PROTECTED_SLUGS = ["entre-deux-vies", "Tranche-de-vie"];

const COOKIE_NAME = "bd_temp_access";
const COOKIE_MAX_AGE = 300; // 5 minutes, juste le temps de charger la page

function isProtectedPath(pathname) {
  return PROTECTED_SLUGS.some((slug) => pathname === `/${slug}` || pathname.startsWith(`/${slug}/`));
}

// La couverture reste toujours visible, même pour une BD protégée : c'est
// elle qui s'affiche sur la table d'accueil, avant que le visiteur choisisse
// un livre. Tout le reste (page de lecture, planches) reste protégé.
function isPublicCover(pathname) {
  return /\/images\/00-couverture\.jpg$/i.test(pathname);
}

// Une planche ou toute autre image du livre (pas la page HTML elle-même).
function isImageAsset(pathname) {
  return /\.(jpe?g|png|gif|webp)$/i.test(pathname);
}

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
  h1 { font-size: 1.1rem; margin: 0 0 18px; color: #2f2a25; display: flex; align-items: center;
       justify-content: center; gap: 8px; }
  h1 svg { flex-shrink: 0; }
  .field { position: relative; margin-bottom: 14px; }
  input[type=password], input[type=text].code-input {
    width: 100%; padding: 10px 44px 10px 12px; font-size: 1rem; border: 1px solid #ccc;
    border-radius: 6px; box-sizing: border-box; font-family: inherit;
  }
  .toggle-btn {
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; padding: 6px;
    display: flex; align-items: center; justify-content: center; color: #6b5c50;
  }
  .toggle-btn:hover { color: #2f2a25; }
  button.submit-btn { width: 100%; padding: 10px; font-size: 1rem; background: #9c4a47; color: #f2ead9;
           border: none; border-radius: 6px; cursor: pointer; }
  .err { color: #9c4a47; font-size: 0.85rem; margin-bottom: 12px; }
</style>
</head>
<body>
  <div class="box">
    <h1>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="8" cy="15" r="4"></circle>
        <path d="M10.5 12.5L20 3M20 3h-4M20 3v4"></path>
      </svg>
      Ce livre est protégé
    </h1>
    ${wrong ? '<p class="err">Code incorrect, réessaie.</p>' : ""}
    <form method="POST" action="${pathname}" id="access-form">
      <div class="field">
        <input type="password" name="code" id="code-input" placeholder="Code d'accès" autofocus required>
        <button type="button" class="toggle-btn" id="toggle-btn" aria-label="Afficher le code">
          <svg id="eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      </div>
      <input type="hidden" name="target" id="target-field" value="">
      <button type="submit" class="submit-btn">Valider</button>
    </form>
  </div>
  <script>
    document.getElementById('target-field').value = window.location.hash || "";

    const codeInput = document.getElementById('code-input');
    const toggleBtn = document.getElementById('toggle-btn');
    const eyeIcon = document.getElementById('eye-icon');
    const eyeOpen = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>';
    const eyeClosed = '<path d="M17.94 17.94A10.94 10.94 0 0112 19c-7 0-11-7-11-7a18.5 18.5 0 015.06-5.94M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 7 11 7a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24"></path><path d="M1 1l22 22"></path>';
    toggleBtn.addEventListener('click', () => {
      const isPassword = codeInput.type === 'password';
      codeInput.type = isPassword ? 'text' : 'password';
      codeInput.classList.toggle('code-input', isPassword);
      eyeIcon.innerHTML = isPassword ? eyeClosed : eyeOpen;
      toggleBtn.setAttribute('aria-label', isPassword ? 'Masquer le code' : 'Afficher le code');
    });
  </script>
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

  const expectedToken = await sign(ACCESS_CODE, "granted");

  // Planches et autres images : on vérifie juste le cookie temporaire posé
  // au moment où le code a été validé pour cette page.
  if (isImageAsset(url.pathname)) {
    const token = getCookie(request, COOKIE_NAME);
    if (token === expectedToken) {
      return next();
    }
    return new Response("Accès refusé", { status: 403 });
  }

  // La page de lecture elle-même : toujours redemander le code.
  if (request.method === "POST") {
    const form = await request.formData();
    const submitted = form.get("code");
    const target = form.get("target") || "";

    if (submitted === ACCESS_CODE) {
      const pageResponse = await env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
      let html = await pageResponse.text();

      if (target && /^#[a-zA-Z0-9_-]+$/.test(target)) {
        const isolateScript = `<script>document.addEventListener("DOMContentLoaded", function () {
  if (window.__isolatePage) { window.__isolatePage(${JSON.stringify(target)}); }
});</script>`;
        html = html.replace("</body>", `${isolateScript}</body>`);
      }

      const headers = new Headers({ "Content-Type": "text/html; charset=utf-8" });
      headers.append(
        "Set-Cookie",
        `${COOKIE_NAME}=${expectedToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`
      );
      return new Response(html, { headers });
    }

    return renderForm(url.pathname, true);
  }

  return renderForm(url.pathname, false);
}
