"""Ricostruisce il centro storico di Bacoli in scala metrica reale.

La mappa precedente copriva l'intero territorio flegreo con circa 10 m per tile.
Questa ricostruzione si limita a Via Ortensio, Via Spiaggia e al centro storico,
ma usa una proiezione metrica locale con 1 metro = 16 pixel (1 tile = 1 metro).

Fonti concrete:
- src/data/bacoli_geo.json (strade, edifici e POI OSM recuperati via Overpass);
- https://www.openstreetmap.org/search?query=Bacoli e https://overpass-turbo.eu/
  per edifici, strade e POI del centro;
- https://geoportale.urba.cloud/maps/Stradario%20-%20Comune%20di%20Bacoli/viewer/
  per la toponomastica comunale verificata;
- https://commons.wikimedia.org/wiki/Category:Bacoli e
  https://comune.bacoli.na.it/vivere-il-comune/galleria-fotografica/ per le
  fotografie dell'architettura locale;
- sagoma costiera OSM già verificata in tools/build_map.py;
- fotografie allegate analizzate in docs/NEW_ASSETS_ANALYSIS.json.

Le approssimazioni sono dichiarate esplicitamente nel file generato: il numero
dei piani non è disponibile nei tag OSM dell'area, quindi viene stimato
dall'area dell'impronta; la sagoma costiera resta quella semplificata già usata
dal progetto perché la query Overpass aggiornata è andata in timeout.

Uso: python tools/build_map_centro.py
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
GEO = ROOT / "src" / "data" / "bacoli_geo.json"
OUT = ROOT / "public" / "assets" / "maps" / "centro"
DATA_OUT = ROOT / "src" / "data" / "bacoli_centro.json"
TILED_OUT = ROOT / "tools" / "generated" / "centro.tiled.json"

# Area ricostruita: Via Ortensio, Via Spiaggia e centro storico.
LAT_S, LAT_N = 40.7995, 40.8060
LON_W, LON_E = 14.0775, 14.0830
LAT0 = (LAT_S + LAT_N) / 2
M_PER_LAT = 111_132.0
M_PER_LON = 111_320.0 * math.cos(math.radians(LAT0))
TW = int(round((LON_E - LON_W) * M_PER_LON))
TH = int(round((LAT_N - LAT_S) * M_PER_LAT))
TILE = 16
# Facciate native da 6 a 68 m, con passo 1 m fino a 28 m e 2-4 m oltre.
# Ogni edificio sceglie la larghezza più vicina al suo ingombro OSM, quindi
# la sprite resta sempre a dimensione reale (1 metro = 16 pixel).
FACADE_WIDTHS = tuple(range(96, 449, 16)) + (
    480, 512, 544, 576, 608, 640, 672, 704, 768, 832, 896, 960, 1024, 1088,
)

GRASS, GRASS2, SAND, SAND2, COBBLE, COBBLE2, ASPHALT, PAVING_GID = (
    TILES.GRASS, TILES.GRASS2, TILES.SAND, TILES.SAND2,
    TILES.COBBLE, TILES.COBBLE2, TILES.ASPHALT, TILES.PAVING,
)
WATER0, WATER1, WATER2, WATER3, FOAM, WALL, ROOF, FLOWERS = (
    TILES.WATER0, TILES.WATER1, TILES.WATER2, TILES.WATER3,
    TILES.FOAM, TILES.WALL, TILES.ROOF, TILES.FLOWERS,
)
WATER_GIDS = TILES.WATER_GIDS
WATER_IDS = set(WATER_GIDS)

ROAD_RADIUS = {
    "footway": 1, "steps": 1, "path": 1, "service": 1,
    "residential": 2, "unclassified": 2, "tertiary": 2,
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
    "building": "home",
}


def to_tile(lat: float, lon: float) -> tuple[int, int]:
    x = int(round((lon - LON_W) * M_PER_LON))
    y = int(round((LAT_N - lat) * M_PER_LAT))
    return max(0, min(TW - 1, x)), max(0, min(TH - 1, y))


def to_lat(y: int) -> float:
    return LAT_N - y / M_PER_LAT


def to_lon(x: int) -> float:
    return LON_W + x / M_PER_LON


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


def fill_polygon(poly: list[tuple[int, int]]) -> set[tuple[int, int]]:
    if len(poly) < 3:
        return set()
    minx = max(0, min(p[0] for p in poly))
    maxx = min(TW - 1, max(p[0] for p in poly))
    miny = max(0, min(p[1] for p in poly))
    maxy = min(TH - 1, max(p[1] for p in poly))
    return {
        (x, y)
        for y in range(miny, maxy + 1)
        for x in range(minx, maxx + 1)
        if inside_polygon(x + 0.5, y + 0.5, poly)
    }


def clip_segment(
    x0: float, y0: float, x1: float, y1: float,
) -> tuple[float, float, float, float] | None:
    """Cohen-Sutherland: evita di rasterizzare strade fuori dall'area."""
    xmin, ymin, xmax, ymax = 0.0, 0.0, float(TW - 1), float(TH - 1)

    def code(x: float, y: float) -> int:
        return (
            (1 if x < xmin else 0) | (2 if x > xmax else 0)
            | (4 if y < ymin else 0) | (8 if y > ymax else 0)
        )

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


def rasterize(points: list[tuple[float, float]], radius: int) -> set[tuple[int, int]]:
    out: set[tuple[int, int]] = set()
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        segment = clip_segment(ax, ay, bx, by)
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
                        if 0 <= nx < TW and 0 <= ny < TH:
                            out.add((nx, ny))
    return out


def coast_x(y: int) -> int:
    lat = to_lat(y)
    points = sorted((p for p in EAST_COAST if LAT_S - 0.002 <= p[0] <= LAT_N + 0.002))
    if not points:
        return TW - 1
    if lat <= points[0][0]:
        return to_tile(points[0][0], points[0][1])[0]
    if lat >= points[-1][0]:
        return to_tile(points[-1][0], points[-1][1])[0]
    for (la0, lo0), (la1, lo1) in zip(points, points[1:]):
        if la0 <= lat <= la1 and la1 != la0:
            lon = lo0 + (lo1 - lo0) * ((lat - la0) / (la1 - la0))
            return to_tile(lat, lon)[0]
    return TW - 1


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


def add_place(places: list[dict], name: str, kind: str, x: int, y: int,
              footprint: set[tuple[int, int]] | None = None, **extra: object) -> None:
    # Il JSON pubblicato conserva solo il rettangolo di ingestione dell'impronta:
    # i tile esatti sono già nel buffer collision.bin, quindi memorizzarli qui
    # gonfierebbe il bundle di 1,8 MB senza aggiungere informazioni utilizzate.
    bounds: list[int] | None = None
    if footprint:
        bounds = [
            min(p[0] for p in footprint), min(p[1] for p in footprint),
            max(p[0] for p in footprint), max(p[1] for p in footprint),
        ]
    entry: dict[str, object] = {
        "id": f"place-{len(places) + 1}",
        "name": name,
        "kind": kind,
        "x": x,
        "y": y,
        "sprite": SPRITE_FOR.get(kind, 0),
    }
    if bounds:
        entry["bounds"] = bounds
    entry.update(extra)
    places.append(entry)


def main() -> None:
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    rng = random.Random(20261124)

    ground = [[0 for _ in range(TW)] for _ in range(TH)]
    collision = [[0 for _ in range(TW)] for _ in range(TH)]
    roads: set[tuple[int, int]] = set()
    sidewalks: set[tuple[int, int]] = set()
    road_tiles: dict[tuple[int, int], str] = {}
    road_hints: dict[tuple[int, int], int] = {}
    water_tiles: set[tuple[int, int]] = set()

    # Mare e battigia: sagoma OSM semplificata già verificata nel progetto.
    for y in range(TH):
        coast = coast_x(y)
        for x in range(TW):
            if x > coast + 3:
                ground[y][x] = WATER_GIDS[(x // 4 + y // 3) % 4]
                collision[y][x] = 1
                water_tiles.add((x, y))
    PAVE.fill_base(ground, TW, TH, water_tiles, 20261124)
    for y in range(TH):
        coast = coast_x(y)
        for x in range(coast - 4, coast + 4):
            if 0 <= x < TW and (x, y) not in water_tiles:
                ground[y][x] = SAND if (x + y) % 3 else SAND2

    # Strade OSM reali, con marciapiedi larghi 1-2 metri.
    street_names: dict[int, str] = {}
    for road in geo["roads"]:
        geom = road.get("geometry") or []
        pts = [to_tile(p["lat"], p["lon"]) for p in geom]
        if len(pts) < 2:
            continue
        radius = ROAD_RADIUS.get(road["kind"], 1)
        tiles = rasterize(pts, radius)
        if not tiles:
            continue
        roads |= tiles
        sidewalks |= rasterize(pts, radius + 2)
        kind = PAVE.road_class(road.get('kind'))
        assert kind is not None
        hint = 0 if abs(pts[-1][0] - pts[0][0]) >= abs(pts[-1][1] - pts[0][1]) else 1
        for x, y in tiles:
            if ground[y][x] not in WATER_IDS:
                road_tiles[(x, y)] = kind
                road_hints[(x, y)] = hint
                collision[y][x] = 0
        name = road.get("name")
        if name:
            cx, cy = pts[len(pts) // 2]
            street_names[(cx // 12, cy // 12)] = name

    for x, y in sidewalks - roads:
        if 0 <= x < TW and 0 <= y < TH and ground[y][x] not in WATER_IDS | {FOAM}:
            ground[y][x] = PAVING_GID if (x + y) % 7 else COBBLE2

    places: list[dict] = []
    occupied: set[tuple[int, int]] = set()
    assigned_pois: set[int] = set()
    street_count: dict[str, int] = {}

    # Edifici OSM: impronta reale, larghezza in metri, piani stimati.
    for building in geo["buildings"]:
        geom = building.get("geometry") or []
        if len(geom) < 4:
            continue
        poly = [to_tile(p["lat"], p["lon"]) for p in geom]
        footprint = fill_polygon(poly)
        if not footprint:
            continue
        xs = [x for x, _ in footprint]
        ys = [y for _, y in footprint]
        minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
        cx, cy = sum(xs) // len(xs), sum(ys) // len(ys)
        width = maxx - minx + 1
        depth = maxy - miny + 1
        area = len(footprint)

        kind = "home"
        name = building.get("name") or ""
        best: tuple[float, dict | None] = (1e9, None)
        for poi in geo["pois"]:
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
            if poi.get("name"):
                name = poi["name"]
            assigned_pois.add(poi["id"])

        street = street_names.get((cx // 12, cy // 12))
        if not name and street:
            street_count[street] = street_count.get(street, 0) + 1
            name = f"{street} {street_count[street]}"

        # I lotti molto estesi sono edifici pubblici, scuole o capannoni:
        # assegnare 3-4 piani a 1.000 m² di impronta produrrebbe facciate
        # alte e irreali. La stima resta dichiarata come approssimazione.
        if area > 700 or (area > 400 and width > 34):
            floors = 1
        elif area > 180 or width > 34:
            floors = 2
        elif area > 80:
            floors = 3
        else:
            floors = 2
        # Facciata nativa più vicina all'ingombro OSM in metri: nessuno
        # stiramento e al massimo 2 m di scarto sui lotti più stretti.
        facade = min(FACADE_WIDTHS, key=lambda candidate: abs(candidate / 16 - width))
        variant = rng.randrange(4)
        if kind in {"cafe", "bar", "restaurant", "gelateria", "pescheria"}:
            variant = 3
        entry_x, entry_y = entrance_tile(footprint, roads, cx, cy)

        for x, y in footprint:
            ground[y][x] = PAVING_GID
            collision[y][x] = 1
            occupied.add((x, y))
        add_place(
            places, name or f"Casa {len(places) + 1}", kind, entry_x, entry_y,
            footprint, floors=floors, facadeWidth=facade, variant=variant,
            meters={ "width": width, "depth": depth, "area": area },
            source="OSM building polygon; piani stimati dall'area (tag building:levels assente)",
        )

    # POI senza edificio associato: segnaposto, non edifici inventati.
    for poi in geo["pois"]:
        if poi["id"] in assigned_pois:
            continue
        lat, lon = poi.get("lat"), poi.get("lon")
        if lat is None or lon is None:
            continue
        x, y = to_tile(lat, lon)
        if not (0 <= x < TW and 0 <= y < TH):
            continue
        kind = OSM_KIND.get(poi.get("kind", ""), "shop")
        if poi.get("name"):
            add_place(places, poi["name"], kind, x, y, marker=True,
                      source="OSM POI; posizione puntuale, nessun edificio inventato")

    # Piazzetta sul mare e servizi necessari alle meccaniche esistenti.
    add_place(places, "Piazzetta sul mare", "beach", *to_tile(40.80170, 14.08134),
              marker=True, source="coordinate verificate")
    add_place(places, "Villa Comunale", "beach", *to_tile(40.80360, 14.07950),
              marker=True, source="coordinate verificate")
    for name, kind, lat, lon, note in (
        ("Gelateria Piazzetta", "gelateria", 40.80170, 14.08134, "coordinata verificata"),
        ("Centro consegne Bacoli", "delivery", 40.80100, 14.08060,
         "posizione approssimata nel centro; servizio non georeferenziato"),
        ("Garage comunale", "garage", 40.80240, 14.07910,
         "posizione approssimata nel centro; servizio non georeferenziato"),
        ("Pescheria del centro", "pescheria", 40.80280, 14.08110,
         "posizione approssimata nel centro; attività non georeferenziata"),
    ):
        tx, ty = to_tile(lat, lon)
        sx, sy = nearest_tile(tx, ty, roads) or (tx, ty)
        add_place(places, name, kind, sx, sy, marker=True, source=note)

    # Pavimentazione finale: maschere di adiacenza, cordoli, attraversamenti pedonali e
    # segnaletica orizzontale derivata dalle geometrie OSM, non da pattern casuali.
    paving_counts = PAVE.paint(
        ground, collision, TW, TH, road_tiles, sidewalks, water_tiles,
        road_hints, 20261124,
    )
    classes = PAVE.rebuild_classes(ground, TW, TH)
    PAVE.write_roads(OUT, TW, TH, classes)

    # Fiori: solo su prato, mai sopra strade o edifici.
    for i in range(0, TW * TH, 53):
        x, y = (i * 17) % TW, (i * 29) % TH
        if ground[y][x] in (GRASS, GRASS2) and rng.random() < 0.14:
            ground[y][x] = FLOWERS

    # Spawn su Via Spiaggia, controllando lo spazio libero intorno al giocatore.
    target = to_tile(40.80170, 14.08134)
    candidates = sorted(roads, key=lambda p: (p[0] - target[0]) ** 2 + (p[1] - target[1]) ** 2)
    spawn = target
    for tx, ty in candidates:
        if all(not collision[yy][xx]
               for xx, yy in ((tx, ty), (tx - 1, ty), (tx + 1, ty),
                              (tx, ty - 1), (tx, ty + 1))):
            spawn = (tx, ty)
            break

    layers = []
    for index, (layer_name, data) in enumerate((("ground", ground), ("collision", collision))):
        layers.append({
            "data": [cell for row in data for cell in row],
            "height": TH, "id": index + 1, "name": layer_name, "opacity": 1,
            "type": "tilelayer", "visible": layer_name == "ground", "width": TW, "x": 0, "y": 0,
        })
    tiled = {
        "compressionlevel": -1, "height": TH, "width": TW, "infinite": False,
        "layers": layers, "nextlayerid": 3, "nextobjectid": 1,
        "orientation": "orthogonal", "renderorder": "right-down",
        "tiledversion": "1.11.0", "tileheight": TILE, "tilewidth": TILE,
        "tilesets": [{
            "columns": 16, "firstgid": 1, "image": "tileset.png",
            "imageheight": 256, "imagewidth": 256, "margin": 0, "name": "base",
            "spacing": 0, "tilecount": 256, "tileheight": TILE, "tilewidth": TILE,
        }],
        "type": "map", "version": "1.10",
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "ground.bin").write_bytes(bytes(cell for row in ground for cell in row))
    packed = bytearray((TW * TH + 7) // 8)
    for index, row in enumerate(collision):
        for x, value in enumerate(row):
            if value:
                bit = index * TW + x
                packed[bit >> 3] |= 1 << (bit & 7)
    (OUT / "collision.bin").write_bytes(bytes(packed))
    (OUT / "meta.json").write_text(json.dumps({
        "width": TW, "height": TH, "tileWidth": TILE, "tileHeight": TILE,
        "tilesetName": "base", "tilesetKey": "tiles16", "firstGid": 1,
        "metersPerPixel": 1 / 16, "metersPerTile": 1,
        "bounds": {"south": LAT_S, "north": LAT_N, "west": LON_W, "east": LON_E},
        "projection": "equirectangular locale, 1 tile = 1 metro",
        "solidTiles": sum(sum(row) for row in collision),
    }, indent=1), encoding="utf-8")
    TILED_OUT.parent.mkdir(parents=True, exist_ok=True)
    TILED_OUT.write_text(json.dumps(tiled, separators=(",", ":")), encoding="utf-8")
    DATA_OUT.write_text(json.dumps({
        "bounds": {"south": LAT_S, "north": LAT_N, "west": LON_W, "east": LON_E},
        "scale": {"metersPerPixel": 1 / 16, "metersPerTile": 1,
                  "adultHeightPx": 28, "floorHeightPx": 52},
        "size": {"width": TW, "height": TH},
        "spawn": {"x": spawn[0], "y": spawn[1]},
        "places": places,
        "roadTileCount": len(roads),
        "buildingCount": sum(1 for p in places if p.get("bounds")),
        "sources": [
            "OpenStreetMap via Overpass: edifici, strade e POI del centro storico",
            "https://www.openstreetmap.org/search?query=Bacoli",
            "https://overpass-turbo.eu/",
            "https://geoportale.urba.cloud/maps/Stradario%20-%20Comune%20di%20Bacoli/viewer/",
            "https://commons.wikimedia.org/wiki/Category:Bacoli",
            "https://comune.bacoli.na.it/vivere-il-comune/galleria-fotografica/",
            "OSM coastline già verificata nel progetto (EAST_COAST)",
            "docs/NEW_ASSETS_ANALYSIS.json per i materiali fotografici forniti",
        ],
        "approximations": [
            "building:levels e height assenti negli edifici OSM dell'area: piani stimati dall'area dell'impronta",
            "nuova query coastline Overpass in timeout (HTTP 504): usata la sagoma già verificata",
            "garage, consegne e pescheria centrali sono segnaposto approssimati, dichiarati per place",
        ],
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(
        f"centro metrico {TW}x{TH} tile = {TW}m x {TH}m: "
        f"{len(roads)} tile strada, {len(places)} luoghi, "
        f"{sum(1 for p in places if p.get('bounds'))} edifici reali, spawn {spawn}"
    )


if __name__ == "__main__":
    main()
