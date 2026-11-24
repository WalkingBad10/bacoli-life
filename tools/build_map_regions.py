"""Genera le mappe metriche M5 delle frazioni flegree, 1 metro = 1 tile = 16 px.

Il centro storico resta identico a ``bacoli_centro.json``; le nuove zone sono
costruite con gli stessi generatori, ma da geodati OSM specifici per zona.
Tutte le geometrie derivano da OpenStreetMap/Overpass; nessun edificio o
strada vieneinventato. I servizi senza coordinate OSM restano esplicitamente
dichiarati come approssimati.

Fonti: vedi docs/M5_GEO_AUDIT.md e tools/generated/m5_osm_raw.json.

Uso: python tools/build_map_regions.py
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

from build_map import EAST_COAST
import m6_paving as PAVE
import m6_tiles as TILES

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "tools" / "generated" / "m5_osm_raw.json"
CENTRO_DATA = ROOT / "src" / "data" / "bacoli_centro.json"
CENTRO_MAPS = ROOT / "public" / "assets" / "maps" / "centro"
OUT_MAPS = ROOT / "public" / "assets" / "maps"
DATA_OUT = ROOT / "src" / "data" / "bacoli_world.json"

TILE = 16
GRASS, GRASS2, SAND, SAND2, COBBLE, COBBLE2, ASPHALT, PAVING_GID = (
    TILES.GRASS, TILES.GRASS2, TILES.SAND, TILES.SAND2,
    TILES.COBBLE, TILES.COBBLE2, TILES.ASPHALT, TILES.PAVING,
)
WATER_GIDS = TILES.WATER_GIDS
WATER_IDS = set(WATER_GIDS)
FLOWERS = TILES.FLOWERS

M5_ZONES = {
    "marina_grande", "lago_miseno", "villa_comunale", "miseno", "miliscola",
    "baia", "fusaro", "torregaveta",
}

# Lato del mare rispetto alla costa OSM: a Torregaveta e Miliscola l'abitato è
# a est della battigia, a Baia/Miseno/Marina Grande è a ovest.
COAST_SIDE = {
    "torregaveta": "west", "miliscola": "west",
    "miseno": "east", "marina_grande": "east", "baia": "east",
}

ROAD_RADIUS = {
    "footway": 1, "steps": 1, "path": 1, "track": 1, "service": 1,
    "residential": 2, "unclassified": 2, "tertiary": 2, "pedestrian": 2,
    "secondary": 3, "primary": 3,
}

SPRITE_FOR = {
    "cafe": 2, "bar": 2, "restaurant": 2, "shop": 4, "pharmacy": 4,
    "fuel": 4, "bank": 1, "post_office": 1, "archaeological_site": 3,
    "railway": 5, "bus_stop": 5, "beach": 5, "parking": 5,
    "dealership": 4, "workplace": 1, "home": 0, "house": 1,
    "garage": 1, "pescheria": 4, "gelateria": 4, "office": 1,
    "delivery": 4,
}

OSM_KIND = {
    "restaurant": "restaurant", "fast_food": "restaurant", "pub": "restaurant",
    "nightclub": "restaurant", "cafe": "cafe", "bar": "bar",
    "ice_cream": "gelateria", "pharmacy": "pharmacy", "bank": "bank",
    "atm": "bank", "fuel": "fuel", "parking": "parking", "rail": "railway",
    "beach": "beach", "archaeological_site": "archaeological_site",
    "ruins": "archaeological_site", "castle": "archaeological_site",
    "memorial": "archaeological_site", "wayside_cross": "archaeological_site",
    "place_of_worship": "house", "school": "workplace",
    "police": "office", "townhall": "office", "public_building": "office",
    "library": "office", "university": "office", "veterinary": "office",
    "post_office": "post_office", "marketplace": "shop",
    "boat_rental": "shop", "dive_centre": "shop", "recycling": "shop",
    "events_venue": "shop", "car_wash": "garage", "yes": "shop",
    "bus_stop": "bus_stop", "train_station": "railway",
    "building": "home",
}

# Coordinate verificate e gia' documentate in src/systems/TransportSystem.ts.
# Coordinate reali verificate: identiche a src/systems/TransportSystem.ts.
STATION_COORDS = {
    "bacoli_centro": (40.80550, 14.07920),
    "miseno": (40.78669, 14.08409),
    "miliscola": (40.78971, 14.06611),
    "mercato_sabato": (40.80100, 14.05800),
    "piazza_de_gasperi": (40.81853, 14.07133),
    "sella_baia": (40.81480, 14.07450),
    "baia_station": (40.82115, 14.07130),
    "fusaro_station": (40.81857, 14.06173),
    "torregaveta": (40.81150, 14.04487),
    "lucrino": (40.82940, 14.08370),
    "cuma_station": (40.84915, 14.04929),
    "lido_fusaro": (40.82888, 14.04984),
}

# Corrisponde campo per campo a `mapRegion` in TransportSystem.ts: una fermata
# appartiene a una sola regione, anche quando il suo punto reale è appena fuori
# dal ritaglio (in quel caso il gate è riportato al bordo e segnalato).
REGION_STATIONS = {
    "miseno": ["miseno"],
    "miliscola": ["miliscola", "mercato_sabato"],
    "baia": ["baia_station", "piazza_de_gasperi", "sella_baia"],
    "fusaro": ["fusaro_station", "lucrino", "lido_fusaro"],
    "torregaveta": ["torregaveta", "cuma_station"],
}

# Punti di ingresso predominanti, usati solo per scegliere uno spawnPedonale.
ZONE_ANCHORS = {
    "marina_grande": (40.78200, 14.08700),
    "lago_miseno": (40.79000, 14.08000),
    "villa_comunale": (40.80360, 14.07950),
    "miseno": (40.78669, 14.08409),
    "miliscola": (40.78971, 14.06611),
    "baia": (40.81889, 14.07075),
    "fusaro": (40.81907, 14.06260),
    "torregaveta": (40.81150, 14.04487),
}

FACADE_WIDTHS = tuple(range(96, 449, 16)) + (
    480, 512, 544, 576, 608, 640, 672, 704, 768, 832, 896, 960, 1024, 1088,
)


def inside_polygon(x: float, y: float, poly: list[tuple[int, int]]) -> bool:
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y):
            cross = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < cross:
                inside = not inside
        j = i
    return inside


def clip_segment(x0: float, y0: float, x1: float, y1: float,
                 width: int, height: int) -> tuple[float, float, float, float] | None:
    xmin, ymin, xmax, ymax = 0.0, 0.0, float(width - 1), float(height - 1)

    def code(x: float, y: float) -> int:
        return ((1 if x < xmin else 0) | (2 if x > xmax else 0)
                | (4 if y < ymin else 0) | (8 if y > ymax else 0))

    c0, c1 = code(x0, y0), code(x1, y1)
    while c0 or c1:
        if c0 & c1:
            return None
        out = c0 or c1
        if out & 1:
            t = (xmin - x0) / (x1 - x0)
            y0 += (y1 - y0) * t
            x0 = xmin
        elif out & 2:
            t = (xmax - x0) / (x1 - x0)
            y0 += (y1 - y0) * t
            x0 = xmax
        elif out & 4:
            t = (ymin - y0) / (y1 - y0)
            x0 += (x1 - x0) * t
            y0 = ymin
        elif out & 8:
            t = (ymax - y0) / (y1 - y0)
            x0 += (x1 - x0) * t
            y0 = ymax
        c0, c1 = code(x0, y0), code(x1, y1)
    return x0, y0, x1, y1


def rasterize(points: list[tuple[float, float]], radius: int,
              width: int, height: int) -> set[tuple[int, int]]:
    out: set[tuple[int, int]] = set()
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        segment = clip_segment(ax, ay, bx, by, width, height)
        if not segment:
            continue
        x0, y0, x1, y1 = segment
        steps = max(1, int(math.ceil(math.hypot(x1 - x0, y1 - y0) * 2)))
        for i in range(steps + 1):
            t = i / steps
            cx, cy = round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t)
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    if dx * dx + dy * dy <= radius * radius + 1:
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < width and 0 <= ny < height:
                            out.add((nx, ny))
    return out


def fill_tiles(poly: list[tuple[int, int]], width: int, height: int) -> set[tuple[int, int]]:
    """Rasterizza un poligono OSM entro la regione corrente (non il centro M4)."""
    if len(poly) < 3:
        return set()
    minx, maxx = min(p[0] for p in poly), max(p[0] for p in poly)
    miny, maxy = min(p[1] for p in poly), max(p[1] for p in poly)
    out: set[tuple[int, int]] = set()
    for y in range(max(0, miny), min(height - 1, maxy) + 1):
        for x in range(max(0, minx), min(width - 1, maxx) + 1):
            if inside_polygon(x + 0.5, y + 0.5, poly):
                out.add((x, y))
    return out


def nearest_tile(x: int, y: int, candidates: set[tuple[int, int]]) -> tuple[int, int] | None:
    if not candidates:
        return None
    return min(candidates, key=lambda p: (p[0] - x) ** 2 + (p[1] - y) ** 2)


def entrance_tile(footprint: set[tuple[int, int]], roads: set[tuple[int, int]],
                  cx: int, cy: int) -> tuple[int, int]:
    for radius in range(1, 5):
        for tx, ty in footprint:
            for nx, ny in ((tx + dx, ty + dy)
                           for dx in range(-radius, radius + 1)
                           for dy in range(-radius, radius + 1)):
                if (nx, ny) in roads:
                    return nx, ny
    return nearest_tile(cx, cy, roads) or (cx, cy)


def add_place(places: list[dict], prefix: str, name: str, kind: str,
              x: int, y: int, footprint: set[tuple[int, int]] | None = None,
              **extra: object) -> None:
    bounds: list[int] | None = None
    if footprint:
        bounds = [min(p[0] for p in footprint), min(p[1] for p in footprint),
                  max(p[0] for p in footprint), max(p[1] for p in footprint)]
    ident = f"place-{prefix}-{len(places) + 1}"
    entry: dict[str, object] = {
        "id": ident, "name": name, "kind": kind, "x": x, "y": y,
        "sprite": SPRITE_FOR.get(kind, 0),
    }
    if bounds:
        entry["bounds"] = bounds
    entry.update(extra)
    places.append(entry)


def write_buffers(region_id: str, ground: list[list[int]],
                  collision: list[list[int]], meta_extra: dict) -> None:
    out = OUT_MAPS / region_id
    out.mkdir(parents=True, exist_ok=True)
    height = len(ground)
    width = len(ground[0])
    (out / "ground.bin").write_bytes(bytes(cell for row in ground for cell in row))
    packed = bytearray((width * height + 7) // 8)
    for y, row in enumerate(collision):
        for x, value in enumerate(row):
            if value:
                bit = y * width + x
                packed[bit >> 3] |= 1 << (bit & 7)
    (out / "collision.bin").write_bytes(bytes(packed))
    meta = {
        "width": width, "height": height, "tileWidth": TILE, "tileHeight": TILE,
        "tilesetName": "base", "tilesetKey": "tiles16", "firstGid": 1,
        "metersPerPixel": 1 / 16, "metersPerTile": 1,
        "solidTiles": sum(sum(row) for row in collision),
        **meta_extra,
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")


def build_region(region_id: str, zone: dict, seed: int) -> dict:
    bbox = zone["bbox"]
    south, north = bbox["south"], bbox["north"]
    west, east = bbox["west"], bbox["east"]
    lat0 = (south + north) / 2
    m_per_lat = 111_132.0
    m_per_lon = 111_320.0 * math.cos(math.radians(lat0))
    width = max(64, min(1100, int(round((east - west) * m_per_lon))))
    height = max(64, min(1100, int(round((north - south) * m_per_lat))))

    def to_tile(lat: float, lon: float) -> tuple[int, int]:
        x = int(round((lon - west) * m_per_lon))
        y = int(round((north - lat) * m_per_lat))
        return max(0, min(width - 1, x)), max(0, min(height - 1, y))

    ground = [[0 for _ in range(width)] for _ in range(height)]
    collision = [[0 for _ in range(width)] for _ in range(height)]
    roads: set[tuple[int, int]] = set()
    sidewalks: set[tuple[int, int]] = set()
    road_tiles: dict[tuple[int, int], str] = {}
    road_hints: dict[tuple[int, int], int] = {}
    street_names: dict[tuple[int, int], str] = {}

    water_tiles: set[tuple[int, int]] = set()
    water_polys = zone.get("water", [])
    coast_points: list[tuple[float, float]] = []
    for water in water_polys:
        geom = water.get("geometry") or []
        if water.get("kind") == "coastline":
            coast_points.extend((p["lat"], p["lon"]) for p in geom)
            continue
        if len(geom) < 3:
            continue
        poly = [to_tile(p["lat"], p["lon"]) for p in geom]
        water_tiles |= fill_tiles(poly, width, height)

    # La coastline OSM delinea il mare anche quando la zona contiene un lago:
    # i poligoni lacustri e il mare coexistono, senza sostituirsi a vicenda.
    if coast_points or not water_tiles:
        coast = sorted((p for p in (coast_points or EAST_COAST)
                        if south - 0.004 <= p[0] <= north + 0.004), key=lambda p: p[0])
        side = COAST_SIDE.get(region_id, "east")
        if coast:
            for y in range(height):
                lat = north - y / m_per_lat
                if lat <= coast[0][0]:
                    lon = coast[0][1]
                elif lat >= coast[-1][0]:
                    lon = coast[-1][1]
                else:
                    lon = coast[-1][1]
                    for (la0, lo0), (la1, lo1) in zip(coast, coast[1:]):
                        if la0 <= lat <= la1 and la1 != la0:
                            lon = lo0 + (lo1 - lo0) * ((lat - la0) / (la1 - la0))
                            break
                edge = to_tile(lat, lon)[0]
                xs = range(edge + 4, width) if side == "east" else range(0, max(0, edge - 3))
                for x in xs:
                    water_tiles.add((x, y))

    # Terreno a macchie deterministiche (nessuno scacchiere `(x + y) % n`).
    PAVE.fill_base(ground, width, height, water_tiles, seed)
    for x, y in water_tiles:
        ground[y][x] = WATER_GIDS[(x // 4 + y // 3) % 4]
        collision[y][x] = 1
    for x, y in list(water_tiles):
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in water_tiles:
                    if ground[ny][nx] not in WATER_IDS:
                        ground[ny][nx] = SAND if (nx + ny) % 3 else SAND2

    for road in zone.get("roads", []):
        geom = road.get("geometry") or []
        pts = [to_tile(p["lat"], p["lon"]) for p in geom]
        if len(pts) < 2:
            continue
        radius = ROAD_RADIUS.get(road.get("kind"), 1)
        tiles = rasterize(pts, radius, width, height)
        if not tiles:
            continue
        roads |= tiles
        sidewalks |= rasterize(pts, radius + 2, width, height)
        kind = PAVE.road_class(road.get("kind"))
        assert kind is not None
        hint = 0 if abs(pts[-1][0] - pts[0][0]) >= abs(pts[-1][1] - pts[0][1]) else 1
        for x, y in tiles:
            if ground[y][x] not in WATER_IDS:
                road_tiles[(x, y)] = kind
                road_hints[(x, y)] = hint
                collision[y][x] = 0
        if road.get("name"):
            cx, cy = pts[len(pts) // 2]
            street_names[(cx // 12, cy // 12)] = road["name"]

    # I marciapiedi sono affidati ad `autotiling` insieme alle strade, in fondo
    # alla funzione: qui si conserva solo l'insieme dei tile pedonali.

    places: list[dict] = []
    assigned: set[object] = set()
    street_count: dict[str, int] = {}
    rng = random.Random(seed)

    for building in zone.get("buildings", []):
        geom = building.get("geometry") or []
        if len(geom) < 4:
            continue
        poly = [to_tile(p["lat"], p["lon"]) for p in geom]
        minx, maxx = min(p[0] for p in poly), max(p[0] for p in poly)
        miny, maxy = min(p[1] for p in poly), max(p[1] for p in poly)
        footprint = {
            (x, y) for y in range(miny, maxy + 1) for x in range(minx, maxx + 1)
            if inside_polygon(x + 0.5, y + 0.5, poly)
        }
        if not footprint:
            continue
        xs = [x for x, _ in footprint]
        ys = [y for _, y in footprint]
        cx, cy = sum(xs) // len(xs), sum(ys) // len(ys)
        width_m = max(xs) - min(xs) + 1
        depth_m = max(ys) - min(ys) + 1
        area = len(footprint)

        kind = "home"
        name = building.get("name") or ""
        best: tuple[float, dict | None] = (1e9, None)
        for poi in zone.get("pois", []):
            lat, lon = poi.get("lat"), poi.get("lon")
            if lat is None or lon is None:
                continue
            px, py = to_tile(lat, lon)
            distance = (px - cx) ** 2 + (py - cy) ** 2
            if distance < best[0]:
                best = (distance, poi)
        if best[0] <= 144 and best[1]:
            poi = best[1]
            kind = OSM_KIND.get(poi.get("kind", ""), "home")
            name = poi.get("name") or name
            assigned.add(poi.get("id") or id(poi))

        street = street_names.get((cx // 12, cy // 12))
        if not name and street:
            street_count[street] = street_count.get(street, 0) + 1
            name = f"{street} {street_count[street]}"

        if area > 700 or (area > 400 and width_m > 34):
            floors = 1
        elif area > 180 or width_m > 34:
            floors = 2
        elif area > 80:
            floors = 3
        else:
            floors = 2
        facade = min(FACADE_WIDTHS, key=lambda candidate: abs(candidate / 16 - width_m))
        variant = rng.randrange(4)
        if kind in {"cafe", "bar", "restaurant", "gelateria", "pescheria"}:
            variant = 3
        entry_x, entry_y = entrance_tile(footprint, roads, cx, cy)
        for x, y in footprint:
            ground[y][x] = PAVING_GID
            collision[y][x] = 1
        add_place(
            places, region_id, name or f"Casa {len(places) + 1}", kind,
            entry_x, entry_y, footprint, floors=floors, facadeWidth=facade,
            variant=variant, meters={"width": width_m, "depth": depth_m, "area": area},
            source="OSM building polygon; piani stimati dall'area (tag building:levels assente)",
        )

    for poi in zone.get("pois", []):
        if (poi.get("id") or id(poi)) in assigned:
            continue
        lat, lon = poi.get("lat"), poi.get("lon")
        if lat is None or lon is None:
            continue
        x, y = to_tile(lat, lon)
        kind = OSM_KIND.get(poi.get("kind", ""), "shop")
        if poi.get("name"):
            add_place(places, region_id, poi["name"], kind, x, y, marker=True,
                      source="OSM POI; posizione puntuale, nessun edificio inventato")

    # Meccaniche esistenti: conservano un punto di accesso in ogni frazione,
    # dichiarato come servizio non georeferenziato quando OSM non lo fornisce.
    for name, kind in (("Centro consegne", "delivery"), ("Garage comunale", "garage")):
        if any(p["kind"] == kind for p in places):
            continue
        lat, lon = ZONE_ANCHORS.get(region_id, (lat0, (west + east) / 2))
        tx, ty = to_tile(lat, lon)
        sx, sy = nearest_tile(tx, ty, roads) or (tx, ty)
        add_place(places, region_id, name, kind, sx, sy, marker=True,
                  source="posizione approssimata nella frazione; servizio non georeferenziato")

    # Pavimentazione finale: maschere di adiacenza, cordoli, attraversamenti
    # pedonali e segnaletica derivata dalle geometrie OSM (non da pattern casuali).
    PAVE.paint(
        ground, collision, width, height, road_tiles, sidewalks - roads,
        water_tiles, road_hints, seed,
    )
    classes = PAVE.rebuild_classes(ground, width, height)
    PAVE.write_roads(OUT_MAPS / region_id, width, height, classes)

    for i in range(0, width * height, 53):
        x, y = (i * 17) % width, (i * 29) % height
        if ground[y][x] in (GRASS, GRASS2) and rng.random() < 0.14:
            ground[y][x] = FLOWERS

    anchor_lat, anchor_lon = ZONE_ANCHORS.get(region_id, (lat0, (west + east) / 2))
    def free_spot(tx: int, ty: int) -> bool:
        for xx, yy in ((tx, ty), (tx - 1, ty), (tx + 1, ty), (tx, ty - 1), (tx, ty + 1)):
            if not (0 <= xx < width and 0 <= yy < height) or collision[yy][xx]:
                return False
        return True

    ax, ay = to_tile(anchor_lat, anchor_lon)
    footprints = [(place["x"], place["y"]) for place in places if place.get("bounds")]
    # Lo spawn deve mostrare subito il paese: si privilegiano le strade con
    # più edifici/OSM nel campo visivo (80x45 tile), non solo la più vicina
    # all'ancoraggio, che spesso cade in prati vuoti.
    def spawn_score(tx: int, ty: int) -> float:
        nearby = sum(
            1 for px, py in footprints
            if abs(px - tx) <= 26 and abs(py - ty) <= 18
        )
        visible_water = sum(
            1 for yy in range(max(0, ty - 20), min(height, ty + 21), 3)
            for xx in range(max(0, tx - 36), min(width, tx + 37), 3)
            if ground[yy][xx] in WATER_IDS
        )
        distance2 = (tx - ax) ** 2 + (ty - ay) ** 2
        return nearby * 40 + visible_water * 0.5 - distance2 / 500

    candidates = sorted(roads, key=lambda p: (-spawn_score(*p), p))
    spawn = candidates[0] if candidates else (ax, ay)
    for tx, ty in candidates:
        if free_spot(tx, ty):
            spawn = (tx, ty)
            break

    station_spawns: dict[str, dict[str, int]] = {}
    for station_id in REGION_STATIONS.get(region_id, []):
        coords = STATION_COORDS.get(station_id)
        if not coords:
            continue
        lat, lon = coords
        approximate = not (south <= lat <= north and west <= lon <= east)
        tx = min(width - 1, max(0, round((lon - west) * m_per_lon)))
        ty = min(height - 1, max(0, round((north - lat) * m_per_lat)))
        candidates = sorted(roads or {(tx, ty)},
                            key=lambda p: (p[0] - tx) ** 2 + (p[1] - ty) ** 2)
        sx, sy = candidates[0]
        for cx, cy in candidates:
            if free_spot(cx, cy):
                sx, sy = cx, cy
                break
        entry = {"x": sx, "y": sy}
        if approximate:
            entry["approximate"] = True
        entry["coordinates"] = {"lat": lat, "lon": lon}
        station_spawns[station_id] = entry

    bounds = {"south": south, "north": north, "west": west, "east": east}
    write_buffers(region_id, ground, collision, {
        "bounds": bounds,
        "projection": "equirectangular locale, 1 tile = 1 metro",
    })
    return {
        "id": region_id,
        "name": zone.get("name", region_id),
        "bounds": bounds,
        "scale": {"metersPerPixel": 1 / 16, "metersPerTile": 1,
                  "adultHeightPx": 28, "floorHeightPx": 52},
        "size": {"width": width, "height": height},
        "spawn": {"x": spawn[0], "y": spawn[1]},
        "stations": station_spawns,
        "places": places,
        "roadTileCount": len(roads),
        "buildingCount": sum(1 for p in places if p.get("bounds")),
        "sources": zone.get("sources", ["OpenStreetMap via Overpass"]),
        "approximations": [
            "building:levels e height assenti: piani stimati dall'area OSM",
            "servizi senza coordinate OSM dichiarati singolarmente nel luogo",
        ],
    }


def main() -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    centro = json.loads(CENTRO_DATA.read_text(encoding="utf-8"))
    meta = json.loads((CENTRO_MAPS / "meta.json").read_text(encoding="utf-8"))
    centro_region = {
        "id": "centro",
        "name": "Centro storico · Via Ortensio · Via Spiaggia",
        **centro,
        "stations": {
            "bacoli_centro": {
                "x": round(((40.80550 - centro["bounds"]["south"])
                            / (centro["bounds"]["north"] - centro["bounds"]["south"]))
                           * centro["size"]["height"]),
                "y": round(((14.07920 - centro["bounds"]["west"])
                            / (centro["bounds"]["east"] - centro["bounds"]["west"]))
                           * centro["size"]["width"]),
            }
        },
    }
    # Il gate storico del centro e' verificato dal dataset e resta invariato.
    centro_region["stations"]["bacoli_centro"] = {"x": 347, "y": 478}

    regions = [centro_region]
    for index, (region_id, zone) in enumerate(sorted(raw["zones"].items())):
        # Pianura e Napoli 80126 restano solo predisposte nei trasporti: non
        # diventano mappe giocabili in questa milestone.
        if region_id not in M5_ZONES:
            continue
        regions.append(build_region(region_id, zone, 20_261_124 + index))

    DATA_OUT.write_text(json.dumps({
        "scale": {"metersPerPixel": 1 / 16, "metersPerTile": 1,
                  "adultHeightPx": 28, "floorHeightPx": 52},
        "sources": raw.get("sources", []),
        "regions": regions,
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"Mappa M5: {len(regions)} regioni metriche")
    for region in regions:
        print(f"  {region['id']}: {region['size']['width']}x{region['size']['height']} "
              f"tile, {region['roadTileCount']} strada, "
              f"{region['buildingCount']} edifici, {len(region['places'])} luoghi")
    print(f"meta centro: {meta['width']}x{meta['height']} (invariato)")


if __name__ == "__main__":
    main()
