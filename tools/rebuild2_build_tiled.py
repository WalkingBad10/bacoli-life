"""Genera la mappa Tiled multilivello della zona campione da GeoJSON OSM metrici.

La mappa prodotta è la sorgente unica usata a runtime: ground, road_marks, decals,
object layer con impronte OSM, buffer di collisione e classi stradali. Nessuna strada casuale.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from PIL import Image, ImageDraw
from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "rebuild2" / "data"
OUT_MAP = ROOT / "public" / "rebuild2" / "maps" / "sample"
OUT_ASSETS = ROOT / "public" / "rebuild2" / "assets"
TILE_PX = 16
PX_PER_M = 16
SIDEWALK_M = 2.0

# GID: sorgente unica, esportata anche in gid_manifest.json.
GID = {
    "empty": 1,
    "asphalt": 2,
    "basolato": 3,
    "sidewalk": 4,
    "building": 5,
    "sand": 6,
    "grass": 7,
    "water": 8,
    "crosswalk": 9,
    "lane_dash": 10,
    "parking": 11,
    "shadow": 12,
    "roof": 13,
    "wall": 14,
    "manhole": 15,
    "curb": 16,
}
# 16 varianti di bordo marciapiede: 4 + maschera N/E/S/W (bit 1/2/4/8).
SIDEWALK_BASE = 16
ROAD_CLASS = {"asphalt": 1, "basolato": 2, "sidewalk": 3, "sand": 4, "empty": 0}


def build_tileset() -> None:
    OUT_ASSETS.mkdir(parents=True, exist_ok=True)
    count = SIDEWALK_BASE + 16
    image = Image.new("RGBA", (TILE_PX * count, TILE_PX), (0, 0, 0, 0))
    rng = np.random.default_rng(20261125)
    colors = {
        1: (222, 215, 198), 2: (112, 110, 106), 3: (88, 87, 83),
        5: (198, 180, 155), 6: (208, 190, 148), 7: (112, 130, 96), 8: (66, 116, 150),
    }
    for gid, color in colors.items():
        x = (gid - 1) * TILE_PX
        draw = ImageDraw.Draw(image)
        draw.rectangle((x, 0, x + TILE_PX - 1, TILE_PX - 1), fill=color + (255,))
        for _ in range(14):
            dx = int(rng.integers(0, TILE_PX))
            dy = int(rng.integers(0, TILE_PX))
            delta = int(rng.integers(-8, 9))
            shade = tuple(max(0, min(255, c + delta)) for c in color) + (255,)
            draw.point((x + dx, dy), fill=shade)
        if gid == 3:  # basolato: giunti regolari
            for offset in (0, 8):
                draw.line((x + offset, 0, x + offset, 15), fill=(64, 63, 60, 255))
                draw.line((x, offset, x + 15, offset), fill=(64, 63, 60, 255))
        if gid == 8:
            for offset in (3, 9):
                draw.line((x + 1, offset, x + 6, offset), fill=(96, 148, 176, 255))
    draw = ImageDraw.Draw(image)
    x = (GID["crosswalk"] - 1) * TILE_PX
    for stripe in range(0, 16, 4):
        draw.rectangle((x + stripe, 2, x + stripe + 2, 13), fill=(232, 228, 216, 255))
    x = (GID["lane_dash"] - 1) * TILE_PX
    draw.rectangle((x + 6, 1, x + 9, 14), fill=(218, 202, 132, 255))
    x = (GID["parking"] - 1) * TILE_PX
    draw.line((x + 3, 1, x + 3, 14), fill=(222, 218, 206, 255))
    draw.line((x + 3, 14, x + 12, 14), fill=(222, 218, 206, 255))
    x = (GID["shadow"] - 1) * TILE_PX
    draw.ellipse((x + 2, 5, x + 13, 11), fill=(52, 48, 44, 96))
    x = (GID["roof"] - 1) * TILE_PX
    draw.rectangle((x, 0, x + 15, 15), fill=(168, 88, 66, 255))
    for offset in (0, 5, 10, 15):
        draw.line((x + offset, 0, x + offset, 15), fill=(128, 62, 48, 255))
    x = (GID["wall"] - 1) * TILE_PX
    draw.rectangle((x, 0, x + 15, 15), fill=(184, 166, 142, 255))
    x = (GID["manhole"] - 1) * TILE_PX
    draw.ellipse((x + 4, 4, x + 11, 11), outline=(72, 70, 66, 255), width=1)
    x = (GID["curb"] - 1) * TILE_PX
    draw.rectangle((x, 0, x + 15, 2), fill=(150, 146, 136, 255))
    for mask in range(16):
        gid = SIDEWALK_BASE + mask
        x = (gid - 1) * TILE_PX
        draw.rectangle((x, 0, x + 15, 15), fill=(176, 170, 158, 255))
        if mask & 1:
            draw.rectangle((x, 0, x + 15, 2), fill=(150, 144, 134, 255))
        if mask & 2:
            draw.rectangle((x + 14, 0, x + 15, 15), fill=(150, 144, 134, 255))
        if mask & 4:
            draw.rectangle((x, 14, x + 15, 15), fill=(150, 144, 134, 255))
        if mask & 8:
            draw.rectangle((x, 0, x + 1, 15), fill=(150, 144, 134, 255))
    image.save(OUT_ASSETS / "tileset.png")
    manifest = {
        "tilewidth": TILE_PX,
        "tileheight": TILE_PX,
        "firstgid": 1,
        "gid": GID,
        "sidewalk_base": SIDEWALK_BASE,
        "road_class": ROAD_CLASS,
        "note": "Il runtime deve leggere questo manifest: nessun intervallo GID scritto a mano.",
    }
    (OUT_ASSETS / "gid_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main() -> None:
    OUT_MAP.mkdir(parents=True, exist_ok=True)
    build_tileset()
    buildings = gpd.read_file(DATA / "sample_buildings.geojson")
    roads = gpd.read_file(DATA / "sample_roads.geojson")
    places = gpd.read_file(DATA / "sample_places.geojson")
    landcover = gpd.read_file(DATA / "sample_landcover.geojson")
    xmin, ymin, xmax, ymax = buildings.total_bounds
    width = math.ceil((xmax - xmin) * PX_PER_M / TILE_PX)
    height = math.ceil((ymax - ymin) * PX_PER_M / TILE_PX)

    road_polys = roads.copy()
    road_polys["geometry"] = roads.apply(
        lambda row: row.geometry.buffer(max(1.0, row.width_m / 2), cap_style=2, join_style=2), axis=1
    )
    sidewalk_polys = roads.copy()
    sidewalk_polys["geometry"] = roads.apply(
        lambda row: row.geometry.buffer(max(1.0, row.width_m / 2) + SIDEWALK_M, cap_style=2, join_style=2), axis=1
    )

    points = []
    xs = xmin + (np.arange(width) + 0.5) * TILE_PX / PX_PER_M
    ys = ymax - (np.arange(height) + 0.5) * TILE_PX / PX_PER_M
    for y in ys:
        for x in xs:
            points.append(Point(x, y))
    points_gdf = gpd.GeoDataFrame(geometry=points, crs=buildings.crs)

    def classify(polygons: gpd.GeoDataFrame, column: str | None = None) -> gpd.GeoDataFrame:
        columns = ["geometry"] + ([column] if column else [])
        joined = gpd.sjoin(points_gdf, polygons[columns], how="left", predicate="within")
        return joined[~joined.index.duplicated(keep="first")].reindex(points_gdf.index)

    road_join = classify(road_polys, "kind")
    sidewalk_join = classify(sidewalk_polys)
    building_join = classify(buildings)

    # La costa OSM è una striscia sottile: il centro del tile può cadere fuori
    # anche quando il tile è attraversato. Rasterizziamo i poligoni a risoluzione
    # di tile, così ogni tile toccato conserva la classe reale senza clamp.
    land_image = Image.new("L", (width * TILE_PX, height * TILE_PX), 0)
    land_draw = ImageDraw.Draw(land_image)
    # La spiaggia va disegnata per ultima: l'area residenziale OSM sovrappone
    # la stessa costa e non deve cancellare la classe sabbia.
    ordered_landcover = landcover.iloc[np.argsort(landcover["kind"].eq("beach").to_numpy())]
    for _, row in ordered_landcover.iterrows():
        fill = 1 if row["kind"] == "beach" else 2
        coords = []
        if row.geometry.geom_type == "Polygon":
            coords = list(row.geometry.exterior.coords)
        elif row.geometry.geom_type == "MultiPolygon":
            coords = list(max(row.geometry.geoms, key=lambda item: item.area).exterior.coords)
        points_px = [
            (int((x - xmin) * PX_PER_M), int((ymax - y) * PX_PER_M))
            for x, y in coords
        ]
        if len(points_px) >= 3:
            land_draw.polygon(points_px, fill=fill)
    land_pixels = np.asarray(land_image).reshape(height, TILE_PX, width, TILE_PX)
    # Un tile prende la classe se almeno un pixel della costa lo attraversa.
    beach_mask = land_pixels.max(axis=(1, 3)) == 1
    other_mask = land_pixels.max(axis=(1, 3)) == 2
    land_mask = np.where(beach_mask, 1, np.where(other_mask, 2, 0)).reshape(-1)

    ground = [GID["empty"]] * (width * height)
    road_class = [0] * (width * height)
    solid = [0] * (width * height)
    for i in range(width * height):
        if land_mask[i] == 1:
            ground[i] = GID["sand"]
            road_class[i] = ROAD_CLASS["sand"]
        elif land_mask[i] == 2:
            ground[i] = GID["grass"]
            road_class[i] = ROAD_CLASS["empty"]
        if pd.notna(sidewalk_join.at[i, "index_right"]):
            ground[i] = GID["sidewalk"]
            road_class[i] = ROAD_CLASS["sidewalk"]
        if pd.notna(road_join.at[i, "index_right"]):
            kind = road_join.at[i, "kind"]
            surface = "basolato" if kind in {"pedestrian", "service", "footway", "steps", "path"} else "asphalt"
            ground[i] = GID[surface]
            road_class[i] = ROAD_CLASS[surface]
        if pd.notna(building_join.at[i, "index_right"]):
            ground[i] = GID["building"]
            road_class[i] = 0
            solid[i] = 1

    # Maschera di adiacenza per i bordi marciapiede: N=1 E=2 S=4 W=8.
    for row in range(height):
        for col in range(width):
            i = row * width + col
            if ground[i] != GID["sidewalk"]:
                continue
            mask = 0
            for bit, nr, nc in ((1, row - 1, col), (2, row, col + 1), (4, row + 1, col), (8, row, col - 1)):
                if 0 <= nr < height and 0 <= nc < width:
                    neighbor = ground[nr * width + nc]
                    if neighbor in {GID["asphalt"], GID["basolato"]}:
                        mask |= bit
            ground[i] = SIDEWALK_BASE + mask

    marks = [0] * (width * height)
    for idx, row in roads.iterrows():
        line = row.geometry
        length = line.length
        step = 8 / PX_PER_M
        distance = 0.0
        while distance < length:
            point = line.interpolate(distance)
            col = int((point.x - xmin) * PX_PER_M / TILE_PX)
            row_i = int((ymax - point.y) * PX_PER_M / TILE_PX)
            if 0 <= col < width and 0 <= row_i < height:
                i = row_i * width + col
                if road_class[i] == ROAD_CLASS["asphalt"]:
                    marks[i] = GID["lane_dash"]
            distance += step

    decals = [0] * (width * height)
    for idx, place in places.iterrows():
        geometry = place.geometry
        if geometry.geom_type != "Point":
            continue
        col = int((geometry.x - xmin) * PX_PER_M / TILE_PX)
        row_i = int((ymax - geometry.y) * PX_PER_M / TILE_PX)
        if 0 <= col < width and 0 <= row_i < height:
            decals[row_i * width + col] = GID["shadow"]

    def tile_layer(name: str, data: list[int]) -> dict:
        return {
            "type": "tilelayer", "name": name, "width": width, "height": height,
            "tilewidth": TILE_PX, "tileheight": TILE_PX,
            "encoding": "csv", "data": data, "visible": True, "opacity": 1,
        }

    objects = []
    for _, row in buildings.iterrows():
        polygon = row.geometry
        points_px = [{"x": round((x - xmin) * PX_PER_M, 1), "y": round((ymax - y) * PX_PER_M, 1)} for x, y in polygon.exterior.coords]
        objects.append({
            "id": int(row.osm_id), "name": row.get("name", "") or "edificio", "type": "building",
            "polygon": points_px[:-1],
            "properties": {"osm_id": row.osm_id, "kind": row.kind, "levels": int(row.levels or 0)},
        })
    for _, row in places.iterrows():
        geometry = row.geometry
        if geometry.geom_type != "Point":
            continue
        objects.append({
            "id": int(row.osm_id) + 100000, "name": row.get("name", "") or row.kind, "type": "poi",
            "x": (geometry.x - xmin) * PX_PER_M,
            "y": (ymax - geometry.y) * PX_PER_M,
            "width": 16, "height": 16,
            "properties": {"osm_id": row.osm_id, "kind": row.kind},
        })

    tiled = {
        "type": "map", "version": "1.10", "orientation": "orthogonal", "renderorder": "right-down",
        "width": width, "height": height, "tilewidth": TILE_PX, "tileheight": TILE_PX,
        "infinite": False, "nextlayerid": 5, "nextobjectid": max(o["id"] for o in objects) + 1,
        "properties": [
            {"name": "crs", "type": "string", "value": "EPSG:32633"},
            {"name": "origin_x", "type": "float", "value": float(xmin)},
            {"name": "origin_y", "type": "float", "value": float(ymax)},
            {"name": "meters_per_pixel", "type": "float", "value": 1 / PX_PER_M},
        ],
        "tilesets": [{"firstgid": 1, "source": "tileset.png", "name": "rebuild2", "tilewidth": TILE_PX, "tileheight": TILE_PX, "columns": SIDEWALK_BASE + 16, "tilecount": SIDEWALK_BASE + 16, "image": "tileset.png", "imagewidth": (SIDEWALK_BASE + 16) * TILE_PX, "imageheight": TILE_PX}],
        "layers": [
            tile_layer("ground", ground),
            tile_layer("road_marks", marks),
            tile_layer("decals", decals),
            {"type": "objectgroup", "name": "footprints", "draworder": "index", "objects": objects},
        ],
    }
    (OUT_MAP / "sample.tiled.json").write_text(json.dumps(tiled, separators=(",", ":")), encoding="utf-8")
    (OUT_MAP / "collision.bin").write_bytes(bytes(solid))
    (OUT_MAP / "roads.bin").write_bytes(bytes(road_class))
    (OUT_MAP / "meta.json").write_text(json.dumps({
        "width": width, "height": height, "tile_px": TILE_PX, "px_per_m": PX_PER_M,
        "origin_x": float(xmin), "origin_y": float(ymax),
        "buildings": len(buildings), "roads": len(roads), "pois": len(places),
        "gid_manifest": "assets/gid_manifest.json",
    }, indent=2), encoding="utf-8")

    summary = {
        "tiles": width * height,
        "grid": [width, height],
        "solid_tiles": sum(solid),
        "road_tiles": sum(1 for value in road_class if value in (1, 2)),
        "sidewalk_tiles": sum(1 for value in road_class if value == 3),
        "objects": len(objects),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
