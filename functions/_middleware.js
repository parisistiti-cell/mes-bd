const PROTECTED_SLUGS = ['entre-deux-vies']; // Remplacez par les dossiers de vos BD protégées
const PASSWORD = '0711'; // Le code d'accès unique
const COOKIE_NAME = 'bd_access_granted';

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Vérifie si le chemin correspond à une BD protégée
  const isProtected = PROTECTED_SLUGS.some(slug => path.startsWith(`/${slug}`));

  if (!isProtected) {
    return next();
  }

  // Vérifie si le cookie d'accès est présent
  const cookieHeader = request.headers.get('Cookie') || '';
  if (cookieHeader.includes(`${COOKIE_NAME}=true`)) {
    return next();
  }

  // Traitement du formulaire si l'utilisateur a soumis le code
  if (request.method === 'POST') {
    const formData = await request.formData();
    const inputPassword = formData.get('password');

    if (inputPassword === PASSWORD) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': request.url,
          'Set-Cookie': `${COOKIE_NAME}=true; Max-Age=${30 * 24 * 60 * 60}; Path=/; HttpOnly; Secure; SameSite=Lax`
        }
      });
    }
  }

  // Affichage du formulaire de mot de passe
  return new Response(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Accès protégé</title>
      <style>
        body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #0f172a; color: #f8fafc; margin: 0; }
        .card { background: #1e293b; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); text-align: center; max-width: 320px; width: 100%; }
        input { width: 80%; padding: 0.75rem; font-size: 1rem; margin-bottom: 1rem; border: 1px solid #475569; border-radius: 6px; background: #0f172a; color: white; }
        button { width: 100%; padding: 0.75rem; font-size: 1rem; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
        button:hover { background: #2563eb; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>🔒 BD Protégée</h2>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem;">Entrez le code d'accès unique pour déverrouiller la lecture.</p>
        <form method="POST">
          <input type="password" name="password" placeholder="Code secret" required autofocus>
          <button type="submit">Valider</button>
        </form>
      </div>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}