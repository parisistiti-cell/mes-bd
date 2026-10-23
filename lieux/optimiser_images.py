#!/usr/bin/env python3
"""
Optimise les images du dépôt (à lancer en local, à la racine du dossier lieux/) :
    pip install pillow
    python optimiser_images.py

 - images/NN.jpg      -> recompressées (max 1800 px, JPEG progressif qualité 80)
 - images/thumbs/NN.jpg -> miniatures 240 px pour la bande du bas
 - photos/*           -> recompressées (max 1400 px, qualité 78)
Les noms restent identiques : rien à changer dans le HTML.
Les originaux sont conservés dans _originaux/ (à ne pas pousser sur GitHub).
"""
import shutil
from pathlib import Path
from PIL import Image, ImageOps

def save(img, dest, quality):
    img = img.convert("RGB")
    img.save(dest, "JPEG", quality=quality, optimize=True, progressive=True)

def process(folder, max_side, quality, thumbs=False):
    src_dir = Path(folder)
    if not src_dir.exists():
        return
    backup = Path("_originaux") / folder
    backup.mkdir(parents=True, exist_ok=True)
    if thumbs:
        (src_dir / "thumbs").mkdir(exist_ok=True)
    for f in sorted(src_dir.iterdir()):
        if not f.is_file() or f.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        before = f.stat().st_size
        shutil.copy2(f, backup / f.name)
        im = ImageOps.exif_transpose(Image.open(f))
        if thumbs:
            t = im.copy(); t.thumbnail((240, 240 * 4))
            save(t, src_dir / "thumbs" / (f.stem + ".jpg"), 70)
        im.thumbnail((max_side, max_side))
        # même nom/extension qu'avant pour ne rien casser
        if f.suffix.lower() in {".jpg", ".jpeg"}:
            save(im, f, quality)
        elif f.suffix.lower() == ".png":
            im.save(f, "PNG", optimize=True)
        else:
            im.save(f, "WEBP", quality=quality)
        print(f"{f.name}: {before//1024} Ko -> {f.stat().st_size//1024} Ko")

process("images", 1800, 80, thumbs=True)
process("photos", 1400, 78)
