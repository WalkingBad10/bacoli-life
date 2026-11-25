"""Costruisce il grafo a corsie direzionate della zona campione da OSMnx + GeoPandas."""
from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
from shapely.geometry import LineString

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "rebuild2" / "data"
OUT = ROOT / "public" / "rebuild2" / "maps" / "sample" / "lanes.json"
PX_PER_M = 16
BUS_MIN_WIDTH_M = 8.0
DRIVABLE = {"secondary", "tertiary", "residential", "service", "living_street", "unclassified"}


def offset(line: LineString, distance: float) -> LineString:
    try:
        result = line.parallel_offset(abs(distance), "left" if distance >= 0 else "right", resolution=2, join_style=2)
        if isinstance(result, LineString):
            return result
        return max(result.geoms, key=lambda part: part.length)
    except Exception:
        return line


def main() -> None:
    meta = json.loads((ROOT / "public" / "rebuild2" / "maps" / "sample" / "meta.json").read_text(encoding="utf-8"))
    origin_x, origin_y = meta["origin_x"], meta["origin_y"]
    edges = gpd.read_file(DATA / "sample_graph_edges.geojson")
    roads = gpd.read_file(DATA / "sample_roads.geojson")
    by_osm = {}
    for _, row in roads.iterrows():
        by_osm.setdefault(str(row.osm_id), row)

    lanes = []
    nodes = {}
    for idx, row in edges.iterrows():
        osm = by_osm.get(str(row.osmid))
        # OSMnx conserve anche coastline, spiaggia, aree e breakwater: non sono strade.
        if osm is None:
            continue
        kind = osm["kind"]
        width = float(osm["width_m"]) if osm is not None else 6.0
        oneway = bool(osm["oneway"]) if osm is not None else bool(row.oneway)
        drivable = kind in DRIVABLE
        bus_ok = drivable and width >= BUS_MIN_WIDTH_M
        geometry = row.geometry
        half = width / 4

        def to_pixels(line: LineString) -> list[list[float]]:
            return [
                [round((x - origin_x) * PX_PER_M, 1), round((origin_y - y) * PX_PER_M, 1)]
                for x, y in line.coords
            ]

        forward = offset(geometry, half)
        lanes.append({
            "id": f"lane-{idx}-f", "osm_id": str(row.osmid), "name": osm["name"] if osm is not None else "",
            "from": str(row.u), "to": str(row.v), "kind": kind, "width_m": round(width, 2),
            "oneway": oneway, "drivable": drivable, "bus_compatible": bus_ok,
            "length_px": round(forward.length * PX_PER_M, 1), "points": to_pixels(forward),
        })
        if not oneway:
            backward = offset(geometry, -half)
            lanes.append({
                "id": f"lane-{idx}-b", "osm_id": str(row.osmid), "name": osm["name"] if osm is not None else "",
                "from": str(row.v), "to": str(row.u), "kind": kind, "width_m": round(width, 2),
                "oneway": False, "drivable": drivable, "bus_compatible": bus_ok,
                "length_px": round(backward.length * PX_PER_M, 1), "points": to_pixels(backward),
            })
        for node_id, point in ((str(row.u), geometry.coords[0]), (str(row.v), geometry.coords[-1])):
            nodes[node_id] = [round((point[0] - origin_x) * PX_PER_M, 1), round((origin_y - point[1]) * PX_PER_M, 1)]

    payload = {
        "crs": "EPSG:32633", "px_per_m": PX_PER_M,
        "origin_x": origin_x, "origin_y": origin_y,
        "bus_min_width_m": BUS_MIN_WIDTH_M,
        "lanes": lanes, "nodes": nodes,
    }
    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    report = {
        "lanes": len(lanes),
        "drivable_lanes": sum(1 for lane in lanes if lane["drivable"]),
        "bus_compatible_lanes": sum(1 for lane in lanes if lane["bus_compatible"]),
        "nodes": len(nodes),
        "byte": OUT.stat().st_size,
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
