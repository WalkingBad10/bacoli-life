"""Tile M6: pavimentazioni con maschere di adiacenza, 1 tile = 1 metro = 16 px.

Le costanti sono condivise tra generatore grafico e costruttori mappe, così la
pavimentazione non dipende più da pattern `(x + y) % n`. I GID 1-16 restano
quelli della milestone 5 per compatibilità con i buffer e con il runtime.
"""
from __future__ import annotations

from PIL import Image, ImageDraw

TILE = 16
COLS = 16
ROWS = 16
SIZE = COLS * TILE

# GID legacy (inviolati: il runtime riconosce l'acqua dagli indici 8-11).
GRASS, GRASS2, SAND, SAND2, COBBLE, COBBLE2, ASPHALT, PAVING = 1, 2, 3, 4, 5, 6, 7, 8
WATER0, WATER1, WATER2, WATER3, FOAM, WALL, ROOF, FLOWERS = 9, 10, 11, 12, 13, 14, 15, 16
WATER_IDS = frozenset((WATER0, WATER1, WATER2, WATER3))
WATER_GIDS = (WATER0, WATER1, WATER2, WATER3)

# Blocchi di autotiling: 16 maschere N=1, E=2, S=4, W=8 (bit = vicino stesso tipo).
ASPHALT_MASK = tuple(range(17, 33))
ASPHALT_MARK = tuple(range(33, 49))
CROSSWALK = tuple(range(49, 65))
COBBLE_MASK = tuple(range(65, 81))
PAVING_MASK = tuple(range(81, 97))
GRAVEL_MASK = tuple(range(97, 113))
GRASS_MASK = tuple(range(113, 129))
DETAILS = tuple(range(129, 145))

MASK_RANGES = {
    'asphalt': ASPHALT_MASK,
    'cobble': COBBLE_MASK,
    'paving': PAVING_MASK,
    'gravel': GRAVEL_MASK,
    'grass': GRASS_MASK,
}

# Segnaletica orizzontale (GID 33-48).
DASH_H, DASH_V, SOLID_H, SOLID_V, EDGE_H, EDGE_V, ARROW_S, ARROW_T = ASPHALT_MARK[:8]
CROSS_H, CROSS_H2, CROSS_V, CROSS_V2, STOP_H, STOP_V, INTERSECTION, YIELD = ASPHALT_MARK[8:16]

# Le ultime 8 caselle del blocco attraversamenti pedonali sono dedicate a parcheggi e dettagli.
PARK_H, PARK_V, PARK_H2, PARK_V2, MANHOLE, DRAIN, PATCH, DOUBLE_Y = CROSSWALK[8:16]

P = {
    'asphalt': '#5F5E58',
    'asphalt_light': '#6E6C64',
    'asphalt_dark': '#4E4E49',
    'curb': '#B6AA91',
    'curb_light': '#D2C3A5',
    'curb_shadow': '#7C7060',
    'basalt': '#555551',
    'basalt_light': '#6B6B64',
    'basalt_dark': '#41423F',
    'stone': '#C7B89C',
    'stone_light': '#E0D1B4',
    'stone_shadow': '#A39279',
    'dirt': '#A08B6C',
    'dirt_light': '#B9A07D',
    'grass': '#5F7C49',
    'grass_light': '#759354',
    'grass_dark': '#44643C',
    'white': '#F2EAD8',
    'yellow': '#E6AB2D',
    'sea': '#185F76',
    'sea_mid': '#337A98',
    'sea_light': '#3A9FF3',
    'sea_deep': '#144D90',
    'foam': '#AFD7E3',
    'plaster': '#DBC8A6',
    'shade': '#B69375',
    'terra': '#B67352',
    'terra_dark': '#825834',
    'ink': '#0C1823',
    'leaf': '#51B526',
    'red': '#B1403B',
    'ochre': '#E6AB2D',
}


def rgb(name: str) -> tuple[int, int, int]:
    return tuple(bytes.fromhex(P.get(name, name)[1:]))  # type: ignore[return-value]


def rect(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, color: str) -> None:
    if w > 0 and h > 0:
        d.rectangle((x, y, x + w - 1, y + h - 1), fill=rgb(color))


def dot(d: ImageDraw.ImageDraw, x: int, y: int, color: str) -> None:
    d.point((x, y), fill=rgb(color))


def speckle(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int,
            colors: tuple[str, ...], seed: int, density: float) -> None:
    import random
    rnd = random.Random(seed)
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if rnd.random() < density:
                dot(d, xx, yy, rnd.choice(colors))


def noise(seed: int, x: int, y: int, scale: int) -> int:
    """Hash esatto e privo di stato: lo stesso punto ha sempre lo stesso colore."""
    h = (seed * 374761393 + (x // scale) * 668265263 + (y // scale) * 2147483647) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return (h ^ (h >> 16)) & 0xFFFF


def frame_xy(gid: int) -> tuple[int, int]:
    idx = gid - 1
    return (idx % COLS) * TILE, (idx // COLS) * TILE


def draw_curbs(d: ImageDraw.ImageDraw, ox: int, oy: int, mask: int) -> None:
    # Il cordolo compare solo lato terra (bit 0). L'ombra interna dà profondità.
    if not (mask & 1):
        rect(d, ox, oy, 16, 2, 'curb_light')
        rect(d, ox, oy + 2, 16, 1, 'curb_shadow')
    if not (mask & 2):
        rect(d, ox + 14, oy, 2, 16, 'curb')
        rect(d, ox + 13, oy, 1, 16, 'curb_shadow')
    if not (mask & 4):
        rect(d, ox, oy + 14, 16, 2, 'curb')
        rect(d, ox, oy + 13, 16, 1, 'curb_shadow')
    if not (mask & 8):
        rect(d, ox, oy, 2, 16, 'curb_light')
        rect(d, ox + 2, oy, 1, 16, 'curb_shadow')


def draw_asphalt(d: ImageDraw.ImageDraw, ox: int, oy: int, mask: int, seed: int) -> None:
    rect(d, ox, oy, 16, 16, 'asphalt')
    speckle(d, ox, oy, 16, 16, ('asphalt_light', 'asphalt_dark', 'asphalt'), seed, 0.24)
    for x, y in ((3, 5), (11, 10), (7, 13), (14, 3)):
        if noise(seed, x, y, 1) % 5 == 0:
            dot(d, ox + x, oy + y, 'asphalt_light')
    draw_curbs(d, ox, oy, mask)


def draw_basalt(d: ImageDraw.ImageDraw, ox: int, oy: int, mask: int, seed: int) -> None:
    rect(d, ox, oy, 16, 16, 'basalt_dark')
    for row, (sy, h) in enumerate(((0, 4), (4, 3), (7, 4), (11, 5))):
        offset = 2 if row % 2 else 0
        for sx in range(-4 + offset, 16, 6):
            x = ox + sx
            y = oy + sy
            tone = ('basalt', 'basalt_light', 'basalt_dark')[(row + sx // 6 + seed) % 3]
            rect(d, x, y, 5, h - 1, tone)
            rect(d, x, y, 5, 1, 'basalt_light')
            if (sx + sy + seed) % 3 == 0:
                dot(d, x + 2, y + 2, 'basalt_dark')
    draw_curbs(d, ox, oy, mask)


def draw_paving(d: ImageDraw.ImageDraw, ox: int, oy: int, mask: int, seed: int) -> None:
    rect(d, ox, oy, 16, 16, 'stone')
    for y in (0, 8):
        for x in (0, 8):
            rect(d, ox + x, oy + y, 8, 8, 'stone_light' if (x + y + seed) % 3 else 'stone')
            rect(d, ox + x, oy + y, 8, 1, 'stone_shadow')
            rect(d, ox + x, oy + y, 1, 8, 'stone_shadow')
    speckle(d, ox, oy, 16, 16, ('stone_light', 'stone_shadow'), seed + 9, 0.08)
    draw_curbs(d, ox, oy, mask)


def draw_gravel(d: ImageDraw.ImageDraw, ox: int, oy: int, mask: int, seed: int) -> None:
    rect(d, ox, oy, 16, 16, 'dirt')
    speckle(d, ox, oy, 16, 16, ('dirt_light', 'stone', 'dirt'), seed, 0.34)
    draw_curbs(d, ox, oy, mask)


def draw_grass(d: ImageDraw.ImageDraw, ox: int, oy: int, mask: int, seed: int) -> None:
    rect(d, ox, oy, 16, 16, 'grass' if seed % 2 == 0 else 'grass_light')
    import random
    rnd = random.Random(seed)
    for _ in range(26):
        dot(d, ox + rnd.randrange(16), oy + rnd.randrange(16),
            rnd.choice(('grass_dark', 'grass_light', 'leaf')))
    draw_curbs(d, ox, oy, mask)


def draw_legacy(d: ImageDraw.ImageDraw) -> None:
    # 1-2 prato, 3-4 sabbia, 5-6 basolato, 7 asfalto, 8 lastricato.
    for gid in (GRASS, GRASS2):
        draw_grass(d, *frame_xy(gid), 15, gid)
    for gid in (SAND, SAND2):
        ox, oy = frame_xy(gid)
        rect(d, ox, oy, 16, 16, '#D3B59D' if gid == SAND else '#E8D3B8')
        speckle(d, ox, oy, 16, 16, ('#D3B59D', '#AD8370', '#E8D3B8'), gid, 0.25)
    draw_basalt(d, *frame_xy(COBBLE), 15, 1)
    draw_basalt(d, *frame_xy(COBBLE2), 15, 2)
    draw_asphalt(d, *frame_xy(ASPHALT), 15, 3)
    draw_paving(d, *frame_xy(PAVING), 15, 4)
    # 9-12 acqua: onde deterministiche, senza sfondo nero.
    for phase, gid in enumerate(WATER_GIDS):
        ox, oy = frame_xy(gid)
        for y in range(16):
            shift = int(3 * __import__('math').sin((y + phase * 3) * 0.7)) % 5
            for x in range(16):
                import math
                wave = math.sin((x + shift) * 0.55 + y * 0.35 + phase * 1.4)
                tone = ('sea_light' if wave > 0.78 else 'sea_mid' if wave > 0.35
                        else 'sea_deep' if wave < -0.75 else 'sea')
                dot(d, ox + x, oy + y, tone)
        for y in (3, 10):
            start = (phase * 4 + y) % 16
            for k in range(4):
                dot(d, ox + (start + k) % 16, oy + y, 'foam')
    ox, oy = frame_xy(FOAM)
    rect(d, ox, oy, 16, 16, 'sea_mid')
    for x in range(16):
        import math
        y = oy + 4 + int(3 * math.sin(x * 0.8))
        dot(d, ox + x, y, 'foam')
        if x % 3 == 0:
            dot(d, ox + x, y + 1, 'white')
    ox, oy = frame_xy(WALL)
    rect(d, ox, oy, 16, 16, 'shade')
    for row in range(4):
        for col in range(2):
            x = ox + col * 8 + (4 if row % 2 else 0)
            rect(d, x, oy + row * 4, 7, 3, 'stone' if (row + col) % 2 == 0 else 'curb')
    ox, oy = frame_xy(ROOF)
    rect(d, ox, oy, 16, 16, 'terra_dark')
    for row in range(4):
        for x in range(-4, 16, 4):
            rect(d, ox + x + (2 if row % 2 else 0), oy + row * 4, 3, 3,
                 'terra' if (row + x) % 3 else '#C08952')
    ox, oy = frame_xy(FLOWERS)
    rect(d, ox, oy, 16, 16, 'grass_dark')
    for x, y, color in ((3, 4, 'red'), (7, 3, 'ochre'), (11, 6, '#D98B96'),
                        (4, 10, 'ochre'), (10, 11, 'red')):
        rect(d, ox + x, oy + y, 2, 2, color)
        dot(d, ox + x + 1, oy + y + 2, 'leaf')


def _marking(d: ImageDraw.ImageDraw, gid: int, kind: str) -> None:
    ox, oy = frame_xy(gid)
    draw_asphalt(d, ox, oy, 15, gid)
    if kind == 'dash_h':
        for x in (1, 7, 13):
            rect(d, ox + x, oy + 7, 4, 2, 'white')
    elif kind == 'dash_v':
        for y in (1, 7, 13):
            rect(d, ox + 7, oy + y, 2, 4, 'white')
    elif kind == 'solid_h':
        rect(d, ox, oy + 7, 16, 2, 'white')
    elif kind == 'solid_v':
        rect(d, ox + 7, oy, 2, 16, 'white')
    elif kind == 'edge_h':
        rect(d, ox, oy + 1, 16, 1, 'white')
        rect(d, ox, oy + 14, 16, 1, 'white')
    elif kind == 'edge_v':
        rect(d, ox + 1, oy, 1, 16, 'white')
        rect(d, ox + 14, oy, 1, 16, 'white')
    elif kind == 'arrow_s':
        rect(d, ox + 7, oy + 4, 2, 9, 'white')
        rect(d, ox + 5, oy + 4, 6, 1, 'white')
        dot(d, ox + 6, oy + 3, 'white')
        dot(d, ox + 9, oy + 3, 'white')
    elif kind == 'arrow_t':
        rect(d, ox + 7, oy + 6, 2, 7, 'white')
        rect(d, ox + 7, oy + 6, 5, 2, 'white')
        dot(d, ox + 11, oy + 5, 'white')
    elif kind == 'cross_h':
        for x in (1, 4, 7, 10, 13):
            rect(d, ox + x, oy + 2, 2, 12, 'white')
    elif kind == 'cross_h2':
        for x in (2, 6, 10, 14):
            rect(d, ox + x, oy + 3, 2, 10, 'white')
    elif kind == 'cross_v':
        for y in (1, 4, 7, 10, 13):
            rect(d, ox + 2, oy + y, 12, 2, 'white')
    elif kind == 'cross_v2':
        for y in (2, 6, 10, 14):
            rect(d, ox + 3, oy + y, 10, 2, 'white')
    elif kind == 'stop_h':
        rect(d, ox, oy + 2, 16, 2, 'white')
    elif kind == 'stop_v':
        rect(d, ox + 2, oy, 2, 16, 'white')
    elif kind == 'intersection':
        rect(d, ox, oy + 7, 16, 2, 'white')
        rect(d, ox + 7, oy, 2, 16, 'white')
    elif kind == 'yield':
        for x, y in ((2, 7), (4, 8), (6, 9), (8, 8), (10, 7)):
            dot(d, ox + x, oy + y, 'white')
    elif kind == 'park_h':
        rect(d, ox, oy + 1, 1, 14, 'white')
        rect(d, ox + 15, oy + 1, 1, 14, 'white')
        rect(d, ox, oy + 1, 16, 1, 'white')
    elif kind == 'park_v':
        rect(d, ox + 1, oy, 14, 1, 'white')
        rect(d, ox + 1, oy + 15, 14, 1, 'white')
        rect(d, ox + 1, oy, 1, 16, 'white')
    elif kind == 'park_h2':
        rect(d, ox, oy + 4, 16, 1, 'white')
        rect(d, ox, oy + 11, 16, 1, 'white')
    elif kind == 'park_v2':
        rect(d, ox + 4, oy, 1, 16, 'white')
        rect(d, ox + 11, oy, 1, 16, 'white')
    elif kind == 'manhole':
        rect(d, ox + 4, oy + 4, 8, 8, 'asphalt_dark')
        rect(d, ox + 5, oy + 5, 6, 6, 'curb_shadow')
        for x in (6, 8, 10):
            dot(d, ox + x, oy + 8, 'curb')
    elif kind == 'drain':
        rect(d, ox + 2, oy + 6, 12, 4, 'asphalt_dark')
        for x in range(3, 14, 2):
            rect(d, ox + x, oy + 7, 1, 2, 'curb_shadow')
    elif kind == 'patch':
        rect(d, ox + 2, oy + 3, 11, 9, 'asphalt_dark')
        speckle(d, ox + 2, oy + 3, 11, 9, ('asphalt', 'asphalt_light'), gid + 30, 0.2)
    elif kind == 'double_y':
        rect(d, ox + 7, oy, 1, 16, 'yellow')
        rect(d, ox + 9, oy, 1, 16, 'yellow')


MARKINGS = ('dash_h', 'dash_v', 'solid_h', 'solid_v', 'edge_h', 'edge_v',
            'arrow_s', 'arrow_t', 'cross_h', 'cross_h2', 'cross_v', 'cross_v2',
            'stop_h', 'stop_v', 'intersection', 'yield')
PARKING_DETAILS = ('park_h', 'park_v', 'park_h2', 'park_v2', 'manhole', 'drain',
                   'patch', 'double_y')


def build_tileset() -> Image.Image:
    im = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    draw_legacy(d)
    for kind, gids in MASK_RANGES.items():
        painter = {
            'asphalt': draw_asphalt, 'cobble': draw_basalt, 'paving': draw_paving,
            'gravel': draw_gravel, 'grass': draw_grass,
        }[kind]
        # L'indice nella serie è la maschera stessa (N=1, E=2, S=4, W=8).
        for mask, gid in enumerate(gids):
            painter(d, *frame_xy(gid), mask, gid)
    for gid, kind in zip(ASPHALT_MARK, MARKINGS):
        _marking(d, gid, kind)
    for gid, kind in zip(CROSSWALK, PARKING_DETAILS):
        _marking(d, gid, kind)
    for gid in DETAILS:
        ox, oy = frame_xy(gid)
        rect(d, ox, oy, 16, 16, 'stone')
        for x in (0, 8):
            rect(d, ox + x, oy, 8, 8, 'stone_light')
        rect(d, ox, oy + 8, 16, 8, 'grass')
        speckle(d, ox, oy + 8, 16, 8, ('grass_dark', 'leaf'), gid, 0.25)
    return im
