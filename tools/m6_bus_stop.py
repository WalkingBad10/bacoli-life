"""Fermata autobus M6 nella palette approvata (1 m = 16 px).

Uso: python tools/m6_bus_stop.py
Scrive solo public/assets/scale/bus_stop.png, senza rigenerare gli altri asset.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "scale" / "bus_stop.png"

INK = "#0C1823"
WHITE = "#F2EAD8"
SEA = "#185F76"
SEA_MID = "#337A98"
OCHRE = "#E6AB2D"
STONE = "#BC9E87"
SHADE = "#B69375"


def rect(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color: str) -> None:
    d.rectangle((x, y, x + w - 1, y + h - 1), fill=color)


def main() -> None:
    im = Image.new("RGBA", (24, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # Ombre a terra: due striature, non un rettangolo pieno.
    rect(d, 5, 45, 14, 2, INK)
    rect(d, 7, 43, 10, 1, SHADE)

    # Palo e basamento.
    rect(d, 11, 22, 3, 23, INK)
    rect(d, 12, 23, 1, 21, STONE)
    rect(d, 9, 44, 7, 3, INK)

    # Cartello: sagoma scura, campo blu EAV, bordo chiaro.
    rect(d, 2, 2, 21, 25, INK)
    rect(d, 4, 4, 17, 21, WHITE)
    rect(d, 5, 5, 15, 19, SEA)
    rect(d, 6, 6, 13, 6, SEA_MID)

    # Autobus stilizzato: tre finestrini, due ruote, faro posteriore.
    rect(d, 7, 12, 11, 8, WHITE)
    rect(d, 8, 13, 3, 3, SEA)
    rect(d, 12, 13, 3, 3, SEA)
    rect(d, 16, 13, 1, 3, OCHRE)
    rect(d, 8, 20, 2, 2, INK)
    rect(d, 15, 20, 2, 2, INK)

    im.save(OUT)
    print(f"fermata bus: {OUT} {im.width}x{im.height}")


if __name__ == "__main__":
    main()
