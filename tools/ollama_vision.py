"""Analisi visiva locale delle fotografie con Ollama + qwen2.5vl.

Nessuna API key o servizio esterno: il modello gira su localhost.
Uso: python tools/ollama_vision.py
"""
from __future__ import annotations

import base64
import json
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPLOADS = Path(r"C:\Users\rocka\AppData\Local\Temp\opencode\uploads")
OUT = ROOT / "docs" / "AI_VISION_ANALYSIS.md"
MODEL = "qwen2.5vl:3b"
API = "http://127.0.0.1:11434/api/generate"

PROMPT = (
    "Analizza questa fotografia per un simulatore di vita in pixel art ambientato a Bacoli. "
    "Descrivi in italiano, in massimo 8 punti brevi: soggetto principale, edifici e facciate, "
    "balconi e ringhiere, strade e marciapiedi, vegetazione, mare/cielo, colori dominanti, "
    "dettagli che andrebbero riprodotti in pixel art 16x16. Non inventare quello che non vedi."
)


def describe(image: Path) -> str:
    payload = {
        "model": MODEL,
        "prompt": PROMPT,
        "images": [base64.b64encode(image.read_bytes()).decode("ascii")],
        "stream": False,
    }
    request = urllib.request.Request(
        API,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=600) as response:
        data = json.loads(response.read().decode("utf-8"))
    return str(data.get("response", "")).strip()


def main() -> None:
    images = sorted(UPLOADS.glob("*/image.png"))
    if not images:
        raise SystemExit(f"Nessuna foto trovata in {UPLOADS}")
    lines = [
        "# Analisi visiva locale con Ollama",
        "",
        f"Modello: `{MODEL}` · servizio: `{API}` · generato: {datetime.now().isoformat(timespec='seconds')}",
        "",
        "Analisi semantica in linguaggio naturale delle 6 fotografie ricevute. "
        "I dati numerici restano in `VISUAL_ANALYSIS.md`; qui il modello locale descrive "
        "gli elementi visivi utili alle nuove facciate, balconi, marciapiedi e vegetazione.",
        "",
    ]
    for index, image in enumerate(images, start=1):
        print(f"[{index}/{len(images)}] {image}", flush=True)
        try:
            text = describe(image)
        except Exception as error:  # il servizio locale potrebbe non essere avviato
            text = f"Analisi non riuscita: {error}"
        lines += [f"## Foto {index} — `{image.parent.name}`", "", text, ""]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"salvato {OUT}")


if __name__ == "__main__":
    main()
