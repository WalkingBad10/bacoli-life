"""Descrizione di supporto di un'immagine locale via Ollama (non certificazione)."""
from __future__ import annotations

import base64
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs/rebuild2/audit/rebuild2_preview.png"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "docs/rebuild2/audit/rebuild2_preview_ollama.md"
PROMPT = (
    "Descrivi questo screenshot di un videogioco 2D in italiano, solo ciò che vedi. "
    "Rispondi in massimo 12 punti brevi: strade e marciapiedi; edifici e facciate; veicoli e dimensioni; "
    "personaggi e arredo; HUD; difetti evidenti come rettangoli colorati, marker, scale sbagliate o oggetti fluttuanti."
)


def main() -> None:
    payload = {
        "model": "qwen2.5vl:3b",
        "prompt": PROMPT,
        "images": [base64.b64encode(IMAGE.read_bytes()).decode("ascii")],
        "stream": False,
    }
    req = urllib.request.Request(
        "http://127.0.0.1:11434/api/generate",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=600) as response:
        text = str(json.loads(response.read().decode("utf-8")).get("response", "")).strip()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        f"# Descrizione di supporto — `{IMAGE.name}`\n\n"
        "Modello locale `qwen2.5vl:3b`. Usata solo come supporto descrittivo: "
        "la verifica resta ancorata a misure deterministiche e al giudizio visivo dell'utente.\n\n" + text + "\n",
        encoding="utf-8",
    )
    print(text)


if __name__ == "__main__":
    main()
