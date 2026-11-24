"""Classifica e descrive con Ollama le nuove immagini ricevute."""
from __future__ import annotations

import base64
import io
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PREVIEWS = ROOT / "docs" / "image_previews"
OUT = ROOT / "docs" / "NEW_ASSETS_ANALYSIS.json"
MODEL = "qwen2.5vl:3b"
API = "http://127.0.0.1:11434/api/generate"
PROMPT = (
    "Descrivi questa immagine in italiano, in massimo 10 righe concrete. "
    "Prima dici se è una fotografia reale, una tavola pixel art o una mappa. "
    "Se è una tavola, elenca gli elementi separabili e la disposizione a griglia. "
    "Se è una fotografia, indica luogo visibile, edifici, strade, mare e veicoli. "
    "Non inventare dettagli."
)


def ask(path: Path) -> str:
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    image = Image.open(path).convert("RGB")
    image.thumbnail((1536, 1536), Image.Resampling.LANCZOS)
    preview = PREVIEWS / f"{path.parent.name[:8]}.jpg"
    image.save(preview, quality=90)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    payload = {
        "model": MODEL,
        "prompt": PROMPT,
        "images": [base64.b64encode(buffer.getvalue()).decode("ascii")],
        "stream": False,
        "options": {"num_predict": 260},
    }
    request = urllib.request.Request(API, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=900) as response:
        return str(json.loads(response.read().decode()).get("response", "")).strip()


def main() -> None:
    paths = [Path(arg) for arg in sys.argv[1:]]
    entries = []
    for path in paths:
        print(f"Analisi di {path.parent.name[:8]}", flush=True)
        try:
            text = ask(path)
        except Exception as error:
            text = f"Analisi non riuscita: {error}"
        entries.append({"dir": path.parent.name, "file": str(path), "bytes": path.stat().st_size, "response": text})
    OUT.write_text(json.dumps({"analyzedAt": datetime.now(timezone.utc).isoformat(), "model": MODEL, "entries": entries}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"salvato {OUT}")


if __name__ == "__main__":
    main()
