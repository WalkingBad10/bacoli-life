"""Rileva deterministicamente colori piatti e marker nello screenshot utente."""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMAGE = ROOT / "docs" / "rebuild2" / "audit" / "screenshot_utente.png"
OUT = ROOT / "docs" / "rebuild2" / "audit" / "screenshot_feature.md"


def masks(array: np.ndarray) -> dict[str, np.ndarray]:
    r, g, b = [array[:, :, i].astype(np.int16) for i in range(3)]
    return {
        "blu_marker": (b > r + 25) & (b > g + 10) & (b > 80),
        "verde_marciapiede": (g > r + 18) & (g > b + 8) & (g > 60),
        "rosso_mattone": (r > g + 25) & (r > b + 25) & (r > 80),
        "bianco_finestra": (r > 200) & (g > 200) & (b > 200),
        "grigio_strada": (np.abs(r - g) < 12) & (np.abs(g - b) < 12) & (r > 60) & (r < 190),
    }


def components(mask: np.ndarray, min_area: int = 40) -> list[tuple[int, int, int, int, int]]:
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    result = []
    for i in range(1, count):
        x, y, w, h, area = stats[i]
        if area >= min_area:
            result.append((int(area), int(x), int(y), int(w), int(h)))
    return sorted(result, reverse=True)


def main() -> None:
    array = np.asarray(Image.open(IMAGE).convert("RGB"))
    total = array.shape[0] * array.shape[1]
    lines = ["# Feature deterministiche screenshot utente", ""]
    for name, mask in masks(array).items():
        pct = float(mask.mean() * 100)
        comps = components(mask)
        lines.append(f"## {name}: {pct:.2}% ({int(mask.sum())} px)")
        lines.append(f"Componenti >=40 px: {len(comps)}")
        for area, x, y, w, h in comps[:8]:
            lines.append(f"- area {area} a ({x},{y}) dimensione {w}x{h}")
        lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:60]))


if __name__ == "__main__":
    main()
