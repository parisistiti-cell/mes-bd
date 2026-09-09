# Mes BD — guide de déploiement

## Structure

```
site/
├── index.html                        ← page d'accueil (liste les 2 BD)
├── laffaire-de-la-souris/            ← BD en libre accès
│   ├── index.html
│   └── images/00-couverture.jpg
└── entre-deux-vies/                  ← BD protégée par mot de passe
    ├── index.html
    └── images/00-couverture.jpg
```

## 1. Ajouter des planches à une BD

Dans le dossier de la BD concernée :

1. Dépose l'image dans `images/` (numérotation claire : `01.jpg`, `02.jpg`...).
2. Ouvre `index.html` de cette BD, repère le commentaire `AJOUTE TES PLANCHES ICI`,
   et ajoute un bloc par planche, dans l'ordre :

```html
<div class="page">
  <img src="images/01.jpg" alt="Planche 1">
</div>
```

3. Supprime le bloc `<div class="placeholder">...</div>` une fois ta première
   vraie planche ajoutée.

## 2. Ajouter une troisième BD plus tard

1. Duplique un des deux dossiers existants (par exemple `laffaire-de-la-souris/`),
   renomme-le, remplace la couverture et le titre dans son `index.html`.
2. Ouvre `index.html` (page d'accueil), repère le tableau `const books = [...]`
   et ajoute une ligne :

```js
{
  slug: "nom-du-dossier",
  title: "Titre de la BD",
  cover: "nom-du-dossier/images/00-couverture.jpg"
}
```

La table s'enrichit automatiquement — aucune autre modification nécessaire.
Le livre apparaît avec une légère inclinaison, posé parmi les autres.

**L'accueil ne montre jamais si un livre est libre ou protégé.** Cette
distinction se révèle seulement quand on clique dessus : un livre libre
s'ouvre directement, un livre protégé déclenche automatiquement la demande
de code (Cloudflare Access), sans rien à coder — c'est le comportement par
chemin déjà en place (voir étape 5 ci-dessous).

## 3. Mettre le projet sur GitHub (sans ligne de commande)

1. Va sur [github.com](https://github.com), connecte-toi, puis clique sur
   **New** (ou le **+** en haut à droite) → **New repository**.
2. Donne-lui un nom (ex : `mes-bd`), laisse Public ou Private selon ta
   préférence, ne coche aucune case d'initialisation, puis **Create repository**.
3. Sur la page du repo tout neuf, clique **Add file** → **Upload files**.
4. Depuis ton explorateur de fichiers, sélectionne tout le contenu du dossier
   `site` (le `index.html` à la racine, `README.md`, et les deux dossiers
   `entre-deux-vies/` et `laffaire-de-la-souris/`) et glisse-les ensemble
   dans la zone de dépôt. GitHub conserve automatiquement la structure des
   sous-dossiers.
5. En bas de page, laisse le message par défaut ou écris "Premier import du
   site", puis clique **Commit changes**.

Pour les mises à jour futures (ajout de planches), tu refais simplement
**Add file** → **Upload files** avec les fichiers modifiés — pas besoin de
`git` en ligne de commande, ni maintenant ni plus tard.

## 4. Déployer sur Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** →
   **Créer une application** → **Pages** → **Se connecter à Git**.
2. Sélectionne le repo `mes-bd`.
3. Laisse les paramètres de build vides (site statique, pas de build nécessaire).
4. **Enregistrer et déployer.** Ton site est en ligne sur
   `mes-bd.pages.dev` — la page d'accueil liste tes deux BD.

## 5. Protéger uniquement "Entre deux vies" (pas "L'affaire de la souris")

1. Dans le dashboard Cloudflare → **Zero Trust** (active-le gratuitement si besoin).
2. **Access** → **Applications** → **Ajouter une application** → **Self-hosted**.
3. Dans le champ du domaine, indique précisément le sous-chemin, pas le domaine entier :

   ```
   mes-bd.pages.dev/entre-deux-vies/*
   ```

4. Configure la règle d'accès :
   - **One-time PIN** : les personnes autorisées entrent leur email, reçoivent
     un code à usage unique par mail — pas de mot de passe à retenir ni à
     transmettre.
   - ou **liste d'emails précis** que tu autorises toi-même.
5. Sauvegarde.

**Important : ne crée aucune règle Access pour `/laffaire-de-la-souris/*`.**
Sans règle, Cloudflare laisse ce chemin en accès libre — c'est le comportement
par défaut. La page d'accueil elle-même (`mes-bd.pages.dev/`) reste aussi
publique, ce qui est voulu puisqu'elle ne montre que les couvertures et les
liens, pas le contenu protégé.

## 6. Le bouton "Télécharger en PDF"

Chaque page de BD a un bouton qui génère un PDF directement dans le
navigateur du lecteur, à partir de la couverture et de toutes les planches
déjà affichées sur la page (dans leur ordre d'apparition). Aucun serveur ni
fichier PDF à préparer toi-même :

- Le PDF se met à jour tout seul à chaque fois que tu ajoutes des planches
  au HTML — pas besoin de régénérer quoi que ce soit.
- Chaque page du PDF garde le format (portrait/paysage) et la taille de
  l'image d'origine.
- Cette fonctionnalité utilise la librairie gratuite jsPDF, chargée depuis
  un CDN — aucune installation nécessaire.

## 7. Mettre à jour le site

Sur la page de ton repo GitHub : **Add file** → **Upload files**, glisse les
fichiers modifiés ou ajoutés (nouvelles planches, `index.html` mis à jour),
puis **Commit changes**.

Cloudflare Pages redéploie automatiquement le site à chaque nouvel envoi.
