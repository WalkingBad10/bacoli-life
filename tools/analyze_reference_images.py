"""Analisi delle foto di riferimento con Ollama qwen2.5vl.

Uso:
  python tools/analyze_reference_images.py <image1> [image2 ...]

Scrive docs/REFERENCE_IMAGES_M4.json con le risposte grezze del modello.
Le immagini restano fuori dal repository: vengono lette solo come byte.
"""
from __future__ import annotations

import base64
import io
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "REFERENCE_IMAGES_M4.json"
URL = "http://127.0.0.1:11434/api/generate"
MODEL = "qwen2.5vl:3b"

PROMPT = """Analizza questa fotografia come riferimento per un videogioco pixel art
ambientato a Bacoli. Rispondi in italiano con frasi brevi e numeri quando puoi.
Non inventare elementi non visibili: scrivi 'non visibile' se non li vedi.
Descrivi precisamente:
1) soggetto e luogo probabile;
2) numero di piani degli edifici visibili e loro altezza approssimativa in metri;
3) larghezza approssimativa della strada/marciapiede in metri e tipo di pavimento;
4) materiali e colori di facciate, tetti, persiane, balconi, ringhiere;
5) porte, finestre, balconi, terrazzi, scale, segnaletica, arredo urbano;
6) rapporto visivo tra persone (se presenti), edifici, auto e vegetazione;
7) dettagli da riprodurre in pixel art con scala 1 metro = 16 pixel.
""".strip()


def encode_for_vision(path: Path) -> str:
    """Riduce l'immagine in memoria: Ollama rifiuta payload PNG troppo grandi."""
    with Image.open(path) as image:
        image = image.convert("RGB")
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=88)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def analyze(path: Path) -> dict:
    payload = {
        "model": MODEL,
        "prompt": PROMPT,
        "images": [encode_for_vision(path)],
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_predict": 500,
            "repeat_penalty": 1.15,
            "repeat_last_n": 64,
        },
    }
    request = urllib.request.Request(
        URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Ollama HTTP {error.code}: {body[:600]}") from error
    return {
        "file": str(path),
        "bytes": path.stat().st_size,
        "model": MODEL,
        "response": result.get("response", "").strip(),
    }


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Passa almeno un percorso immagine")
    previous = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else []
    entries = previous + [analyze(Path(arg)) for arg in sys.argv[1:]]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
        "scaleReference": "1 metro = 16 pixel; adulto 1,75 m = 28 px",
        "entries": entries,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    for entry in entries[-len(sys.argv) + 1:]:
        print(f"--- {Path(entry['file']).name} ---")
        print(entry["response"])


if __name__ == "__main__":
    main()
