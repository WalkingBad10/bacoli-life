"""Descrizione di supporto delle immagini caricate, via Ollama locale."""
from __future__ import annotations

import base64
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPLOADS = Path(r"C:\Users\rocka\AppData\Local\Temp\opencode\uploads")
OUT = ROOT / "docs" / "rebuild2" / "audit"
IMAGES = [
    UPLOADS / "06cebf7e-9fc7-48d8-8780-da52509239fa" / "image.png",
    UPLOADS / "e9f3cb6d-8faa-4ac0-b6b7-177bd6889588" / "image.png",
]
PROMPT = (
    "Descrivi questa immagine in italiano, in massimo 10 punti brevi. "
    "Se è uno screenshot di videogioco, indica ambiente, veicoli, personaggi, edifici, HUD e difetti evidenti. "
    "Se è una fotografia reale, indica luogo, edifici, strade e dettagli architettonici. Non inventare."
)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    lines = ["# Descrizione immagini caricate (supporto visivo locale)", ""]
    for index, image in enumerate(IMAGES, start=1):
        payload = {
            "model": "qwen2.5vl:3b",
            "prompt": PROMPT,
            "images": [base64.b64encode(image.read_bytes()).decode("ascii")],
            "stream": False,
        }
        req = urllib.request.Request(
            "http://127.0.0.1:11434/api/generate",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=600) as response:
            data = json.loads(response.read().decode("utf-8"))
        text = str(data.get("response", "")).strip()
        lines += [f"## Immagine {index} — `{image}`", "", text, ""]
        print(f"[{index}] {text}", flush=True)
    (OUT / "uploaded_images_ollama.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
