"""Analisi visiva strutturale delle fotografie di Bacoli.

 usa OpenCV (Canny + Hough), clustering cromatico e mappe ASCII di luminanza.
 Produce un report leggibile anche senza poter visualizzare direttamente le
 immagini: sintesi di colori, geometria delle facciate, orizzonte e dettagli.

 Uso: python tools/analyze_visual.py [cartella_uploads]
"""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
UPLOADS = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    r"C:\Users\rocka\AppData\Local\Temp\opencode\uploads")
OUT = ROOT / "docs" / "VISUAL_ANALYSIS.md"

RAMP = " .:-=+*#%@"


def luminance_map(image: np.ndarray, cols: int = 60, rows: int = 26) -> list[str]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (cols, rows), interpolation=cv2.INTER_AREA)
    lines = []
    for row in small:
        lines.append("".join(RAMP[min(9, int(v) * 10 // 256)] for v in row))
    return lines


def color_summary(image: np.ndarray) -> list[tuple[str, float]]:
    small = cv2.resize(image, (160, 160), interpolation=cv2.INTER_AREA)
    pixels = small.reshape(-1, 3)
    # 8 livelli per canale: colori dominanti "percepitivi", non rumore JPEG.
    quant = (pixels // 32 * 32).astype(np.uint8)
    counter = Counter(tuple(int(v) for v in p) for p in quant)
    total = len(quant)
    return [(f"#{r:02X}{g:02X}{b:02X}", 100 * n / total)
            for (b, g, r), n in counter.most_common(10)]


def geometry(image: np.ndarray) -> dict:
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 80, 180)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=max(40, w // 12),
                            minLineLength=max(30, w // 10), maxLineGap=8)
    horizontal = vertical = diagonal = 0
    lengths = []
    if lines is not None:
        for line in np.asarray(lines).reshape(-1, 4):
            x1, y1, x2, y2 = [int(v) for v in line]
            dx, dy = abs(x2 - x1), abs(y2 - y1)
            lengths.append(int(np.hypot(dx, dy)))
            if dx > dy * 3:
                horizontal += 1
            elif dy > dx * 3:
                vertical += 1
            else:
                diagonal += 1
    # Orizzonte approssimato: riga con maggior cambio di colore tra bande.
    blur = cv2.GaussianBlur(image, (1, 9), 0)
    diff = np.mean(np.abs(blur[:-1].astype(float) - blur[1:].astype(float)), axis=(1, 2))
    horizon = int(np.argmax(diff[:int(h * 0.75)]) or h // 2)
    return {
        "dimensioni": f"{w}x{h}",
        "edge_density": round(float(np.mean(edges > 0)) * 100, 2),
        "linee_orizzontali": horizontal,
        "linee_verticali": vertical,
        "linee_diagonali": diagonal,
        "lunghezza_media_linee": round(float(np.mean(lengths))) if lengths else 0,
        "riga_orizzonte": horizon,
        "posizione_orizzonte": round(100 * horizon / h, 1),
    }


def regions(image: np.ndarray) -> dict[str, float]:
    h, w = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    total = h * w
    # blu/ciano = mare o cielo; verde = vegetazione; caldo/neutro = pietra/intonaco.
    blue = cv2.inRange(hsv, np.array([85, 45, 50]), np.array([140, 255, 255]))
    green = cv2.inRange(hsv, np.array([30, 40, 40]), np.array([85, 255, 255]))
    warm = cv2.inRange(hsv, np.array([0, 30, 70]), np.array([30, 255, 255]))
    return {
        "blu_mare_cielo": round(100 * np.count_nonzero(blue) / total, 1),
        "verde_vegetazione": round(100 * np.count_nonzero(green) / total, 1),
        "caldo_pietra_intonaco": round(100 * np.count_nonzero(warm) / total, 1),
    }


def main() -> None:
    files = sorted(UPLOADS.rglob("*.png")) + sorted(UPLOADS.rglob("*.jpg"))
    report = [
        "# Analisi visiva delle fotografie ricevute",
        "",
        "Analisi automatica con OpenCV: colori dominanti, geometria delle linee,",
        "segmentazione cromatiche e mappa di luminanza. La mappa ASCII permette di",
        "leggere la composizione anche senza visualizzare direttamente l'immagine.",
        "",
    ]
    for index, path in enumerate(files, start=1):
        image = cv2.imread(str(path))
        if image is None:
            continue
        if max(image.shape[:2]) > 1200:
            scale = 1200 / max(image.shape[:2])
            image = cv2.resize(image, None, fx=scale, fy=scale)
        report += [
            f"## Foto {index} — `{path.name}`",
            "",
            f"- Geometria: {geometry(image)}",
            f"- Regioni: {regions(image)}",
            "- Colori dominanti: " + ", ".join(
                f"{color} {percent:.1f}%" for color, percent in color_summary(image)),
            "",
            "```text",
            *luminance_map(image),
            "```",
            "",
        ]
        print(f"analizzata: {path.name}")
    OUT.write_text("\n".join(report), encoding="utf-8")
    print(f"report: {OUT}")


if __name__ == "__main__":
    main()
