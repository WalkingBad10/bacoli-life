"""Palette deterministiche dalle fotografie reali fornite (K-means, Pillow/OpenCV)."""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
UPLOADS = Path(r"C:\Users\rocka\AppData\Local\Temp\opencode\uploads")
OUT = ROOT / "docs" / "rebuild2" / "data" / "photo_palettes.json"
KEYS = ["0b6d0607", "2372f3d0", "3c19d026", "b3b88625", "fb51c0b3", "f5b6326b"]


def find_image(key: str) -> Path | None:
    matches = sorted(UPLOADS.rglob(f"*{key}*"))
    for path in matches:
        if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
            return path
    return None


def palette(path: Path) -> list[dict]:
    image = Image.open(path).convert("RGB")
    array = np.asarray(image.resize((160, 160))).reshape(-1, 3).astype(np.float32)
    # Escludiamo cielo troppo chiaro e vegetazione troppo verde per isolare intonaci/facciate.
    mask = (array.max(axis=1) < 235) & ~((array[:, 1] > array[:, 0] + 25) & (array[:, 1] > array[:, 2] + 15))
    sample = array[mask]
    if len(sample) < 100:
        sample = array
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.5)
    _, labels, centers = cv2.kmeans(sample, 6, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(labels.ravel(), minlength=6)
    order = np.argsort(-counts)
    return [
        {
            "hex": "#{:02x}{:02x}{:02x}".format(*[int(v) for v in centers[i]]),
            "percent": round(float(counts[i] / counts.sum() * 100), 1),
        }
        for i in order
    ]


def main() -> None:
    result = {}
    for key in KEYS:
        path = find_image(key)
        if path is None:
            continue
        result[key] = {"file": str(path), "size": list(Image.open(path).size), "palette": palette(path)}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    for key, value in result.items():
        print(key, value["size"], " ".join(f"{item['hex']}({item['percent']}%)" for item in value["palette"][:5]))


if __name__ == "__main__":
    main()
