"""Estrae sprite da tavole artistiche e rimuove lo sfondo.

Uso:
  python tools/extract_asset_sheets.py IMMAGINE [IMMAGINE ...]

Opzioni utili:
  --out public/assets/scale_from_sheets
  --grid 8,8     # se la tavola è una griglia regolare: colonne,righe
  --tolerance 18 # tolleranza colore per lo sfondo

Senza --grid lo script usa OpenCV per trovare i componenti connessi delle
figure, dopo una leggera dilatazione che riunisce i dettagli interni.
I file estratti mantengono i pixel originali: non vengono ridefiniti né
deformati.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def corner_background(rgb: np.ndarray) -> np.ndarray:
    h, w = rgb.shape[:2]
    k = max(4, min(h, w) // 16)
    samples = np.concatenate([
        rgb[:k, :k].reshape(-1, 3), rgb[:k, -k:].reshape(-1, 3),
        rgb[-k:, :k].reshape(-1, 3), rgb[-k:, -k:].reshape(-1, 3),
    ])
    return np.median(samples, axis=0).astype(np.int16)


def alpha_mask(rgb: np.ndarray, bg: np.ndarray, tolerance: int) -> np.ndarray:
    diff = np.abs(rgb.astype(np.int16) - bg)
    mask = (np.max(diff, axis=2) > tolerance).astype(np.uint8)
    # Rimuove il rumore di compressione JPEG senza mangiare i contorni.
    return cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))


def save_sprite(rgb: np.ndarray, mask: np.ndarray, path: Path) -> bool:
    ys, xs = np.nonzero(mask)
    if xs.size < 24:
        return False
    pad = 1
    x0, x1 = max(0, xs.min() - pad), min(rgb.shape[1], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(rgb.shape[0], ys.max() + pad + 1)
    crop = rgb[y0:y1, x0:x1]
    alpha = mask[y0:y1, x0:x1] * 255
    out = np.dstack([crop, alpha]).astype(np.uint8)
    Image.fromarray(out, mode="RGBA").save(path)
    return True


def extract_components(rgb: np.ndarray, mask: np.ndarray, out_dir: Path, stem: str) -> list[Path]:
    joined = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=1)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(joined, connectivity=8)
    paths: list[Path] = []
    for label in range(1, count):
        x, y, w, h, area = stats[label]
        if area < 40 or w < 3 or h < 3:
            continue
        local = np.zeros_like(mask)
        local[max(0, y - 2):min(mask.shape[0], y + h + 2),
              max(0, x - 2):min(mask.shape[1], x + w + 2)] = 1
        local = local & mask
        path = out_dir / f"{stem}_{len(paths) + 1:03d}.png"
        if save_sprite(rgb, local, path):
            paths.append(path)
    return paths


def extract_grid(rgb: np.ndarray, mask: np.ndarray, out_dir: Path, stem: str,
                 cols: int, rows: int) -> list[Path]:
    h, w = mask.shape
    cw, ch = w // cols, h // rows
    paths: list[Path] = []
    for row in range(rows):
        for col in range(cols):
            x0, y0 = col * cw, row * ch
            x1, y1 = (col + 1) * cw, (row + 1) * ch
            local = np.zeros_like(mask)
            local[y0:y1, x0:x1] = mask[y0:y1, x0:x1]
            path = out_dir / f"{stem}_r{row + 1:02d}_c{col + 1:02d}.png"
            if save_sprite(rgb, local, path):
                paths.append(path)
    return paths


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("images", nargs="+", type=Path)
    parser.add_argument("--out", type=Path,
                        default=ROOT / "public" / "assets" / "scale_from_sheets")
    parser.add_argument("--grid", default="", help="colonne,righe (es. 8,8)")
    parser.add_argument("--tolerance", type=int, default=18)
    args = parser.parse_args()

    grid: tuple[int, int] | None = None
    if args.grid:
        cols, rows = (int(part) for part in args.grid.split(","))
        grid = (cols, rows)

    args.out.mkdir(parents=True, exist_ok=True)
    all_paths: list[Path] = []
    for image_path in args.images:
        with Image.open(image_path) as image:
            rgb = np.array(image.convert("RGB"))
        bg = corner_background(rgb)
        mask = alpha_mask(rgb, bg, args.tolerance)
        stem = image_path.stem.lower().replace(" ", "_")
        if grid:
            paths = extract_grid(rgb, mask, args.out, stem, *grid)
        else:
            paths = extract_components(rgb, mask, args.out, stem)
        print(f"{image_path.name}: bg={bg.tolist()} sprite={len(paths)}")
        all_paths.extend(paths)
    print(f"estratti {len(all_paths)} PNG in {args.out}")


if __name__ == "__main__":
    main()
