"""Verifica finale delle regioni metriche M5 (centro + frazioni flegree).

Uso: python tools/validate_m5_world.py

Controlla che ogni regione:
- usi la scala universale 1 m = 16 px (adulto 28 px, piano 52 px);
- abbia buffer ground/collision coerenti con width x height e con solidTiles;
- abbia spawn, luoghi e fermate dentro i bounds e su tile non solidi;
- conservi il centro storico M4 come prima regione;
- dichiari le fonti OSM/fotografiche reali.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORLD = ROOT / "src" / "data" / "bacoli_world.json"
MAPS = ROOT / "public" / "assets" / "maps"
RAW = ROOT / "tools" / "generated" / "m5_osm_raw.json"

EXPECTED_REGIONS = [
    "centro", "baia", "fusaro", "lago_miseno", "marina_grande",
    "miliscola", "miseno", "torregaveta", "villa_comunale",
]
EXPECTED_SCALE = {
    "metersPerPixel": 1 / 16,
    "metersPerTile": 1,
    "adultHeightPx": 28,
    "floorHeightPx": 52,
}


def solid_count(bits: bytes) -> int:
    return sum((byte >> bit) & 1 for byte in bits for bit in range(8))


def main() -> None:
    world = json.loads(WORLD.read_text(encoding="utf-8"))
    raw = json.loads(RAW.read_text(encoding="utf-8")) if RAW.exists() else {"zones": {}}
    failures: list[str] = []
    ids = [region["id"] for region in world["regions"]]

    if ids[0] != "centro":
        failures.append("la prima regione deve essere il centro storico M4")
    for expected in EXPECTED_REGIONS:
        if expected not in ids:
            failures.append(f"regione M5 mancante: {expected}")
    if len(ids) != len(set(ids)):
        failures.append("ID regione duplicati")

    for region in world["regions"]:
        rid = region["id"]
        if region.get("scale") != EXPECTED_SCALE:
            failures.append(f"{rid}: scala universale non rispettata")
        b = region["bounds"]
        if not (b["south"] < b["north"] and b["west"] < b["east"]):
            failures.append(f"{rid}: bounds non validi")
        w, h = region["size"]["width"], region["size"]["height"]
        meta = json.loads((MAPS / rid / "meta.json").read_text(encoding="utf-8"))
        if (meta["width"], meta["height"]) != (w, h):
            failures.append(f"{rid}: meta size diverso dal dataset")
        if (meta["tileWidth"], meta["tileHeight"]) != (16, 16):
            failures.append(f"{rid}: tile non a 16 px")
        ground = (MAPS / rid / "ground.bin").read_bytes()
        bits = (MAPS / rid / "collision.bin").read_bytes()
        if len(ground) != w * h:
            failures.append(f"{rid}: ground.bin di dimensione errata")
        if len(bits) != (w * h + 7) // 8:
            failures.append(f"{rid}: collision.bin di dimensione errata")
        elif solid_count(bits) != meta["solidTiles"]:
            failures.append(f"{rid}: solidTiles non coerente con la bitmask")

        def solid(tx: int, ty: int) -> bool:
            if not (0 <= tx < w and 0 <= ty < h):
                return True
            index = ty * w + tx
            return bool((bits[index >> 3] >> (index & 7)) & 1)

        spawn = region["spawn"]
        if solid(spawn["x"], spawn["y"]):
            failures.append(f"{rid}: spawn su tile solido")
        for station_id, station in region.get("stations", {}).items():
            if solid(station["x"], station["y"]):
                failures.append(f"{rid}: fermata {station_id} su tile solido")
        seen: set[str] = set()
        for place in region["places"]:
            if place["id"] in seen:
                failures.append(f"{rid}: place ID duplicato {place['id']}")
            seen.add(place["id"])
            x, y = place["x"], place["y"]
            if not (0 <= x < w and 0 <= y < h):
                failures.append(f"{rid}: luogo fuori mappa {place['id']}")
            footprint = place.get("bounds")
            if footprint and not (
                0 <= footprint[0] <= footprint[2] < w
                and 0 <= footprint[1] <= footprint[3] < h
            ):
                failures.append(f"{rid}: impronta fuori mappa {place['id']}")
            floors = place.get("floors")
            if floors is not None and not 1 <= floors <= 4:
                failures.append(f"{rid}: piani non validi {place['id']}")
        if rid != "centro":
            zone = raw.get("zones", {}).get(rid)
            if zone and not zone.get("roads") and not zone.get("buildings"):
                failures.append(f"{rid}: zona M5 senza geodati OSM")

    sources = "\n".join(
        source if isinstance(source, str)
        else " ".join(str(value) for value in source.values())
        for source in world.get("sources", [])
    )
    for source in ("openstreetmap", "overpass", "wikimedia", "comune.bacoli"):
        if source not in sources.lower():
            failures.append(f"fonte non dichiarata: {source}")

    if failures:
        print("VALIDA MONDO M5: FALLITA")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)
    total_places = sum(len(region["places"]) for region in world["regions"])
    total_buildings = sum(
        sum(1 for place in region["places"] if place.get("bounds"))
        for region in world["regions"]
    )
    total_solid = sum(region and json.loads(
        (MAPS / region["id"] / "meta.json").read_text(encoding="utf-8")
    )["solidTiles"] for region in world["regions"])
    print(
        f"VALIDA MONDO M5: OK · {len(ids)} regioni, {total_places} luoghi, "
        f"{total_buildings} edifici, {total_solid} tile solidi"
    )


if __name__ == "__main__":
    main()
