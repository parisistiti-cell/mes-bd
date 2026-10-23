#!/usr/bin/env python3
"""
Optimise les images de tout le dépôt (ou d'un seul dossier).
    python optimiser_tout.py            -> tous les dossiers sauf lieux/
    python optimiser_tout.py Ardeche-2026   -> seulement ce dossier

 - Images réduites à 1800 px max, JPEG progressif qualité 80 (mêmes noms, même format)
 - Les images déjà légères (< 250 Ko et <= 1800 px) ne sont PAS retouchées
 - Si le résultat est plus lourd que l'original, l'original est conservé
 - Les fichiers illisibles sont ignorés
"""
import io, sys
from pathlib import Path
from PIL import Image, ImageOps

MAX_SIDE = 1800
QUALITY = 80
SKIP_SMALL = 250 * 1024
SKIP_DIRS = {".git", ".github", "thumbs", "node_modules", "lieux"}
EXTS = {".jpg", ".jpeg", ".png", ".webp"}

def encode(im, ext):
    buf = io.BytesIO()
    if ext in (".jpg", ".jpeg"):
        im.convert("RGB").save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    elif ext == ".png":
        im.save(buf, "PNG", optimize=True)
    else:
        im.save(buf, "WEBP", quality=QUALITY)
    return buf.getvalue()

def process(f):
    before = f.stat().st_size
    try:
        im = Image.open(f)
        im.load()
        im = ImageOps.exif_transpose(im)
    except Exception:
        print(f"IGNORÉ (illisible) : {f}")
        return 0
    if before < SKIP_SMALL and max(im.size) <= MAX_SIDE:
        return 0
    im.thumbnail((MAX_SIDE, MAX_SIDE))
    data = encode(im, f.suffix.lower())
    if len(data) >= before:
        return 0
    f.write_bytes(data)
    print(f"{f}: {before//1024} Ko -> {len(data)//1024} Ko")
    return before - len(data)

def main():
    root = Path(".")
    if len(sys.argv) > 1 and sys.argv[1].strip():
        targets = [root / sys.argv[1].strip().strip("/")]
        skip = SKIP_DIRS - {targets[0].name}
    else:
        targets = [root]
        skip = SKIP_DIRS
    saved = 0
    for t in targets:
        if not t.exists():
            print(f"Dossier introuvable : {t}")
            continue
        for f in sorted(t.rglob("*")):
            if not f.is_file() or f.suffix.lower() not in EXTS:
                continue
            if any(p in skip for p in f.parts):
                continue
            saved += process(f)
    print(f"\nGain total : {saved // (1024*1024)} Mo")

main()
