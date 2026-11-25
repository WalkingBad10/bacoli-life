"""Generatore di pixel art NATIVA per la revisione grafica in scala 1 metro = 16 pixel.

Adulto 1,75 m = 28 px; un piano edilizio 3,25 m = 52 px.
Tutto e` disegnato pixel per pixel con Pillow.ImageDraw, con seed deterministico.
Nessuna API esterna, nessun upscale di sprite esistenti.

Uso: python tools/generate_assets_scale.py
Output: public/assets/scale/ (solo li`).
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "scale"
OUT.mkdir(parents=True, exist_ok=True)

random.seed(160325)

# Palette approvata (19 colori). Le ombre usano solo ink con alpha.
P = {
    "ink": "#0C1823",
    "sand": "#D3B59D",
    "stone": "#BC9E87",
    "plaster": "#DBC8A6",
    "shade": "#B69375",
    "terra": "#B67352",
    "terra_dark": "#825834",
    "ochre": "#E6AB2D",
    "sea": "#185F76",
    "sea_mid": "#337A98",
    "sea_light": "#3A9FF3",
    "foam": "#AFD7E3",
    "olive": "#4C6E44",
    "leaf": "#51B526",
    "wood": "#78614C",
    "wood_dark": "#4E3F2D",
    "white": "#F2EAD8",
    "red": "#B1403B",
}
INK = P["ink"]
FILES: list[str] = []


def c(name: str) -> str:
    return P.get(name, name)


def canvas(w: int, h: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def rect(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color: str) -> None:
    if w > 0 and h > 0:
        d.rectangle((x, y, x + w - 1, y + h - 1), fill=c(color))


def edge(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color: str = "ink", width: int = 1) -> None:
    d.rectangle((x, y, x + w - 1, y + h - 1), outline=c(color), width=width)


def dot(d: ImageDraw.ImageDraw, x: int, y: int, color: str) -> None:
    d.point((x, y), fill=c(color))


def oval(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill, outline=None) -> None:
    d.ellipse(box, fill=fill, outline=outline)


def speckle(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int,
            colors: tuple[str, ...], seed: int, density: float) -> None:
    rnd = random.Random(seed)
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if rnd.random() < density:
                dot(d, xx, yy, rnd.choice(colors))


def shadow(d: ImageDraw.ImageDraw, box: tuple[int, int, int, int], alpha: int = 80) -> None:
    oval(d, box, (*bytes.fromhex(INK[1:]), alpha))


def save(im: Image.Image, name: str) -> None:
    im.save(OUT / name)
    FILES.append(name)


# ---------------------------------------------------------------------------
# 1. PERSONAGGI - sheet 64x128, 4 direzioni x 4 frame, frame 16x32
# ---------------------------------------------------------------------------

OUTFITS: tuple[tuple[str, str, str, str, str], ...] = (
    ("sea_mid", "wood_dark", "wood_dark", "sand", "ochre"),       # player
    ("red", "olive", "wood", "sand", "white"),
    ("ochre", "wood_dark", "wood_dark", "shade", "olive"),
    ("olive", "sand", "wood", "sand", "white"),
    ("sea", "plaster", "wood_dark", "shade", "foam"),
    ("terra", "wood_dark", "wood", "sand", "ochre"),
    ("plaster", "olive", "wood_dark", "shade", "red"),
    ("sea_light", "wood_dark", "ochre", "sand", "ink"),
    ("white", "sea", "wood", "shade", "red"),
    ("wood", "terra_dark", "wood_dark", "sand", "leaf"),
    ("stone", "sea", "wood", "shade", "foam"),
    ("olive", "wood", "terra_dark", "sand", "ochre"),
    ("red", "wood_dark", "ochre", "shade", "white"),
    ("sea_mid", "olive", "wood_dark", "sand", "leaf"),
    ("plaster", "terra", "wood", "shade", "wood_dark"),           # fisher
)


def person(d: ImageDraw.ImageDraw, ox: int, oy: int, outfit_idx: int,
           direction: int, frame_i: int, hat: bool = False) -> None:
    shirt, pants, hair, skin, accent = OUTFITS[outfit_idx]
    rnd = random.Random(900 + outfit_idx * 17)
    long_hair = rnd.random() < 0.35
    swing = ((0, 0), (1, -1), (0, 0), (-1, 1))[frame_i]
    arm = (0, 1, 0, -1)[frame_i]

    # ombra a terra (i piedi restano nell'ultimo pixel del frame)
    shadow(d, (ox + 2, oy + 29, ox + 14, oy + 31), 75)

    # gambe e scarpe: y=25..31, altezza totale figura 28 px (y=4..31)
    for leg, off in enumerate((swing[0], swing[1])):
        x = ox + 5 + leg * 3 + off
        rect(d, x, oy + 25, 3, 5, "ink")
        rect(d, x + 1, oy + 25, 2, 5, pants)
        rect(d, x, oy + 30, 3, 2, "ink")
        rect(d, x + 1, oy + 30, 1, 1, "wood")

    # torso e bracci oscillanti
    rect(d, ox + 4, oy + 15, 8, 11, "ink")
    rect(d, ox + 5, oy + 16, 6, 9, shirt)
    rect(d, ox + 6, oy + 16, 4, 1, accent)
    for side, off in ((0, arm), (1, -arm)):
        ax = ox + (3 if side == 0 else 12)
        rect(d, ax, oy + 17 + off, 2, 7, "ink")
        rect(d, ax, oy + 18 + off, 1, 5, shirt)
        rect(d, ax, oy + 23 + off, 2, 2, skin)

    # testa: capelli, viso, dettagli direzionali
    rect(d, ox + 4, oy + 4, 8, 11, "ink")
    rect(d, ox + 5, oy + 6, 6, 7, skin if direction != 2 else hair)
    rect(d, ox + 4, oy + 4, 8, 4, hair)
    rect(d, ox + 5, oy + 5, 6, 1, accent if hat else hair)
    rect(d, ox + 5, oy + 7, 6, 1, hair)
    if long_hair:
        rect(d, ox + 3, oy + 7, 2, 6, hair)
        rect(d, ox + 11, oy + 7, 2, 6, hair)
    if hat:
        rect(d, ox + 3, oy + 4, 10, 2, "wood_dark")
        rect(d, ox + 5, oy + 3, 6, 1, accent)
    if direction == 0:  # fronte
        dot(d, ox + 6, oy + 10, "ink")
        dot(d, ox + 9, oy + 10, "ink")
        dot(d, ox + 8, oy + 12, "shade")
    elif direction == 1:  # sinistra
        dot(d, ox + 6, oy + 10, "ink")
        rect(d, ox + 4, oy + 9, 1, 2, skin)
    elif direction == 2:  # destra (di spalle)
        rect(d, ox + 5, oy + 6, 6, 8, hair)
        dot(d, ox + 7, oy + 9, accent)
    else:  # destra di profilo
        dot(d, ox + 9, oy + 10, "ink")
        rect(d, ox + 11, oy + 9, 1, 2, skin)


def make_character_sheet(name: str, outfit_idx: int, hat: bool = False) -> None:
    im, d = canvas(64, 128)
    for direction in range(4):
        for frame_i in range(4):
            person(d, direction * 16, frame_i * 32, outfit_idx, direction, frame_i, hat)
    save(im, name)


make_character_sheet("player.png", 0)
for i in range(1, 13):
    make_character_sheet(f"npc_{i}.png", i)
make_character_sheet("npc_fisher.png", 14, hat=True)


# ---------------------------------------------------------------------------
# 2. EDIFICI - 4 larghezze x 4 piani x 4 varianti, altezze 56/108/160/212
# ---------------------------------------------------------------------------

FLOOR_PX = 52
CORNICE = 4
# Larghezze native in pixel (1 metro = 16 px). La gamma copre le facciate dei
# palazzi del centro: 6–28 m con passo 2–4 m, senza mai stirare le texture.
WIDTHS = tuple(range(96, 449, 16)) + (
    480, 512, 544, 576, 608, 640, 672, 704, 768, 832, 896, 960, 1024, 1088,
)


def facade(w: int, h: int, variant: int, seed: int) -> Image.Image:
    im, d = canvas(w, h)
    if variant == 0:      # intonaco chiaro
        rect(d, 1, CORNICE, w - 2, h - CORNICE - 1, "plaster")
        speckle(d, 2, CORNICE + 1, w - 4, h - CORNICE - 4, ("white", "shade"), seed, 0.09)
    elif variant == 1:    # mattoni
        rect(d, 1, CORNICE, w - 2, h - CORNICE - 1, "terra")
        for y in range(CORNICE + 1, h - 2, 4):
            rect(d, 1, y, w - 2, 1, "terra_dark")
            off = 5 if (y // 4) % 2 else 0
            for x in range(1 + off, w - 1, 10):
                rect(d, x, y + 1, 1, 3, "terra_dark")
                dot(d, x + 4, y + 2, "shade")
    elif variant == 2:    # pierre giallo
        rect(d, 1, CORNICE, w - 2, h - CORNICE - 1, "sand")
        for y in range(CORNICE + 1, h - 2, 6):
            rect(d, 1, y, w - 2, 1, "shade")
            off = 6 if (y // 6) % 2 else 0
            for x in range(1 + off, w - 1, 12):
                rect(d, x, y, 1, 6, "shade")
                rect(d, x + 1, y + 1, 10, 1, "plaster")
    else:                 # casa colorata con tende da bar
        rect(d, 1, CORNICE, w - 2, h - CORNICE - 1, "ochre")
        rect(d, 2, CORNICE + 1, w - 4, h - CORNICE - 4, "plaster")
        rect(d, 1, h - 42, w - 2, 38, "terra")
        speckle(d, 3, CORNICE + 2, w - 6, h - 46, ("white", "sand"), seed, 0.06)

    # contorni, cornice del tetto e zoccolo
    rect(d, 0, CORNICE, 1, h - CORNICE, "ink")
    rect(d, w - 1, CORNICE, 1, h - CORNICE, "ink")
    rect(d, 0, 0, w, 1, "ink")
    rect(d, 0, 1, w, 2, "terra_dark")
    rect(d, 0, 3, w, 1, "white")
    rect(d, 0, h - 5, w, 4, "stone")
    rect(d, 0, h - 1, w, 1, "ink")
    for x in range(4, w - 2, 12):
        rect(d, x, h - 4, 1, 3, "shade")
    return im


def win(d: ImageDraw.ImageDraw, cx: int, top: int, variant: int, planter: bool = False) -> None:
    x = cx - 7
    shutters = ("olive", "wood", "terra_dark", "wood")[variant]
    rect(d, x - 1, top - 1, 16, 18, "ink")
    rect(d, x, top, 14, 16, "white")
    # vetro: cielo chiaro e interno caldo. Nessun riflesso del mare nelle case del centro.
    rect(d, x + 1, top + 1, 12, 6, "white")
    rect(d, x + 1, top + 8, 12, 7, "plaster")
    rect(d, x + 6, top, 1, 16, "wood_dark")
    rect(d, x, top + 7, 14, 1, "wood_dark")
    rect(d, x - 4, top - 1, 3, 18, "ink")
    rect(d, x + 13, top - 1, 3, 18, "ink")
    rect(d, x - 3, top, 2, 16, shutters)
    rect(d, x + 14, top, 2, 16, shutters)
    for k in range(5):
        rect(d, x - 3, top + 2 + k * 3, 2, 1, "ink")
        rect(d, x + 14, top + 2 + k * 3, 2, 1, "ink")
    rect(d, x - 2, top + 17, 18, 2, "stone")
    rect(d, x - 2, top + 17, 18, 1, "white")
    if planter:
        rect(d, x - 1, top + 19, 16, 3, "terra_dark")
        for i, color in enumerate(("red", "ochre", "leaf", "white")):
            rect(d, x + i * 4, top + 17, 3, 2, color)


def door(d: ImageDraw.ImageDraw, cx: int, bottom: int, color: str = "wood_dark") -> None:
    x, y = cx - 8, bottom - 26
    rect(d, x - 2, y - 2, 20, 28, "ink")
    rect(d, x - 1, y - 1, 18, 26, "stone")
    rect(d, x, y, 16, 24, color)
    rect(d, x + 1, y + 1, 6, 9, "wood")
    rect(d, x + 9, y + 1, 6, 9, "wood")
    rect(d, x + 1, y + 12, 6, 9, "wood")
    rect(d, x + 9, y + 12, 6, 9, "wood")
    dot(d, x + 13, y + 12, "ochre")
    rect(d, x - 3, bottom - 1, 22, 2, "stone")


def balcony(d: ImageDraw.ImageDraw, cx: int, y: int) -> None:
    rect(d, cx - 19, y, 38, 3, "stone")
    rect(d, cx - 19, y + 2, 38, 1, "ink")
    rect(d, cx - 19, y - 7, 38, 2, "wood_dark")
    for x in range(cx - 18, cx + 19, 4):
        rect(d, x, y - 6, 1, 6, "wood")
    rect(d, cx - 16, y - 9, 7, 3, "terra_dark")
    rect(d, cx + 9, y - 9, 7, 3, "terra_dark")
    for bx in (cx - 15, cx - 12, cx + 10, cx + 13):
        dot(d, bx, y - 10, "leaf")
    rect(d, cx - 18, y - 7, 36, 1, "white")


def awning(d: ImageDraw.ImageDraw, x: int, y: int, w: int) -> None:
    for i in range(w):
        rect(d, x + i, y, 1, 7, "red" if (i // 6) % 2 == 0 else "white")
    rect(d, x, y + 7, w, 2, "red" if (w // 6) % 2 else "white")
    for i in range(0, w, 6):
        rect(d, x + i, y + 8, 1, 1, "ink")
    rect(d, x - 1, y - 1, w + 2, 1, "wood_dark")


def laundry_line(d: ImageDraw.ImageDraw, left: int, right: int, y: int, seed: int) -> None:
    """Panni stesi tra due finestre: dettaglio quotidiano del centro storico."""
    if right - left < 30:
        return
    rect(d, left, y, right - left, 1, "ink")
    colors = ("white", "red", "sea_mid", "ochre", "leaf")
    count = min(4, (right - left) // 12)
    for i in range(count):
        x = left + 5 + i * ((right - left - 10) // max(1, count))
        drop = 5 + ((seed + i * 3) % 4)
        rect(d, x, y, 7, drop, colors[(seed + i) % len(colors)])
        rect(d, x + 2, y, 1, 2, "ink")


def ac_unit(d: ImageDraw.ImageDraw, x: int, y: int) -> None:
    """Condizionatore compatto sotto la finestra, con griglia e ombra."""
    rect(d, x - 1, y - 1, 16, 11, "ink")
    rect(d, x, y, 14, 9, "white")
    rect(d, x + 1, y + 1, 12, 3, "shade")
    for gx in range(x + 2, x + 13, 2):
        rect(d, gx, y + 4, 1, 4, "shade")
    rect(d, x + 3, y + 7, 8, 1, "ink")


def terrace_parapet(d: ImageDraw.ImageDraw, w: int, y: int, variant: int) -> None:
    """Parapetto di terrazzo sul coronamento, con ombra e puntelli."""
    rect(d, 2, y, w - 4, 3, "stone")
    rect(d, 2, y + 2, w - 4, 1, "ink")
    for x in range(6, w - 5, 14):
        rect(d, x, y - 5, 2, 5, "shade")
    rect(d, 4, y - 6, w - 8, 2, "white" if variant % 2 else "shade")


def window_centers(w: int) -> list[int]:
    cx = w // 2
    centers: list[int] = []
    for off in (24, 48, 72, 96):
        for sign in (-1, 1):
            x = cx + sign * off
            if 14 <= x <= w - 14 and abs(x - cx) > 16:
                centers.append(x)
    return sorted(centers)


def make_building(w: int, floors: int, variant: int) -> None:
    h = CORNICE + FLOOR_PX * floors
    seed = 700 + w + floors * 7 + variant
    im = facade(w, h, variant, seed)
    d = ImageDraw.Draw(im)
    centers = window_centers(w)
    terrace_parapet(d, w, CORNICE + 2, variant)
    # Grondaia e pluviale: la cornice esiste già in facade(), qui aggiungiamo
    # il tubo che scende fino allo zoccolo, interrotto dai balconi.
    rect(d, w - 3, CORNICE + 5, 2, h - CORNICE - 10, "shade")
    for f in range(floors):
        bottom = h - 5 - FLOOR_PX * f
        for idx, cx in enumerate(centers):
            win(d, cx, bottom - 31, variant, planter=(f == 0 and idx % 2 == 0))
            if f > 0 and (f % 2 == 1 or variant == 0):
                balcony(d, cx, bottom - 8)
            if f == 0 and idx % 2 == 1 and abs(cx - w // 2) > 16:
                ac_unit(d, cx + 8, bottom - 12)
        if f > 0 and len(centers) >= 2 and (f + variant) % 2 == 0:
            laundry_line(d, centers[0] + 9, centers[1] - 9, bottom - 38, seed + f)
        if f == 0:
            door(d, w // 2, bottom, "wood_dark")
            if variant == 3:
                awning(d, 6, bottom - 36, w - 12)
                rect(d, w // 2 - 12, bottom - 45, 24, 8, "wood_dark")
                rect(d, w // 2 - 11, bottom - 44, 22, 6, "white")
                # insegna BAR in pixel 3x5
                glyphs = {
                    "B": ("111", "101", "111", "101", "111"),
                    "A": ("010", "101", "111", "101", "101"),
                    "R": ("111", "101", "111", "110", "101"),
                }
                for gi, ch in enumerate("BAR"):
                    for ry, row in enumerate(glyphs[ch]):
                        for rx, bit in enumerate(row):
                            if bit == "1":
                                dot(d, w // 2 - 8 + gi * 6 + rx, bottom - 43 + ry, "red")
    save(im, f"building_{w}_{floors}_{variant}.png")


for w in WIDTHS:
    for floors in range(1, 5):
        for variant in range(4):
            make_building(w, floors, variant)


def make_roof(w: int, variant: int) -> None:
    im, d = canvas(w, 24)
    if variant == 2:  # copertura piana
        rect(d, 0, 2, w, 21, "ink")
        rect(d, 2, 4, w - 4, 16, "stone")
        rect(d, 2, 4, w - 4, 2, "white")
        rect(d, 2, 18, w - 4, 2, "shade")
        for x in range(6, w - 4, 14):
            rect(d, x, 6, 1, 12, "plaster")
        rect(d, 1, 21, w - 2, 2, "wood_dark")
        return save(im, f"roof_{w}_{variant}.png")
    tones = ("terra", "terra_dark", "terra", "ochre") if variant == 3 else ("terra", "terra", "shade", "terra")
    rect(d, 0, 2, w, 21, "ink")
    rect(d, 1, 3, w - 2, 18, "terra_dark")
    for row in range(5):
        y = 4 + row * 4
        off = 2 if row % 2 else 0
        for x in range(-4, w + 2, 6):
            xx = x + off
            if 1 <= xx < w - 1:
                rect(d, xx, y, 5, 3, tones[(row + x // 6 + variant) % len(tones)])
                rect(d, xx, y, 5, 1, "terra")
    rect(d, 2, 2, w - 4, 2, "white")
    rect(d, 1, 21, w - 2, 2, "wood_dark")
    for x in range(5, w - 3, 20):
        dot(d, x, 23, "ink")
    save(im, f"roof_{w}_{variant}.png")


def make_shadow(w: int) -> None:
    im, d = canvas(w, 20)
    for i in range(6):
        inset = 2 + i * 3
        y_top = 1 + i
        y_bottom = 19 - i // 2
        if inset < w // 2 and y_bottom > y_top:
            oval(d, (inset, y_top, w - inset - 1, y_bottom),
                 (*bytes.fromhex(INK[1:]), 18 + i * 14))
    save(im, f"shadow_{w}.png")


for w in WIDTHS:
    for variant in range(4):
        make_roof(w, variant)
    make_shadow(w)


# ---------------------------------------------------------------------------
# 3. VEICOLI
# ---------------------------------------------------------------------------

def make_car(name: str, body: str) -> None:
    im, d = canvas(72, 40)
    shadow(d, (4, 30, 68, 38), 85)
    d.polygon([(5, 19), (11, 12), (55, 12), (67, 20), (67, 30), (5, 30)],
              fill=c(body), outline=INK)
    d.polygon([(19, 12), (25, 5), (49, 5), (57, 12)], fill=c(body), outline=INK)
    d.polygon([(24, 11), (28, 7), (37, 7), (37, 11)], fill=c("foam"), outline=INK)
    d.polygon([(39, 7), (48, 7), (54, 11), (39, 11)], fill=c("foam"), outline=INK)
    rect(d, 37, 7, 1, 4, INK)
    rect(d, 7, 22, 58, 1, "white" if body != "white" else "shade")
    rect(d, 10, 26, 53, 1, INK)
    rect(d, 64, 21, 4, 3, "ochre")
    rect(d, 6, 21, 3, 3, "red")
    for wx in (14, 50):
        oval(d, (wx - 6, 26, wx + 6, 38), INK)
        oval(d, (wx - 3, 29, wx + 3, 35), c("stone"))
        dot(d, wx, 31, INK)
    save(im, name)


make_car("car_white.png", "white")
make_car("car_blue.png", "sea_mid")
make_car("car_red.png", "red")
make_car("car_yellow.png", "ochre")


def make_moto() -> None:
    im, d = canvas(40, 20)
    shadow(d, (2, 15, 38, 19), 70)
    for wx in (9, 31):
        oval(d, (wx - 5, 11, wx + 5, 19), INK)
        oval(d, (wx - 2, 14, wx + 2, 17), c("stone"))
    d.polygon([(7, 12), (13, 7), (24, 7), (33, 12), (24, 14), (12, 14)],
              fill=c("red"), outline=INK)
    rect(d, 16, 5, 8, 3, INK)
    rect(d, 17, 6, 6, 1, c("foam"))
    rect(d, 24, 4, 7, 1, INK)
    rect(d, 12, 10, 14, 1, c("white"))
    save(im, "moto.png")


def make_bus() -> None:
    im, d = canvas(192, 52)
    shadow(d, (4, 42, 188, 50), 90)
    d.polygon([(3, 10), (180, 10), (189, 19), (189, 41), (3, 41)], fill=c("white"), outline=INK)
    rect(d, 4, 32, 184, 4, c("sea"))
    for x in range(9, 178, 19):
        rect(d, x, 13, 15, 15, INK)
        rect(d, x + 1, 14, 13, 13, c("foam"))
        rect(d, x + 1, 22, 13, 5, c("sea_mid"))
    rect(d, 181, 13, 7, 20, INK)
    rect(d, 182, 14, 5, 18, c("foam"))
    rect(d, 151, 29, 12, 12, INK)
    rect(d, 152, 30, 10, 11, c("plaster"))
    rect(d, 185, 27, 4, 4, c("ochre"))
    rect(d, 4, 27, 3, 4, c("red"))
    for wx in (32, 154):
        oval(d, (wx - 7, 35, wx + 7, 49), INK)
        oval(d, (wx - 3, 39, wx + 3, 45), c("stone"))
    save(im, "bus.png")


def make_train() -> None:
    im, d = canvas(320, 56)
    shadow(d, (4, 48, 316, 55), 95)
    d.polygon([(3, 10), (298, 10), (317, 26), (317, 46), (3, 46)], fill=c("white"), outline=INK)
    rect(d, 4, 39, 312, 4, c("red"))
    for x in range(10, 296, 24):
        rect(d, x, 14, 18, 18, INK)
        rect(d, x + 1, 15, 16, 16, c("foam"))
        rect(d, x + 1, 23, 16, 8, c("sea_mid"))
    rect(d, 300, 16, 14, 22, INK)
    rect(d, 302, 18, 11, 18, c("foam"))
    rect(d, 306, 36, 8, 3, c("ochre"))
    rect(d, 8, 34, 4, 4, c("red"))
    for x in range(18, 310, 26):
        rect(d, x, 4, 1, 6, INK)
    rect(d, 150, 2, 20, 2, INK)
    for wx in range(30, 310, 42):
        oval(d, (wx - 6, 42, wx + 6, 54), INK)
        oval(d, (wx - 2, 46, wx + 2, 50), c("stone"))
    save(im, "train.png")


make_moto()
make_bus()
make_train()


# ---------------------------------------------------------------------------
# 4. PROP E ARREDI ESTERNI
# ---------------------------------------------------------------------------

def make_palm() -> None:
    im, d = canvas(96, 160)
    shadow(d, (14, 148, 82, 158), 80)
    for y in range(48, 150):
        dx = int(5 * math.sin((y - 48) / 42))
        x = 45 + dx
        rect(d, x - 4, y, 9, 1, INK)
        rect(d, x - 3, y, 7, 1, "wood" if y % 5 else "shade")
        rect(d, x + 2, y, 1, 1, "wood_dark")
    cx, cy = 50, 48
    for ang in range(0, 360, 45):
        a = math.radians(ang)
        pts = [(cx, cy)]
        for k in range(1, 8):
            r = k * 5
            px = int(cx + math.cos(a) * r)
            py = int(cy + math.sin(a) * r * 0.5 + k * 0.7)
            pts.append((px, py))
        d.line(pts, fill=c("olive"), width=3)
        for px, py in pts[2:]:
            rect(d, px - 3, py - 1, 6, 2, "olive")
            dot(d, px + 1, py - 1, "leaf")
            dot(d, px - 2, py, "leaf")
    for x in (46, 51, 55):
        oval(d, (x, 51, x + 3, 54), c("terra_dark"))
    save(im, "palm.png")


def make_olive_tree() -> None:
    im, d = canvas(80, 112)
    shadow(d, (10, 100, 70, 110), 80)
    rect(d, 37, 58, 7, 43, INK)
    rect(d, 38, 58, 5, 43, "wood")
    for y in (66, 78, 90):
        rect(d, 34, y, 13, 2, "wood_dark")
    rnd = random.Random(4421)
    for cx, cy, r in ((40, 38, 18), (22, 48, 13), (58, 48, 13), (31, 27, 12), (50, 25, 12)):
        oval(d, (cx - r, cy - r + 4, cx + r, cy + r - 4), c("olive"), INK)
        for _ in range(r * 2):
            x = cx + rnd.randrange(-r, r)
            y = cy + rnd.randrange(-r + 5, r - 5)
            dot(d, x, y, "leaf" if rnd.random() < 0.6 else "wood_dark")
    for _ in range(12):
        dot(d, rnd.randrange(20, 61), rnd.randrange(24, 55), "ink")
    save(im, "olive_tree.png")


def make_bench() -> None:
    im, d = canvas(64, 32)
    shadow(d, (4, 27, 60, 31), 80)
    for x in (8, 50):
        rect(d, x, 17, 5, 12, INK)
        rect(d, x + 1, 18, 3, 10, "wood_dark")
    for y in (3, 8, 13):
        rect(d, 4, y, 56, 4, INK)
        rect(d, 5, y + 1, 54, 2, "wood")
    for y in (18, 23):
        rect(d, 3, y, 58, 4, INK)
        rect(d, 4, y + 1, 56, 2, "wood")
    save(im, "bench.png")


def make_lamp() -> None:
    im, d = canvas(48, 160)
    shadow(d, (6, 150, 42, 158), 80)
    rect(d, 14, 146, 20, 8, INK)
    rect(d, 16, 147, 16, 5, "stone")
    rect(d, 22, 26, 4, 120, INK)
    rect(d, 23, 26, 2, 120, "wood_dark")
    oval(d, (14, 16, 34, 38), (*bytes.fromhex(P["ochre"][1:]), 45))
    rect(d, 16, 6, 16, 4, INK)
    rect(d, 18, 10, 12, 14, INK)
    rect(d, 19, 11, 10, 11, "ochre")
    rect(d, 21, 12, 6, 8, "white")
    rect(d, 14, 24, 20, 3, INK)
    save(im, "lamp.png")


def make_umbrella() -> None:
    im, d = canvas(96, 64)
    shadow(d, (6, 56, 90, 63), 75)
    rect(d, 46, 26, 3, 32, INK)
    rect(d, 47, 27, 1, 30, "wood")
    for i in range(8):
        x = 8 + i * 10
        color = "red" if i % 2 == 0 else "white"
        d.polygon([(48, 4), (x, 28), (x + 10, 28)], fill=c(color), outline=INK)
    d.polygon([(48, 4), (8, 28), (88, 28)], outline=INK)
    rect(d, 46, 3, 4, 3, INK)
    rect(d, 40, 58, 16, 3, "sand")
    save(im, "umbrella.png")


def make_boat() -> None:
    im, d = canvas(128, 48)
    shadow(d, (4, 36, 124, 46), 65)
    d.polygon([(6, 22), (122, 22), (108, 42), (22, 42)], fill=c("wood"), outline=INK)
    d.polygon([(12, 25), (116, 25), (105, 37), (25, 37)], fill=c("wood_dark"))
    rect(d, 18, 29, 92, 2, "shade")
    rect(d, 62, 6, 2, 18, INK)
    d.polygon([(66, 8), (66, 22), (94, 22)], fill=c("white"), outline=INK)
    rect(d, 30, 19, 5, 4, INK)
    rect(d, 92, 19, 5, 4, INK)
    for x in (18, 34, 50, 78, 94, 110):
        rect(d, x, 40, 6, 1, c("foam"))
    save(im, "boat.png")


def make_cafe_table() -> None:
    im, d = canvas(80, 48)
    shadow(d, (6, 41, 74, 47), 75)
    rect(d, 38, 26, 4, 17, INK)
    rect(d, 39, 27, 2, 16, "wood")
    rect(d, 28, 41, 24, 3, INK)
    oval(d, (10, 12, 70, 30), INK)
    oval(d, (12, 14, 68, 27), c("white"))
    oval(d, (15, 15, 65, 25), c("plaster"))
    for x in (18, 34, 50):
        rect(d, x, 18, 2, 5, c("wood"))
    rect(d, 32, 9, 7, 6, INK)
    rect(d, 33, 10, 5, 4, c("foam"))
    rect(d, 39, 11, 3, 2, c("foam"))
    save(im, "cafe_table.png")


def make_fisher() -> None:
    im, d = canvas(16, 32)
    shadow(d, (2, 29, 14, 31), 70)
    rect(d, 4, 25, 3, 5, INK)
    rect(d, 9, 25, 3, 5, INK)
    rect(d, 4, 30, 3, 2, INK)
    rect(d, 9, 30, 3, 2, INK)
    rect(d, 4, 15, 8, 11, INK)
    rect(d, 5, 16, 6, 9, c("sea_mid"))
    rect(d, 2, 16, 2, 7, c("sea_mid"))
    rect(d, 12, 16, 2, 7, c("sea_mid"))
    rect(d, 2, 22, 2, 2, c("sand"))
    rect(d, 4, 4, 8, 11, INK)
    rect(d, 5, 7, 6, 7, c("sand"))
    rect(d, 3, 4, 10, 3, c("wood_dark"))
    rect(d, 5, 3, 6, 1, c("wood"))
    dot(d, 6, 10, INK)
    dot(d, 9, 10, INK)
    d.line([(13, 22), (15, 4)], fill=c("wood_dark"), width=1)
    d.line([(15, 4), (15, 14)], fill=c("foam"), width=1)
    save(im, "fisher.png")


def make_casina() -> None:
    w, h = 256, 208
    im = facade(w, h, 0, 20831)
    d = ImageDraw.Draw(im)
    centers = window_centers(w)
    for cx in centers:
        win(d, cx, 64, 0, planter=True)
    door(d, w // 2, h - 5, "wood_dark")
    rect(d, 0, 0, w, 24, INK)
    for row in range(5):
        y = 2 + row * 4
        off = 2 if row % 2 else 0
        for x in range(-4, w + 2, 6):
            xx = x + off
            if 1 <= xx < w - 1:
                rect(d, xx, y, 5, 3, "terra" if (row + x // 6) % 3 else "shade")
    rect(d, 2, 2, w - 4, 2, "white")
    rect(d, 1, 21, w - 2, 2, "wood_dark")
    awning(d, 24, 122, w - 48)
    rect(d, 8, 178, 32, 18, INK)
    rect(d, 10, 180, 28, 16, "terra_dark")
    rect(d, 14, 176, 20, 5, "olive")
    rect(d, 216, 178, 32, 18, INK)
    rect(d, 218, 180, 28, 16, "terra_dark")
    rect(d, 222, 176, 20, 5, "leaf")
    save(im, "casina.png")


def make_flowerpot() -> None:
    im, d = canvas(32, 32)
    shadow(d, (4, 29, 28, 32), 70)
    rect(d, 11, 10, 10, 4, INK)
    rect(d, 12, 11, 8, 2, "shade")
    d.polygon([(10, 14), (22, 14), (19, 29), (13, 29)], fill=c("terra"), outline=INK)
    rect(d, 12, 16, 8, 2, "shade")
    for x, y in ((16, 8), (12, 6), (20, 5)):
        d.line([(16, 14), (x, y)], fill=c("olive"), width=1)
        oval(d, (x - 3, y - 3, x + 3, y + 2), c("leaf"), INK)
        dot(d, x, y - 1, "red" if x != 12 else "ochre")
    save(im, "flowerpot.png")


def make_trash_bin() -> None:
    im, d = canvas(32, 48)
    shadow(d, (4, 44, 28, 48), 75)
    d.polygon([(7, 12), (25, 12), (23, 45), (9, 45)], fill=c("olive"), outline=INK)
    rect(d, 5, 8, 22, 5, INK)
    rect(d, 6, 9, 20, 3, "wood_dark")
    rect(d, 14, 6, 4, 3, INK)
    for y in (19, 26, 33):
        rect(d, 10, y, 12, 1, c("wood_dark"))
    rect(d, 15, 38, 2, 5, c("shade"))
    save(im, "trash_bin.png")


def make_street_sign() -> None:
    im, d = canvas(40, 64)
    shadow(d, (8, 60, 32, 64), 70)
    rect(d, 18, 10, 4, 51, INK)
    rect(d, 19, 11, 2, 49, "stone")
    d.polygon([(4, 12), (29, 12), (34, 18), (29, 24), (4, 24)], fill=c("sea"), outline=INK)
    rect(d, 7, 15, 16, 2, c("white"))
    rect(d, 7, 19, 11, 2, c("foam"))
    d.polygon([(36, 28), (11, 28), (6, 34), (11, 40), (36, 40)], fill=c("olive"), outline=INK)
    rect(d, 17, 31, 16, 2, c("white"))
    rect(d, 21, 35, 12, 2, c("leaf"))
    save(im, "street_sign.png")


def make_parking_sign() -> None:
    im, d = canvas(48, 64)
    shadow(d, (12, 60, 36, 64), 70)
    rect(d, 22, 16, 4, 45, INK)
    rect(d, 23, 17, 2, 43, "stone")
    rect(d, 4, 2, 40, 40, INK)
    rect(d, 6, 4, 36, 36, c("sea"))
    rect(d, 8, 6, 32, 32, c("sea_mid"))
    # P bianca 9x13
    rect(d, 16, 11, 3, 21, c("white"))
    rect(d, 19, 11, 10, 3, c("white"))
    rect(d, 27, 14, 2, 8, c("white"))
    rect(d, 19, 20, 10, 3, c("white"))
    save(im, "parking_sign.png")


make_palm()
make_olive_tree()
make_bench()
make_lamp()
make_umbrella()
make_boat()
make_cafe_table()
make_fisher()
make_casina()
make_flowerpot()
make_trash_bin()
make_street_sign()
make_parking_sign()


# ---------------------------------------------------------------------------
# 5. ARREDI INTERNI - prefisso f_
# ---------------------------------------------------------------------------

def bevel(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, base: str,
          light: str | None = None, dark: str | None = None) -> None:
    rect(d, x, y, w, h, INK)
    rect(d, x + 1, y + 1, w - 2, h - 2, c(base))
    if light:
        rect(d, x + 2, y + 2, w - 4, 1, c(light))
        rect(d, x + 2, y + 2, 1, h - 4, c(light))
    if dark:
        rect(d, x + 2, y + h - 3, w - 4, 1, c(dark))
        rect(d, x + w - 3, y + 2, 1, h - 4, c(dark))


def ground(d: ImageDraw.ImageDraw, w: int, y: int, inset: int = 8) -> None:
    shadow(d, (inset, y, w - inset, y + 5), 65)


def f_bed() -> None:
    im, d = canvas(96, 64)
    ground(d, 96, 57)
    for x in (8, 82):
        rect(d, x, 36, 6, 20, INK)
        rect(d, x + 1, 37, 4, 18, "wood_dark")
    bevel(d, 4, 24, 88, 28, "wood", "wood", "wood_dark")
    rect(d, 8, 28, 80, 19, INK)
    rect(d, 9, 29, 78, 17, "white")
    rect(d, 9, 40, 78, 6, "sea")
    rect(d, 12, 30, 24, 8, "foam")
    rect(d, 13, 31, 22, 6, "white")
    rect(d, 9, 39, 78, 1, "shade")
    save(im, "f_bed.png")


def f_sofa() -> None:
    im, d = canvas(112, 64)
    ground(d, 112, 57)
    bevel(d, 4, 6, 104, 30, "red", "terra", "terra_dark")
    for x in (12, 50, 88):
        rect(d, x, 10, 32, 20, INK)
        rect(d, x + 1, 11, 30, 18, "red")
        rect(d, x + 3, 12, 26, 2, "terra")
    bevel(d, 2, 34, 108, 17, "red", "terra", "terra_dark")
    for x in (6, 104):
        rect(d, x, 50, 6, 7, INK)
        rect(d, x + 1, 51, 4, 5, "wood_dark")
    save(im, "f_sofa.png")


def f_table() -> None:
    im, d = canvas(96, 56)
    ground(d, 96, 49)
    for x in (10, 78):
        rect(d, x, 14, 7, 35, INK)
        rect(d, x + 1, 15, 5, 33, "wood_dark")
    bevel(d, 2, 8, 92, 12, "wood", "shade", "wood_dark")
    for x in range(8, 90, 18):
        rect(d, x, 10, 1, 8, "wood_dark")
    save(im, "f_table.png")


def f_chair() -> None:
    im, d = canvas(48, 64)
    ground(d, 48, 57)
    rect(d, 8, 4, 32, 30, INK)
    rect(d, 10, 6, 28, 26, "wood")
    for y in (10, 22):
        rect(d, 12, y, 24, 3, "wood_dark")
    bevel(d, 5, 34, 38, 9, "wood", "shade", "wood_dark")
    for x in (8, 36):
        rect(d, x, 43, 5, 14, INK)
        rect(d, x + 1, 44, 3, 12, "wood_dark")
    save(im, "f_chair.png")


def f_fridge() -> None:
    im, d = canvas(64, 128)
    ground(d, 64, 122)
    bevel(d, 6, 2, 52, 120, "white", "foam", "shade")
    rect(d, 7, 46, 50, 2, INK)
    rect(d, 10, 10, 2, 30, "stone")
    rect(d, 10, 55, 2, 58, "stone")
    rect(d, 44, 12, 6, 2, "sea_mid")
    rect(d, 44, 57, 6, 2, "sea_mid")
    rect(d, 10, 114, 44, 4, "shade")
    save(im, "f_fridge.png")


def f_stove() -> None:
    im, d = canvas(80, 80)
    ground(d, 80, 74)
    bevel(d, 4, 4, 72, 70, "stone", "white", "shade")
    rect(d, 6, 8, 68, 26, INK)
    rect(d, 8, 10, 64, 22, "shade")
    for x in (18, 54):
        for y in (16, 26):
            oval(d, (x - 6, y - 3, x + 6, y + 3), INK)
            oval(d, (x - 4, y - 2, x + 4, y + 2), c("wood_dark"))
    rect(d, 8, 40, 64, 30, INK)
    rect(d, 10, 42, 60, 26, "stone")
    rect(d, 14, 46, 52, 12, INK)
    rect(d, 15, 47, 50, 10, c("sea"))
    rect(d, 17, 61, 46, 2, "white")
    save(im, "f_stove.png")


def f_shelf() -> None:
    im, d = canvas(96, 128)
    ground(d, 96, 122)
    bevel(d, 4, 2, 88, 122, "wood_dark", "wood", "ink")
    rnd = random.Random(717)
    for sy in (10, 41, 72, 103):
        rect(d, 8, sy, 80, 16, INK)
        rect(d, 9, sy + 1, 78, 14, "wood")
        x = 12
        while x < 84:
            color = rnd.choice(("red", "sea", "ochre", "olive", "white"))
            rect(d, x, sy + 4 - rnd.randrange(3), 5, 11, c(color))
            dot(d, x + 2, sy + 6, INK)
            x += rnd.randrange(7, 11)
        rect(d, 8, sy + 15, 80, 2, "wood_dark")
    save(im, "f_shelf.png")


def f_tv() -> None:
    im, d = canvas(80, 64)
    ground(d, 80, 57)
    bevel(d, 2, 2, 76, 46, INK, "wood_dark", "ink")
    rect(d, 6, 6, 68, 37, INK)
    rect(d, 8, 8, 64, 33, c("sea"))
    rect(d, 10, 10, 40, 10, c("sea_mid"))
    rect(d, 14, 26, 52, 2, c("foam"))
    rect(d, 34, 48, 12, 6, INK)
    rect(d, 26, 54, 28, 3, INK)
    save(im, "f_tv.png")


def f_espresso() -> None:
    im, d = canvas(48, 48)
    ground(d, 48, 43)
    bevel(d, 6, 8, 36, 32, "red", "terra", "terra_dark")
    rect(d, 9, 12, 30, 12, INK)
    rect(d, 10, 13, 28, 10, c("stone"))
    rect(d, 13, 15, 8, 5, c("sea"))
    rect(d, 27, 15, 8, 5, c("white"))
    rect(d, 14, 28, 7, 9, INK)
    rect(d, 15, 29, 5, 7, c("foam"))
    rect(d, 27, 34, 12, 3, INK)
    rect(d, 29, 31, 8, 3, c("white"))
    save(im, "f_espresso.png")


def f_register() -> None:
    im, d = canvas(64, 48)
    ground(d, 64, 43)
    bevel(d, 6, 6, 52, 34, "plaster", "white", "shade")
    rect(d, 10, 10, 22, 12, INK)
    rect(d, 12, 12, 18, 8, c("sea"))
    rect(d, 36, 10, 18, 12, INK)
    rect(d, 38, 12, 14, 8, c("foam"))
    for y in (26, 32):
        for x in range(11, 54, 7):
            rect(d, x, y, 5, 3, c("stone" if (x + y) % 2 else "white"))
    save(im, "f_register.png")


def f_bathtub() -> None:
    im, d = canvas(128, 72)
    ground(d, 128, 65)
    oval(d, (6, 12, 122, 60), INK)
    oval(d, (9, 15, 119, 56), c("white"))
    oval(d, (14, 20, 114, 51), c("foam"))
    oval(d, (18, 23, 110, 47), c("sea_mid"))
    for x in (24, 40, 56, 72, 88):
        rect(d, x, 28, 8, 1, c("foam"))
    for x in (14, 106):
        rect(d, x, 56, 7, 8, INK)
        rect(d, x + 1, 57, 5, 6, c("stone"))
    rect(d, 104, 8, 6, 14, INK)
    rect(d, 105, 9, 4, 12, c("stone"))
    save(im, "f_bathtub.png")


def f_toilet() -> None:
    im, d = canvas(56, 64)
    ground(d, 56, 59)
    bevel(d, 14, 2, 28, 22, "white", "foam", "shade")
    rect(d, 21, 8, 14, 3, INK)
    rect(d, 21, 14, 14, 3, c("stone"))
    oval(d, (10, 26, 46, 52), INK)
    oval(d, (12, 28, 44, 50), c("white"))
    oval(d, (15, 31, 41, 47), c("foam"))
    rect(d, 16, 52, 24, 5, INK)
    rect(d, 17, 53, 22, 3, c("white"))
    save(im, "f_toilet.png")


def f_plant() -> None:
    im, d = canvas(64, 96)
    ground(d, 64, 89)
    d.polygon([(18, 58), (46, 58), (41, 88), (23, 88)], fill=c("terra"), outline=INK)
    rect(d, 16, 54, 32, 6, INK)
    rect(d, 18, 55, 28, 4, c("shade"))
    for x, y in ((32, 12), (20, 26), (44, 26), (26, 42), (39, 42)):
        d.line([(32, 58), (x, y)], fill=c("wood_dark"), width=2)
        oval(d, (x - 9, y - 8, x + 9, y + 8), c("olive"), INK)
        for _ in range(6):
            dot(d, x + random.Random(y).randrange(-8, 9), y + random.Random(x).randrange(-6, 7), "leaf")
    save(im, "f_plant.png")


def f_washing_machine() -> None:
    im, d = canvas(64, 96)
    ground(d, 64, 90)
    bevel(d, 6, 4, 52, 86, "white", "foam", "shade")
    rect(d, 8, 8, 48, 10, INK)
    rect(d, 10, 10, 32, 6, c("stone"))
    for x in (46, 52):
        oval(d, (x, 11, x + 3, 14), c("sea_mid"))
    oval(d, (14, 26, 50, 62), INK)
    oval(d, (17, 29, 47, 59), c("foam"))
    oval(d, (20, 32, 44, 56), c("sea_mid"))
    rect(d, 12, 68, 40, 4, INK)
    rect(d, 14, 69, 36, 2, c("stone"))
    save(im, "f_washing_machine.png")


def f_microwave() -> None:
    im, d = canvas(72, 48)
    ground(d, 72, 43)
    bevel(d, 2, 4, 68, 36, "stone", "white", "shade")
    rect(d, 6, 8, 42, 27, INK)
    rect(d, 8, 10, 38, 23, c("sea"))
    rect(d, 11, 13, 32, 16, c("sea_mid"))
    rect(d, 51, 8, 16, 7, INK)
    rect(d, 52, 9, 14, 5, c("foam"))
    for y in (20, 26, 32):
        rect(d, 53, y, 3, 3, c("wood_dark"))
        rect(d, 59, y, 6, 3, c("white"))
    save(im, "f_microwave.png")


def f_desk() -> None:
    im, d = canvas(112, 72)
    ground(d, 112, 66)
    bevel(d, 2, 6, 108, 14, "wood", "shade", "wood_dark")
    rect(d, 6, 22, 32, 26, INK)
    rect(d, 7, 23, 30, 24, "wood")
    for y in (28, 38):
        rect(d, 10, y, 24, 1, "wood_dark")
        rect(d, 20, y - 3, 4, 2, INK)
    for x in (50, 100):
        rect(d, x, 20, 6, 46, INK)
        rect(d, x + 1, 21, 4, 44, "wood_dark")
    rect(d, 62, 12, 20, 6, INK)
    rect(d, 64, 13, 16, 3, c("foam"))
    save(im, "f_desk.png")


def f_crib() -> None:
    im, d = canvas(96, 72)
    ground(d, 96, 65)
    for x in (6, 84):
        rect(d, x, 16, 6, 48, INK)
        rect(d, x + 1, 17, 4, 46, "wood")
        oval(d, (x - 2, 10, x + 8, 20), INK)
        oval(d, (x - 1, 11, x + 7, 19), c("wood"))
    rect(d, 10, 44, 76, 14, INK)
    rect(d, 11, 45, 74, 12, "white")
    rect(d, 11, 50, 74, 7, c("foam"))
    for x in range(14, 84, 6):
        rect(d, x, 20, 2, 25, INK)
        rect(d, x, 20, 1, 25, c("wood"))
    rect(d, 8, 16, 80, 3, INK)
    rect(d, 9, 17, 78, 1, c("shade"))
    save(im, "f_crib.png")


f_bed()
f_sofa()
f_table()
f_chair()
f_fridge()
f_stove()
f_shelf()
f_tv()
f_espresso()
f_register()
f_bathtub()
f_toilet()
f_plant()
f_washing_machine()
f_microwave()
f_desk()
f_crib()


# ---------------------------------------------------------------------------
# 6. TILESET 4x4, INDICI ESATTI DEL CODICE ESISTENTE (1..16)
#    1 grass, 2 grass2, 3 sand, 4 sand2, 5 cobble, 6 cobble2,
#    7 asphalt, 8 paving, 9-12 water0..3, 13 foam, 14 wall, 15 roof, 16 flowers
# ---------------------------------------------------------------------------

def t_grass(d: ImageDraw.ImageDraw, ox: int, oy: int, variant: int) -> None:
    rect(d, ox, oy, 16, 16, "olive")
    rnd = random.Random(100 + variant)
    for _ in range(42):
        dot(d, ox + rnd.randrange(16), oy + rnd.randrange(16),
            rnd.choice(("leaf", "leaf", "wood_dark", "shade")))
    for _ in range(6):
        x, y = ox + rnd.randrange(2, 14), oy + rnd.randrange(3, 14)
        dot(d, x, y, "leaf")
        dot(d, x + 1, y - 1, "leaf")


def t_sand(d: ImageDraw.ImageDraw, ox: int, oy: int, variant: int) -> None:
    rect(d, ox, oy, 16, 16, "sand")
    rnd = random.Random(200 + variant)
    for _ in range(34):
        dot(d, ox + rnd.randrange(16), oy + rnd.randrange(16),
            rnd.choice(("white", "shade", "plaster")))
    if variant:
        for x, y in ((3, 4), (11, 9), (6, 13)):
            dot(d, ox + x, oy + y, "stone")
            dot(d, ox + x + 1, oy + y, "shade")


def t_cobble(d: ImageDraw.ImageDraw, ox: int, oy: int, variant: int) -> None:
    rect(d, ox, oy, 16, 16, "wood_dark")
    rows = ((0, 0, 7, 6), (8, 0, 7, 5), (0, 7, 5, 4), (6, 7, 9, 4), (0, 12, 8, 3), (9, 12, 6, 3))
    rnd = random.Random(300 + variant)
    for sx, sy, w, h in rows:
        tone = rnd.choice(("stone", "shade", "plaster", "stone"))
        rect(d, ox + sx, oy + sy, w - 1, h - 1, tone)
        rect(d, ox + sx, oy + sy, w - 1, 1, "stone")
        rect(d, ox + sx, oy + sy + h - 2, w - 1, 1, "wood_dark")
        for _ in range(max(1, w * h // 18)):
            dot(d, ox + sx + rnd.randrange(w - 1), oy + sy + 1 + rnd.randrange(max(1, h - 2)), "wood_dark")


def t_asphalt(d: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
    rect(d, ox, oy, 16, 16, "ink")
    rnd = random.Random(400)
    for _ in range(28):
        dot(d, ox + rnd.randrange(16), oy + rnd.randrange(16),
            rnd.choice(("sea", "wood_dark", "stone")))
    for x in (2, 9):
        rect(d, ox + x, oy + 7, 4, 1, "shade")


def t_paving(d: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
    rect(d, ox, oy, 16, 16, "plaster")
    rect(d, ox, oy, 16, 1, "shade")
    rect(d, ox, oy + 7, 16, 1, "shade")
    rect(d, ox, oy, 1, 16, "shade")
    rect(d, ox + 8, oy + 8, 1, 8, "shade")
    speckle(d, ox, oy, 16, 16, ("white", "sand"), 500, 0.09)


def t_water(d: ImageDraw.ImageDraw, ox: int, oy: int, phase: int) -> None:
    rect(d, ox, oy, 16, 16, "sea")
    for y in range(16):
        shift = int(3 * math.sin((y + phase * 3) * 0.7)) % 5
        for x in range(16):
            wave = math.sin((x + shift) * 0.55 + y * 0.35 + phase * 1.4)
            if wave > 0.78:
                color = "foam"
            elif wave > 0.35:
                color = "sea_mid"
            elif wave < -0.75:
                color = "ink"
            else:
                color = "sea_light" if phase % 2 else "sea"
            dot(d, ox + x, oy + y, color)
    for y in (3, 10):
        x0 = (phase * 4 + y) % 16
        for k in range(4):
            dot(d, ox + (x0 + k) % 16, oy + y, "foam")


def t_foam(d: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
    rect(d, ox, oy, 16, 16, "sea_mid")
    for x in range(16):
        y = oy + 4 + int(3 * math.sin(x * 0.8))
        dot(d, ox + x, y, "foam")
        if x % 3 == 0:
            dot(d, ox + x, y + 1, "white")
    for x in range(1, 15, 4):
        dot(d, ox + x, oy + 13, "sea_light")


def t_wall(d: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
    rect(d, ox, oy, 16, 16, "shade")
    for row in range(4):
        y = oy + row * 4
        for col in range(2):
            x = ox + col * 8 + (4 if row % 2 else 0)
            rect(d, x, y, 7, 3, "stone" if (row + col) % 2 == 0 else "plaster")
            rect(d, x, y, 7, 1, "white")
    speckle(d, ox, oy, 16, 16, ("sand", "wood_dark"), 600, 0.07)


def t_roof(d: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
    rect(d, ox, oy, 16, 16, "terra_dark")
    for row in range(4):
        y = oy + row * 4
        off = 2 if row % 2 else 0
        for x in range(-4, 16, 4):
            xx = ox + x + off
            rect(d, xx, y, 3, 3, "terra" if (row + x) % 3 else "shade")
            rect(d, xx, y, 3, 1, "terra")
    rect(d, ox, oy + 15, 16, 1, "wood_dark")


def t_flowers(d: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
    rect(d, ox, oy, 16, 16, "olive")
    for x, y, color in ((3, 4, "red"), (7, 3, "ochre"), (11, 6, "white"), (4, 10, "ochre"), (10, 11, "red")):
        dot(d, ox + x, oy + y + 2, "leaf")
        rect(d, ox + x, oy + y, 2, 2, color)
        dot(d, ox + x + 1, oy + y, "white")
    speckle(d, ox, oy, 16, 16, ("leaf", "wood_dark"), 800, 0.10)


tileset, td = canvas(64, 64)
tile_fns = (
    lambda ox, oy: t_grass(td, ox, oy, 0),
    lambda ox, oy: t_grass(td, ox, oy, 1),
    lambda ox, oy: t_sand(td, ox, oy, 0),
    lambda ox, oy: t_sand(td, ox, oy, 1),
    lambda ox, oy: t_cobble(td, ox, oy, 0),
    lambda ox, oy: t_cobble(td, ox, oy, 1),
    lambda ox, oy: t_asphalt(td, ox, oy),
    lambda ox, oy: t_paving(td, ox, oy),
    lambda ox, oy: t_water(td, ox, oy, 0),
    lambda ox, oy: t_water(td, ox, oy, 1),
    lambda ox, oy: t_water(td, ox, oy, 2),
    lambda ox, oy: t_water(td, ox, oy, 3),
    lambda ox, oy: t_foam(td, ox, oy),
    lambda ox, oy: t_wall(td, ox, oy),
    lambda ox, oy: t_roof(td, ox, oy),
    lambda ox, oy: t_flowers(td, ox, oy),
)
for idx, fn in enumerate(tile_fns):
    fn((idx % 4) * 16, (idx // 4) * 16)  # indice 1 = (0,0) ... indice 16 = (48,48)
# Il tileset M5 a 4x4(frame) resta disponibile come riferimento storico;
# quello M6 a 16x16 frame è la sorgente runtime con pavimentazioni autotilate.
tileset.save(OUT / "tileset_m5_legacy.png")

floors, fd = canvas(48, 16)
rect(fd, 0, 0, 16, 16, "wood")
for y in (3, 7, 11, 15):
    rect(fd, 0, y, 16, 1, "wood_dark")
rect(fd, 5, 0, 1, 3, "wood_dark")
rect(fd, 11, 4, 1, 3, "wood_dark")
rect(fd, 3, 8, 1, 3, "wood_dark")
rect(fd, 16, 0, 16, 16, "stone")
for y in (0, 8):
    for x in (16, 24):
        rect(fd, x, y, 8, 8, "shade")
        rect(fd, x + 1, y + 1, 6, 6, "stone")
for y in (0, 8):
    rect(fd, 16, y, 16, 1, "wood_dark")
    rect(fd, 16, y, 1, 8, "wood_dark")
rect(fd, 32, 0, 16, 16, "white")
for y in range(0, 16, 8):
    for x in range(32, 48, 8):
        rect(fd, x, y, 8, 8, "white" if (x + y) % 16 == 0 else "foam")
        edge(fd, x, y, 8, 8, "stone")
save(floors, "room_floors.png")


# ---------------------------------------------------------------------------
# VERIFICA FINALE
# ---------------------------------------------------------------------------

# La generazione degli asset termina sovrascrivendo tileset.png con la versione
# M6: tutti i GID legacy 1-16 restano compatibili con i buffer esistenti.
from m6_tiles import build_tileset  # noqa: E402

build_tileset().save(OUT / "tileset.png")

print(f"File creati in {OUT}: {len(FILES)}")
chiavi = ("player.png", "building_160_3_0.png", "car_white.png", "bus.png", "train.png", "tileset.png")
for name in chiavi:
    with Image.open(OUT / name) as im:
        print(f"  {name}: {im.size[0]}x{im.size[1]}")
print("Verifica: tutti i file sono nella cartella public/assets/scale/.")
