"""Analisi numerica delle immagini di riferimento inviate dall'utente.

Il modello non può vedere le immagini: questo script estrae dimensioni, palette
dominante e una rappresentazione testuale (ASCII a colori) per guidare la direzione artistica.
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

from PIL import Image


def describe(path: Path) -> None:
    im = Image.open(path).convert("RGB")
    print(f"\n=== {path.name} ===")
    print(f"dimensioni: {im.width}x{im.height}")

    small = im.copy()
    small.thumbnail((160, 160))
    q = small.quantize(colors=12, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette() or []
    counts = Counter(q.getdata())
    print("palette dominante (RGB, percentuale):")
    for idx, n in counts.most_common(12):
        r, g, b = pal[idx * 3 : idx * 3 + 3]
        print(f"  #{r:02X}{g:02X}{b:02X}  {100 * n / (small.width * small.height):5.1f}%")

    # Rappresentazione testuale: schema regionale a 48x20, simboli per luminanza/saturazione.
    w, h = 48, 20
    mini = im.resize((w, h), Image.Resampling.BILINEAR)
    chars = " .:-=+*#%@"
    print("mappa testuale (chiaro=@, scuro=spazio):")
    for y in range(h):
        row = ""
        for x in range(w):
            r, g, b = mini.getpixel((x, y))
            lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
            row += chars[min(9, int(lum * 10))]
        print("  " + row)


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        describe(Path(arg))
