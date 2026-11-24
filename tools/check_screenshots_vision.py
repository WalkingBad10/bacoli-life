"""Verifica visiva locale degli screenshot E2E con Ollama + qwen2.5vl.

Nessuna API key: il modello gira su localhost. Uso:
    python tools/check_screenshots_vision.py
"""
from __future__ import annotations

import base64
import json
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "screenshots"
OUT = ROOT / "docs" / "SCREENSHOT_VISION_REVIEW.md"
MODEL = "qwen2.5vl:3b"
API = "http://127.0.0.1:11434/api/generate"

PROMPT = (
    "Sei un controllore qualità visivo per un simulatore 2D in pixel art. "
    "Descrivi in italiano, in massimo 7 punti brevi, solo quello che vedi: "
    "1) edifici e facciate (proporzioni, balconi, finestre, ombre); "
    "2) mare e barche se presenti; 3) personaggi e animali; "
    "4) HUD e pannelli; 5) problemi evidenti come elementi sospesi, deformazioni, "
    "sovrapposizioni o zone vuote. Termina con un giudizio: 'OK' oppure "
    "'DA CORREGGERE: ...'. Non inventare dettagli non visibili."
)

NAMES = [
    "world-chromium-desktop.png",
    "world-mobile-android.png",
    "interior-chromium-desktop.png",
    "cafe-chromium-desktop.png",
    "pet-chromium-desktop.png",
]


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
    with urllib.request.urlopen(request, timeout=900) as response:
        data = json.loads(response.read().decode("utf-8"))
    return str(data.get("response", "")).strip()


def main() -> None:
    lines = [
        "# Verifica visiva degli screenshot E2E",
        "",
        f"Modello: `{MODEL}` · servizio: `{API}` · generato: "
        f"{datetime.now().isoformat(timespec='seconds')}",
        "",
        "Analisi locale (nessuna API key) degli screenshot prodotti dai test E2E. "
        "Serve a individuare deformazioni, elementi sospesi e zone vuote dopo la Milestone 3.",
        "",
    ]
    for name in NAMES:
        image = SHOTS / name
        if not image.exists():
            lines += [f"## `{name}`", "", "Screenshot assente.", ""]
            continue
        print(f"Analisi di {name}", flush=True)
        try:
            text = describe(image)
        except Exception as error:  # servizio locale non disponibile
            text = f"Analisi non riuscita: {error}"
        lines += [f"## `{name}`", "", text, ""]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"salvato {OUT}")


if __name__ == "__main__":
    main()
