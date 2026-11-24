"""Controllo automatico delle proporzioni della scala universale.

Verifica che gli asset della nuova direzione artistica rispettino
1 metro = 16 pixel e che la mappa metrica usi la stessa conversione.

Uso: python tools/check_proportions.py
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SCALE = ROOT / "public" / "assets" / "scale"
MAP_META = ROOT / "public" / "assets" / "maps" / "centro" / "meta.json"
PLACES = ROOT / "src" / "data" / "bacoli_centro.json"

VALID_WIDTHS = tuple(range(96, 449, 16)) + (
    480, 512, 544, 576, 608, 640, 672, 704, 768, 832, 896, 960, 1024, 1088,
)

EXPECTED = {
    "player.png": (64, 128),
    "npc_1.png": (64, 128),
    "building_96_1_0.png": (96, 56),
    "building_128_2_0.png": (128, 108),
    "building_160_3_0.png": (160, 160),
    "building_208_4_0.png": (208, 212),
    "building_448_4_0.png": (448, 212),
    "building_1088_2_0.png": (1088, 108),
    "roof_160_0.png": (160, 24),
    "roof_448_0.png": (448, 24),
    "roof_1088_0.png": (1088, 24),
    "shadow_160.png": (160, 20),
    "shadow_448.png": (448, 20),
    "shadow_1088.png": (1088, 20),
    "car_white.png": (72, 40),
    "moto.png": (40, 20),
    "bus.png": (192, 52),
    "train.png": (320, 56),
    "palm.png": (96, 160),
    "olive_tree.png": (80, 112),
    "lamp.png": (48, 160),
    "boat.png": (128, 48),
    "cafe_table.png": (80, 48),
    "fisher.png": (16, 32),
    "casina.png": (256, 208),
    "tileset.png": (64, 64),
    "room_floors.png": (48, 16),
    "f_bed.png": (96, 64),
    "f_fridge.png": (64, 128),
    "f_washing_machine.png": (64, 96),
}


def main() -> None:
    failures: list[str] = []

    for name, expected in EXPECTED.items():
        path = SCALE / name
        if not path.exists():
            failures.append(f"asset mancante: {name}")
            continue
        with Image.open(path) as image:
            if image.size != expected:
                failures.append(f"{name}: atteso {expected}, trovato {image.size}")

    meta = json.loads(MAP_META.read_text(encoding="utf-8"))
    if meta.get("tileWidth") != 16 or meta.get("tileHeight") != 16:
        failures.append("tile non metrico: atteso 16x16")
    if abs(meta.get("metersPerPixel", 0) - 1 / 16) > 1e-9:
        failures.append("metersPerPixel diverso da 1/16")
    if meta.get("metersPerTile") != 1:
        failures.append("metersPerTile diverso da 1")

    ground = (SCALE.parent / "maps" / "centro" / "ground.bin").read_bytes()
    collision = (SCALE.parent / "maps" / "centro" / "collision.bin").read_bytes()
    expected = meta["width"] * meta["height"]
    if len(ground) != expected:
        failures.append(f"ground.bin: attesi {expected} byte, trovati {len(ground)}")
    if len(collision) != (expected + 7) // 8:
        failures.append(f"collision.bin: attesi {(expected + 7) // 8} byte, trovati {len(collision)}")
    solid = sum((byte >> bit) & 1 for byte in collision for bit in range(8))
    if solid != meta.get("solidTiles"):
        failures.append(f"solidTiles: attesi {meta.get('solidTiles')}, trovati {solid}")

    places = json.loads(PLACES.read_text(encoding="utf-8"))
    scale = places.get("scale", {})
    if abs(scale.get("metersPerPixel", 0) - 1 / 16) > 1e-9:
        failures.append("scala del dataset luoghi non coerente")
    if scale.get("adultHeightPx") != 28:
        failures.append("adulto non alto 28 px")
    if scale.get("floorHeightPx") != 52:
        failures.append("piano non alto 52 px")

    invalid_buildings = [
        place["name"] for place in places["places"]
        if place.get("bounds") and not (
            1 <= place.get("floors", 0) <= 4
            and place.get("facadeWidth") in VALID_WIDTHS
        )
    ]
    if invalid_buildings:
        failures.append(f"edifici senza metadati di scala: {invalid_buildings[:5]}")

    oversized = [
        place["name"] for place in places["places"]
        if place.get("bounds") and (place.get("meters") or {}).get("area", 0) > 700
        and place.get("floors", 0) > 1
    ]
    if oversized:
        failures.append(f"lotti estesi con piani irreali: {oversized[:5]}")

    if failures:
        print("CONTROLLI PROPORZIONI: FALLITI")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)
    print(
        f"CONTROLLI PROPORZIONI: OK · {len(EXPECTED)} asset, "
        f"{places['buildingCount']} edifici, scala 1 m = 16 px"
    )


if __name__ == "__main__":
    main()
