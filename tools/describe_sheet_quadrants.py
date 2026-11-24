"""Descrive i quadranti delle tavole con Ollama per capire la disposizione.

Uso:
    python tools/describe_sheet_quadrants.py IMMAGINE [IMMAGINE ...]

Salva i quadranti in `docs/sheet_quadrants/` e il report in
`docs/ASSET_SHEETS_QUADRANTS.json`.
"""
from __future__ import annotations

import base64
import io
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "sheet_quadrants"
OUT = ROOT / "docs" / "ASSET_SHEETS_QUADRANTS.json"
MODEL = "qwen2.5vl:3b"
API = "http://127.0.0.1:11434/api/generate"

PROMPT = (
    "Elenca in italiano, in massimo 8 righe brevi, gli oggetti visibili in "
    "questa porzione di immagine. Non ripetere la stessa frase. Se vedi una "
    "griglia di riquadri, descrivi il contenuto di ogni riquadro principale. "
    "Niente elaborate, solo oggetti concreti."
)


def ask(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    payload = {
        "model": MODEL,
        "prompt": PROMPT,
        "images": [base64.b64encode(buffer.getvalue()).decode("ascii")],
        "stream": False,
        "options": {"num_predict": 280},
    }
    request = urllib.request.Request(
        API,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=900) as response:
        return str(json.loads(response.read().decode("utf-8")).get("response", "")).strip()


def main() -> None:
    paths = [Path(arg) for arg in sys.argv[1:]]
    if not paths:
        raise SystemExit("passa almeno un'immagine")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    entries = []
    for path in paths:
        image = Image.open(path).convert("RGB")
        w, h = image.size
        for row in range(2):
            for col in range(2):
                crop = image.crop((col * w // 2, row * h // 2, (col + 1) * w // 2, (row + 1) * h // 2))
                name = f"{path.stem[:8]}_r{row + 1}c{col + 1}.png"
                target = OUT_DIR / name
                crop.save(target)
                print(f"Analisi di {name}", flush=True)
                try:
                    response = ask(crop)
                except Exception as error:
                    response = f"Analisi non riuscita: {error}"
                entries.append({"file": str(target), "response": response})
    OUT.write_text(json.dumps({
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
        "model": MODEL,
        "entries": entries,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"salvato {OUT}")


if __name__ == "__main__":
    main()
