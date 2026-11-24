"""Costruisce la mappa Tiled di BACOLI LIFE sull'intero territorio flegreo.

Fonti:
- strade e POI OSM già recuperati in src/data/bacoli_geo.json;
- coordinate reali di frazioni, stazioni e monumenti verificate con OSM/Wikipedia;
- sagome costiere reali (OSM way 437456521, 27967504, 437456513).

Gli edifici fuori dal centro storico sono isolati ricostruiti in modo
deterministico intorno ad ancoraggi reali: la mappa resta densa e giocabile
senza fingersi un rilievo cartografico completo.

Uso: python tools/build_map.py
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "src" / "data" / "bacoli_geo.json"
MAP_OUT = ROOT / "public" / "assets" / "maps" / "bacoli.json"
PLACES_OUT = ROOT / "src" / "data" / "bacoli_places.json"

# Territorio coperto: Capo Miseno a sud, Cuma a nord, Torregaveta a ovest.
S, N = 40.7770, 40.8450
W, E = 14.0400, 14.0960
TW, TH = 480, 680

# Gid del tileset (firstgid = 1).
GRASS, GRASS2, SAND, SAND2, COBBLE, COBBLE2, ASPHALT, PAVING = 1, 2, 3, 4, 5, 6, 7, 8
WATER0, WATER1, WATER2, WATER3, FOAM, WALL, ROOF, FLOWERS = 9, 10, 11, 12, 13, 14, 15, 16
WATER_GIDS = (WATER0, WATER1, WATER2, WATER3)
WATER_IDS = set(WATER_GIDS)

# Costa orientale: golfo di Pozzuoli, da Capo Miseno verso Baia.
EAST_COAST = [
    (40.77788, 14.08946), (40.78027, 14.09009), (40.78546, 14.08893),
    (40.78721, 14.08812), (40.78959, 14.08341), (40.78868, 14.08041),
    (40.78953, 14.07839), (40.79243, 14.08009), (40.79374, 14.08624),
    (40.79744, 14.08482), (40.80063, 14.08147), (40.80301, 14.08182),
    (40.80679, 14.08085), (40.80950, 14.08173), (40.81232, 14.08205),
    (40.81308, 14.07836), (40.81441, 14.07608), (40.81696, 14.07596),
    (40.81640, 14.07316), (40.82003, 14.07231), (40.82264, 14.07546),
    (40.82361, 14.07734), (40.84500, 14.07734),
]

# Costa occidentale: golfo di Gaeta, da Torregaveta a Cuma.
WEST_COAST = [
    (40.77788, 14.08946), (40.77900, 14.08200), (40.78400, 14.06500),
    (40.79000, 14.04500), (40.79825, 14.03992), (40.80546, 14.04092),
    (40.80898, 14.04364), (40.81157, 14.04403), (40.81559, 14.04635),
    (40.82161, 14.04679), (40.82326, 14.04729), (40.82837, 14.04777),
    (40.83526, 14.04790), (40.84534, 14.04748),
]

# Ancoraggi reali per la densità urbana: (nome, lat, lon, raggio tile, case).
ANCHORS = [
    ("Bacoli centro", 40.79659, 14.07777, 30, 90),
    ("Bacoli mare", 40.80170, 14.08134, 22, 52),
    ("Miseno", 40.78669, 14.08409, 24, 62),
    ("Miliscola", 40.78971, 14.06611, 22, 52),
    ("Baia", 40.81889, 14.07075, 26, 70),
    ("Fusaro", 40.81907, 14.06260, 24, 58),
    ("Torregaveta", 40.81150, 14.04487, 18, 36),
    ("Cuma", 40.83805, 14.05598, 20, 44),
    ("Capo Miseno", 40.77788, 14.08946, 12, 18),
]

# Luoghi nominali verificati: (nome, kind, lat, lon, solido).
LANDMARKS = [
    ("Piscina Mirabilis", "archaeological_site", 40.79520, 14.08028, True),
    ("Cento Camerelle", "archaeological_site", 40.79821, 14.08407, True),
    ("Castello Aragonese di Baia", "archaeological_site", 40.81110, 14.08032, True),
    ("Parco Archeologico Terme di Baia", "archaeological_site", 40.81727, 14.06995, True),
    ("Tempio di Diana", "archaeological_site", 40.81913, 14.07056, True),
    ("Casina Vanvitelliana", "archaeological_site", 40.81971, 14.05842, True),
    ("Punta Epitaffio", "beach", 40.82233, 14.07688, False),
    ("Lago Miseno", "beach", 40.79343, 14.07307, False),
    ("Lago del Fusaro", "beach", 40.82312, 14.05567, False),
    ("Porto Turistico Miseno", "beach", 40.79218, 14.07929, False),
    ("Punta Pennata", "beach", 40.79340, 14.08130, False),
    ("Capo Miseno", "beach", 40.77788, 14.08946, False),
    ("Spiaggia di Miliscola", "beach", 40.78971, 14.06611, False),
    ("Baia marina", "beach", 40.82003, 14.07231, False),
    ("Piazzetta sul mare", "beach", 40.80170, 14.08134, False),
    ("Villa Comunale", "beach", 40.80360, 14.07950, False),
]

# Stazioni EAV reali; alcune sono chiuse, ma restano esplorabili.
STATIONS = [
    ("Stazione Baia (Cumana)", 40.82115, 14.07130),
    ("Stazione Fusaro (Cumana)", 40.81857, 14.06173),
    ("Stazione Torregaveta", 40.81150, 14.04487),
    ("Stazione Lucrino", 40.82940, 14.08370),
    ("Stazione Cuma (Circumflegrea)", 40.84915, 14.04929),
    ("Stazione Lido Fusaro", 40.82888, 14.04984),
]

# Fermate EAV citate negli orari ufficiali 2026.
BUS_STOPS = [
    ("Bacoli Via Roma", 40.80550, 14.07920),
    ("Bacoli Centro", 40.79659, 14.07777),
    ("Rotonda Miliscola", 40.79050, 14.06900),
    ("Via Mercato di Sabato", 40.80100, 14.05800),
    ("Miseno CL", 40.78669, 14.08409),
    ("Baia Piazza De Gasperi", 40.81853, 14.07133),
    ("Sella di Baia", 40.81480, 14.07450),
    ("Fusaro Stazione EAV", 40.81857, 14.06173),
    ("Torregaveta EAV", 40.81150, 14.04487),
    ("Cuma Scavi", 40.83805, 14.05598),
]

ZONE_KINDS = [
    ("cafe", 4), ("bar", 3), ("restaurant", 3), ("shop", 6),
    ("pharmacy", 2), ("home", 18), ("house", 8), ("workplace", 2),
    ("bank", 1), ("fuel", 1), ("parking", 2), ("dealership", 1),
]

SPRITE_FOR = {
    "cafe": 2, "bar": 2, "restaurant": 2, "shop": 4, "pharmacy": 4,
    "fuel": 4, "bank": 1, "post_office": 1, "archaeological_site": 3,
    "railway": 5, "bus_stop": 5, "beach": 5, "parking": 5,
    "dealership": 4, "workplace": 1, "home": 0, "house": 1,
}


def to_tile(lat: float, lon: float) -> tuple[int, int]:
    x = int((lon - W) / (E - W) * (TW - 1))
    y = int((N - lat) / (N - S) * (TH - 1))
    return max(0, min(TW - 1, x)), max(0, min(TH - 1, y))


def to_lon(x: int) -> float:
    return W + x / (TW - 1) * (E - W)


def to_lat(y: int) -> float:
    return N - y / (TH - 1) * (N - S)


def coast_lon(points: list[tuple[float, float]], lat: float) -> float:
    ordered = sorted(points)
    if lat <= ordered[0][0]:
        return ordered[0][1]
    if lat >= ordered[-1][0]:
        return ordered[-1][1]
    for (lat0, lon0), (lat1, lon1) in zip(ordered, ordered[1:]):
        if lat0 <= lat <= lat1 and lat1 != lat0:
            t = (lat - lat0) / (lat1 - lat0)
            return lon0 + (lon1 - lon0) * t
    return ordered[-1][1]


def rasterize_line(points: list[tuple[int, int]], radius: int) -> set[tuple[int, int]]:
    out: set[tuple[int, int]] = set()
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        steps = max(abs(x1 - x0), abs(y1 - y0), 1) * 2
        for i in range(steps + 1):
            t = i / steps
            cx = round(x0 + (x1 - x0) * t)
            cy = round(y0 + (y1 - y0) * t)
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    if dx * dx + dy * dy <= radius * radius + 1:
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < TW and 0 <= ny < TH:
                            out.add((nx, ny))
    return out


def inside_polygon(x: float, y: float, poly: list[tuple[float, float]]) -> bool:
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yi - yj) + xi:
            inside = not inside
        j = i
    return inside


def fill_polygon(poly: list[tuple[int, int]]) -> set[tuple[int, int]]:
    if len(poly) < 3:
        return set()
    minx, maxx = min(p[0] for p in poly), min(TW - 1, max(p[0] for p in poly))
    miny, maxy = min(p[1] for p in poly), min(TH - 1, max(p[1] for p in poly))
    out: set[tuple[int, int]] = set()
    for y in range(max(0, miny), maxy + 1):
        for x in range(max(0, minx), maxx + 1):
            if inside_polygon(x + 0.5, y + 0.5, poly):
                out.add((x, y))
    return out


def lagoon_polygon(south: float, north: float, west: float, east: float) -> list[tuple[int, int]]:
    points: list[tuple[float, float]] = []
    cy = (south + north) / 2
    cx = (west + east) / 2
    for i in range(20):
        a = 2 * math.pi * i / 20
        lat = cy + (north - south) / 2 * math.sin(a) * (1 + 0.08 * math.cos(3 * a))
        lon = cx + (east - west) / 2 * math.cos(a) * (1 + 0.06 * math.sin(2 * a))
        points.append(to_tile(lat, lon))
    return points


def add_place(places: list[dict], name: str, kind: str, x: int, y: int,
              footprint: list[tuple[int, int]] | None = None) -> None:
    places.append({
        "id": f"place-{len(places) + 1}", "name": name, "kind": kind,
        "x": x, "y": y, "sprite": SPRITE_FOR.get(kind, 0),
        "footprint": sorted(footprint or []),
    })


def main() -> None:
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    ground = [[GRASS if (x + y * 3) % 11 else GRASS2 for x in range(TW)] for y in range(TH)]
    collision = [[0 for _ in range(TW)] for _ in range(TH)]
    road_tiles: set[tuple[int, int]] = set()

    # Mare aperto: a ovest della costa occidentale e a est della costa orientale.
    for y in range(TH):
        lat = to_lat(y)
        west = coast_lon(WEST_COAST, lat)
        east = coast_lon(EAST_COAST, lat)
        for x in range(TW):
            lon = to_lon(x)
            if lon < west or lon > east:
                ground[y][x] = FOAM if abs(lon - (west if lon < west else east)) < 0.00025 else \
                    WATER_GIDS[(x // 3 + y // 2) % 4]
                collision[y][x] = 1
            elif abs(lon - west) < 0.00035 or abs(lon - east) < 0.00035:
                ground[y][x] = SAND if (x + y) % 4 else SAND2

    # Laghi craterici: acque interne con Ponti/strade ricavate dopo.
    lagoons = [
        lagoon_polygon(40.79014, 40.79672, 14.06665, 14.07830),
        lagoon_polygon(40.81574, 40.83044, 14.04989, 14.06053),
    ]
    for poly in lagoons:
        for x, y in fill_polygon(poly):
            ground[y][x] = WATER_GIDS[(x + y) % 4]
            collision[y][x] = 1
        minx, maxx = min(p[0] for p in poly), max(p[0] for p in poly)
        miny, maxy = min(p[1] for p in poly), max(p[1] for p in poly)
        for x in range(minx, maxx + 1):
            for y in (miny - 1, maxy + 1):
                if 0 <= x < TW and 0 <= y < TH and ground[y][x] not in WATER_IDS:
                    ground[y][x] = SAND

    # Strade OSM reali dove disponibili.
    widths = {"footway": 1, "steps": 1, "path": 1, "service": 1, "residential": 1,
              "tertiary": 2, "secondary": 2, "primary": 2, "unclassified": 1}
    for road in geo["roads"]:
        geom = road.get("geometry") or []
        pts = [to_tile(p["lat"], p["lon"]) for p in geom]
        if len(pts) < 2:
            continue
        tiles = rasterize_line(pts, widths.get(road["kind"], 1))
        road_tiles |= tiles
        for x, y in tiles:
            ground[y][x] = COBBLE if (x + y) % 3 else COBBLE2
            collision[y][x] = 0

    # Collegamenti stradali tra frazioni, per evitare zone isolate.
    anchors_tiles = [to_tile(lat, lon) for _, lat, lon, _, _ in ANCHORS]
    connectors = [(anchors_tiles[i], anchors_tiles[i + 1]) for i in range(len(anchors_tiles) - 1)]
    connectors += [
        (anchors_tiles[0], to_tile(40.80550, 14.07920)),
        (anchors_tiles[0], to_tile(40.79520, 14.08028)),
        (to_tile(40.79821, 14.08407), to_tile(40.80170, 14.08134)),
        (to_tile(40.81150, 14.04487), to_tile(40.81857, 14.06173)),
        (to_tile(40.81857, 14.06173), to_tile(40.81971, 14.05842)),
        (to_tile(40.81727, 14.06995), to_tile(40.82115, 14.07130)),
    ]
    for a, b in connectors:
        line = rasterize_line([a, b], 2)
        road_tiles |= line
        for x, y in line:
            ground[y][x] = ASPHALT if (x + y) % 4 else COBBLE2
            collision[y][x] = 0

    places: list[dict] = []
    occupied: set[tuple[int, int]] = set()

    # Edifici OSM reali del centro storico.
    for i, b in enumerate(geo["buildings"]):
        geom = b.get("geometry") or []
        if len(geom) < 4:
            continue
        poly = [to_tile(p["lat"], p["lon"]) for p in geom]
        tiles = fill_polygon(poly)
        if not tiles:
            continue
        cx = sum(x for x, _ in tiles) // len(tiles)
        cy = sum(y for _, y in tiles) // len(tiles)
        for x, y in tiles:
            ground[y][x] = PAVING
            collision[y][x] = 1
            occupied.add((x, y))
        best: tuple[float, dict | None] = (1e9, None)
        for poi in geo["pois"]:
            if poi.get("lat") is None or poi.get("lon") is None:
                continue
            px, py = to_tile(poi["lat"], poi["lon"])
            dist = (px - cx) ** 2 + (py - cy) ** 2
            if dist < best[0]:
                best = (dist, poi)
        poi = best[1] if best[0] < 36 else None
        kind = (poi or {}).get("kind", "home")
        if kind not in SPRITE_FOR:
            kind = "home"
        name = b.get("name") or (poi or {}).get("name") or f"Casa {i + 1}"
        add_place(places, name, kind, cx, cy, sorted(tiles))

    # Edifici procedurali ancorati alle frazioni reali.
    rng = random.Random(20261124)
    total_kind_weight = sum(w for _, w in ZONE_KINDS)
    for zone, lat, lon, radius, attempts in ANCHORS:
        ax, ay = to_tile(lat, lon)
        made = 0
        for n in range(attempts):
            if made >= attempts * 0.82:
                break
            tx = ax + rng.randint(-radius, radius)
            ty = ay + rng.randint(-radius, radius)
            w = 2 if rng.random() < 0.72 else 3
            h = 2 if rng.random() < 0.8 else 3
            tiles = [(x, y) for y in range(ty, ty + h) for x in range(tx, tx + w)]
            if any(x <= 1 or y <= 1 or x >= TW - 2 or y >= TH - 2 for x, y in tiles):
                continue
            if any((x, y) in road_tiles or (x, y) in occupied or collision[y][x]
                   for x, y in tiles):
                continue
            if any(ground[y][x] in WATER_IDS or ground[y][x] in (FOAM, SAND, SAND2)
                   for x, y in tiles):
                continue
            roll = rng.randint(1, total_kind_weight)
            kind = "home"
            running = 0
            for candidate, weight in ZONE_KINDS:
                running += weight
                if roll <= running:
                    kind = candidate
                    break
            label = {
                "cafe": "Bar", "bar": "Bar", "restaurant": "Pizzeria", "shop": "Negozio",
                "pharmacy": "Farmacia", "bank": "Banca", "fuel": "Distributore",
                "parking": "Parcheggio", "dealership": "Concessionaria",
                "workplace": "Attività", "home": "Casa", "house": "Palazzo",
            }[kind]
            add_place(places, f"{label} {zone} {n + 1}", kind, tx, ty, tiles)
            for x, y in tiles:
                ground[y][x] = PAVING if (x + y) % 5 else ROOF
                collision[y][x] = 1
                occupied.add((x, y))
            made += 1

    # Monumenti, laghi, spiagge e stazioni con coordinate reali.
    for name, kind, lat, lon, solid in LANDMARKS:
        x, y = to_tile(lat, lon)
        footprint: list[tuple[int, int]] = []
        if solid:
            footprint = [(xx, yy) for yy in range(y - 1, y + 2) for xx in range(x - 1, x + 2)]
            footprint = [(xx, yy) for xx, yy in footprint
                         if 1 <= xx < TW - 1 and 1 <= yy < TH - 1]
            for xx, yy in footprint:
                ground[yy][xx] = PAVING
                collision[yy][xx] = 1
        add_place(places, name, kind, x, y, footprint)

    for name, lat, lon in STATIONS:
        x, y = to_tile(lat, lon)
        footprint = [(xx, yy) for yy in range(y - 1, y + 1) for xx in range(x - 2, x + 2)
                     if 1 <= xx < TW - 1 and 1 <= yy < TH - 1]
        for xx, yy in footprint:
            ground[yy][xx] = PAVING
            collision[yy][xx] = 0
        add_place(places, name, "railway", x, y, footprint)

    for name, lat, lon in BUS_STOPS:
        x, y = to_tile(lat, lon)
        add_place(places, name, "bus_stop", x, y, [])

    # Piazzetta principale e spawn del giocatore su Via Spiaggia.
    plaza_x, plaza_y = to_tile(40.80170, 14.08134)
    for y in range(plaza_y - 3, plaza_y + 4):
        for x in range(plaza_x - 4, plaza_x + 5):
            if 1 <= x < TW - 1 and 1 <= y < TH - 1 and ground[y][x] not in WATER_IDS:
                ground[y][x] = PAVING if (x + y) % 5 else COBBLE2
                collision[y][x] = 0
    add_place(places, "Piazzetta sul mare", "beach", plaza_x, plaza_y, [])

    spawn_target = to_tile(40.80170, 14.08134)
    candidates = sorted(
        ((x - spawn_target[0]) ** 2 + (y - spawn_target[1]) ** 2, x, y)
        for x, y in road_tiles
        if collision[y][x] == 0
    )
    spawn = {"x": candidates[0][1], "y": candidates[0][2]} if candidates else \
        {"x": spawn_target[0], "y": spawn_target[1]}

    # Fiori e macchie verdi per aumentare la densità visiva.
    for i in range(0, TW * TH, 37):
        x = (i * 17) % TW
        y = (i * 29) % TH
        if ground[y][x] in (GRASS, GRASS2) and rng.random() < 0.12:
            ground[y][x] = FLOWERS

    layers = []
    for name, data in (("ground", ground), ("collision", collision)):
        layers.append({
            "data": [cell for row in data for cell in row],
            "height": TH, "id": len(layers) + 1, "name": name, "opacity": 1,
            "type": "tilelayer", "visible": name == "ground", "width": TW, "x": 0, "y": 0,
        })

    tiled = {
        "compressionlevel": -1, "height": TH, "width": TW, "infinite": False,
        "layers": layers, "nextlayerid": 3, "nextobjectid": 1,
        "orientation": "orthogonal", "renderorder": "right-down",
        "tiledversion": "1.11.0", "tileheight": 16, "tilewidth": 16,
        "tilesets": [{
            "columns": 4, "firstgid": 1, "image": "tileset.png",
            "imageheight": 64, "imagewidth": 64, "margin": 0, "name": "base",
            "spacing": 0, "tilecount": 16, "tileheight": 16, "tilewidth": 16,
        }],
        "type": "map", "version": "1.10",
    }
    MAP_OUT.parent.mkdir(parents=True, exist_ok=True)
    MAP_OUT.write_text(json.dumps(tiled, separators=(",", ":")), encoding="utf-8")

    PLACES_OUT.write_text(json.dumps({
        "bounds": {"south": S, "north": N, "west": W, "east": E},
        "tileSize": 16, "size": {"width": TW, "height": TH},
        "spawn": spawn, "places": places,
        "roadTileCount": len(road_tiles), "buildingCount": len(places),
        "sources": [
            "OpenStreetMap via Overpass (strade/POI centro storico)",
            "OSM/Wikipedia coordinate verificate per frazioni e stazioni",
            "isolati procedurali deterministici ancorati a luoghi reali",
        ],
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"mappa {TW}x{TH} generata: {len(road_tiles)} tile strada, "
          f"{len(places)} luoghi, spawn {spawn}")


if __name__ == "__main__":
    main()
