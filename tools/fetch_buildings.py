"""Recupera gli edifici della zona fase 1 tramite l'API map di OpenStreetMap.

L'API Overpass non sempre risponde per query pesanti: questa è un'alternativa
compatibile che integra i risultati in src/data/bacoli_geo.json.

Uso: python tools/fetch_buildings.py
"""
from __future__ import annotations

import json
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "src" / "data" / "bacoli_geo.json"
BBOX = (14.0785, 40.8002, 14.0840, 40.8052)  # west, south, east, north
URL = "https://api.openstreetmap.org/api/0.6/map?bbox=" + ",".join(map(str, BBOX))


def main() -> None:
    req = urllib.request.Request(URL, headers={"User-Agent": "BacoliLifeMapGenerator/0.1"})
    with urllib.request.urlopen(req, timeout=180) as response:
        xml = response.read()
    root = ET.fromstring(xml)
    nodes = {
        n.attrib["id"]: (float(n.attrib["lat"]), float(n.attrib["lon"]))
        for n in root.findall("node")
    }
    buildings: list[dict] = []
    for way in root.findall("way"):
        tags = {t.attrib["k"]: t.attrib["v"] for t in way.findall("tag")}
        if "building" not in tags:
            continue
        geometry = []
        for nd in way.findall("nd"):
            pos = nodes.get(nd.attrib["ref"])
            if pos:
                geometry.append({"lat": pos[0], "lon": pos[1]})
        if len(geometry) >= 4:
            buildings.append({
                "id": f"api-{way.attrib['id']}",
                "name": tags.get("name", ""),
                "levels": tags.get("building:levels", ""),
                "geometry": geometry,
            })

    geo = json.loads(GEO.read_text(encoding="utf-8"))
    existing = {b["id"] for b in geo.get("buildings", [])}
    geo.setdefault("buildings", [])
    for b in buildings:
        if b["id"] not in existing:
            geo["buildings"].append(b)
    GEO.write_text(json.dumps(geo, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"recuperati {len(buildings)} edifici reali; totale {len(geo['buildings'])}")


if __name__ == "__main__":
    main()
