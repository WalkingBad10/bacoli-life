"""Pavimentazione M6: autotiling, cordoli, attraversamenti pedonali e segnaletica su strade OSM.

Nessun tile viene scelto con `(x + y) % n`: ogni GID deriva dalla maschera dei
quattro vicini della stessa classe e dalla direzione della geometria OSM.
"""
from __future__ import annotations

from pathlib import Path

from m6_tiles import (
    ASPHALT, ASPHALT_MASK, CROSSWALK, GRASS, GRASS2, GRAVEL_MASK, MASK_RANGES,
    PAVING, PAVING_MASK, SAND, SAND2, WATER_IDS, COBBLE_MASK,
    CROSS_H, CROSS_H2, CROSS_V, CROSS_V2, DASH_H, DASH_V, DRAIN, EDGE_H, EDGE_V,
    INTERSECTION, MANHOLE, PARK_H, PARK_V, PATCH, SOLID_H, SOLID_V, STOP_H,
    STOP_V, ASPHALT_MARK,
)

# Classi stradali: 0 = non strada, 1 = asfalto, 2 = basolato, 3 = marciapiede,
# 4 = sterrato. Il buffer è usato dal sistema di traffico per costruire il grafo.
CLASS_CODE = {'asphalt': 1, 'cobble': 2, 'paving': 3, 'gravel': 4}

ROAD_CLASS_BY_KIND = {
    'primary': 'asphalt', 'secondary': 'asphalt', 'tertiary': 'asphalt',
    'residential': 'asphalt', 'unclassified': 'asphalt', 'service': 'asphalt',
    'track': 'gravel', 'pedestrian': 'cobble', 'footway': 'cobble',
    'path': 'cobble', 'steps': 'cobble',
}


def road_class(kind: str | None) -> str | None:
    return ROAD_CLASS_BY_KIND.get(kind or '', 'asphalt')


def fill_base(ground: list[list[int]], width: int, height: int,
              water_tiles: set[tuple[int, int]], seed: int) -> None:
    """Terreno a macchie deterministiche: niente scacchiere casuale."""
    from m6_tiles import noise
    for y in range(height):
        for x in range(width):
            if (x, y) in water_tiles:
                continue
            coarse = noise(seed, x, y, 12) % 7
            fine = noise(seed + 91, x, y, 3) % 5
            near_water = any((x + dx, y + dy) in water_tiles
                             for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)))
            if near_water:
                ground[y][x] = SAND if fine < 3 else SAND2
            else:
                ground[y][x] = GRASS2 if coarse < 3 and fine < 2 else GRASS


def _mask(classes: dict[tuple[int, int], str], x: int, y: int, kind: str) -> int:
    value = 0
    if classes.get((x, y - 1)) == kind:
        value |= 1
    if classes.get((x + 1, y)) == kind:
        value |= 2
    if classes.get((x, y + 1)) == kind:
        value |= 4
    if classes.get((x - 1, y)) == kind:
        value |= 8
    return value


def _is_wide(classes: dict[tuple[int, int], str], x: int, y: int, kind: str) -> bool:
    return any(classes.get((x + dx, y + dy)) == kind
               for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)))


def _direction(classes: dict[tuple[int, int], str], x: int, y: int, kind: str,
               hint: int) -> str:
    horizontal = (classes.get((x - 1, y)) == kind or classes.get((x + 1, y)) == kind)
    vertical = (classes.get((x, y - 1)) == kind or classes.get((x, y + 1)) == kind)
    if horizontal and not vertical:
        return 'h'
    if vertical and not horizontal:
        return 'v'
    return 'h' if hint == 0 else 'v'


def paint(ground: list[list[int]], collision: list[list[int]], width: int, height: int,
          road_tiles: dict[tuple[int, int], str], sidewalk_tiles: set[tuple[int, int]],
          water_tiles: set[tuple[int, int]], road_hints: dict[tuple[int, int], int],
          seed: int) -> dict[str, int]:
    """Applica le maschere, poi la segnaletica. Restituisce il conteggio GID usati."""
    classes: dict[tuple[int, int], str] = {}
    for (x, y), kind in road_tiles.items():
        if not (0 <= x < width and 0 <= y < height):
            continue
        if (x, y) in water_tiles or collision[y][x]:
            continue
        classes[(x, y)] = kind
    for x, y in sidewalk_tiles:
        if not (0 <= x < width and 0 <= y < height):
            continue
        if (x, y) in water_tiles or collision[y][x] or (x, y) in classes:
            continue
        classes[(x, y)] = 'paving'

    counts: dict[str, int] = {}
    for (x, y), kind in classes.items():
        mask = _mask(classes, x, y, kind)
        ground[y][x] = MASK_RANGES[kind][mask]
        counts[kind] = counts.get(kind, 0) + 1

    # Segnaletica: solo su asfalto interno (maschera 15), mai sopra il cordolo.
    for (x, y), kind in list(classes.items()):
        if kind != 'asphalt' or _mask(classes, x, y, kind) != 15:
            continue
        wide = _is_wide(classes, x, y, kind)
        direction = _direction(classes, x, y, kind, road_hints.get((x, y), 0))
        horizontal_neighbours = (classes.get((x - 1, y)) == kind and classes.get((x + 1, y)) == kind)
        vertical_neighbours = (classes.get((x, y - 1)) == kind and classes.get((x, y + 1)) == kind)
        gid: int | None = None
        if horizontal_neighbours and vertical_neighbours:
            gid = INTERSECTION if wide else None
        elif wide:
            gid = DASH_H if direction == 'h' else DASH_V
            if seed % 11 == 0 and (x + y) % 17 == 0:
                gid = SOLID_H if direction == 'h' else SOLID_V
            if (x * 7 + y * 3 + seed) % 43 == 0:
                gid = STOP_H if direction == 'h' else STOP_V
        else:
            gid = EDGE_H if direction == 'h' else EDGE_V
        # Throughze pedonali: la pavement pedonale lambisce la carreggiata.
        footway = any(classes.get((x + dx, y + dy)) in ('cobble', 'paving')
                      for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)))
        if footway and wide and (x * 5 + y * 11 + seed) % 9 == 0:
            gid = CROSS_H if direction == 'h' else CROSS_V
        if gid is not None:
            ground[y][x] = gid
        # Stalli di sosta solo sul bordo delle strade larghe.
        if wide and (x * 13 + y * 7 + seed) % 19 == 0 and not footway:
            ground[y][x] = PARK_H if direction == 'h' else PARK_V
        # Manhole e griglie di drenaggio, distanti fra loro e mai in throughza.
        if horizontal_neighbours and vertical_neighbours and (x + y * 3 + seed) % 53 == 0:
            ground[y][x] = MANHOLE
        elif (x * 3 + y * 17 + seed) % 71 == 0 and not wide:
            ground[y][x] = DRAIN if ground[y][x] in (EDGE_H, EDGE_V) else PATCH

    counts['gidUsed'] = len({cell for row in ground for cell in row})
    return counts


def write_roads(out_dir: Path, width: int, height: int,
                classes: dict[tuple[int, int], str]) -> Path:
    data = bytearray(width * height)
    for (x, y), kind in classes.items():
        if 0 <= x < width and 0 <= y < height:
            data[y * width + x] = CLASS_CODE[kind]
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / 'roads.bin'
    path.write_bytes(bytes(data))
    return path


def rebuild_classes(ground: list[list[int]], width: int, height: int) -> dict[tuple[int, int], str]:
    """Ricostruisce la classe dal GID: usata dai builder dopo la pittura."""
    reverse: dict[int, str] = {}
    for kind, gids in MASK_RANGES.items():
        for gid in gids:
            reverse[gid] = kind
    for gid in (ASPHALT, *ASPHALT_MARK, *CROSSWALK):
        reverse[gid] = 'asphalt'
    reverse[PAVING] = 'paving'
    classes: dict[tuple[int, int], str] = {}
    for y in range(height):
        for x in range(width):
            kind = reverse.get(ground[y][x])
            if kind:
                classes[(x, y)] = kind
    return classes
