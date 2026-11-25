"""Identifica lo screenshot segnalato confrontandolo con quelli del progetto."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [
    Path(r"C:\Users\rocka\AppData\Local\Temp\opencode\uploads\6bf430ad-ee72-40e3-9d58-fcbd58970d39\image.png"),
    Path(r"C:\Users\rocka\AppData\Local\Temp\opencode\uploads\06cebf7e-9fc7-48d8-8780-da52509239fa\image.png"),
    Path(r"C:\Users\rocka\AppData\Local\Temp\opencode\uploads\e9f3cb6d-8faa-4ac0-b6b7-177bd6889588\image.png"),
]


def features(path: Path) -> np.ndarray:
    image = Image.open(path).convert("RGB").resize((64, 64))
    array = np.asarray(image, dtype=np.float32) / 255.0
    # Istogramma di colore 4x4x4 + media dei canali: robusto a risoluzione diversa.
    hist, _ = np.histogramdd(
        array.reshape(-1, 3), bins=(4, 4, 4), range=((0, 1), (0, 1), (0, 1))
    )
    return np.concatenate([hist.ravel() / hist.sum(), array.mean(axis=(0, 1))])


def main() -> None:
    candidates = sorted(
        p for folder in ("docs/M6_SCREENSHOTS", "docs/M5_SCREENSHOTS", "screenshots")
        for p in (ROOT / folder).rglob("*.png")
    )
    print(f"candidati: {len(candidates)}")
    for target in TARGETS:
        tf = features(target)
        scores = []
        for candidate in candidates:
            score = float(np.linalg.norm(tf - features(candidate)))
            scores.append((score, candidate))
        scores.sort(key=lambda item: item[0])
        print(f"\n{target} ({Image.open(target).size}):")
        for score, candidate in scores[:6]:
            print(f"  {score:.4f}  {candidate.relative_to(ROOT)}")
        image = np.asarray(Image.open(target).convert("RGB"))
        flat = image.reshape(-1, 3)
        print(
            "  media RGB",
            flat.mean(axis=0).round(1),
            "V<70",
            round(float((flat.max(axis=1) < 70).mean() * 100), 2),
            "%",
        )


if __name__ == "__main__":
    main()
