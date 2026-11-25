"""Scarica un piccolo bbox OSM reale attorno a Via Ortensio e Via Spiaggia (Baia, Bacoli)."""
from __future__ import annotations

import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "rebuild2" / "data" / "osm_baia_sample.osm"
# bbox = west, south, east, north. Copre l'intero centro storico, Via Spiaggia
# (40.8017) e Via Ortensio (40.8046); same bbox in rebuild2_build_geo.py.
BBOX = (14.0775, 40.7995, 14.0830, 40.8062)
URL = (
    "https://api.openstreetmap.org/api/0.6/map?bbox="
    f"{BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]}"
)


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(URL, headers={"User-Agent": "BACOLI-LIFE-REBUILD2/1.0 (local audit)"})
    with urllib.request.urlopen(req, timeout=300) as response:
        data = response.read()
    OUT.write_bytes(data)
    root = ET.fromstring(data)
    nodes = root.findall("node")
    ways = root.findall("way")
    relations = root.findall("relation")
    tags: dict[str, int] = {}
    for way in ways:
        for tag in way.findall("tag"):
            key = tag.get("k", "")
            if key in {"building", "highway", "amenity", "shop", "landuse", "natural", "name"}:
                tags[f"{key}={tag.get('v')}"] = tags.get(f"{key}={tag.get('v')}", 0) + 1
    print(f"salvato {OUT.relative_to(ROOT)}: {len(data)} byte")
    print(f"nodes {len(nodes)}, ways {len(ways)}, relations {len(relations)}")
    for key, value in sorted(tags.items(), key=lambda item: -item[1])[:40]:
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
