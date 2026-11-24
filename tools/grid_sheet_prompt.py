"""Crea una versione grigliata delle tavole e chiede a Ollama il contenuto di ogni cella."""
from __future__ import annotations

import base64
import io
import json
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "SHEET_GRID_READ.json"
MODEL = "qwen2.5vl:3b"
API = "http://127.0.0.1:11434/api/generate"


def ask(image: Image.Image, grid: str) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    prompt = (
        f"Questa immagine ha una griglia {grid} con etichette riga-colonna. "
        "Elenca il contenuto di ogni cella, riga per riga, in italiano, "
        "usando una riga per cella: A1: ..., A2: ... . Massimo 20 righe. "
        "Non inventare quello che non vedi."
    )
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "images": [base64.b64encode(buffer.getvalue()).decode("ascii")],
        "stream": False,
        "options": {"num_predict": 600},
    }
    request = urllib.request.Request(API, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=900) as response:
        return str(json.loads(response.read().decode()).get("response", "")).strip()


def main() -> None:
    specs = [
        (Path(sys.argv[1]), 4, 4),
        (Path(sys.argv[2]), 3, 3),
        (Path(sys.argv[3]), 4, 10),
    ]
    entries = []
    for path, cols, rows in specs:
        image = Image.open(path).convert("RGB")
        overlay = image.copy()
        draw = ImageDraw.Draw(overlay)
        cw, ch = image.width // cols, image.height // rows
        for c in range(cols + 1):
            draw.line((c * cw, 0, c * cw, image.height), fill=(255, 30, 30), width=3)
        for r in range(rows + 1):
            draw.line((0, r * ch, image.width, r * ch), fill=(255, 30, 30), width=3)
        for r in range(rows):
            for c in range(cols):
                label = f"{chr(65 + r)}{c + 1}"
                draw.rectangle((c * cw + 4, r * ch + 4, c * cw + 52, r * ch + 26), fill=(0, 0, 0))
                draw.text((c * cw + 8, r * ch + 6), label, fill=(255, 255, 255))
        target = ROOT / "docs" / f"grid_{path.stem[:8]}.png"
        overlay.save(target)
        print(f"Analisi di {target.name}", flush=True)
        try:
            text = ask(overlay, f"{cols}x{rows}")
        except Exception as error:
            text = f"Analisi non riuscita: {error}"
        entries.append({"file": str(target), "grid": [cols, rows], "response": text})
    OUT.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"salvato {OUT}")


if __name__ == "__main__":
    main()
