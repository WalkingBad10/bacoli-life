"""Estrae gli asset originali dalle tre tavole e li organizza per categoria.

Uso: python tools/extract_original_assets.py

Le tavole sono state lette con Ollama/Opencv per individuare la griglia:
- Buildings: 4x4 (case, portali, chiesa);
- Interiors/Shops: 3x3 (bar, ristorante, cucine, camera, bagno);
- Roads/UrbanProps/Vegetation/Vehicles/Beach/Harbor: 4x10.

Ogni cella viene ritagliata, lo sfondo viene rimosso con GrabCut e maschera di
bordo, e l'elemento viene adattato alla scala universale senza deformazioni. I file
pronti per il motore sono copiati anche in `public/assets/scale/` con le chiavi
già usate dal gioco, mentre tutti gli originali restano in
`public/assets/original/<Categoria>/`.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SHEETS = ROOT / "docs" / "source_assets" / "sheets"
OUT = ROOT / "public" / "assets" / "original"
SCALE_OUT = ROOT / "public" / "assets" / "scale"
MANIFEST = ROOT / "docs" / "ORIGINAL_ASSETS_MANIFEST.json"
CATEGORIES = [
    "Buildings", "Roads", "Interiors", "Vehicles", "Trains", "Stations",
    "Characters", "Animals", "Furniture", "Shops", "Beach", "Harbor",
    "Vegetation", "UrbanProps",
]

# Celle: (foglio, colonna 0-based, riga 0-based) -> (cartella, nome, target, tipo)
# target = dimensione finale in pixel; tipo "sprite" rimuove lo sfondo,
# "texture" conserva l'intera cella come riquadro opaco.
MAP: dict[tuple[str, int, int], tuple[str, str, tuple[int, int] | None, str]] = {}

S1 = "b3b88625-a6df-4732-9fe3-5e801b8fbaf7.png"
for row in range(4):
    for col in range(4):
        name = "church" if row == 3 else f"facade_{row + 1}_{col + 1}"
        MAP[(S1, col, row)] = ("Buildings", name, (208, 212 if row == 3 else 160), "sprite")

S2 = "fb51c0b3-ad53-47eb-a4c1-828a7ef8591e.png"
for (col, row), name in {
    (0, 0): "shop_cafe", (1, 0): "shop_restaurant", (2, 0): "shop_trattoria",
    (0, 1): "shop_bar",
    (1, 1): "kitchen_1", (2, 1): "kitchen_2", (0, 2): "kitchen_3",
    (1, 2): "bedroom", (2, 2): "bathroom",
}.items():
    category = "Shops" if name.startswith("shop_") else "Interiors"
    MAP[(S2, col, row)] = (category, name, (256, 192), "sprite")

S3 = "f5b6326b-79d7-438b-bc5e-6f96b1919ba2.png"
CELLS3 = {
    (0, 0): ("Roads", "road_stone_a", (64, 64), "texture"),
    (1, 0): ("Roads", "road_stone_b", (64, 64), "texture"),
    (2, 0): ("Roads", "stairs_flowers_a", (64, 80), "sprite"),
    (3, 0): ("UrbanProps", "arch_flowers_a", (64, 96), "sprite"),
    (0, 1): ("Buildings", "stone_wall_a", (128, 96), "texture"),
    (1, 1): ("Buildings", "stone_wall_b", (128, 96), "texture"),
    (2, 1): ("Roads", "stairs_flowers_b", (64, 80), "sprite"),
    (3, 1): ("UrbanProps", "arch_flowers_b", (64, 96), "sprite"),
    (0, 2): ("Buildings", "door_stone", (64, 96), "sprite"),
    (1, 2): ("Buildings", "door_accessible", (64, 96), "sprite"),
    (2, 2): ("UrbanProps", "planters_flowers", (80, 64), "sprite"),
    (3, 2): ("Buildings", "stone_wall_c", (128, 96), "texture"),
    (0, 3): ("Roads", "mosaic_a", (64, 64), "texture"),
    (1, 3): ("UrbanProps", "drain", (48, 48), "sprite"),
    (2, 3): ("UrbanProps", "fence_metal_a", (96, 64), "sprite"),
    (3, 3): ("UrbanProps", "fence_metal_b", (96, 64), "sprite"),
    (0, 4): ("Buildings", "stone_wall_d", (128, 96), "texture"),
    (1, 4): ("Buildings", "stone_wall_e", (128, 96), "texture"),
    (2, 4): ("UrbanProps", "fence_metal_c", (96, 64), "sprite"),
    (3, 4): ("UrbanProps", "fence_metal_d", (96, 64), "sprite"),
    (0, 5): ("UrbanProps", "lamp", (48, 160), "sprite"),
    (1, 5): ("UrbanProps", "bench", (64, 32), "sprite"),
    (2, 5): ("UrbanProps", "fountain", (80, 96), "sprite"),
    (3, 5): ("Vegetation", "cactus", (48, 80), "sprite"),
    (0, 6): ("Vehicles", "car_a", (72, 40), "sprite"),
    (1, 6): ("Vehicles", "car_b", (72, 40), "sprite"),
    (2, 6): ("Vehicles", "scooter", (40, 20), "sprite"),
    (3, 6): ("Vehicles", "bicycle", (48, 32), "sprite"),
    (0, 7): ("Vegetation", "tree_a", (80, 112), "sprite"),
    (1, 7): ("Vegetation", "palm", (96, 160), "sprite"),
    (2, 7): ("Vegetation", "pergola", (96, 64), "sprite"),
    (3, 7): ("Vegetation", "tree_b", (80, 112), "sprite"),
    (0, 8): ("Buildings", "stone_wall_f", (128, 96), "texture"),
    (1, 8): ("Buildings", "stone_wall_g", (128, 96), "texture"),
    (2, 8): ("Vegetation", "pergola_b", (96, 64), "sprite"),
    (3, 8): ("Vegetation", "tree_c", (80, 112), "sprite"),
    (0, 9): ("Beach", "rock", (64, 48), "sprite"),
    (1, 9): ("Beach", "water_texture", (64, 64), "texture"),
    (2, 9): ("Beach", "sand_texture", (64, 64), "texture"),
    (3, 9): ("Harbor", "boat", (128, 48), "sprite"),
}
for (col, row), value in CELLS3.items():
    MAP[(S3, col, row)] = value

# Chiavi runtime già caricate da BootScene: alcune celle sostituiscono
# direttamente gli asset procedurali con la versione estratta dalle tavole.
RUNTIME_OVERRIDES = {
    # Solo soggetti con silhouette inequivocabile e scala già compatibile.
    # Le altre celle restano nella libreria originale come riferimento
    # artistico: sostituirle in runtime introdurrebbe strip di sfondo e
    # elementi sospesi, peggiorando la qualità verificata degli asset nativi.
    ("Vehicles", "car_a"): "car_white.png",
    ("Vehicles", "car_b"): "car_blue.png",
    ("Harbor", "boat"): "boat.png",
}


def dominant_border_color(rgb: np.ndarray) -> np.ndarray:
    """Colore di fondo stimato dagli angoli, dove il soggetto non arriva."""
    h, w = rgb.shape[:2]
    k = max(4, min(h, w) // 12)
    # L'angolo in alto a sinistra è quello che, nelle tre tavole, resta
    # sempre libero dal soggetto; gli altri angoli possono invece toccare
    # edifici od ombre e falsare la stima del fondo.
    corner = rgb[:k, :k].reshape(-1, 3).astype(np.int16)
    median = np.median(corner, axis=0).astype(np.int16)
    if median.mean() > 120 and int(median.max() - median.min()) < 80:
        return median
    border = np.concatenate([
        rgb[:k].reshape(-1, 3), rgb[-k:].reshape(-1, 3),
        rgb[:, :k].reshape(-1, 3), rgb[:, -k:].reshape(-1, 3),
    ]).astype(np.float32)
    _, labels, centers = cv2.kmeans(border.reshape(-1, 1, 3), 4, None,
                                    (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5),
                                    4, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(labels.ravel(), minlength=len(centers))
    return centers[int(np.argmax(counts))].astype(np.int16)


def extract_sprite(cell: Image.Image) -> tuple[Image.Image, float]:
    """Rimuove lo sfondo con GrabCut, conservando solo i componenti utili."""
    rgb = np.array(cell.convert("RGB"))
    h, w = rgb.shape[:2]
    bg = dominant_border_color(rgb)
    diff = np.max(np.abs(rgb.astype(np.int16) - bg), axis=2)

    mask = np.full((h, w), cv2.GC_PR_FGD, dtype=np.uint8)
    band = np.zeros((h, w), dtype=bool)
    edge = max(4, min(h, w) // 8)
    band[:edge, :] = True
    band[-edge:, :] = True
    band[:, :edge] = True
    band[:, -edge:] = True
    mask[band & (diff < 30)] = cv2.GC_PR_BGD
    # Bordo più esterno sempre di fondo: stabilizza GrabCut anche quando
    # l'oggetto tocca la cella e la texture di sfondo non è perfettamente piatta.
    mask[:3, :] = cv2.GC_BGD
    mask[-3:, :] = cv2.GC_BGD
    mask[:, :3] = cv2.GC_BGD
    mask[:, -3:] = cv2.GC_BGD
    # Non imporre FG definito: le tavole hanno sfondi texture che, con una
    # soglia troppo ampia, verrebbero etichettati come soggetto.
    # GrabCut usa un RNG interno: il seed fisso rende l'estrazione ripetibile.

    bg_model = np.zeros((1, 65), dtype=np.float64)
    fg_model = np.zeros((1, 65), dtype=np.float64)
    cv2.setRNGSeed(1)
    cv2.grabCut(rgb, mask, None, bg_model, fg_model, 5, cv2.GC_INIT_WITH_MASK)
    alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))

    count, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 0).astype(np.uint8), connectivity=8)
    keep = np.zeros_like(alpha)
    for label in range(1, count):
        if stats[label, cv2.CC_STAT_AREA] >= 20:
            keep[labels == label] = 255
    ys, xs = np.nonzero(keep)
    if xs.size == 0:
        # Nessun soggetto separabile: restituisce la cella come texture opaca.
        return cell.convert("RGBA"), 1.0
    x0, x1 = max(0, xs.min() - 2), min(w, xs.max() + 3)
    y0, y1 = max(0, ys.min() - 2), min(h, ys.max() + 3)
    rgba = np.dstack([rgb[y0:y1, x0:x1], keep[y0:y1, x0:x1]]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA"), float((keep > 0).mean())


def fit_sprite(image: Image.Image, target: tuple[int, int], align: str = "bottom") -> Image.Image:
    fitted = ImageOps.contain(image, target, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", target, (0, 0, 0, 0))
    x = (target[0] - fitted.width) // 2
    y = target[1] - fitted.height if align == "bottom" else (target[1] - fitted.height) // 2
    canvas.alpha_composite(fitted, (x, max(0, y)))
    return canvas


def copy_runtime_fallbacks() -> list[dict]:
    """Popola le cartelle senza celle dedicate con asset già verificati."""
    groups = {
        "Characters": ["player.png"] + [f"npc_{i}.png" for i in range(1, 13)] + ["npc_fisher.png"],
        "Animals": ["pet_dog.png", "pet_cat.png"],
        "Furniture": [
            "f_bed.png", "f_sofa.png", "f_table.png", "f_chair.png", "f_fridge.png",
            "f_stove.png", "f_shelf.png", "f_tv.png", "f_espresso.png", "f_register.png",
            "f_bathtub.png", "f_toilet.png", "f_plant.png", "f_washing_machine.png",
            "f_microwave.png", "f_desk.png", "f_crib.png",
        ],
        "Trains": ["train.png"],
    }
    rows = []
    for category, names in groups.items():
        for name in names:
            source = ROOT / "public" / "assets" / "sprites" / name
            if not source.exists():
                source = SCALE_OUT / name
            if not source.exists():
                continue
            target = OUT / category / name
            shutil.copy2(source, target)
            rows.append({"category": category, "name": name, "source": str(source), "fallback": True})
    return rows


def make_station_assets() -> list[dict]:
    """Crea stazione EAV originale ispirata alla foto della stazione di Baia."""
    ink = (12, 24, 35, 255)
    stone = (211, 181, 157, 255)
    plaster = (230, 210, 189, 255)
    terracotta = (182, 115, 82, 255)
    sea = (24, 95, 118, 255)
    yellow = (198, 142, 68, 255)
    white = (245, 240, 232, 255)

    station = Image.new("RGBA", (192, 80), (0, 0, 0, 0))
    draw = ImageDraw.Draw(station)
    draw.rectangle((4, 72, 188, 79), fill=(12, 24, 35, 70))
    draw.polygon([(12, 20), (180, 20), (192, 32), (0, 32)], fill=ink)
    draw.polygon([(15, 21), (177, 21), (186, 30), (6, 30)], fill=sea)
    for x in range(12, 184, 12):
        draw.line((x, 22, x - 6, 29), fill=plaster, width=1)
    draw.rectangle((14, 32, 178, 58), fill=ink)
    draw.rectangle((17, 34, 175, 56), fill=plaster)
    for x in range(22, 174, 30):
        draw.rectangle((x, 34, x + 4, 56), fill=ink)
        draw.rectangle((x + 1, 35, x + 3, 55), fill=stone)
    draw.rectangle((20, 42, 172, 45), fill=terracotta)
    draw.rectangle((74, 6, 118, 22), fill=ink)
    draw.rectangle((76, 8, 116, 20), fill=white)
    # EAV in caratteri 3x5, coerente con la pixel art del progetto.
    glyphs = {
        "E": ("111", "100", "110", "100", "111"),
        "A": ("010", "101", "111", "101", "101"),
        "V": ("101", "101", "101", "101", "010"),
    }
    for gi, letter in enumerate("EAV"):
        for ry, row in enumerate(glyphs[letter]):
            for rx, bit in enumerate(row):
                if bit == "1":
                    draw.point((80 + gi * 12 + rx, 10 + ry), fill=terracotta)
    draw.rectangle((0, 58, 192, 79), fill=ink)
    draw.rectangle((2, 60, 190, 77), fill=stone)
    draw.rectangle((2, 61, 190, 63), fill=yellow)
    for x in range(8, 190, 16):
        draw.line((x, 65, x - 4, 76), fill=(150, 126, 105, 255), width=1)

    platform = Image.new("RGBA", (192, 24), (0, 0, 0, 0))
    pd = ImageDraw.Draw(platform)
    pd.rectangle((0, 0, 191, 23), fill=ink)
    pd.rectangle((2, 2, 189, 21), fill=stone)
    pd.rectangle((2, 3, 189, 5), fill=yellow)
    for x in range(8, 189, 20):
        pd.line((x, 7, x - 6, 20), fill=(150, 126, 105, 255), width=1)

    rail = Image.new("RGBA", (192, 16), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rail)
    for x in range(4, 190, 18):
        rd.rectangle((x, 2, x + 8, 13), fill=(94, 63, 45, 255))
    rd.rectangle((0, 3, 191, 5), fill=ink)
    rd.rectangle((0, 10, 191, 12), fill=ink)

    rows = []
    for name, image in (("station_eav.png", station), ("platform.png", platform), ("rail.png", rail)):
        path = OUT / "Stations" / name
        image.save(path)
        if name == "station_eav.png":
            image.save(SCALE_OUT / name)
        rows.append({
            "category": "Stations",
            "name": name,
            "path": str(path.relative_to(ROOT)),
            "sourcePhoto": "docs/source_assets/photos/698ca65f.png",
            "coverage": 1.0,
            "target": list(image.size),
            "runtimeOverride": "station_eav.png" if name == "station_eav.png" else None,
        })
    return rows


def main() -> None:
    for category in CATEGORIES:
        (OUT / category).mkdir(parents=True, exist_ok=True)
    manifest = []
    grids = [(S1, 4, 4), (S2, 3, 3), (S3, 4, 10)]
    for filename, cols, rows in grids:
        sheet = Image.open(SHEETS / filename).convert("RGB")
        cw, ch = sheet.width // cols, sheet.height // rows
        for row in range(rows):
            for col in range(cols):
                key = (filename, col, row)
                if key not in MAP:
                    continue
                category, name, target, kind = MAP[key]
                cell = sheet.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
                if kind == "texture":
                    image = ImageOps.fit(cell.convert("RGB"), target, Image.Resampling.LANCZOS)
                    coverage = 1.0
                else:
                    image, coverage = extract_sprite(cell)
                    image = fit_sprite(image, target or image.size)
                destination = OUT / category / f"{name}.png"
                image.save(destination)
                runtime_key = RUNTIME_OVERRIDES.get((category, name))
                if runtime_key:
                    image.save(SCALE_OUT / runtime_key)
                manifest.append({
                    "sourceSheet": filename,
                    "cell": {"col": col, "row": row, "x": col * cw, "y": row * ch, "w": cw, "h": ch},
                    "category": category,
                    "name": name,
                    "kind": kind,
                    "coverage": round(coverage, 4),
                    "target": list(image.size),
                    "path": str(destination.relative_to(ROOT)),
                    "runtimeOverride": runtime_key,
                })
    manifest.extend(copy_runtime_fallbacks())
    manifest.extend(make_station_assets())
    MANIFEST.write_text(json.dumps({
        "scale": "1 metro = 16 pixel",
        "gridReading": "docs/SHEET_GRID_READ.json",
        "assets": manifest,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"estratti {len(manifest)} asset in {OUT}")
    print(f"manifest: {MANIFEST}")


if __name__ == "__main__":
    main()
