#!/usr/bin/env python3
"""
Ajoute à chaque BD (dossier/index.html) : <title>, meta description, canonical,
Open Graph / Twitter (image = la couverture de la BD), JSON-LD, alt des planches.
Génère aussi sitemap.xml (avec les couvertures) et robots.txt.

Usage (depuis la racine du site, là où se trouvent les dossiers des BD) :
    python3 seo_bd.py            # simulation : n'écrit rien, affiche ce qui changerait
    python3 seo_bd.py --write    # applique les modifications
Faites une sauvegarde (ou utilisez git) avant --write.
"""
import re, sys, json, html
from pathlib import Path

SITE = "https://mes-bd.pages.dev"
TODAY = "2026-10-26"
AUTEUR = "TP"
# BD "en travaux" : non indexées et absentes du sitemap (mettre set() pour tout indexer)
EN_TRAVAUX = {"entre-deux-vies", "avance", "Tranche-de-vie", "tp", "venus"}
SUFFIXE = " BD à lire en ligne, textes et photos de TP, illustrations IA."

BOOKS = [
("Ardeche-2026","Ardèche 2026","Un voyage de 15 jours en Ardèche en août 2026."),
("conf","Confiture de melon d'Espagne","Recette complète de la confiture de melon d'Espagne."),
("entre-deux-vies","Entre deux vies","Une rencontre improbable."),
("lieux","Lieux","Retrouver et localiser des lieux d'Europe de l'Ouest à partir de photos et de souvenirs."),
("moto","Moto","Rénovation de mobylettes Motobécane anciennes et de motos anciennes ou modernes."),
("avance","Avance","Une impossible histoire sentimentale."),
("laffaire-de-la-souris","L'affaire de la souris","L'histoire d'un handicap : ne pas connaître sa droite et sa gauche."),
("eusk","Pays basque espagnol","Un voyage de 7 jours au Pays basque espagnol en décembre 2024."),
("leym","Leymarie","Un lieu de vie en Périgord, à Leymarie."),
("code","Code","Des aventures médicales."),
("bloi","Blois et les châteaux de la Loire","Un voyage de 5 jours autour des châteaux de la Loire."),
("ia","Intelligence artificielle","Des informations sur l'intelligence artificielle."),
("Tranche-de-vie","Tranche de vie","L'histoire d'une fin logique."),
("sola","Solaire","Une installation photovoltaïque domestique."),
("clis","Clisson et le Hellfest","Une visite du site du Hellfest à Clisson, hors festival."),
("meca","Mécanique","Histoires de réparations mécaniques."),
("jard","Jardin","L'histoire d'un jardin domestique."),
("corezlot","Corrèze et Lot","Des lieux à voir en Corrèze et dans le Lot."),
("opti","Récupération d'eau de pluie","La récupération de l'eau de pluie avec l'entreprise Optimeau."),
("phrases","Phrases","Un guide de croissance personnelle."),
("irla","Irlande","Un voyage de 15 jours dans le sud-ouest de l'Irlande, de Cork à Clifden (Connemara)."),
("tp","TP","Pour un peu connaître l'auteur."),
("reseaux","Réseaux sociaux","Des informations de base sur les réseaux sociaux."),
("venus","Vénus","Présentation d'un caractère et d'un tempérament, ou du moins de sa perception."),
("drone","Drone","Les prérequis pour piloter un drone en France."),
("bre","Sud Bretagne","Un voyage de 7 jours dans le sud de la Bretagne en décembre 2025."),
("catha","Châteaux cathares","Une visite de châteaux cathares."),
]
e = lambda s: html.escape(s, quote=True)
START, END = "<!-- SEO:start -->", "<!-- SEO:end -->"

def seo_block(slug, t, d, solo=False):
    url = f"{SITE}/{slug}/"
    img = f"{SITE}/{slug}/images/00-couverture.jpg"
    title = f"{t} — BD en ligne | Mes BD"
    desc = d + SUFFIXE
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "CreativeWork", "name": t, "description": d, "url": url, "image": img,
         "inLanguage": "fr", "author": {"@type": "Person", "name": AUTEUR},
         "isPartOf": {"@type": "WebSite", "name": "Mes BD", "url": SITE + "/"}},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Mes BD", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": t, "item": url}]}]}
    lines = [START, f"<title>{e(title)}</title>",
        f'<meta name="description" content="{e(desc)}">']
    if solo or slug in EN_TRAVAUX:
        lines.append('<meta name="robots" content="noindex, follow">')
        if solo:
            lines.append(f'<link rel="canonical" href="{url}">')  # version -solo : on pointe vers la BD principale
    else:
        lines.append('<meta name="robots" content="index, follow">')
        lines.append(f'<link rel="canonical" href="{url}">')
    lines += [
        '<meta property="og:type" content="article">',
        '<meta property="og:locale" content="fr_FR">',
        '<meta property="og:site_name" content="Mes BD">',
        f'<meta property="og:title" content="{e(t)} — Mes BD">',
        f'<meta property="og:description" content="{e(d)}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{img}">',
        f'<meta property="og:image:alt" content="Couverture de la BD {e(t)}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{e(t)} — Mes BD">',
        f'<meta name="twitter:description" content="{e(d)}">',
        f'<meta name="twitter:image" content="{img}">',
        '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>',
        END]
    return "\n".join(lines), title, desc

def transform(src, slug, t, d, solo=False):
    block, title, desc = seo_block(slug, t, d, solo)
    # 1. retirer l'ancien bloc SEO et les anciennes balises
    src = re.sub(re.escape(START) + r".*?" + re.escape(END) + r"\n?", "", src, flags=re.S)
    head_m = re.search(r"<head>.*?</head>", src, flags=re.S)
    if not head_m:
        raise ValueError("pas de <head>")
    head = head_m.group(0)
    for pat in [r"<title>.*?</title>\s*", r'<meta name="description"[^>]*>\s*',
                r'<meta name="robots"[^>]*>\s*', r'<link rel="canonical"[^>]*>\s*',
                r'<meta property="og:[^>]*>\s*', r'<meta name="twitter:[^>]*>\s*']:
        head = re.sub(pat, "", head, flags=re.S)
    # 2. insérer le nouveau bloc après la balise viewport (sinon après <head>)
    m = re.search(r'<meta name="viewport"[^>]*>', head)
    ins = m.end() if m else len("<head>")
    head = head[:ins] + "\n" + block + head[ins:]
    src = src[:head_m.start()] + head + src[head_m.end():]
    # 3. titres visibles : h1 et barre du haut (seulement s'ils contiennent le nom du dossier)
    src = re.sub(r'(<h1>)\s*' + re.escape(slug) + r'\s*(</h1>)', rf'\g<1>{t}\g<2>', src, count=1)
    src = re.sub(r'(<a class="topbar__title"[^>]*>)\s*' + re.escape(slug) + r'\s*(</a>)', rf'\g<1>{t}\g<2>', src, count=1)
    # 4. image d'en-tête : alt précis, et pas de lazy-loading (elle est en haut de page)
    def hero(m):
        h = m.group(0)
        h = h.replace(' loading="lazy"', '')
        return re.sub(r'alt="[^"]*"', f'alt="Couverture de la BD {e(t)}"', h)
    src = re.sub(r'<header class="hero">.*?</header>', hero, src, count=1, flags=re.S)
    # 5. alt des planches
    src = re.sub(r'alt="Planche (\d+)"', lambda mm: f'alt="{e(t)} — planche {int(mm.group(1))}"', src)
    return src, title, desc

def sitemap():
    rows = [f"  <url><loc>{SITE}/</loc><lastmod>{TODAY}</lastmod></url>"]
    for slug, t, d in BOOKS:
        if slug in EN_TRAVAUX: continue
        rows.append(f"  <url><loc>{SITE}/{slug}/</loc><lastmod>{TODAY}</lastmod>"
                    f"<image:image><image:loc>{SITE}/{slug}/images/00-couverture.jpg</image:loc>"
                    f"<image:title>{e(t)}</image:title></image:image></url>")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + "\n".join(rows) + "\n</urlset>\n")

def main():
    write = "--write" in sys.argv
    root = Path(".")
    # chaque BD + ses éventuelles versions "-solo" (noindex, canonical vers la BD principale)
    jobs = []
    for slug, t, d in BOOKS:
        jobs.append((slug, slug, t, d, False))
        for extra in {f"{slug}-solo", slug.lower() + "-solo", slug.split("-")[0].lower() + "-solo"}:
            jobs.append((extra, slug, t, d, True))
    for folder, slug, t, d, solo in jobs:
        f = root / folder / "index.html"
        if not f.exists():
            if not solo: print(f"[absent ] {folder}/index.html")
            continue
        new, title, desc = transform(f.read_text(encoding="utf-8"), slug, t, d, solo)
        warn = []
        if len(title) > 60: warn.append(f"title {len(title)} car.")
        if len(desc) > 160: warn.append(f"description {len(desc)} car.")
        etat = "noindex " if (solo or slug in EN_TRAVAUX) else "indexée "
        print(f"[{'écrit ' if write else 'simulé'}] {folder:24} {etat} {' / '.join(warn)}")
        if write: f.write_text(new, encoding="utf-8")
    if write:
        Path("sitemap.xml").write_text(sitemap(), encoding="utf-8")
        Path("robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n", encoding="utf-8")
        print("sitemap.xml et robots.txt écrits.")
    else:
        print("\nSimulation seulement. Relancez avec --write pour appliquer.")

if __name__ == "__main__":
    main()
