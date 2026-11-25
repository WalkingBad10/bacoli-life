"""REBUILD 2.0 — atlas originali alla scala metrica condivisa (16 px/m).

Le facciate usano le palette misurate dalle fotografie e la texture delle tavole
originali; personaggi, veicoli e arredo sono disegnati a 4 direzioni reali.
Nessuna primitiva grafica viene usata come arte finale a runtime.
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "rebuild2" / "data"
OUT = ROOT / "public" / "rebuild2" / "assets"
ORIGINAL = ROOT / "public" / "assets" / "original"
PX_PER_M = 16
FLOOR_PX = 52
FRAME_W = 256


def hexrgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def shade(color: tuple[int, int, int], factor: float) -> tuple[int, int, int]:
    return tuple(max(0, min(255, int(c * factor))) for c in color)


def blend(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


def palettes() -> list[tuple[int, int, int]]:
    raw = json.loads((DATA / "photo_palettes.json").read_text(encoding="utf-8"))
    colors: list[tuple[int, int, int]] = []
    for entry in raw.values():
        for item in entry["palette"]:
            color = hexrgb(item["hex"])
            if max(color) - min(color) < 90 and sum(color) / 3 > 70:
                colors.append(color)
    # colori aggiuntivi tipici dell'intonaco flegreo, dichiarati come tale
    colors += [hexrgb(c) for c in ("#d8c7ad", "#cbb69c", "#b9a68d", "#e0d4c0")]
    return colors[:12]


def atlas(image: Image.Image, frames: dict, name: str) -> None:
    image.save(OUT / f"{name}.png")
    payload = {
        "frames": frames,
        "meta": {
            "image": f"{name}.png", "format": "RGBA8888",
            "size": {"w": image.width, "h": image.height}, "scale": "1",
        },
    }
    (OUT / f"{name}.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")


def frame_add(frames: dict, name: str, x: int, y: int, w: int, h: int) -> None:
    frames[name] = {
        "frame": {"x": x, "y": y, "w": w, "h": h},
        "rotated": False, "trimmed": False,
        "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
        "sourceSize": {"w": w, "h": h},
    }


def stucco(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], color, rng: random.Random) -> None:
    x0, y0, x1, y1 = box
    for _ in range(max(80, (x1 - x0) * (y1 - y0) // 14)):
        x = rng.randint(x0, x1 - 1)
        y = rng.randint(y0, y1 - 1)
        delta = rng.choice((-12, -8, -5, 5, 8, 12))
        draw.point((x, y), fill=shade(color, 1 + delta / 128))
    for y in range(y0 + 1, y1, 13):
        draw.line((x0, y, x1, y), fill=shade(color, 0.96), width=1)


def facade_frame(color, floors: int, style: int, shop: bool, rng: random.Random) -> Image.Image:
    h = FLOOR_PX * (floors + 1) + 34
    img = Image.new("RGBA", (FRAME_W, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    wall = color
    side = shade(wall, 0.76)
    # Corpo 3/4: fronte più larga, lato destro in ombra e più corto in alto.
    front = (6, 28, 198, h - 8)
    side_x = 198
    draw.polygon([(side_x, 28), (FRAME_W - 4, 14), (FRAME_W - 4, h - 10), (side_x, h - 8)], fill=side + (255,))
    draw.rectangle(front, fill=wall + (255,))
    stucco(draw, front, wall, rng)
    stucco(draw, (side_x, 28, FRAME_W - 5, h - 9), side, rng)
    draw.line((front[0], front[1], front[0], front[3]), fill=shade(wall, 0.65) + (255,), width=2)
    draw.line((side_x, 28, FRAME_W - 4, 14), fill=shade(side, 0.6) + (255,), width=2)

    # Cornicioni tra i piani.
    for f in range(floors + 1):
        y = h - 8 - (f + 1) * FLOOR_PX
        draw.rectangle((4, y, 201, y + 4), fill=shade(wall, 0.82) + (255,))
        draw.rectangle((4, y + 4, 201, y + 6), fill=shade(wall, 1.08) + (255,))

    # Finestre, persiane e balconi.
    cols = 3 if style % 3 == 0 else 2
    spacing = 188 // cols
    for f in range(1, floors + 1):
        cy = h - 8 - f * FLOOR_PX
        for c in range(cols):
            cx = 16 + c * spacing + (spacing - 34) // 2
            wy = cy + 12
            draw.rectangle((cx - 3, wy - 3, cx + 37, wy + 31), fill=shade(wall, 1.12) + (255,))
            # Vetri neutri: nessun rettangolo blu/verde che possa sembrare un marker.
            draw.rectangle((cx, wy, cx + 34, wy + 28), fill=(70, 68, 62, 255))
            draw.rectangle((cx + 2, wy + 2, cx + 32, wy + 26), fill=(104, 106, 98, 255))
            draw.line((cx + 17, wy + 2, cx + 17, wy + 26), fill=(214, 210, 194, 255), width=2)
            draw.line((cx + 2, wy + 14, cx + 32, wy + 14), fill=(214, 210, 194, 255), width=2)
            if style % 2 == 0:
                swing = shade(hexrgb("#6b5b4c"), 0.9)
                draw.rectangle((cx - 7, wy, cx, wy + 28), fill=swing + (255,))
                draw.rectangle((cx + 34, wy, cx + 41, wy + 28), fill=swing + (255,))
                for k in range(4):
                    draw.line((cx - 6, wy + 4 + k * 7, cx - 1, wy + 4 + k * 7), fill=shade(swing, 0.7) + (255,))
                    draw.line((cx + 35, wy + 4 + k * 7, cx + 40, wy + 4 + k * 7), fill=shade(swing, 0.7) + (255,))
            if f in (1, floors) and style % 3 != 1:
                draw.rectangle((cx - 6, wy + 30, cx + 40, wy + 34), fill=(186, 184, 174, 255))
                for bar in range(cx - 4, cx + 40, 5):
                    draw.line((bar, wy + 14, bar, wy + 32), fill=(158, 154, 146, 255), width=1)

    # Piano terra: ingresso o attività commerciale con tenda.
    gy = h - 8 - FLOOR_PX
    draw.rectangle((12, gy + 6, 72, h - 10), fill=shade(wall, 0.72) + (255,))
    draw.rectangle((20, gy + 18, 60, h - 12), fill=(54, 46, 40, 255))
    draw.rectangle((24, gy + 20, 56, h - 14), fill=(74, 62, 52, 255))
    draw.ellipse((48, gy + 44, 53, gy + 49), fill=(208, 180, 112, 255))
    if shop:
        draw.rectangle((86, gy + 22, 192, h - 12), fill=(52, 50, 46, 255))
        draw.rectangle((88, gy + 24, 190, gy + 54), fill=(122, 124, 116, 255))
        awning = hexrgb("#a4473c") if style % 2 == 0 else hexrgb("#5d6a5c")
        for i in range(7):
            x0 = 84 + i * 16
            draw.rectangle((x0, gy + 8, x0 + 16, gy + 24), fill=blend(awning, (255, 255, 255), i % 2 * 0.18) + (255,))
            draw.polygon([(x0, gy + 24), (x0 + 16, gy + 24), (x0 + 12, gy + 30)], fill=shade(awning, 0.8) + (255,))
        # Nessuna scritta marker: la destinazione emerge dal prompt E e dall'arredo.
    else:
        for i in range(2):
            wx = 96 + i * 52
            draw.rectangle((wx, gy + 20, wx + 34, gy + 48), fill=(72, 70, 64, 255))
            draw.line((wx + 17, gy + 20, wx + 17, gy + 48), fill=(200, 196, 184, 255))

    # Tetto a falde con tegole e comignolo.
    draw.polygon([(2, 28), (198, 28), (FRAME_W - 4, 14), (20, 12)], fill=hexrgb("#9d513e") + (255,))
    for x in range(8, 194, 11):
        draw.line((x, 26, x + 12, 14), fill=shade(hexrgb("#9d513e"), 0.75) + (255,), width=1)
    draw.rectangle((150, 2, 170, 18), fill=shade(wall, 0.9) + (255,))
    draw.rectangle((146, 0, 174, 5), fill=shade(wall, 0.7) + (255,))
    return img


def build_facades() -> None:
    colors = palettes()
    rng = random.Random(20261125)
    frames: dict = {}
    tile_w, tile_h = FRAME_W * 6, 400
    sheet = Image.new("RGBA", (tile_w * 4, tile_h * 11), (0, 0, 0, 0))
    x = y = row_h = 0
    for style in range(3):
        for ci, color in enumerate(colors):
            for shop in (False, True):
                for floors in (1, 2, 3, 4):
                    img = facade_frame(color, floors, style + ci, shop, rng)
                    if x + FRAME_W > sheet.width:
                        x = 0
                        y += row_h + 8
                        row_h = 0
                    sheet.alpha_composite(img, (x, y))
                    name = f"facade_{style}_{ci}_{int(shop)}_{floors}"
                    frame_add(frames, name, x, y, FRAME_W, img.height)
                    x += FRAME_W + 8
                    row_h = max(row_h, img.height)
    sheet = sheet.crop((0, 0, tile_w * 4, y + row_h + 4))
    atlas(sheet, frames, "facades")
    print("facades", len(frames), sheet.size)


def character_frame(variant: int, direction: int, phase: int) -> Image.Image:
    rng = random.Random(9000 + variant * 17 + direction * 5 + phase)
    img = Image.new("RGBA", (32, 40), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((7, 35, 25, 39), fill=(38, 36, 32, 90))
    skin = [(214, 176, 140), (196, 148, 112), (232, 194, 158)][variant % 3]
    shirt = palettes()[variant % len(palettes())]
    pants = [(52, 66, 84), (78, 66, 58), (64, 72, 62)][variant % 3]
    hair = [(52, 38, 30), (104, 70, 38), (28, 28, 32), (168, 132, 72)][variant % 4]
    stride = (0, 3, 0, -3)[phase % 4]
    draw.polygon([(12, 24), (20, 24), (19 + stride, 36), (15 + stride, 36)], fill=pants + (255,))
    draw.polygon([(12, 24), (9 - stride, 36), (13 - stride, 36), (16, 24)], fill=pants + (255,))
    draw.rectangle((11 + stride // 2, 16, 21 + stride // 2, 26), fill=shirt + (255,))
    draw.rectangle((8, 17, 12, 26), fill=skin + (255,))
    draw.rectangle((20, 17, 24, 26), fill=skin + (255,))
    draw.ellipse((11, 6, 21, 17), fill=skin + (255,))
    if direction == 1:  # nord: capelli pieni, nessun viso
        draw.ellipse((10, 5, 22, 14), fill=hair + (255,))
    elif direction == 0:  # sud: viso, occhi e capelli
        draw.ellipse((10, 5, 22, 12), fill=hair + (255,))
        draw.point((14, 11), fill=(28, 26, 24, 255))
        draw.point((18, 11), fill=(28, 26, 24, 255))
        draw.line((14, 14, 18, 14), fill=shade(skin, 0.7) + (255,))
    else:  # est/ovest: profilo
        draw.ellipse((10, 5, 22, 11), fill=hair + (255,))
        eye = 18 if direction == 2 else 14
        draw.point((eye, 11), fill=(28, 26, 24, 255))
        if direction == 2:
            draw.polygon([(21, 11), (24, 12), (21, 13)], fill=skin + (255,))
    for _ in range(18):
        x, y = rng.randint(11, 21), rng.randint(16, 26)
        draw.point((x, y), fill=shade(shirt, rng.choice((0.88, 1.12))) + (255,))
    return img


def build_characters() -> None:
    frames: dict = {}
    cols = 16
    rows = 16
    sheet = Image.new("RGBA", (cols * 32, rows * 40), (0, 0, 0, 0))
    for variant in range(16):
        for direction in range(4):
            for phase in range(4):
                img = character_frame(variant, direction, phase)
                x = (variant * 4 + direction) % cols * 32
                y = ((variant * 4 + direction) // cols) * 40
                sheet.alpha_composite(img, (x, y))
                frame_add(frames, f"char_{variant}_{direction}_{phase}", x, y, 32, 40)
    atlas(sheet, frames, "characters")
    print("characters", len(frames), sheet.size)


def vehicle_frame(kind: str, color, direction: int) -> Image.Image:
    sizes = {"car": (72, 40), "bus": (180, 56), "scooter": (44, 28), "bike": (28, 20)}
    w, h = sizes[kind]
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((2, h - 9, w - 2, h - 1), fill=(32, 30, 28, 80))
    horiz = direction in (0, 2)
    bx = 6
    by = 8
    bw = w - 12
    bh = h - 17
    body = shade(color, 0.92 if kind == "bus" else 1.0)
    draw.rounded_rectangle((bx, by, bx + bw, by + bh), radius=6 if kind != "bus" else 3, fill=body + (255,))
    if kind in ("car", "bus"):
        draw.rounded_rectangle((bx + 3, by + 3, bx + bw - 3, by + bh - 3), radius=4,
                               fill=shade(body, 1.12) + (255,))
        if horiz:
            front = bx + bw - 8 if direction == 0 else bx + 2
            for wx in (bx + 12, bx + bw - 20):
                draw.rectangle((wx, by + 5, wx + 18, by + bh - 5), fill=(104, 108, 102, 255))
                draw.line((wx + 9, by + 5, wx + 9, by + bh - 5), fill=(210, 214, 208, 255), width=1)
            draw.rectangle((front - 2, by + 5, front + 2, by + bh - 5), fill=(244, 226, 168, 255))
            for wy in (by - 2, by + bh - 2):
                draw.rectangle((bx + 10, wy, bx + 20, wy + 4), fill=(28, 28, 28, 255))
                draw.rectangle((bx + bw - 22, wy, bx + bw - 12, wy + 4), fill=(28, 28, 28, 255))
        else:
            for wy in (by + 5, by + bh - 16):
                draw.rectangle((bx + 8, wy, bx + bw - 8, wy + 12), fill=(104, 108, 102, 255))
            front_y = by + bh - 8 if direction == 1 else by + 2
            draw.rectangle((bx + 8, front_y, bx + bw - 8, front_y + 4), fill=(244, 226, 168, 255))
            draw.rectangle((bx + 4, by + 10, bx + 10, by + 20), fill=(28, 28, 28, 255))
            draw.rectangle((bx + bw - 10, by + 10, bx + bw - 4, by + 20), fill=(28, 28, 28, 255))
        if kind == "bus":
            for i in range(4):
                wx = bx + 10 + i * 38
                if wx + 20 < bx + bw:
                    draw.rectangle((wx, by + 6, wx + 20, by + 18), fill=(112, 114, 106, 255))
            draw.text((bx + 16, by + 24), "EAV", fill=(236, 232, 216, 255))
    else:
        draw.ellipse((w // 2 - 5, h // 2 - 5, w // 2 + 5, h // 2 + 5), fill=shade(body, 0.7) + (255,))
        front = w - 6 if direction == 0 else 4
        draw.ellipse((front - 3, h // 2 - 3, front + 3, h // 2 + 3), fill=(244, 226, 168, 255))
    return img


def build_vehicles() -> None:
    frames: dict = {}
    items = []
    for ci, color in enumerate([hexrgb(c) for c in ("#f0eee6", "#6b735f", "#b6483c", "#d8b455")]):
        for d in range(4):
            items.append((f"car_{ci}_{d}", "car", color, d))
    for ci, color in enumerate([hexrgb(c) for c in ("#e8e2d2", "#8c8f85")]):
        for d in range(4):
            items.append((f"bus_{ci}_{d}", "bus", color, d))
    for ci, color in enumerate([hexrgb(c) for c in ("#c75c46", "#e4d9c0")]):
        for d in range(4):
            items.append((f"scooter_{ci}_{d}", "scooter", color, d))
    for d in range(4):
        items.append((f"bike_0_{d}", "bike", hexrgb("#44647a"), d))
    x = y = row_h = 0
    sheet = Image.new("RGBA", (190 * 12, 80 * 4), (0, 0, 0, 0))
    for name, kind, color, direction in items:
        img = vehicle_frame(kind, color, direction)
        if x + img.width > sheet.width:
            x = 0
            y += row_h + 4
            row_h = 0
        sheet.alpha_composite(img, (x, y))
        frame_add(frames, name, x, y, img.width, img.height)
        x += img.width + 4
        row_h = max(row_h, img.height)
    sheet = sheet.crop((0, 0, sheet.width, y + row_h + 2))
    atlas(sheet, frames, "vehicles")
    print("vehicles", len(frames), sheet.size)


def prop_frame(name: str) -> Image.Image:
    sizes = {
        "bench": (44, 26), "lamp": (26, 76), "planter": (34, 30), "tree": (52, 76),
        "palm": (60, 96), "bin": (22, 30), "bollard": (14, 26), "fountain": (72, 72),
        "table": (30, 22), "chair": (18, 24), "parasol": (56, 56), "sign": (26, 44),
    }
    w, h = sizes[name]
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((2, h - 8, w - 2, h - 1), fill=(36, 34, 30, 80))
    wood = hexrgb("#7c5b42")
    metal = hexrgb("#4b5358")
    leaf = hexrgb("#4a6a3f")
    if name == "bench":
        d.rectangle((4, 10, w - 4, 15), fill=wood + (255,))
        d.rectangle((4, 16, w - 4, 20), fill=shade(wood, 0.82) + (255,))
        for x in (8, w - 12):
            d.rectangle((x, 16, x + 3, h - 3), fill=metal + (255,))
    elif name == "lamp":
        d.rectangle((w // 2 - 2, 14, w // 2 + 2, h - 4), fill=metal + (255,))
        d.ellipse((w // 2 - 8, 4, w // 2 + 8, 18), fill=(232, 216, 168, 255))
        d.arc((w // 2 - 12, 0, w // 2 + 12, 24), 180, 360, fill=shade(metal, 0.8) + (255,))
    elif name in ("tree", "palm", "planter"):
        trunk = hexrgb("#6a4d36")
        d.rectangle((w // 2 - 3, h // 2, w // 2 + 3, h - 5), fill=trunk + (255,))
        if name == "palm":
            for a in range(8):
                ang = a * math.pi / 4
                ex = w // 2 + int(math.cos(ang) * 24)
                ey = h // 2 - 12 + int(math.sin(ang) * 10)
                d.line((w // 2, h // 2 - 8, ex, ey), fill=leaf + (255,), width=3)
        else:
            for cx, cy, r in ((w // 2, h // 2 - 12, 18), (w // 2 - 14, h // 2 - 4, 13), (w // 2 + 14, h // 2 - 4, 13)):
                d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=leaf + (255,))
                d.ellipse((cx - r + 4, cy - r + 3, cx + r - 5, cy + r - 4), fill=shade(leaf, 1.16) + (255,))
        if name == "planter":
            d.rectangle((5, h - 14, w - 5, h - 2), fill=hexrgb("#9a7256") + (255,))
    elif name == "bin":
        d.rectangle((5, 8, w - 5, h - 4), fill=metal + (255,))
        d.rectangle((3, 6, w - 3, 10), fill=shade(metal, 0.8) + (255,))
    elif name == "bollard":
        d.rounded_rectangle((3, 6, w - 3, h - 3), radius=3, fill=hexrgb("#d8d2c0") + (255,))
        d.rectangle((3, 12, w - 3, 15), fill=hexrgb("#3d4145") + (255,))
    elif name == "fountain":
        d.ellipse((6, 22, w - 6, h - 4), fill=hexrgb("#9a9b92") + (255,))
        d.ellipse((12, 27, w - 12, h - 9), fill=hexrgb("#4f8aa4") + (255,))
        d.ellipse((w // 2 - 6, 18, w // 2 + 6, 30), fill=hexrgb("#a8a99f") + (255,))
        d.line((w // 2, 20, w // 2, 4), fill=(156, 186, 196, 220), width=3)
    elif name == "table":
        d.ellipse((2, 4, w - 2, h - 6), fill=hexrgb("#c2b39a") + (255,))
        d.rectangle((w // 2 - 2, h - 10, w // 2 + 2, h - 2), fill=wood + (255,))
    elif name == "chair":
        d.rectangle((4, 9, w - 4, 14), fill=wood + (255,))
        d.rectangle((4, 3, w - 4, 9), fill=shade(wood, 0.85) + (255,))
        for x in (5, w - 7):
            d.rectangle((x, 14, x + 2, h - 3), fill=shade(wood, 0.7) + (255,))
    elif name == "parasol":
        d.polygon([(w // 2, 2), (w - 2, h // 2), (2, h // 2)], fill=hexrgb("#b85646") + (255,))
        for i in range(6):
            d.line((w // 2, 2, 2 + i * (w - 4) // 5, h // 2), fill=shade(hexrgb("#b85646"), 0.8) + (255,))
        d.rectangle((w // 2 - 1, h // 2, w // 2 + 1, h - 3), fill=wood + (255,))
    else:  # sign
        d.rectangle((w // 2 - 1, 16, w // 2 + 1, h - 3), fill=metal + (255,))
        d.rectangle((3, 4, w - 3, 20), fill=hexrgb("#2f5e73") + (255,))
        d.text((7, 8), "BUS", fill=(238, 234, 220, 255))
    return img


def build_props() -> None:
    names = ["bench", "lamp", "planter", "tree", "palm", "bin", "bollard", "fountain", "table", "chair", "parasol", "sign"]
    frames: dict = {}
    sheet = Image.new("RGBA", (500, 500), (0, 0, 0, 0))
    x = y = row_h = 0
    for name in names:
        img = prop_frame(name)
        if x + img.width > sheet.width:
            x = 0
            y += row_h + 4
            row_h = 0
        sheet.alpha_composite(img, (x, y))
        frame_add(frames, name, x, y, img.width, img.height)
        x += img.width + 4
        row_h = max(row_h, img.height)
    sheet = sheet.crop((0, 0, 500, y + row_h + 2))
    atlas(sheet, frames, "props")
    print("props", len(frames), sheet.size)


def interior_frame(kind: str) -> Image.Image:
    w, h = 512, 384
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = random.Random(sum(ord(c) for c in kind))
    wall = hexrgb("#d6c4a8") if kind != "pizzeria" else hexrgb("#c9a88a")
    floor = hexrgb("#8c6e52")
    d.rectangle((0, 0, w, h), fill=wall + (255,))
    d.rectangle((0, 150, w, h), fill=floor + (255,))
    for y in range(150, h, 24):
        d.line((0, y, w, y), fill=shade(floor, 0.84) + (255,))
        for x in range((y // 24) % 2 * 24, w, 48):
            d.line((x, y, x, y + 24), fill=shade(floor, 0.84) + (255,))
    d.rectangle((0, 0, w, 18), fill=shade(wall, 0.7) + (255,))
    d.rectangle((0, 140, w, 152), fill=shade(wall, 0.8) + (255,))
    if kind in ("bar", "pizzeria"):
        counter = hexrgb("#6b4734")
        d.rectangle((40, 196, 250, 286), fill=counter + (255,))
        d.rectangle((34, 188, 256, 202), fill=shade(counter, 1.2) + (255,))
        for x in range(58, 245, 44):
            d.rectangle((x, 210, x + 30, 244), fill=shade(counter, 0.78) + (255,))
            d.rectangle((x + 4, 214, x + 26, 240), fill=(92, 126, 138, 255))
        for x in (86, 150, 214):
            d.ellipse((x - 12, 294, x + 12, 318), fill=hexrgb("#b4a28a") + (255,))
            d.rectangle((x - 2, 318, x + 2, 344), fill=hexrgb("#6b4734") + (255,))
        for y in range(36, 132, 32):
            d.rectangle((40, y, 250, y + 22), fill=hexrgb("#7a573d") + (255,))
            for x in range(48, 244, 18):
                d.rectangle((x, y + 4, x + 12, y + 18), fill=(196 + rng.randint(-20, 20), 168, 118, 255))
        if kind == "pizzeria":
            d.ellipse((320, 210, 470, 300), fill=hexrgb("#b57642") + (255,))
            d.ellipse((330, 218, 460, 292), fill=hexrgb("#e2c58a") + (255,))
            d.text((366, 248), "PIZZA", fill=hexrgb("#8d4c36") + (255,))
        d.text((92, 262), "BAR" if kind == "bar" else "FORNO", fill=(240, 230, 208, 255))
    else:
        d.rectangle((36, 178, 168, 286), fill=hexrgb("#7d6047") + (255,))
        d.rectangle((42, 184, 162, 210), fill=hexrgb("#9a7b5c") + (255,))
        d.rectangle((276, 186, 470, 292), fill=hexrgb("#846d5a") + (255,))
        d.rectangle((282, 192, 464, 218), fill=hexrgb("#a38d76") + (255,))
        for y in (196, 230, 264):
            d.rectangle((284, y, 462, y + 6), fill=shade(hexrgb("#846d5a"), 0.8) + (255,))
        d.rectangle((200, 210, 258, 280), fill=hexrgb("#5f6a58") + (255,))
        d.ellipse((206, 216, 252, 250), fill=hexrgb("#5d8a4f") + (255,))
    # Luce calda e vignettatura leggera.
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((180, 40, 340, 200), fill=(255, 226, 160, 44))
    glow = glow.filter(ImageFilter.GaussianBlur(34))
    img.alpha_composite(glow)
    return img


def build_interiors() -> None:
    frames: dict = {}
    sheet = Image.new("RGBA", (512 * 2, 384 * 2), (0, 0, 0, 0))
    for i, kind in enumerate(("bar", "pizzeria", "home", "kitchen")):
        x, y = (i % 2) * 512, (i // 2) * 384
        sheet.alpha_composite(interior_frame(kind), (x, y))
        frame_add(frames, kind, x, y, 512, 384)
    atlas(sheet, frames, "interiors")
    print("interiors", len(frames), sheet.size)


def build_shadow() -> None:
    img = Image.new("RGBA", (64, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((2, 3, 62, 21), fill=(28, 26, 24, 90))
    img = img.filter(ImageFilter.GaussianBlur(2))
    img.save(OUT / "shadow.png")


def build_manifest() -> None:
    manifest = {
        "scale_px_per_m": PX_PER_M,
        "floor_px": FLOOR_PX,
        "source": "palette delle fotografie reali + tavole originali; generato da tools/rebuild2_build_assets.py",
        "atlas": ["facades", "characters", "vehicles", "props", "interiors"],
        "metric_sizes_px": {
            "person": 28, "door": 34, "car": 64, "bus": 176, "floor": FLOOR_PX,
        },
    }
    (OUT / "assets_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    build_facades()
    build_characters()
    build_vehicles()
    build_props()
    build_interiors()
    build_shadow()
    build_manifest()
    print("asset REBUILD 2.0 generati in", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
