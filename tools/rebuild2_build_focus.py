"""Punti di interesse verificabili per la zona campione giocabile.

Legge gli stessi GeoJSON metrici usati per la mappa: nessuna posizione inventata.
I ruoli (bar/pizzeria/casa) sono assegnazioni documentate a edifici reali OSM.
"""
from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
from shapely.geometry import Point
from shapely.ops import nearest_points

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "rebuild2" / "data"
OUT = ROOT / "public" / "rebuild2" / "maps" / "sample" / "focus.json"


def to_px(point, origin_x: float, origin_y: float, scale: float) -> list[float]:
    center = point.centroid if not hasattr(point, "x") else point
    return [round((center.x - origin_x) * scale, 1), round((origin_y - center.y) * scale, 1)]


def find_poi(places: gpd.GeoDataFrame, name: str):
    match = places[places.name.fillna("").str.contains(name, case=False, regex=False)]
    return match.iloc[0] if len(match) else None


def nearest_building(buildings: gpd.GeoDataFrame, point: Point):
    idx = buildings.geometry.distance(point).idxmin()
    return buildings.loc[idx], float(buildings.geometry.distance(point).min())


def nearest_road(roads: gpd.GeoDataFrame, point: Point):
    idx = roads.geometry.distance(point).idxmin()
    return roads.loc[idx], float(roads.geometry.distance(point).min())


def door_point(building, roads: gpd.GeoDataFrame) -> Point:
    road, _ = nearest_road(roads, building.geometry.centroid)
    target, _ = nearest_points(building.geometry.boundary, road.geometry)
    return target


def main() -> None:
    meta = json.loads((OUT.parent / "meta.json").read_text(encoding="utf-8"))
    origin_x, origin_y, scale = meta["origin_x"], meta["origin_y"], meta["px_per_m"]
    buildings = gpd.read_file(DATA / "sample_buildings.geojson")
    roads = gpd.read_file(DATA / "sample_roads.geojson")
    places = gpd.read_file(DATA / "sample_places.geojson")

    cafe = find_poi(places, "Cafè Centrale")
    restaurant = find_poi(places, "Il Portico")
    townhall = find_poi(places, "Municipio di Bacoli")
    church = find_poi(places, "Chiesa di San Gioacchino")
    if cafe is None or restaurant is None or townhall is None:
        raise RuntimeError("POI campione mancanti nei GeoJSON")

    home_candidates = buildings[buildings.kind.astype(str).str.contains("residential")]
    home, home_dist = nearest_building(home_candidates, cafe.geometry)

    roles = {}
    for label, poi, building_kind in (
        ("bar", cafe, None),
        ("pizzeria", restaurant, None),
        ("home", None, home),
    ):
        source = poi if poi is not None else building_kind
        building, distance = nearest_building(buildings, source.geometry if hasattr(source, "geometry") else source)
        door = door_point(building, roads)
        roles[label] = {
            "osm_id": str(building.osm_id),
            "name": str(building.get("name") or (poi.get("name") if poi is not None else "casa")),
            "source_poi": str(poi.get("name")) if poi is not None else None,
            "distance_m": round(distance, 2),
            "door_px": to_px(door, origin_x, origin_y, scale),
            "center_px": to_px(building.geometry.centroid, origin_x, origin_y, scale),
        }

    # Spawn davanti al bar, sul punto della strada OSM più vicino alla porta.
    spawn_road, _ = nearest_road(roads, cafe.geometry)
    spawn_point, _ = nearest_points(spawn_road.geometry, cafe.geometry)
    if buildings.geometry.contains(spawn_point).any():
        spawn_point = spawn_road.geometry.interpolate(0.5, normalized=True)

    via_ortensio = roads[roads.name.fillna("").str.contains("Ortensio")]
    via_spiaggia = roads[roads.name.fillna("").str.contains("Spiaggia")]
    payload = {
        "crs": meta.get("crs", "EPSG:32633"),
        "origin_x": origin_x, "origin_y": origin_y, "px_per_m": scale,
        "spawn_px": to_px(spawn_point, origin_x, origin_y, scale),
        "spawn_source": {"road": str(spawn_road.get("name") or "senza nome"), "osm_id": str(spawn_road.osm_id)},
        "landmarks": {
            "townhall_px": to_px(townhall.geometry, origin_x, origin_y, scale),
            "church_px": to_px(church.geometry, origin_x, origin_y, scale) if church is not None else None,
            "via_ortensio_px": [to_px(Point(x, y), origin_x, origin_y, scale) for x, y in via_ortensio.geometry.iloc[0].coords],
            "via_spiaggia_px": [to_px(Point(x, y), origin_x, origin_y, scale) for x, y in via_spiaggia.geometry.iloc[0].coords],
        },
        "roles": roles,
        "approximations": [
            "Il Portico è un ristorante OSM: usato come pizzeria visitabile nell'anteprima.",
            "La casa è l'edificio residenziale OSM più vicino a Cafè Centrale, non una proprietà censita.",
            "Le porte sono il punto della sagoma OSM più vicino alla strada OSM più vicina.",
        ],
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({
        "spawn_px": payload["spawn_px"], "spawn_source": payload["spawn_source"],
        "roles": {k: {"osm_id": v["osm_id"], "name": v["name"], "door_px": v["door_px"]} for k, v in roles.items()},
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
