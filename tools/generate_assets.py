"""Generatore di pixel art originale per BACOLI LIFE.

Tutti gli asset sono disegnati esplicitamente pixel per pixel su una griglia
di base 16x16, con palette mediterranea ricavata dai riferimenti fotografici.
Nessuna immagine fotografica viene incollata nel gioco.

Uso: python tools/generate_assets.py
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "public" / "assets"
T = A / "tiles"
S = A / "sprites"
B = A / "buildings"
for folder in (A, T, S, B):
    folder.mkdir(parents=True, exist_ok=True)

# Palette mediterranea (campionata dai riferimenti, riadattata a 16 bit).
P = {
    "ink": "#0C1823",
    "shadow": "#1B2C33",
    "night": "#12335F",
    "sea_deep": "#144D90",
    "sea": "#185F76",
    "sea_mid": "#337A98",
    "sea_light": "#3A9FF3",
    "foam": "#AFD7E3",
    "sky": "#A6CEF3",
    "sand": "#D3B59D",
    "sand_light": "#E8D3B8",
    "sand_dark": "#AD8370",
    "plaster": "#DBC8A6",
    "plaster_warm": "#D3B59D",
    "plaster_shade": "#B69375",
    "stone": "#93806B",
    "stone_light": "#BC9E87",
    "stone_dark": "#5C4E35",
    "terra": "#B67352",
    "terra_light": "#C08952",
    "terra_dark": "#825834",
    "ochre": "#E6AB2D",
    "olive": "#4C6E44",
    "leaf": "#51B526",
    "leaf_dark": "#2F5B32",
    "wood": "#78614C",
    "wood_dark": "#4E3F2D",
    "white": "#F2EAD8",
    "red": "#B1403B",
    "pink": "#D98B96",
    "blue": "#3A6EA5",
    "skin": "#D3A078",
    "skin_dark": "#A96E4C",
    "hair": "#4E3F2D",
    "hair_light": "#78614C",
}


def canvas(w: int, h: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def box(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color: str) -> None:
    d.rectangle((x, y, x + w - 1, y + h - 1), fill=P.get(color, color))


def outline(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color: str = "ink") -> None:
    d.rectangle((x, y, x + w - 1, y + h - 1), outline=P.get(color, color))


def speckle(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, colors: tuple[str, ...], seed: int, density: float = 0.16) -> None:
    rnd = random.Random(seed)
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if rnd.random() < density:
                d.point((xx, yy), fill=P.get(rnd.choice(colors), rnd.choice(colors)))


# ---------------------------------------------------------------------------
# TILESET 16x16 - 4 colonne x 4 righe
# ---------------------------------------------------------------------------

def tile_grass(d: ImageDraw.ImageDraw, ox: int, oy: int, variant: int) -> None:
    box(d, ox, oy, 16, 16, "olive")
    rnd = random.Random(100 + variant)
    for _ in range(46):
        x, y = ox + rnd.randrange(16), oy + rnd.randrange(16)
        d.point((x, y), fill=P[rnd.choice(("leaf_dark", "leaf", "leaf", "stone_dark"))])
    for _ in range(7):
        x, y = ox + rnd.randrange(2, 15), oy + rnd.randrange(3, 15)
        d.point((x, y), fill=P["leaf"])
        d.point((x + 1, y - 1), fill=P["leaf"])


def tile_sand(d: ImageDraw.ImageDraw, ox: int, oy: int, variant: int) -> None:
    box(d, ox, oy, 16, 16, "sand")
    rnd = random.Random(200 + variant)
    for _ in range(38):
        x, y = ox + rnd.randrange(16), oy + rnd.randrange(16)
        d.point((x, y), fill=P[rnd.choice(("sand_light", "sand_dark", "sand_light"))])
    for _ in range(4):
        x, y = ox + rnd.randrange(16), oy + rnd.randrange(16)
        d.point((x, y), fill=P["stone_light"])


def tile_cobble(d: ImageDraw.ImageDraw, ox: int, oy: int, variant: int) -> None:
    box(d, ox, oy, 16, 16, "stone_dark")
    rows = ((0, 0, 7, 6), (8, 0, 7, 5), (0, 7, 5, 4), (6, 7, 9, 4), (0, 12, 8, 3), (9, 12, 6, 3))
    rnd = random.Random(300 + variant)
    for sx, sy, w, h in rows:
        x, y = ox + sx, oy + sy
        tone = rnd.choice(("stone", "stone_light", "plaster_warm", "stone"))
        box(d, x, y, w - 1, h - 1, tone)
        box(d, x, y, w - 1, 1, "stone_light")
        box(d, x, y + h - 2, w - 1, 1, "stone_dark")
        for _ in range(max(1, w * h // 16)):
            d.point((x + rnd.randrange(w - 1), y + 1 + rnd.randrange(max(1, h - 2))), fill=P["stone_dark"])


def tile_asphalt(d: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
    box(d, ox, oy, 16, 16, "shadow")
    rnd = random.Random(400)
    for _ in range(30):
        x, y = ox + rnd.randrange(16), oy + rnd.randrange(16)
        d.point((x, y), fill=P[rnd.choice(("night", "stone_dark", "ink"))])


def tile_paving(d: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
    box(d, ox, oy, 16, 16, "plaster")
    box(d, ox, oy, 16, 1, "plaster_shade")
    box(d, ox, oy + 7, 16, 1, "plaster_shade")
    box(d, ox, oy, 1, 16, "plaster_shade")
    box(d, ox + 8, oy + 8, 1, 8, "plaster_shade")
    speckle(d, ox, oy, 16, 16, ("white", "plaster_warm"), 500, 0.10)


def tile_water(d: ImageDraw.ImageDraw, ox: int, oy: int, phase: int) -> None:
    tones = ("sea_deep", "sea", "sea_mid", "sea_light")
    box(d, ox, oy, 16, 16, tones[phase % 2])
    for y in range(16):
        shift = int(3 * math.sin((y + phase * 3) * 0.7)) % 5
        for x in range(16):
            wave = math.sin((x + shift) * 0.55 + y * 0.35 + phase * 1.4)
            if wave > 0.78:
                c = "sea_light"
            elif wave > 0.35:
                c = "sea_mid"
            elif wave < -0.75:
                c = "sea_deep"
            else:
                c = "sea"
            d.point((ox + x, oy + y), fill=P[c])
    for y in (3, 10):
        x0 = (phase * 4 + y) % 16
        for k in range(4):
            d.point((ox + (x0 + k) % 16, oy + y), fill=P["foam"])


def tile_foam(d: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
    box(d, ox, oy, 16, 16, "sea_mid")
    for x in range(16):
        y = oy + 4 + int(3 * math.sin(x * 0.8))
        d.point((ox + x, y), fill=P["foam"])
        if x % 3 == 0:
            d.point((ox + x, y + 1), fill=P["white"])


def tile_wall(d: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
    box(d, ox, oy, 16, 16, "plaster_shade")
    for row in range(4):
        y = oy + row * 4
        for col in range(2):
            x = ox + col * 8 + (4 if row % 2 else 0)
            box(d, x, y, 7, 3, "stone_light" if (row + col) % 2 == 0 else "stone")
    speckle(d, ox, oy, 16, 16, ("plaster", "stone_dark"), 600, 0.08)


def tile_roof(d: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
    box(d, ox, oy, 16, 16, "terra_dark")
    for row in range(4):
        y = oy + row * 4
        off = 2 if row % 2 else 0
        for x in range(-4, 16, 4):
            xx = ox + x + off
            box(d, xx, y, 3, 3, "terra" if (row + x) % 3 else "terra_light")
            box(d, xx, y, 3, 1, "terra_light")
    box(d, ox, oy + 15, 16, 1, "wood_dark")


def tile_flowerbed(d: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
    box(d, ox, oy, 16, 16, "olive")
    for x, y, c in ((3, 4, "red"), (7, 3, "ochre"), (11, 6, "pink"), (4, 10, "ochre"), (10, 11, "red")):
        box(d, ox + x, oy + y, 2, 2, c)
        d.point((ox + x + 1, oy + y + 2), fill=P["leaf_dark"])


def tile_steps(d: ImageDraw.ImageDraw, ox: int, oy: int) -> None:
    box(d, ox, oy, 16, 16, "stone_dark")
    for i in range(4):
        box(d, ox + i, oy + i, 16 - 2 * i, 3, "stone_light" if i % 2 else "stone")
        box(d, ox + i, oy + i + 2, 16 - 2 * i, 1, "stone_dark")


def build_tileset() -> None:
    im, d = canvas(64, 64)
    tile_grass(d, 0, 0, 0)
    tile_grass(d, 16, 0, 1)
    tile_sand(d, 32, 0, 0)
    tile_sand(d, 48, 0, 1)
    tile_cobble(d, 0, 16, 0)
    tile_cobble(d, 16, 16, 1)
    tile_asphalt(d, 32, 16)
    tile_paving(d, 48, 16)
    for i in range(4):
        tile_water(d, i * 16, 32, i)
    tile_foam(d, 0, 48)
    tile_wall(d, 16, 48)
    tile_roof(d, 32, 48)
    tile_flowerbed(d, 48, 48)
    im.save(T / "tileset.png")
    print("tileset.png 64x64 (16 tile da 16x16)")


# ---------------------------------------------------------------------------
# EDIFICI - facciate dettagliate
# ---------------------------------------------------------------------------

def window(d: ImageDraw.ImageDraw, x: int, y: int, shutters: str = "olive", flowerbox: bool = True) -> None:
    box(d, x - 1, y - 1, 14, 18, "wood_dark")
    box(d, x, y, 12, 16, "white")
    box(d, x + 1, y + 1, 10, 14, "sea")
    box(d, x + 1, y + 1, 4, 6, "sky")
    box(d, x + 6, y + 8, 5, 7, "sea_mid")
    box(d, x + 6, y, 1, 16, "wood_dark")
    box(d, x, y + 8, 12, 1, "wood_dark")
    box(d, x - 4, y - 1, 3, 18, shutters)
    box(d, x + 13, y - 1, 3, 18, shutters)
    for i in range(6):
        box(d, x - 4, y + i * 3, 3, 1, "wood_dark")
        box(d, x + 13, y + i * 3, 3, 1, "wood_dark")
    box(d, x - 2, y + 17, 16, 2, "stone_light")
    if flowerbox:
        box(d, x - 1, y + 19, 14, 4, "terra_dark")
        for i, c in enumerate(("red", "ochre", "pink", "leaf")):
            box(d, x + i * 3, y + 17, 3, 3, c)


def balcony(d: ImageDraw.ImageDraw, x: int, y: int, w: int = 34) -> None:
    box(d, x, y + 12, w, 4, "stone_light")
    box(d, x, y + 15, w, 2, "stone_dark")
    box(d, x + 1, y + 1, w - 2, 2, "wood_dark")
    for i in range(0, w, 4):
        box(d, x + i, y + 2, 1, 11, "ink")
    box(d, x, y + 11, w, 1, "ink")


def door(d: ImageDraw.ImageDraw, x: int, y: int, color: str = "wood_dark") -> None:
    box(d, x - 1, y - 11, 16, 24, "stone_dark")
    box(d, x, y - 10, 14, 22, color)
    for yy in range(-10, -6):
        box(d, x + max(0, 4 - abs(yy + 8)), y + yy, 14 - 2 * max(0, 4 - abs(yy + 8)), 1, color)
    box(d, x + 1, y - 8, 5, 8, "wood")
    box(d, x + 8, y - 8, 5, 8, "wood")
    box(d, x + 1, y + 2, 5, 8, "wood")
    box(d, x + 8, y + 2, 5, 8, "wood")
    d.point((x + 11, y + 1), fill=P["ochre"])
    box(d, x - 3, y + 13, 20, 3, "stone_light")


def awning(d: ImageDraw.ImageDraw, x: int, y: int, w: int) -> None:
    for i in range(w):
        c = "red" if (i // 5) % 2 == 0 else "white"
        box(d, x + i, y, 1, 8, c)
    for i in range(0, w, 5):
        box(d, x + i, y + 8, 5, 2, "red" if (i // 5) % 2 == 0 else "white")
    box(d, x, y - 1, w, 1, "wood_dark")


def laundry(d: ImageDraw.ImageDraw, x: int, y: int, w: int) -> None:
    for xx in range(x, x + w):
        d.point((xx, y + int(2 * math.sin(xx * 0.4))), fill=P["wood_dark"])
    items = ((2, "white", 5), (10, "sea_light", 6), (20, "ochre", 5))
    for dx, c, h in items:
        xx = x + dx
        box(d, xx, y + 1, 6, h, c)
        box(d, xx, y + 1, 6, 1, "ink")
        box(d, xx + 5, y + 1, 1, h, "ink")


def roof(d: ImageDraw.ImageDraw, w: int, h: int, height: int = 20) -> None:
    box(d, 2, 2, w - 4, height - 2, "terra_dark")
    for row in range(height // 4):
        y = 3 + row * 4
        off = 2 if row % 2 else 0
        for x in range(0, w, 4):
            xx = x + off
            if 2 <= xx < w - 2:
                box(d, xx, y, 3, 3, "terra" if (row + x // 4) % 3 else "terra_light")
                box(d, xx, y, 3, 1, "terra_light")
    box(d, 1, height - 3, w - 2, 3, "wood_dark")
    box(d, 3, 1, w - 6, 2, "terra_light")


def building_base(w: int, h: int, wall: str, seed: int) -> Image.Image:
    im, d = canvas(w, h)
    box(d, 1, 18, w - 2, h - 19, wall)
    speckle(d, 1, 18, w - 2, h - 19, ("plaster_shade", "white"), seed, 0.07)
    box(d, 0, 18, 1, h - 18, "ink")
    box(d, w - 1, 18, 1, h - 18, "ink")
    box(d, 1, h - 2, w - 2, 2, "stone_dark")
    roof(d, w, h)
    return im


def make_building(style: int) -> Image.Image:
    w, h = 80, 96
    styles = {
        0: ("plaster_warm", "olive"),
        1: ("plaster", "blue"),
        2: ("sand_light", "terra_dark"),
        3: ("stone_light", "olive"),
        4: ("plaster", "sea"),
        5: ("white", "olive"),
    }
    wall, shutter = styles[style]
    im = building_base(w, h, wall, 700 + style)
    d = ImageDraw.Draw(im)

    if style == 0:  # casa con balcone e panni stesi
        door(d, 34, 92, "wood_dark")
        window(d, 8, 42, shutter)
        balcony(d, 8, 38, 34)
        window(d, 50, 42, shutter, False)
        laundry(d, 6, 30, 34)
        box(d, 4, 84, 9, 11, "terra_dark")
        box(d, 6, 82, 5, 3, "leaf_dark")
    elif style == 1:  # palazzo con tre balconi
        door(d, 34, 92, "wood")
        for x in (5, 33, 61):
            window(d, x, 38, shutter, False)
            balcony(d, x - 3, 34, 20)
        window(d, 12, 70, shutter)
        window(d, 56, 70, shutter)
        box(d, 38, 82, 4, 10, "stone_light")
    elif style == 2:  # bar / pizzeria
        box(d, 0, 40, w, 11, "stone_light")
        awning(d, 4, 40, 72)
        door(d, 34, 92, "wood")
        window(d, 8, 56, shutter, False)
        window(d, 58, 56, shutter, False)
        box(d, 25, 29, 30, 9, "wood_dark")
        box(d, 27, 31, 26, 5, "ochre")
        for i in range(6):
            box(d, 30 + i * 4, 32, 2, 3, "ink")
        box(d, 6, 84, 10, 10, "terra_dark")
        box(d, 8, 82, 6, 3, "leaf")
    elif style == 3:  # cappella in pietra
        box(d, 0, 20, w, h - 21, "stone")
        speckle(d, 1, 22, w - 2, h - 25, ("stone_light", "stone_dark"), 77, 0.13)
        d.ellipse((30, 62, 50, 92), fill=P["wood_dark"], outline=P["ink"], width=1)
        box(d, 34, 74, 12, 18, "wood")
        box(d, 16, 48, 9, 14, "sea")
        box(d, 15, 47, 11, 1, "stone_light")
        box(d, 56, 48, 9, 14, "sea")
        box(d, 55, 47, 11, 1, "stone_light")
        box(d, 35, 2, 10, 16, "stone_light")
        box(d, 37, 5, 6, 8, "ink")
        box(d, 38, 6, 4, 6, "ochre")
    elif style == 4:  # negozio con saracinesche
        door(d, 36, 92, "sea")
        box(d, 6, 52, 22, 30, "wood_dark")
        box(d, 53, 52, 22, 30, "wood_dark")
        for y in range(54, 82, 4):
            box(d, 8, y, 18, 1, "wood")
            box(d, 55, y, 18, 1, "wood")
        box(d, 30, 28, 20, 8, "red")
        for i in range(5):
            box(d, 32 + i * 4, 30, 2, 4, "white")
    else:  # villa con terrazzo vista mare
        box(d, 2, 76, w - 4, 18, "stone_light")
        for i in range(0, w - 4, 8):
            box(d, 2 + i, 76, 1, 18, "plaster_shade")
        door(d, 34, 74, "wood_dark")
        window(d, 6, 40, shutter)
        window(d, 60, 40, shutter)
        window(d, 32, 42, shutter, False)
        laundry(d, 4, 34, 30)
        box(d, 66, 84, 10, 10, "terra_dark")
        box(d, 68, 82, 6, 3, "red")

    # ombra coerente alla base
    d.ellipse((4, h - 6, w - 4, h), fill=(12, 24, 35, 90))
    im.save(B / f"building_{style}.png")
    return im


# ---------------------------------------------------------------------------
# PERSONAGGI - 4 direzioni x 4 frame, 16x32
# ---------------------------------------------------------------------------

def draw_character(d: ImageDraw.ImageDraw, ox: int, oy: int, direction: int, frame: int, shirt: str, hair: str, skin: str) -> None:
    swing = ((frame % 4) - 1) * 2
    # ombra
    d.ellipse((ox + 3, oy + 28, ox + 13, oy + 32), fill=(12, 24, 35, 110))
    # gambe e scarpe
    box(d, ox + 4, oy + 20, 3, 8, "night")
    box(d, ox + 9, oy + 20, 3, 8, "night")
    box(d, ox + 4 + max(0, swing), oy + 27, 3, 2, "ink")
    box(d, ox + 9 - max(0, -swing), oy + 27, 3, 2, "ink")
    # busto
    box(d, ox + 4, oy + 12, 8, 9, shirt)
    box(d, ox + 4, oy + 12, 2, 9, "shadow")
    box(d, ox + 10, oy + 12, 2, 9, "ink")
    # braccia
    box(d, ox + 2, oy + 13 + (swing // 2), 2, 7, shirt)
    box(d, ox + 12, oy + 13 - (swing // 2), 2, 7, shirt)
    box(d, ox + 2, oy + 19 + (swing // 2), 2, 2, skin)
    box(d, ox + 12, oy + 19 - (swing // 2), 2, 2, skin)
    # testa
    box(d, ox + 4, oy + 4, 8, 8, skin)
    box(d, ox + 5, oy + 3, 6, 1, skin)
    box(d, ox + 3, oy + 4, 1, 6, skin)
    box(d, ox + 12, oy + 4, 1, 6, skin)
    if direction == 0:  # fronte
        box(d, ox + 4, oy + 3, 8, 3, hair)
        box(d, ox + 5, oy + 2, 6, 1, hair)
        box(d, ox + 5, oy + 8, 1, 1, "ink")
        box(d, ox + 10, oy + 8, 1, 1, "ink")
        box(d, ox + 7, oy + 10, 2, 1, "skin_dark")
    elif direction == 1:  # sinistra
        box(d, ox + 4, oy + 3, 8, 4, hair)
        box(d, ox + 3, oy + 4, 2, 6, hair)
        box(d, ox + 5, oy + 8, 1, 1, "ink")
    elif direction == 2:  # destra
        box(d, ox + 4, oy + 3, 8, 4, hair)
        box(d, ox + 11, oy + 4, 2, 6, hair)
        box(d, ox + 10, oy + 8, 1, 1, "ink")
    else:  # retro
        box(d, ox + 4, oy + 2, 8, 7, hair)
        box(d, ox + 4, oy + 8, 8, 2, P["hair_light"])


def make_character(name: str, shirt: str, hair: str, skin: str) -> None:
    im, d = canvas(64, 128)
    for direction in range(4):
        for frame in range(4):
            draw_character(d, frame * 16, direction * 32, direction, frame, shirt, hair, skin)
    im.save(S / f"{name}.png")
    print(f"{name}.png 64x128 (4 direzioni x 4 frame)")


# ---------------------------------------------------------------------------
# PROPS
# ---------------------------------------------------------------------------

def make_prop(name: str, w: int, h: int, draw_fn) -> None:
    im, d = canvas(w, h)
    draw_fn(d, w, h)
    im.save(S / f"{name}.png")


def palm(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    box(d, w // 2 - 2, h - 26, 4, 26, "wood")
    for y in range(h - 25, h):
        box(d, w // 2 - 2, y, 1, 1, "wood_dark")
        if y % 4 == 0:
            box(d, w // 2 + 2, y, 1, 1, "wood_dark")
    for ang in range(0, 360, 45):
        rad = math.radians(ang)
        for step in range(3, 15):
            x = int(w // 2 + math.cos(rad) * step)
            y = int(10 + math.sin(rad) * step * 0.45 - step * 0.12)
            c = "leaf_dark" if step < 7 else "leaf"
            box(d, x, y, 3, 2, c)
    d.ellipse((w // 2 - 4, 6, w // 2 + 4, 14), fill=P["leaf_dark"])


def olive(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    box(d, w // 2 - 2, h - 16, 4, 16, "wood_dark")
    box(d, w // 2 - 7, h - 2, 14, 2, "ink")
    for cx, cy, r in ((16, 14, 10), (24, 17, 9), (10, 20, 7)):
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=P["olive"])
        d.ellipse((cx - r + 2, cy - r + 1, cx + r - 2, cy + r - 3), fill=P["leaf_dark"])
    for x, y in ((10, 12), (20, 10), (26, 20), (14, 24)):
        box(d, x, y, 2, 2, "stone_dark")


def bench(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    box(d, 1, 4, 22, 3, "wood")
    box(d, 1, 9, 22, 3, "wood")
    box(d, 2, 3, 20, 1, "wood_dark")
    box(d, 2, 8, 20, 1, "wood_dark")
    box(d, 4, 12, 2, 4, "ink")
    box(d, 18, 12, 2, 4, "ink")
    d.ellipse((2, h - 3, w - 2, h), fill=(12, 24, 35, 90))


def lamp(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    box(d, 7, h - 2, 2, 2, "ink")
    box(d, 7, 6, 2, h - 8, "ink")
    box(d, 5, 4, 6, 3, "ink")
    box(d, 6, 5, 4, 2, "ochre")
    d.ellipse((4, 1, 10, 7), outline=P["ink"], width=1)


def umbrella(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    box(d, 15, 18, 2, 14, "wood_dark")
    for x in range(1, 31):
        yy = 18 - int(12 * math.sin(math.pi * x / 30))
        c = "red" if (x // 5) % 2 == 0 else "white"
        box(d, x, yy, 1, 3, c)
    d.ellipse((10, 30, 22, 32), fill=(12, 24, 35, 90))


def boat(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    d.ellipse((1, 10, 46, 23), fill=P["wood_dark"])
    box(d, 4, 12, 40, 7, "white")
    box(d, 22, 2, 2, 11, "wood_dark")
    d.polygon([(25, 3), (42, 12), (25, 12)], fill=P["ochre"])
    d.ellipse((0, h - 3, w, h), fill=(12, 24, 35, 70))


# ---------------------------------------------------------------------------
# INTERNI: pavimenti e arredi
# ---------------------------------------------------------------------------

def make_room_floors() -> None:
    im, d = canvas(64, 16)
    # parquet
    box(d, 0, 0, 16, 16, "wood")
    for y in range(0, 16, 4):
        box(d, 0, y, 16, 1, "wood_dark")
        for x in range((y // 4) % 2 * 4, 16, 8):
            box(d, x, y, 1, 4, "wood_dark")
    # piastrelle bianche e blu
    box(d, 16, 0, 16, 16, "white")
    for y in range(0, 16, 4):
        for x in range(16, 32, 4):
            if (x // 4 + y // 4) % 2:
                box(d, x, y, 4, 4, "foam")
    box(d, 16, 0, 16, 1, "stone_light")
    # cotto
    box(d, 32, 0, 16, 16, "terra_dark")
    for y in range(0, 16, 4):
        for x in range(32, 48, 8):
            box(d, x + (2 if (y // 4) % 2 else 0), y, 6, 3, "terra")
    # tappeto
    box(d, 48, 0, 16, 16, "red")
    box(d, 50, 2, 12, 12, "ochre")
    box(d, 52, 4, 8, 8, "red")
    speckle(d, 48, 0, 16, 16, ("white", "terra_light"), 900, 0.06)
    im.save(T / "room_floors.png")


def furniture(d: ImageDraw.ImageDraw, w: int, h: int, kind: str) -> None:
    base = h - 2
    if kind == "bed":
        box(d, 2, 10, 28, h - 12, "wood_dark")
        box(d, 4, 12, 24, h - 16, "white")
        box(d, 4, 12, 24, 6, "plaster")
        box(d, 6, 19, 20, h - 23, "sea_light")
        box(d, 2, 6, 5, h - 8, "wood")
        box(d, 3, 7, 3, 4, "stone_light")
    elif kind == "sofa":
        box(d, 1, 10, 30, h - 12, "wood_dark")
        box(d, 3, 12, 26, h - 16, "olive")
        box(d, 3, 12, 26, 5, "leaf_dark")
        box(d, 6, 17, 8, h - 20, "leaf")
        box(d, 18, 17, 8, h - 20, "leaf")
        box(d, 1, 12, 3, h - 14, "wood")
        box(d, 28, 12, 3, h - 14, "wood")
    elif kind == "table":
        box(d, 2, 12, 28, 4, "wood")
        box(d, 2, 12, 28, 1, "wood_dark")
        box(d, 5, 16, 3, h - 17, "wood_dark")
        box(d, 24, 16, 3, h - 17, "wood_dark")
        box(d, 12, 8, 8, 4, "white")
        box(d, 14, 6, 4, 2, "ochre")
    elif kind == "chair":
        box(d, 4, 6, 24, 5, "wood")
        box(d, 4, 6, 24, 1, "wood_dark")
        box(d, 6, 11, 20, 4, "wood_dark")
        box(d, 6, 15, 3, h - 16, "wood")
        box(d, 23, 15, 3, h - 16, "wood")
    elif kind == "fridge":
        box(d, 6, 2, 20, h - 3, "white")
        box(d, 6, 2, 20, 1, "foam")
        box(d, 6, 16, 20, 2, "foam")
        box(d, 21, 7, 2, 6, "stone_dark")
        box(d, 21, 19, 2, 6, "stone_dark")
    elif kind == "stove":
        box(d, 3, 10, 26, h - 11, "stone_light")
        box(d, 4, 8, 24, 3, "ink")
        for x in (8, 20):
            d.ellipse((x - 3, 8, x + 3, 13), outline=P["stone_dark"], width=1)
        box(d, 5, 15, 22, 6, "stone_dark")
        box(d, 7, 17, 18, 2, "ochre")
    elif kind == "shelf":
        box(d, 2, 4, 28, h - 5, "wood_dark")
        for y in (8, 16, 24):
            box(d, 3, y, 26, 2, "wood")
            for x, c in ((5, "red"), (10, "ochre"), (16, "sea"), (23, "olive")):
                box(d, x, y - 4, 3, 4, c)
    elif kind == "tv":
        box(d, 2, 6, 28, 18, "ink")
        box(d, 4, 8, 24, 14, "sea_deep")
        box(d, 6, 10, 9, 5, "sky")
        box(d, 14, 15, 12, 5, "sea_mid")
        box(d, 14, 24, 4, 3, "stone_dark")
        box(d, 8, 27, 16, 2, "stone_dark")
    elif kind == "espresso":
        box(d, 8, 8, 16, h - 9, "ink")
        box(d, 10, 10, 12, 8, "stone_light")
        box(d, 12, 12, 3, 3, "ochre")
        box(d, 14, 19, 4, 5, "white")
        box(d, 6, 6, 20, 3, "red")
    elif kind == "register":
        box(d, 6, 10, 20, h - 11, "ink")
        box(d, 8, 12, 16, 8, "stone_light")
        box(d, 10, 14, 12, 4, "leaf_dark")
        box(d, 8, 22, 16, 3, "stone")
    elif kind == "bathtub":
        d.ellipse((2, 8, 30, h - 2), fill=P["white"], outline=P["ink"], width=1)
        d.ellipse((5, 10, 27, h - 5), fill=P["foam"])
        box(d, 24, 4, 3, 6, "ochre")
    elif kind == "toilet":
        box(d, 8, 4, 16, 10, "white")
        d.ellipse((6, 12, 26, h - 2), fill=P["white"], outline=P["ink"], width=1)
        d.ellipse((9, 14, 23, h - 5), fill=P["foam"])
    elif kind == "plant":
        box(d, 10, 20, 12, h - 21, "terra_dark")
        box(d, 9, 19, 14, 2, "terra")
        for x, y in ((12, 12), (18, 10), (15, 16), (9, 15), (21, 14)):
            d.ellipse((x - 3, y - 4, x + 3, y + 4), fill=P["leaf_dark"])
            d.point((x, y), fill=P["leaf"])
    d.ellipse((3, h - 3, w - 3, h), fill=(12, 24, 35, 80))


def make_furniture() -> None:
    kinds = ("bed", "sofa", "table", "chair", "fridge", "stove", "shelf", "tv",
             "espresso", "register", "bathtub", "toilet", "plant")
    for kind in kinds:
        im, d = canvas(32, 32)
        furniture(d, 32, 32, kind)
        im.save(S / f"f_{kind}.png")


def generate_all() -> None:
    build_tileset()
    make_room_floors()
    make_furniture()
    for style in range(6):
        make_building(style)
    make_character("player", "sea_light", "hair", "skin")
    make_character("npc_1", "red", "hair_light", "skin")
    make_character("npc_2", "olive", "hair", "skin_dark")
    make_character("npc_3", "ochre", "wood_dark", "skin")
    make_character("npc_4", "blue", "hair_light", "skin_dark")
    make_prop("palm", 32, 48, palm)
    make_prop("olive_tree", 40, 44, olive)
    make_prop("bench", 24, 16, bench)
    make_prop("lamp", 16, 48, lamp)
    make_prop("umbrella", 32, 32, umbrella)
    make_prop("boat", 48, 32, boat)
    print("Asset generati in", A)


if __name__ == "__main__":
    generate_all()
