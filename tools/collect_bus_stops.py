"""Raccoglie le fermate bus OSM reali delle nove regioni costruite.

Nelle mappe M5/M6 i nodi ``highway=bus_stop`` non finivano nei POI generici,
perché il collector filtrava solo amenity/tourism/public_transport ecc. Questo
script interroga l'API OSM con le stesse bbox già usate per i geodati e scrive
un piccolo file derivato, usato dai generatori per collocare le fermate come
segnaposto puntuali (mai come edifici inventati).

Uso: python tools/collect_bus_stops.py
Output: tools/generated/m6_bus_stops.json
"""
from __future__ import annotations

import datetime as dt
import json
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "tools" / "generated" / "m5_osm_raw.json"
OUT = ROOT / "tools" / "generated" / "m6_bus_stops.json"
API = "https://api.openstreetmap.org/api/0.6/map"
UA = "BACOLI-LIFE-M6/1.0 (geodati OSM per fermate reali)"

# Il centro storico ha una bbox propria; le altre otto regioni sono lette da
# m5_osm_raw.json. Pianura e Napoli restano fuori: non sono costruite.
CENTRO_BBOX = {
    "south": 40.7995, "north": 40.8060,
    "west": 14.0775, "east": 14.0830,
}
BUILT = (
    "marina_grande", "villa_comunale", "lago_miseno", "miseno", "miliscola",
    "baia", "fusaro", "torregaveta", "centro",
)


def fetch(bbox: dict[str, float]) -> ET.Element:
    query = urllib.parse.urlencode({
        "bbox": f"{bbox['west']},{bbox['south']},{bbox['east']},{bbox['north']}"
    })
    request = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=90) as response:
        return ET.fromstring(response.read())


def stops(region: str, bbox: dict[str, float]) -> list[dict]:
    root = fetch(bbox)
    found: list[dict] = []
    seen: set[int] = set()
    for node in root.findall("node"):
        tags = {tag.get("k"): tag.get("v") for tag in node.findall("tag")}
        if tags.get("highway") != "bus_stop":
            continue
        ident = int(node.attrib["id"])
        if ident in seen:
            continue
        seen.add(ident)
        name = tags.get("name") or tags.get("ref") or "Fermata bus"
        found.append({
            "id": ident,
            "region": region,
            "name": name,
            "lat": float(node.attrib["lat"]),
            "lon": float(node.attrib["lon"]),
            "source": "OSM node highway=bus_stop",
        })
    return found


def main() -> None:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    bboxes = {key: zone["bbox"] for key, zone in raw["zones"].items()}
    bboxes["centro"] = CENTRO_BBOX
    collected: list[dict] = []
    sources: list[dict] = []
    for region in BUILT:
        found = stops(region, bboxes[region])
        collected.extend(found)
        sources.append({
            "region": region,
            "url": f"{API}?bbox={bboxes[region]['west']},{bboxes[region]['south']},"
                   f"{bboxes[region]['east']},{bboxes[region]['north']}",
            "retrieved_at": dt.datetime.now(dt.timezone.utc)
              .replace(microsecond=0).isoformat(),
            "count": len(found),
        })
        print(f"{region}: {len(found)} fermate")
    payload = {
        "source": "OpenStreetMap API 0.6 map",
        "filter": "node[highway=bus_stop] nelle bbox delle regioni costruite",
        "sources": sources,
        "stops": collected,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"totale {len(collected)} fermate -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
