"""Verifica che la mappa metrica derivi solo da fonti geografiche reali.

Uso: python tools/validate_geography.py

Controlla che:
- ogni edificio del dataset abbia un'impronta OSM proiettata corrispondente;
- nessun edificio sia stato inventato o spostato casualmente;
- le strade nominate dal geoportale/OSM siano presenti nella mappa;
- tutti i luoghi restino dentro i bounds della ricostruzione.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from build_map_centro import DATA_OUT, GEO, TH, TW, fill_polygon, to_tile  # noqa: E402

REQUIRED_SOURCES = (
    "https://www.openstreetmap.org/search?query=Bacoli",
    "https://overpass-turbo.eu/",
    "https://geoportale.urba.cloud/maps/Stradario%20-%20Comune%20di%20Bacoli/viewer/",
    "https://commons.wikimedia.org/wiki/Category:Bacoli",
    "https://comune.bacoli.na.it/vivere-il-comune/galleria-fotografica/",
)


def projected_bounds(geo: dict) -> set[tuple[int, int, int, int]]:
    result: set[tuple[int, int, int, int]] = set()
    for building in geo["buildings"]:
        geometry = building.get("geometry") or []
        if len(geometry) < 4:
            continue
        footprint = fill_polygon([to_tile(p["lat"], p["lon"]) for p in geometry])
        if not footprint:
            continue
        xs = [x for x, _ in footprint]
        ys = [y for _, y in footprint]
        result.add((min(xs), min(ys), max(xs), max(ys)))
    return result


def main() -> None:
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    centro = json.loads(DATA_OUT.read_text(encoding="utf-8"))
    failures: list[str] = []

    osm_bounds = projected_bounds(geo)
    place_bounds = {
        tuple(place["bounds"]) for place in centro["places"] if place.get("bounds")
    }
    invented = sorted(place_bounds - osm_bounds)
    dropped = sorted(osm_bounds - place_bounds)
    if invented:
        failures.append(f"impronte non OSM nel dataset: {invented[:4]}")
    if dropped:
        failures.append(f"impronte OSM mancanti nel dataset: {dropped[:4]}")

    if centro["buildingCount"] != len(place_bounds):
        failures.append(
            f"buildingCount {centro['buildingCount']} != impronte {len(place_bounds)}"
        )
    if centro["roadTileCount"] < 20_000:
        failures.append(f"rete stradale troppo ridotta: {centro['roadTileCount']} tile")

    names = [place.get("name", "") for place in centro["places"]]
    if not any(name.startswith("Via Ortensio") for name in names):
        failures.append("manca la toponomastica di Via Ortensio")
    bounds = centro["bounds"]
    if not (bounds["south"] < 40.80162 < bounds["north"]
            and bounds["west"] < 14.08133 < bounds["east"]):
        failures.append("Via Spiaggia non rientra nei bounds della mappa")

    sources = "\n".join(centro.get("sources", []))
    for source in REQUIRED_SOURCES:
        if source not in sources:
            failures.append(f"fonte non dichiarata: {source}")

    for place in centro["places"]:
        x, y = place.get("x"), place.get("y")
        if not (isinstance(x, int) and isinstance(y, int)):
            failures.append(f"coordinate non intere: {place.get('id')}")
        elif not (0 <= x < TW and 0 <= y < TH):
            failures.append(f"luogo fuori mappa: {place.get('id')}")
        bounds = place.get("bounds")
        if bounds and not (
            0 <= bounds[0] <= bounds[2] < TW and 0 <= bounds[1] <= bounds[3] < TH
        ):
            failures.append(f"impronta fuori mappa: {place.get('id')}")

    if failures:
        print("VALIDA GEOGRAFIA: FALLITA")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)
    print(
        f"VALIDA GEOGRAFIA: OK · {len(osm_bounds)} impronte OSM, "
        f"{centro['roadTileCount']} tile strada, {len(centro['places'])} luoghi"
    )


if __name__ == "__main__":
    main()
