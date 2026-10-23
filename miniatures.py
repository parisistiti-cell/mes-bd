#!/usr/bin/env python3
"""
Crée un dossier 'thumbs' (miniatures 240 px) à côté des images de chaque BD.
    python miniatures.py                 -> tous les dossiers
    python miniatures.py Ardeche-2026    -> seulement ce dossier

Exemple : Ardeche-2026/images/03.jpg  ->  Ardeche-2026/images/thumbs/03.jpg
 - Les miniatures déjà existantes ne sont pas recréées
 - Les images originales ne sont jamais modifiées
 - Les images très légères (< 40 Ko) n'ont pas de miniature (inutile)
"""
import sys
from pathlib import Path
from PIL import Image, ImageOps

SKIP_DIRS = {".git", ".github", "thumbs", "node_modules"}
EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MIN_SIZE = 40 * 1024

root = Path(".")
if len(sys.argv) > 1 and sys.argv[1].strip():
    root = Path(sys.argv[1].strip().strip("/"))
if not root.exists():
    sys.exit(f"Dossier introuvable : {root}")

created = 0
for f in sorted(root.rglob("*")):
    if not f.is_file() or f.suffix.lower() not in EXTS:
        continue
    if any(p in SKIP_DIRS for p in f.parts) or f.parent == Path("."):
        continue
    if f.stat().st_size < MIN_SIZE:
        continue
    dest = f.parent / "thumbs" / (f.stem + ".jpg")
    if dest.exists():
        continue
    try:
        im = ImageOps.exif_transpose(Image.open(f))
        im.load()
        im.thumbnail((240, 960))
        dest.parent.mkdir(exist_ok=True)
        im.convert("RGB").save(dest, "JPEG", quality=70, optimize=True, progressive=True)
        created += 1
        print(f"{dest} ({dest.stat().st_size//1024} Ko)")
    except Exception:
        print(f"IGNORÉ (illisible) : {f}")
print(f"\n{created} miniature(s) créée(s)")
