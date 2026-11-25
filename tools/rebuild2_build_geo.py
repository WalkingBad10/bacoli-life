"""Pipeline metrica REBUILD 2.0: OSM -> GeoJSON proiettato + grafo OSMnx.

Zona campione: Via Ortensio, Via Spiaggia e centro storico di Baia/Bacoli.
Usa concretamente PyProj, Shapely, GeoPandas e OSMnx. Nessuna strada casuale.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

import geopandas as gpd
import networkx as nx
import numpy as np
import osmnx as ox
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, box
from shapely import transform

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "docs" / "rebuild2" / "data"
OSM = DATA / "osm_baia_sample.osm"
BBOX = (14.0775, 40.7995, 14.0830, 40.8062)
CRS = "EPSG:32633"  # UTM 33N, metro
PX_PER_M = 16
FLOOR_HEIGHT_PX = 52  # 3 m + sporto/cornicione, come da configurazione verificata M5/M6

ROAD_WIDTH_DEFAULT_M = {
    "secondary": 12.0,
    "tertiary": 9.0,
    "residential": 7.0,
    "service": 5.0,
    "pedestrian": 6.0,
    "living_street": 6.0,
    "footway": 2.0,
    "path": 2.0,
    "steps": 2.0,
    "track": 3.0,
}


def tags_of(element: ET.Element) -> dict[str, str]:
    return {tag.get("k", ""): tag.get("v", "") for tag in element.findall("tag")}


def road_width_m(tags: dict[str, str]) -> tuple[float, str]:
    if "width" in tags:
        try:
            return max(1.5, float(tags["width"].replace(",", "."))), "tag width"
        except ValueError:
            pass
    lanes = tags.get("lanes")
    if lanes:
        try:
            return max(2.0, float(lanes) * 3.5), "tag lanes"
        except ValueError:
            pass
    return ROAD_WIDTH_DEFAULT_M.get(tags.get("highway", ""), 4.0), "class default"


def building_levels(tags: dict[str, str], area_m2: float, width_m: float) -> tuple[int, str]:
    """Regola dichiarata e riproducibile per i piani quando OSM non li riporta."""
    for key in ("building:levels", "height"):
        if key in tags:
            try:
                value = float(tags[key])
                return max(1, int(round(value / 3.0 if key == "height" else value))), f"tag {key}"
            except ValueError:
                pass
    if area_m2 > 700 or (area_m2 > 400 and width_m > 34):
        return 1, "area_heuristic_v1"
    if area_m2 > 180 or width_m > 34:
        return 2, "area_heuristic_v1"
    if area_m2 > 80:
        return 3, "area_heuristic_v1"
    return 2, "area_heuristic_v1"


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    root = ET.parse(OSM).getroot()
    nodes = {
        node.get("id"): (float(node.get("lon")), float(node.get("lat")))
        for node in root.findall("node")
    }
    transformer = Transformer.from_crs("EPSG:4326", CRS, always_xy=True)

    def project(geometry):
        def to_utm(coords: np.ndarray) -> np.ndarray:
            xs, ys = transformer.transform(coords[:, 0], coords[:, 1])
            return np.column_stack([xs, ys])
        return transform(geometry, to_utm)

    minx, miny = transformer.transform(BBOX[0], BBOX[1])
    maxx, maxy = transformer.transform(BBOX[2], BBOX[3])
    bbox_polygon = box(minx, miny, maxx, maxy)

    buildings: list[dict] = []
    roads: list[dict] = []
    places: list[dict] = []
    landcover: list[dict] = []
    for way in root.findall("way"):
        tags = tags_of(way)
        coords = [nodes[ref.get("ref")] for ref in way.findall("nd") if ref.get("ref") in nodes]
        if len(coords) < 2:
            continue
        closed = coords[0] == coords[-1]
        if "building" in tags and closed and len(coords) >= 4:
            polygon = project(Polygon(coords))
            if polygon.is_valid and polygon.area > 4 and bbox_polygon.contains(polygon.centroid):
                min_width = min(polygon.bounds[2] - polygon.bounds[0], polygon.bounds[3] - polygon.bounds[1])
                levels, levels_source = building_levels(tags, polygon.area, min_width)
                height = None
                if "height" in tags:
                    try:
                        height = float(tags["height"].replace(",", "."))
                    except ValueError:
                        height = None
                buildings.append({
                    "osm_id": way.get("id"),
                    "name": tags.get("name", ""),
                    "kind": tags["building"],
                    "levels": levels,
                    "levels_source": levels_source,
                    "height_m": height,
                    "geometry": polygon,
                })
        if "highway" in tags:
            line = project(LineString(coords)).intersection(bbox_polygon)
            if line.is_empty:
                continue
            width_m, width_source = road_width_m(tags)
            roads.append({
                "osm_id": way.get("id"),
                "name": tags.get("name", ""),
                "kind": tags["highway"],
                "width_m": width_m,
                "width_source": width_source,
                "oneway": tags.get("oneway", "no") in {"yes", "true", "1"},
                "maxspeed": tags.get("maxspeed", ""),
                "geometry": line,
            })
        if closed and ("amenity" in tags or "shop" in tags or "tourism" in tags):
            polygon = project(Polygon(coords))
            if polygon.is_valid and polygon.area > 1 and bbox_polygon.intersects(polygon):
                places.append({
                    "osm_id": way.get("id"),
                    "name": tags.get("name", ""),
                    "kind": tags.get("amenity") or tags.get("shop") or tags.get("tourism", ""),
                    "geometry": polygon,
                })
        if closed and ("natural" in tags or "landuse" in tags or "leisure" in tags):
            polygon = project(Polygon(coords))
            if polygon.is_valid and polygon.area > 2 and bbox_polygon.intersects(polygon):
                landcover.append({
                    "osm_id": way.get("id"),
                    "kind": tags.get("natural") or tags.get("landuse") or tags.get("leisure", ""),
                    "geometry": polygon,
                })

    for node in root.findall("node"):
        tags = tags_of(node)
        if "amenity" in tags or "shop" in tags or "tourism" in tags or "highway" in tags and tags.get("highway") == "bus_stop":
            point = project(Point((float(node.get("lon")), float(node.get("lat")))))
            if not bbox_polygon.contains(point):
                continue
            places.append({
                "osm_id": node.get("id"),
                "name": tags.get("name", ""),
                "kind": tags.get("amenity") or tags.get("shop") or tags.get("tourism") or tags.get("highway", ""),
                "geometry": point,
            })

    gdf_buildings = gpd.GeoDataFrame(buildings, crs=CRS, geometry="geometry")
    gdf_roads = gpd.GeoDataFrame(roads, crs=CRS, geometry="geometry")
    gdf_places = gpd.GeoDataFrame(places, crs=CRS, geometry="geometry")
    gdf_landcover = gpd.GeoDataFrame(landcover, crs=CRS, geometry="geometry")
    gdf_buildings.to_file(DATA / "sample_buildings.geojson", driver="GeoJSON")
    gdf_roads.to_file(DATA / "sample_roads.geojson", driver="GeoJSON")
    gdf_places.to_file(DATA / "sample_places.geojson", driver="GeoJSON")
    gdf_landcover.to_file(DATA / "sample_landcover.geojson", driver="GeoJSON")

    # OSMnx di default trattiene solo la componente connessa più grande: nel nostro
    # bbox quella è la coastline, non la rete stradale. retain_all è obbligatorio.
    ox.settings.useful_tags_way = [
        "highway", "name", "oneway", "lanes", "width", "maxspeed",
        "bus", "foot", "bicycle", "surface", "ref", "bridge", "tunnel",
    ]
    graph = ox.graph_from_xml(str(OSM), simplify=False, retain_all=True)
    graph_metric = ox.project_graph(graph, to_crs=CRS)
    nodes_gdf, edges_gdf = ox.graph_to_gdfs(graph_metric)
    nodes_gdf.to_file(DATA / "sample_graph_nodes.geojson", driver="GeoJSON")
    edges_gdf.to_file(DATA / "sample_graph_edges.geojson", driver="GeoJSON")

    bounds = gdf_buildings.total_bounds
    width_m = bounds[2] - bounds[0]
    height_m = bounds[3] - bounds[1]
    report = [
        "# Zona campione REBUILD 2.0 — dati metrici reali",
        "",
        f"Sorgente: `{OSM.name}` (OSM API 0.6, bbox {BBOX[0]},{BBOX[1]}–{BBOX[2]},{BBOX[3]}).",
        f"CRS: `{CRS}` (UTM 33N, unità = metro). Conversione: PyProj.",
        "",
        "| Elemento | Conteggio |",
        "|---|---:|",
        f"| Edifici OSM (poligoni validi) | {len(gdf_buildings)} |",
        f"| Strade OSM (LineString) | {len(gdf_roads)} |",
        f"| Luoghi/POI OSM | {len(gdf_places)} |",
        f"| Aree naturali/landuse OSM | {len(gdf_landcover)} |",
        f"| Nodi grafo OSMnx | {len(graph_metric.nodes)} |",
        f"| Archi grafo OSMnx | {len(graph_metric.edges)} |",
        f"| Componenti deboli del grafo | {nx.number_weakly_connected_components(graph_metric)} |",
        "",
        "Provenienza piani: " + ", ".join(
            f"{source}={sum(1 for b in buildings if b['levels_source'] == source)}"
            for source in sorted({b["levels_source"] for b in buildings})
        ) + ".",
        "Provenienza larghezze stradali: " + ", ".join(
            f"{source}={sum(1 for r in roads if r['width_source'] == source)}"
            for source in sorted({r["width_source"] for r in roads})
        ) + ".",
        "",
        f"Estensione: {width_m:.1f} m x {height_m:.1f} m.",
        f"Griglia di gioco ipotizzata: {round(width_m * PX_PER_M)} x {round(height_m * PX_PER_M)} px a {PX_PER_M} px/m.",
        "",
        "## Scala e proiezione",
        "",
        f"- 1 metro = {PX_PER_M} px a terra.",
        "- Persona 1,75 m = 28 px; porta 2,10 m = 34 px; automobile 4 m = 64 px; autobus 11 m = 176 px.",
        f"- Altezza visiva di un piano 3 m = {FLOOR_HEIGHT_PX} px (include sporto e cornicione); la proiezione 3/4 è codificata una sola volta." ,
        "",
        "## Approssimazioni documentate",
        "",
        "- I livelli mancanti sono stimati dalla regola dichiarata `area_heuristic_v1`: "
        ">700 m² o (>400 m² e larghezza>34 m) -> 1; >180 m² o larghezza>34 m -> 2; "
        ">80 m² -> 3; altrimenti 2. Ogni edificio riporta `levels_source`.",
        "- Le larghezze stradali derivano da tag OSM `width`/`lanes`; in assenza sono usati valori tipici per classe.",
        "- Le facciate saranno ricostruite dalle fotografie fornite, non dal solo tag `building`.",
        "- Il grafo OSMnx è proiettato in UTM; le corsie saranno derivate da larghezza e senso di marcia.",
        "",
        "## Verifica",
        "",
        "I file `.geojson` prodotti sono la sorgente verificabile della mappa di gioco: "
        "la sovrapposizione cartografica sarà generata da questi stessi poligoni e linee.",
        "",
    ]
    (DATA / "REPORT.md").write_text("\n".join(report), encoding="utf-8")
    print("\n".join(report))
    print("Grafo connesso:", nx.is_connected(graph_metric.to_undirected()))


if __name__ == "__main__":
    main()
