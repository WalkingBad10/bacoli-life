"""Recupera la geometria reale di Bacoli da OpenStreetMap (Overpass API).

Produce:
  docs/osm_bacoli_raw.json  - risposta Overpass grezza (conservata come fonte)
  src/data/bacoli_geo.json  - strade e POI con coordinate, usati per la mappa di gioco

Uso: python tools/osm_to_map.py
"""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BBOX = (40.790, 14.040, 40.830, 14.105)  # sud, ovest, nord, est

ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
)

QUERY = f"""[out:json][timeout:180];
(
  way["highway"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  nwr["amenity"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  nwr["historic"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  nwr["natural"="beach"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["railway"="rail"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  nwr["shop"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
  way["building"](40.7995,14.0775,40.8060,14.0850);
);
out center geom tags;
"""


def fetch() -> dict:
    last_error: Exception | None = None
    data = QUERY.encode("utf-8")
    for endpoint in ENDPOINTS:
        try:
            req = urllib.request.Request(
                endpoint,
                data=data,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "BacoliLifeMapGenerator/0.1 (sviluppo locale)",
                },
            )
            with urllib.request.urlopen(req, timeout=200) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:  # prova l'endpoint successivo
            last_error = exc
            print(f"endpoint {endpoint} non disponibile: {exc}")
    raise RuntimeError(f"Impossibile recuperare dati Overpass: {last_error}")


def main() -> None:
    raw = fetch()
    raw_path = ROOT / "docs" / "osm_bacoli_raw.json"
    raw_path.write_text(json.dumps(raw, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"salvato {raw_path} ({raw_path.stat().st_size} byte)")

    roads: list[dict] = []
    pois: list[dict] = []
    buildings: list[dict] = []
    for element in raw.get("elements", []):
        tags = element.get("tags", {})
        geometry = [
            {"lat": p["lat"], "lon": p["lon"]}
            for p in element.get("geometry", [])
            if "lat" in p and "lon" in p
        ]
        lat = element.get("lat", element.get("center", {}).get("lat"))
        lon = element.get("lon", element.get("center", {}).get("lon"))
        if "building" in tags and geometry:
            buildings.append(
                {
                    "id": element["id"],
                    "name": tags.get("name", ""),
                    "levels": tags.get("building:levels", ""),
                    "geometry": geometry,
                }
            )
        elif "highway" in tags:
            roads.append(
                {
                    "id": element["id"],
                    "name": tags.get("name", ""),
                    "kind": tags["highway"],
                    "geometry": geometry,
                }
            )
        elif tags.get("name") or "historic" in tags or tags.get("natural") == "beach":
            pois.append(
                {
                    "id": element["id"],
                    "name": tags.get("name", ""),
                    "kind": tags.get("amenity") or tags.get("shop") or tags.get("historic") or tags.get("natural") or tags.get("railway", ""),
                    "lat": lat,
                    "lon": lon,
                    "geometry": geometry,
                }
            )

    out = {
        "source": "OpenStreetMap via Overpass API",
        "bbox": dict(zip(("south", "west", "north", "east"), BBOX)),
        "roads": roads,
        "pois": pois,
        "buildings": buildings,
    }
    out_path = ROOT / "src" / "data" / "bacoli_geo.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"salvato {out_path}: {len(roads)} strade, {len(pois)} POI, {len(buildings)} edifici")


if __name__ == "__main__":
    main()
