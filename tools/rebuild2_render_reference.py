"""Raster di riferimento della cartografia OSM reale, per sovrapposizione verificabile."""
from __future__ import annotations

from pathlib import Path

import geopandas as gpd
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import MultiLineString, MultiPolygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "rebuild2" / "data"
OUT = DATA / "osm_reference.png"
SCALE = 3  # pixel per metro nel raster di confronto


def polygons(geometry):
    if geometry.geom_type == "Polygon":
        return [geometry]
    if geometry.geom_type == "MultiPolygon":
        return list(geometry.geoms)
    return []


def lines(geometry):
    if geometry.geom_type == "LineString":
        return [geometry]
    if geometry.geom_type == "MultiLineString":
        return list(geometry.geoms)
    return []


def main() -> None:
    buildings = gpd.read_file(DATA / "sample_buildings.geojson")
    roads = gpd.read_file(DATA / "sample_roads.geojson")
    places = gpd.read_file(DATA / "sample_places.geojson")
    xmin, ymin, xmax, ymax = buildings.total_bounds
    width = int((xmax - xmin) * SCALE) + 40
    height = int((ymax - ymin) * SCALE) + 40
    image = Image.new("RGB", (width, height), (245, 243, 236))
    draw = ImageDraw.Draw(image)

    def px(coords):
        return [(int((x - xmin) * SCALE) + 20, height - 20 - int((y - ymin) * SCALE)) for x, y in coords]

    colors = {
        "secondary": (214, 173, 92),
        "tertiary": (224, 190, 118),
        "residential": (196, 196, 190),
        "service": (206, 206, 200),
        "pedestrian": (176, 152, 112),
        "footway": (170, 150, 120),
        "path": (170, 150, 120),
        "steps": (150, 130, 100),
    }
    for _, row in roads.iterrows():
        for line in lines(row.geometry):
            draw.line(px(line.coords), fill=colors.get(row["kind"], (190, 190, 185)), width=max(2, int(row["width_m"] * SCALE / 3)))

    for _, row in buildings.iterrows():
        for polygon in polygons(row.geometry):
            points = px(polygon.exterior.coords)
            draw.polygon(points, fill=(206, 198, 184), outline=(122, 108, 92))

    for _, row in places.iterrows():
        geometry = row.geometry
        if geometry.geom_type == "Point":
            x, y = px([(geometry.x, geometry.y)])[0]
            draw.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(28, 110, 164))
        else:
            for polygon in polygons(geometry):
                draw.polygon(px(polygon.exterior.coords), fill=(120, 170, 200), outline=(28, 90, 140))

    title = "REBUILD 2.0 — bbox OSM reale Via Ortensio / Via Spiaggia (EPSG:32633, 3 px/m)"
    draw.rectangle((0, 0, width, 22), fill=(24, 36, 42))
    draw.text((8, 5), title, fill=(255, 255, 255))
    image.save(OUT)
    print(f"salvato {OUT.relative_to(ROOT)}: {width}x{height} px")


if __name__ == "__main__":
    main()
