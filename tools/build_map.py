"""Costruisce la mappa Tiled JSON della prima zona di BACOLI LIFE.

La geometria stradale e gli edifici derivano dai dati reali OpenStreetMap
recuperati da tools/osm_to_map.py. La scala è adattata al gameplay:
un tile corrisponde approssimativamente a 4 metri.

Uso: python tools/build_map.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "src" / "data" / "bacoli_geo.json"
MAP_OUT = ROOT / "public" / "assets" / "maps" / "bacoli.json"
PLACES_OUT = ROOT / "src" / "data" / "bacoli_places.json"

# Riquadro della fase 1: Via Ortensio, Via Spiaggia, centro storico costiero.
S, N = 40.7998, 40.8056
W, E = 14.0778, 14.0848
TW, TH = 160, 120

# Gid del tileset (firstgid = 1).
GRASS, GRASS2, SAND, SAND2, COBBLE, COBBLE2, ASPHALT, PAVING = 1, 2, 3, 4, 5, 6, 7, 8
WATER0, WATER1, WATER2, WATER3, FOAM, WALL, ROOF, FLOWERS = 9, 10, 11, 12, 13, 14, 15, 16


def to_tile(lat: float, lon: float) -> tuple[int, int]:
    x = int((lon - W) / (E - W) * (TW - 1))
    y = int((N - lat) / (N - S) * (TH - 1))
    return max(0, min(TW - 1, x)), max(0, min(TH - 1, y))


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


def inside_polygon(x: int, y: int, poly: list[tuple[int, int]]) -> bool:
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
    minx, maxx = min(p[0] for p in poly), max(p[0] for p in poly)
    miny, maxy = min(p[1] for p in poly), max(p[1] for p in poly)
    out = set()
    for y in range(miny, maxy + 1):
        for x in range(minx, maxx + 1):
            if inside_polygon(x + 0.5, y + 0.5, poly):
                out.add((x, y))
    return out


def main() -> None:
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    ground = [[GRASS if (x + y) % 7 else GRASS2 for x in range(TW)] for y in range(TH)]
    collision = [[0 for _ in range(TW)] for _ in range(TH)]
    road_tiles: set[tuple[int, int]] = set()

    # Costiera: il mare a sud della linea di costa, poco sotto Via Spiaggia
    # (40.8017 N), con una leggera curvaturea naturale.
    for x in range(TW):
        coast = int((N - 40.8012) / (N - S) * (TH - 1) + 2 * math.sin(x * 0.05))
        for y in range(max(0, coast), TH):
            dist = y - coast
            if dist == 0:
                ground[y][x] = FOAM
            elif dist < 3:
                ground[y][x] = (WATER0, WATER1, WATER2, WATER3)[(x + y) % 4]
            else:
                ground[y][x] = (WATER0, WATER1, WATER2, WATER3)[(x // 2 + y) % 4]
            collision[y][x] = 1
        for y in range(max(0, coast - 3), coast):
            ground[y][x] = SAND if (x + y) % 5 else SAND2

    # Strade reali da OSM.
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

    # Edifici reali da OSM: footprint rasterizzato + sprite associates.
    places: list[dict] = []
    building_footprints: set[tuple[int, int]] = set()
    for i, b in enumerate(geo["buildings"]):
        geom = b.get("geometry") or []
        if len(geom) < 4:
            continue
        poly = [to_tile(p["lat"], p["lon"]) for p in geom]
        tiles = fill_polygon(poly)
        if not tiles:
            continue
        building_footprints |= tiles
        cx = sum(x for x, _ in tiles) // len(tiles)
        cy = sum(y for _, y in tiles) // len(tiles)
        for x, y in tiles:
            ground[y][x] = PAVING
            collision[y][x] = 1

        # Tipo di attività: usa i POI OSM più vicini al footprint.
        best: tuple[float, dict | None] = (1e9, None)
        for poi in geo["pois"]:
            if poi.get("lat") is None or poi.get("lon") is None:
                continue
            px, py = to_tile(poi["lat"], poi["lon"])
            dist = (px - cx) ** 2 + (py - cy) ** 2
            if dist < best[0]:
                best = (dist, poi)
        poi = best[1] if best[0] < 36 else None
        name = b.get("name") or (poi or {}).get("name") or f"Casa {i + 1}"
        kind = (poi or {}).get("kind", "home")
        if kind not in ("cafe", "bar", "restaurant", "shop", "pharmacy", "fuel", "bank", "post_office", "archaeological_site"):
            kind = "home"
        sprite = {"cafe": 2, "bar": 2, "restaurant": 2, "shop": 4, "pharmacy": 4,
                  "fuel": 4, "bank": 1, "post_office": 1, "archaeological_site": 3,
                  "home": 0 if i % 3 else 1}.get(kind, 0)
        places.append({
            "id": f"b{i}", "name": name, "kind": kind,
            "x": cx, "y": cy, "sprite": sprite,
            "footprint": sorted(tiles),
        })

    # POI significativi fuori dagli edifici (monumenti, spiagge, stazioni).
    for i, poi in enumerate(geo["pois"]):
        kind = poi.get("kind", "")
        if kind not in ("archaeological_site", "beach", "railway", "fuel"):
            continue
        if poi.get("lat") is None or poi.get("lon") is None:
            continue
        x, y = to_tile(poi["lat"], poi["lon"])
        if not (0 <= x < TW and 0 <= y < TH):
            continue
        places.append({
            "id": f"p{i}", "name": poi.get("name") or kind, "kind": kind,
            "x": x, "y": y, "sprite": 3 if kind == "archaeological_site" else 5,
            "footprint": [],
        })

    # Piazzetta con affaccio sul mare, poco a nord della costa.
    plaza_cx, plaza_cy = 84, 83
    for y in range(plaza_cy - 3, plaza_cy + 3):
        for x in range(plaza_cx - 4, plaza_cx + 5):
            if 0 <= x < TW and 0 <= y < TH and ground[y][x] not in (FOAM, WATER0, WATER1, WATER2, WATER3):
                ground[y][x] = PAVING if (x + y) % 5 else COBBLE2
                collision[y][x] = 0
    places.append({
        "id": "piazzetta-mare", "name": "Piazzetta sul mare", "kind": "beach",
        "x": plaza_cx, "y": plaza_cy, "sprite": 5, "footprint": [],
    })

    # Spawn del giocatore: una strada libera vicina a Via Spiaggia.
    target = to_tile(40.8017, 14.08134)
    candidates = sorted(
        ((x - target[0]) ** 2 + (y - target[1]) ** 2, x, y)
        for x, y in road_tiles
        if collision[y][x] == 0 and (x, y) not in building_footprints
    )
    spawn = {"x": candidates[0][1], "y": candidates[0][2]} if candidates else {"x": 80, "y": 60}

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
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"mappa {TW}x{TH} generata: {len(road_tiles)} tile strada, {len(places)} luoghi, spawn {spawn}")


if __name__ == "__main__":
    main()
