"""Confronto deterministico tra screenshot M6 segnalato e anteprima REBUILD 2.0."""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "docs" / "rebuild2" / "audit"
IMAGES = {
    "M6 segnalato": AUDIT / "screenshot_utente.png",
    "REBUILD 2.0": AUDIT / "rebuild2_preview.png",
}
OUT = AUDIT / "confronto_visivo.md"


def features(path: Path) -> dict:
    array = np.asarray(Image.open(path).convert("RGB"))
    r, g, b = [array[:, :, i].astype(np.int16) for i in range(3)]
    gray = cv2.cvtColor(array, cv2.COLOR_RGB2GRAY)
    masks = {
        "blue": (b > r + 25) & (b > g + 10) & (b > 80),
        "green": (g > r + 18) & (g > b + 8) & (g > 60),
        "red": (r > g + 25) & (r > b + 25) & (r > 80),
        "white": (r > 200) & (g > 200) & (b > 200),
        "gray": (np.abs(r - g) < 12) & (np.abs(g - b) < 12) & (r > 60) & (r < 190),
    }
    result = {
        "size": f"{array.shape[1]}x{array.shape[0]}",
        "dark<70": round(float((gray < 70).mean() * 100), 2),
        "mean_rgb": [round(float(array[:, :, i].mean()), 1) for i in range(3)],
        "edge_density": round(float((cv2.Canny(gray, 50, 150) > 0).mean() * 100), 2),
        "unique_colors": int(len(np.unique(array.reshape(-1, 3), axis=0))),
    }
    for name, mask in masks.items():
        result[name] = round(float(mask.mean() * 100), 2)
        count, _, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
        result[f"{name}_components"] = int(sum(1 for i in range(1, count) if stats[i, 4] >= 40))
        if name == "blue":
            large = [int(stats[i, 4]) for i in range(1, count) if stats[i, 4] >= 40]
            result["blue_max_component"] = max(large) if large else 0
    return result


def main() -> None:
    data = {name: features(path) for name, path in IMAGES.items()}
    keys = list(next(iter(data.values())).keys())
    lines = [
        "# Confronto visivo deterministico",
        "",
        "Stesse maschere e soglie usate per l'analisi dello screenshot segnalato. "
        "Un valore basso di `blue_components` indica assenza di marker rettangolari; "
        "un `edge_density` maggiore indica più dettaglio visivo.",
        "",
        "| Metrica | " + " | ".join(data) + " |",
        "|---|" + "---:|" * len(data),
    ]
    for key in keys:
        values = [str(data[name][key]) for name in data]
        lines.append(f"| {key} | " + " | ".join(values) + " |")
    lines += [
        "",
        "## Limiti",
        "",
        "Le metriche non certificano la bellezza: la approvazione finale resta visiva da parte dell'utente. "
        "Il modello corrente non può vedere le immagini; la descrizione Ollama è solo di supporto.",
        "",
    ]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
