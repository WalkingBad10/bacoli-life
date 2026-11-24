"""Crea anteprime delle celle estratte e chiede a Ollama di identificarle.

Uso: python tools/identify_sheet_cells.py
"""
from __future__ import annotations

import base64
import io
import json
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from extract_original_assets import SHEETS, S3, extract_sprite  # noqa: E402

OUT = ROOT / "docs" / "sheet3_cells"
REPORT = ROOT / "docs" / "SHEET3_CELL_IDENTIFICATION.json"
API = "http://127.0.0.1:11434/api/generate"
MODEL = "qwen2.5vl:3b"
PROMPT = (
    "In questa riga ci sono 4 riquadri etichettati A, B, C, D. Di' in italiano "
    "che oggetto c'è in ogni riquadro, una riga per riquadro, senza ripetere "
    "frasi uguali. Massimo 4 righe corte."
)


def ask(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    payload = {
        "model": MODEL,
        "prompt": PROMPT,
        "images": [base64.b64encode(buffer.getvalue()).decode("ascii")],
        "stream": False,
        "options": {"num_predict": 180},
    }
    request = urllib.request.Request(
        API, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=900) as response:
        return str(json.loads(response.read().decode()).get("response", "")).strip()


def background(size: tuple[int, int]) -> Image.Image:
    image = Image.new("RGB", size, (225, 225, 220))
    draw = ImageDraw.Draw(image)
    step = 16
    for y in range(0, size[1], step):
        for x in range(0, size[0], step):
            if (x // step + y // step) % 2 == 0:
                draw.rectangle((x, y, x + step - 1, y + step - 1), fill=(205, 205, 200))
    return image


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SHEETS / S3).convert("RGB")
    cw, ch = sheet.width // 4, sheet.height // 10
    entries = []
    for row in range(10):
        strip = Image.new("RGB", (4 * 240, 140), (245, 245, 245))
        draw = ImageDraw.Draw(strip)
        for col in range(4):
            cell = sheet.crop((col * cw, row * ch, (col + 1) * cw, (row + 1) * ch))
            sprite, _ = extract_sprite(cell)
            tile = background((232, 112))
            fitted = ImageOps.contain(sprite, (224, 100), Image.Resampling.LANCZOS)
            tile.paste(fitted, ((232 - fitted.width) // 2, 8), fitted)
            strip.paste(tile, (col * 240, 24))
            draw.rectangle((col * 240, 2, col * 240 + 26, 20), fill=(20, 20, 20))
            draw.text((col * 240 + 8, 5), "ABCD"[col], fill=(255, 255, 255))
        path = OUT / f"row_{row + 1:02d}.png"
        strip.save(path)
        print(f"Analisi riga {row + 1}", flush=True)
        try:
            response = ask(strip)
        except Exception as error:
            response = f"Analisi non riuscita: {error}"
        entries.append({"row": row + 1, "file": str(path), "response": response})
    REPORT.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"salvato {REPORT}")


if __name__ == "__main__":
    main()
