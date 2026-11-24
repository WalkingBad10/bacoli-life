"""Analisi semantica locale delle tre tavole artistiche con Ollama.

Uso:
    python tools/analyze_asset_sheets.py IMMAGINE [IMMAGINE ...]

Salva `docs/ASSET_SHEETS_M4.json` con le descrizioni del modello, senza API key.
"""
from __future__ import annotations

import base64
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "ASSET_SHEETS_M4.json"
MODEL = "qwen2.5vl:3b"
API = "http://127.0.0.1:11434/api/generate"

PROMPT = (
    "Sei un tecnico che deve separare gli sprite da una tavola di pixel art per "
    "un simulatore 2D. Descrivi in italiano, in modo preciso e letterale: "
    "1) colore dello sfondo; 2) se esiste una griglia regolare e quante colonne/righe; "
    "3) elenca riga per riga, da sinistra a destra, tutti gli elementi distinti visibili "
    "(personaggi, edifici, veicoli, alberi, arredi, animali, mare, strade); "
    "4) per ogni elemento dai dimensioni approssimative in pixel e un nome breve in inglese "
    "usabile come file PNG (es. player_down, building_3floors, car_white, bus, palm). "
    "Non inventare elementi non visibili. Se non sei sicuro, scrivi 'incerto'."
)


def describe(path: Path) -> str:
    payload = {
        "model": MODEL,
        "prompt": PROMPT,
        "images": [base64.b64encode(path.read_bytes()).decode("ascii")],
        "stream": False,
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
    entries = []
    for path in paths:
        print(f"Analisi di {path.name}", flush=True)
        try:
            response = describe(path)
        except Exception as error:
            response = f"Analisi non riuscita: {error}"
        entries.append({
            "file": str(path),
            "bytes": path.stat().st_size,
            "model": MODEL,
            "response": response,
        })
    OUT.write_text(json.dumps({
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
        "model": MODEL,
        "entries": entries,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"salvato {OUT}")


if __name__ == "__main__":
    main()
