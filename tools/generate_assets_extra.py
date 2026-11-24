"""Asset aggiuntivi per la fase 2: veicoli, nuovi NPC e dettagli ambientali.

Riutilizza la palette e le primitive del generatore principale.
Uso: python tools/generate_assets_extra.py
"""
from __future__ import annotations

from PIL import Image, ImageDraw

from generate_assets import S, P, box, canvas, make_character, make_prop


def car(d: ImageDraw.ImageDraw, w: int, h: int, color: str) -> None:
    d.ellipse((2, h - 6, w - 2, h - 1), fill=(12, 24, 35, 100))
    box(d, 3, 7, w - 6, h - 12, "ink")
    box(d, 4, 8, w - 8, h - 14, color)
    box(d, 2, 13, 4, 10, "ink")
    box(d, w - 6, 13, 4, 10, "ink")
    box(d, 8, 5, w - 16, 7, "ink")
    box(d, 9, 6, w - 18, 5, P["sea_deep"])
    box(d, 7, h - 8, 6, 3, P["ochre"])
    box(d, w - 13, h - 8, 6, 3, P["ochre"])
    box(d, 10, 11, w - 20, 2, P["white"])
    box(d, 10, 14, w - 20, 1, "shadow")


def moto(d: ImageDraw.ImageDraw, w: int, h: int, color: str) -> None:
    d.ellipse((2, h - 5, w - 2, h - 1), fill=(12, 24, 35, 100))
    d.ellipse((5, h - 10, 13, h - 2), fill=P["ink"])
    d.ellipse((w - 13, h - 10, w - 5, h - 2), fill=P["ink"])
    box(d, 8, 8, w - 16, h - 11, color)
    box(d, 10, 5, w - 20, 4, "ink")
    box(d, 7, 3, w - 14, 2, "ink")
    box(d, 11, 10, w - 22, 4, P["white"])
    box(d, w // 2 - 2, 4, 4, 2, P["ochre"])


def bus(d: ImageDraw.ImageDraw, w: int, h: int, color: str) -> None:
    d.ellipse((3, h - 5, w - 3, h), fill=(12, 24, 35, 110))
    box(d, 2, 3, w - 4, h - 7, "ink")
    box(d, 3, 4, w - 6, h - 9, color)
    for x in range(6, w - 7, 8):
        box(d, x, 7, 6, 9, P["foam"])
        box(d, x, 7, 6, 1, P["sea_deep"])
    box(d, 4, h - 9, 8, 3, P["ochre"])
    box(d, w - 12, h - 9, 8, 3, P["ochre"])
    box(d, w // 2 - 8, h - 8, 16, 3, P["white"])


def train(d: ImageDraw.ImageDraw, w: int, h: int, color: str) -> None:
    d.ellipse((3, h - 5, w - 3, h), fill=(12, 24, 35, 110))
    box(d, 2, 4, w - 4, h - 8, "ink")
    box(d, 3, 5, w - 6, h - 10, P["white"])
    box(d, 3, 5, w - 6, 5, P["blue"])
    for x in range(7, w - 8, 10):
        box(d, x, 12, 7, 8, P["sea_deep"])
    box(d, 5, h - 9, 5, 3, P["ink"])
    box(d, w - 10, h - 9, 5, 3, P["ink"])


def flowerpot(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    box(d, 9, h - 10, 14, 9, P["terra"])
    box(d, 8, h - 11, 16, 2, P["terra_dark"])
    for x, y in ((12, 9), (18, 7), (15, 12), (9, 12), (21, 11)):
        d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=P["leaf_dark"])
        d.point((x, y), fill=P["leaf"])
    for x, y in ((11, 7), (19, 10), (15, 5)):
        d.point((x, y), fill=P["pink"])


def trash_bin(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    box(d, 6, 8, 16, h - 9, "ink")
    box(d, 7, 9, 14, h - 11, P["olive"])
    box(d, 5, 5, 18, 4, P["stone_dark"])
    box(d, 10, 13, 8, 1, P["white"])


def street_sign(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    box(d, w // 2 - 1, 12, 3, h - 12, P["ink"])
    box(d, 2, 4, w - 4, 10, P["sea_deep"])
    box(d, 3, 5, w - 6, 8, P["white"])
    box(d, 5, 7, 12, 2, P["ink"])
    box(d, 5, 11, 8, 1, P["ink"])


def parking_sign(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    box(d, w // 2 - 1, 14, 3, h - 14, P["ink"])
    d.ellipse((4, 2, w - 4, h - 12), fill=P["blue"], outline=P["white"], width=2)
    box(d, 11, 8, 3, 16, P["white"])
    box(d, 9, 8, 8, 3, P["white"])


def main() -> None:
    for name, color in (("car_white", "#F2EAD8"), ("car_blue", "#3A6EA5"),
                        ("car_red", "#B1403B"), ("car_yellow", "#E6AB2D")):
        im, d = canvas(32, 24)
        car(d, 32, 24, P.get(color, color))
        im.save(S / f"{name}.png")
    im, d = canvas(24, 22)
    moto(d, 24, 22, P["red"])
    im.save(S / "moto.png")
    for name, color in (("bus", "olive"), ("train", "blue")):
        im, d = canvas(56, 30)
        (bus if name == "bus" else train)(d, 56, 30, P[color])
        im.save(S / f"{name}.png")
    make_character("npc_5", "pink", "hair", "skin")
    make_character("npc_6", "sea", "wood_dark", "skin_dark")
    make_character("npc_7", "white", "red", "skin")
    make_character("npc_8", "terra", "hair_light", "skin_dark")
    make_prop("flowerpot", 32, 32, flowerpot)
    make_prop("trash_bin", 28, 32, trash_bin)
    make_prop("street_sign", 32, 40, street_sign)
    make_prop("parking_sign", 32, 40, parking_sign)
    print("Asset extra generati")


if __name__ == "__main__":
    main()
