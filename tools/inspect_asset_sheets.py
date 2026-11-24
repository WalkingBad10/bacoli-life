"""Analisi strutturale delle tavole: sfondo, griglia e componenti.

Uso: python tools/inspect_asset_sheets.py IMMAGINE [IMMAGINE ...]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "ASSET_SHEETS_STRUCTURE.json"


def peaks(values: np.ndarray, limit: int = 40) -> list[int]:
    threshold = values.mean() + values.std() * 1.5
    candidates = [i for i, value in enumerate(values) if value > threshold]
    if not candidates:
        return []
    groups: list[list[int]] = []
    for index in candidates:
        if groups and index - groups[-1][-1] <= 3:
            groups[-1].append(index)
        else:
            groups.append([index])
    return [int(round(np.mean(group))) for group in groups[:limit]]


def inspect(path: Path) -> dict:
    bgr = cv2.imread(str(path), cv2.IMREAD_COLOR)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    k = max(8, min(h, w) // 12)
    samples = np.concatenate([
        rgb[:k, :k].reshape(-1, 3), rgb[:k, -k:].reshape(-1, 3),
        rgb[-k:, :k].reshape(-1, 3), rgb[-k:, -k:].reshape(-1, 3),
    ])
    bg = np.median(samples, axis=0).astype(np.int16)
    diff = np.max(np.abs(rgb.astype(np.int16) - bg), axis=2)
    mask = (diff > 24).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    joined = cv2.dilate(mask, np.ones((9, 9), np.uint8), iterations=2)
    count, _, stats, _ = cv2.connectedComponentsWithStats(joined, connectivity=8)
    components = []
    for label in range(1, count):
        x, y, cw, ch, area = stats[label]
        if area < 300 or cw < 12 or ch < 12:
            continue
        components.append({"x": int(x), "y": int(y), "w": int(cw), "h": int(ch), "area": int(area)})
    components.sort(key=lambda item: (item["y"], item["x"]))
    return {
        "file": str(path),
        "size": [w, h],
        "backgroundRGB": bg.tolist(),
        "maskCoverage": round(float(mask.mean()), 4),
        "columnPeaks": peaks(mask.sum(axis=0) / h),
        "rowPeaks": peaks(mask.sum(axis=1) / w),
        "components": components[:120],
        "componentCount": len(components),
    }


def main() -> None:
    paths = [Path(arg) for arg in sys.argv[1:]]
    result = [inspect(path) for path in paths]
    OUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    for item in result:
        print(
            f"{Path(item['file']).name}: bg={item['backgroundRGB']} "
            f"coverage={item['maskCoverage']} components={item['componentCount']} "
            f"colPeaks={item['columnPeaks'][:12]} rowPeaks={item['rowPeaks'][:12]}"
        )
    print(f"salvato {OUT}")


if __name__ == "__main__":
    main()
