"""Descrizione di supporto dello screenshot segnalato dall'utente, via Ollama locale."""
from __future__ import annotations

import base64
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE = Path(r"C:\Users\rocka\AppData\Local\Temp\opencode\uploads\6bf430ad-ee72-40e3-9d58-fcbd58970d39\image.png")
OUT = ROOT / "docs" / "rebuild2" / "audit" / "screenshot_user_ollama.md"

PROMPT = (
    "Analizza con precisione questo screenshot di un videogioco. Descrivi: 1) ambiente e strade; "
    "2) edifici e facciate; 3) veicoli e loro dimensioni/orientamento; 4) personaggi e arredo; "
    "5) HUD/testo; 6) difetti grafici evidenti (oggetti fluttuanti, sovrapposizioni, rettangoli colorati, "
    "scala sbagliata, strade nere, marker). Elenca solo ció che vedi, in italiano, in massimo 15 punti brevi."
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
        data = json.loads(response.read().decode("utf-8"))
    text = str(data.get("response", "")).strip()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        "# Descrizione screenshot utente (supporto visivo locale)\n\n"
        "Modello: `qwen2.5vl:3b`. Usata solo come supporto descrittivo: "
        "la certification resta ancorata a misure deterministiche.\n\n" + text + "\n",
        encoding="utf-8",
    )
    print(text)


if __name__ == "__main__":
    main()
