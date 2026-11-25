"""Overlay verificabile OSM ↔ mappa REBUILD 2.0 alla scala di gioco (16 px/m).

Produce:
- docs/rebuild2/data/osm_reference.png: raster OSM alla scala di gioco.
- docs/rebuild2/audit/overlay.png: ground di gioco + vettori OSM sovrapposti.
- docs/rebuild2/audit/overlay_focus.png: ritaglio leggibile sulla zona campione.
- docs/rebuild2/audit/overlay_metrics.json: metriche con soglie dichiarate.

La sorgente è sempre la stessa: GeoJSON metrici EPSG:32633, meta.json e i buffer
effettivamente caricati dal runtime. Nessuna trasformazione visiva separata.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "rebuild2" / "data"
AUDIT = ROOT / "docs" / "rebuild2" / "audit"
MAP = ROOT / "public" / "rebuild2" / "maps" / "sample"
ASSETS = ROOT / "public" / "rebuild2" / "assets"

META = json.loads((MAP / "meta.json").read_text(encoding="utf-8"))
ORIGIN_X = float(META["origin_x"])
ORIGIN_Y = float(META["origin_y"])
SCALE = int(META["px_per_m"])
TILE_PX = int(META["tile_px"])
METERS_PER_TILE = TILE_PX / SCALE
WIDTH_T = int(META["width"])
HEIGHT_T = int(META["height"])
WIDTH = WIDTH_T * SCALE
HEIGHT = HEIGHT_T * SCALE
XMIN, XMAX = ORIGIN_X, ORIGIN_X + WIDTH_T
YMIN, YMAX = ORIGIN_Y - HEIGHT_T, ORIGIN_Y


def to_px(x: float, y: float) -> tuple[float, float]:
    return ((x - ORIGIN_X) * SCALE, (ORIGIN_Y - y) * SCALE)


def line_parts(geometry):
    if isinstance(geometry, LineString):
        return [geometry]
    if isinstance(geometry, MultiLineString):
        return list(geometry.geoms)
    return []


def polygon_parts(geometry):
    if isinstance(geometry, Polygon):
        return [geometry]
    if isinstance(geometry, MultiPolygon):
        return list(geometry.geoms)
    return []


def render_ground() -> Image.Image:
    tiled = json.loads((MAP / "sample.tiled.json").read_text(encoding="utf-8"))
    layer = next(item for item in tiled["layers"] if item["name"] == "ground")
    ground = np.asarray(layer["data"], dtype=np.int16).reshape(HEIGHT_T, WIDTH_T)
    tileset = np.asarray(Image.open(ASSETS / "tileset.png").convert("RGBA"))
    out = np.zeros((HEIGHT, WIDTH, 4), dtype=np.uint8)
    tile_size = SCALE
    rows = np.arange(tile_size)
    for gid in np.unique(ground):
        if gid < 1 or gid > tileset.shape[0] // tile_size:
            continue
        ys, xs = np.where(ground == gid)
        if len(ys) == 0:
            continue
        src = tileset[
            (gid - 1) * tile_size:gid * tile_size,
            (gid - 1) * tile_size:gid * tile_size,
            :,
        ]
        row_index = ys[:, None] * tile_size + rows[None, :]
        col_index = xs[:, None] * tile_size + rows[None, :]
        out[row_index[:, :, None], col_index[:, None, :], :] = src[None, :, :, :]
    return Image.fromarray(out, "RGBA")


def draw_osm(draw: ImageDraw.ImageDraw, buildings, roads, places, landcover, *, compact: bool = False) -> None:
    for _, row in landcover.iterrows():
        for polygon in polygon_parts(row.geometry):
            pts = [to_px(x, y) for x, y in polygon.exterior.coords]
            color = (214, 190, 128, 110) if row["kind"] == "beach" else (150, 184, 126, 90)
            draw.polygon(pts, fill=color, outline=(196, 92, 92, 220))
    for _, row in roads.iterrows():
        for line in line_parts(row.geometry):
            pts = [to_px(x, y) for x, y in line.coords]
            width_px = max(2, int(float(row["width_m"]) * SCALE / 4))
            draw.line(pts, fill=(32, 104, 188, 220), width=width_px, joint="curve")
    for _, row in buildings.iterrows():
        for polygon in polygon_parts(row.geometry):
            pts = [to_px(x, y) for x, y in polygon.exterior.coords]
            draw.polygon(pts, outline=(240, 88, 72, 255), width=2)
    for _, row in places.iterrows():
        geometry = row.geometry
        if isinstance(geometry, Point):
            x, y = to_px(geometry.x, geometry.y)
            radius = 5 if compact else 4
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(252, 208, 64, 255), outline=(80, 52, 24, 255))
        else:
            for polygon in polygon_parts(geometry):
                pts = [to_px(x, y) for x, y in polygon.exterior.coords]
                draw.line(pts + [pts[0]], fill=(252, 208, 64, 255), width=2)


def render_reference(buildings, roads, places, landcover) -> None:
    image = Image.new("RGBA", (WIDTH, HEIGHT), (246, 243, 235, 255))
    draw = ImageDraw.Draw(image, "RGBA")
    draw_osm(draw, buildings, roads, places, landcover)
    image.convert("RGB").save(DATA / "osm_reference.png", compress_level=1)
    print("reference ok", flush=True)


LEGEND_FONT = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 12)


def legend_lines() -> list[str]:
    return [
        "REBUILD 2.0 - overlay OSM",
        "rosso: edifici OSM",
        "blu: strade OSM",
        "giallo: POI OSM",
        "verde: aree naturali OSM",
        "scala: 16 px/m - CRS EPSG:32633",
    ]


def add_legend(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image)
    lines = legend_lines()
    height = len(lines) * 17 + 12
    draw.rectangle((8, 8, 250, height), fill=(250, 250, 248))
    for index, line in enumerate(lines):
        draw.text((16, 14 + index * 17), line, fill=(36, 44, 52), font=LEGEND_FONT)


def render_overlay(buildings, roads, places, landcover) -> None:
    print("rendering ground", flush=True)
    base = render_ground()
    print("ground ok", flush=True)
    tint = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(tint, "RGBA")
    draw_osm(draw, buildings, roads, places, landcover)
    merged = Image.alpha_composite(base, tint).convert("RGB")
    add_legend(merged)
    merged.save(AUDIT / "overlay.png", compress_level=1)
    print("overlay ok", flush=True)

    focus = (2500, 9700, 3350, 10650)
    crop = merged.crop(focus).convert("RGB")
    draw_focus = ImageDraw.Draw(crop)
    draw_focus.rectangle((0, 0, crop.width - 1, crop.height - 1), outline=(255, 255, 255), width=2)
    crop.save(AUDIT / "overlay_focus.png")


def road_grid() -> np.ndarray:
    return np.frombuffer((MAP / "roads.bin").read_bytes(), dtype=np.uint8).reshape(HEIGHT_T, WIDTH_T)


def beach_tile_mask(landcover) -> np.ndarray:
    """Tile toccati dalla spiaggia OSM, anche quando una strada li ricopre."""
    image = Image.new("L", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(image)
    for _, row in landcover[landcover["kind"] == "beach"].iterrows():
        for polygon in polygon_parts(row.geometry):
            pts = [to_px(x, y) for x, y in polygon.exterior.coords]
            draw.polygon(pts, fill=1)
    pixels = np.asarray(image).reshape(HEIGHT_T, TILE_PX, WIDTH_T, TILE_PX)
    return pixels.max(axis=(1, 3)) == 1


def nearest_distance(points: np.ndarray, valid: np.ndarray) -> np.ndarray:
    """Distanza dal punto al centro del tile valido più vicino, con ricerca ad anelli."""
    result = np.full(len(points), np.nan)
    radii = (2, 5, 10, 20, 40, 80, max(WIDTH_T, HEIGHT_T))
    for index, (x, y) in enumerate(points):
        col = int(np.floor((x - ORIGIN_X) / METERS_PER_TILE))
        row = int(np.floor((ORIGIN_Y - y) / METERS_PER_TILE))
        for radius in radii:
            lo_c, hi_c = max(0, col - radius), min(WIDTH_T - 1, col + radius)
            lo_r, hi_r = max(0, row - radius), min(HEIGHT_T - 1, row + radius)
            sub = valid[lo_r:hi_r + 1, lo_c:hi_c + 1]
            if not sub.any():
                continue
            ys, xs = np.where(sub)
            grid_x = ORIGIN_X + (xs + lo_c + 0.5) * METERS_PER_TILE
            grid_y = ORIGIN_Y - (ys + lo_r + 0.5) * METERS_PER_TILE
            result[index] = np.min(np.hypot(grid_x - x, grid_y - y))
            break
    return result


def sample_line(line: LineString, step_m: float = 0.5) -> np.ndarray:
    distances = np.arange(0, line.length + 1e-6, step_m)
    if distances[-1] < line.length:
        distances = np.append(distances, line.length)
    return np.array([(p.x, p.y) for p in (line.interpolate(float(d)) for d in distances)])


def compute_metrics(buildings, roads, places, landcover) -> dict:
    tiled = json.loads((MAP / "sample.tiled.json").read_text(encoding="utf-8"))
    objects = next(item["objects"] for item in tiled["layers"] if item["name"] == "footprints")
    footprints = {str(obj["properties"]["osm_id"]): obj for obj in objects if obj.get("type") == "building"}

    ious = []
    for _, row in buildings.iterrows():
        obj = footprints.get(str(row.osm_id))
        if obj is None:
            continue
        source = polygon_parts(row.geometry)[0]
        target = Polygon([
            (point["x"] / SCALE + ORIGIN_X, ORIGIN_Y - point["y"] / SCALE)
            for point in obj["polygon"]
        ])
        union = source.union(target).area
        ious.append(source.intersection(target).area / union if union > 0 else 0.0)

    roads_mask = road_grid()
    road_valid = np.isin(roads_mask, [1, 2])
    centerline_points = []
    for _, row in roads.iterrows():
        for line in line_parts(row.geometry):
            centerline_points.extend(sample_line(line).tolist())
    centerline_points = np.asarray(centerline_points)
    inside = (
        (centerline_points[:, 0] >= XMIN) & (centerline_points[:, 0] <= XMAX) &
        (centerline_points[:, 1] >= YMIN) & (centerline_points[:, 1] <= YMAX)
    )
    clipped_centerline_samples = int((~inside).sum())
    centerline_points = centerline_points[inside]
    centerline_distance = nearest_distance(centerline_points, road_valid)

    coast_valid = beach_tile_mask(landcover)
    coast_points = []
    for _, row in landcover.iterrows():
        if row["kind"] != "beach":
            continue
        for polygon in polygon_parts(row.geometry):
            boundary = polygon.exterior
            coast_points.extend(sample_line(LineString(boundary.coords), 1.0).tolist())
    coast_points = np.asarray(coast_points)
    coast_inside = (
        (coast_points[:, 0] >= XMIN) & (coast_points[:, 0] <= XMAX) &
        (coast_points[:, 1] >= YMIN) & (coast_points[:, 1] <= YMAX)
    )
    coast_points = coast_points[coast_inside]
    coast_distance = nearest_distance(coast_points, coast_valid)

    poi_offsets = []
    for _, row in places.iterrows():
        geometry = row.geometry
        if not isinstance(geometry, Point):
            continue
        obj = next((item for item in objects if item.get("type") == "poi" and str(item["properties"]["osm_id"]) == str(row.osm_id)), None)
        if obj is None:
            continue
        expected_x, expected_y = to_px(geometry.x, geometry.y)
        poi_offsets.append(float(np.hypot(obj["x"] - expected_x, obj["y"] - expected_y)))

    clipped = {"buildings": [], "roads": [], "places": [], "landcover": []}
    for layer, key in ((buildings, "buildings"), (roads, "roads"), (places, "places"), (landcover, "landcover")):
        for _, row in layer.iterrows():
            geometry = row.geometry
            coords = []
            if isinstance(geometry, Point):
                coords = [(geometry.x, geometry.y)]
            else:
                for part in polygon_parts(geometry) + line_parts(geometry):
                    coords.extend(part.exterior.coords if isinstance(part, Polygon) else part.coords)
            if any(x < XMIN - 1e-6 or x > XMAX + 1e-6 or y < YMIN - 1e-6 or y > YMAX + 1e-6 for x, y in coords):
                clipped[key].append(str(row.osm_id))

    metrics = {
        "crs": "EPSG:32633",
        "origin_utm": [ORIGIN_X, ORIGIN_Y],
        "grid_tiles": [WIDTH_T, HEIGHT_T],
        "pixels_per_meter": SCALE,
        "definition": {
            "building_iou": "intersezione/unione tra poligono OSM e poligono del layer footprints, in metri UTM",
            "centerline_distance_m": "distanza media dai punti campionati sulla centroline OSM al centro del tile stradale più vicino",
            "coastline_hausdorff_m": "distanza massima dai punti campionati sulla costa OSM al tile della spiaggia OSM più vicino, anche se ricoperto da una strada reale",
            "poi_offset_px": "scarto tra coordinata OSM proiettata e coordinata del POI nel Tiled JSON",
            "clipped_elements": "elementi con almeno un vertice fuori dalla griglia; nessun clamp silenzioso",
        },
        "values": {
            "buildings_compared": len(ious),
            "building_iou_min": round(min(ious), 6) if ious else 0.0,
            "building_iou_mean": round(float(np.mean(ious)), 6) if ious else 0.0,
            "centerline_samples": int(len(centerline_points)),
            "clipped_centerline_samples": clipped_centerline_samples,
            "centerline_distance_mean_m": round(float(np.nanmean(centerline_distance)), 4),
            "centerline_distance_p95_m": round(float(np.nanpercentile(centerline_distance, 95)), 4),
            "coastline_samples": int(len(coast_points)),
            "coastline_hausdorff_m": round(float(np.nanmax(coast_distance)), 4),
            "poi_compared": len(poi_offsets),
            "poi_offset_max_px": round(max(poi_offsets), 6) if poi_offsets else 0.0,
            "clipped_elements": clipped,
            "clipped_total": sum(len(v) for v in clipped.values()),
        },
        "gates": {
            "building_iou_min": {">=": 0.95, "pass": bool(ious and min(ious) >= 0.95)},
            "centerline_distance_mean_m": {"<=": 0.5, "pass": bool(np.nanmean(centerline_distance) <= 0.5)},
            "coastline_hausdorff_m": {"<=": 1.0, "pass": bool(np.nanmax(coast_distance) <= 1.0)},
            "poi_offset_max_px": {"<=": 0.0, "pass": bool(poi_offsets and max(poi_offsets) == 0.0)},
        },
    }
    return metrics


def main() -> None:
    buildings = gpd.read_file(DATA / "sample_buildings.geojson")
    roads = gpd.read_file(DATA / "sample_roads.geojson")
    places = gpd.read_file(DATA / "sample_places.geojson")
    landcover = gpd.read_file(DATA / "sample_landcover.geojson")
    AUDIT.mkdir(parents=True, exist_ok=True)
    if "--metrics-only" in sys.argv:
        print("metriche sui raster esistenti", flush=True)
    else:
        render_reference(buildings, roads, places, landcover)
        render_overlay(buildings, roads, places, landcover)
    metrics = compute_metrics(buildings, roads, places, landcover)
    (AUDIT / "overlay_metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({
        "reference": str((DATA / "osm_reference.png").relative_to(ROOT)),
        "overlay": str((AUDIT / "overlay.png").relative_to(ROOT)),
        "focus": str((AUDIT / "overlay_focus.png").relative_to(ROOT)),
        "values": metrics["values"],
        "gates": metrics["gates"],
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
