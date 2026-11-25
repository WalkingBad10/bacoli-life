"""Analisi deterministica dello screenshot segnalato dall'utente + supporto Ollama."""
from __future__ import annotations

import base64
import json
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMAGE = Path(r"C:\Users\rocka\AppData\Local\Temp\opencode\uploads\69d8972d-6f9f-4be5-a2d3-441b32d95573\c28a6662-2b82-4dd0-a122-c0ce034d70bb.webp")
OUT = ROOT / "docs" / "rebuild2" / "audit"
PNG = OUT / "screenshot_utente.png"


def histogram(path: Path) -> tuple[np.ndarray, np.ndarray]:
    array = np.asarray(Image.open(path).convert("RGB").resize((96, 96)), dtype=np.float32) / 255.0
    hist, _ = np.histogramdd(
        array.reshape(-1, 3), bins=(6, 6, 6), range=((0, 1), (0, 1), (0, 1))
    )
    return hist.ravel() / hist.sum(), array.mean(axis=(0, 1))


def ollama_description() -> str:
    prompt = (
        "Questo è uno screenshot reale del videogioco BACOLI LIFE. Descrivi SOLO quello che vedi, "
        "in italiano, in massimo 12 punti numerati. Concentrati su: strade e marciapiedi, edifici e "
        "facciate, veicoli (dimensioni e orientamento), personaggi, arredo urbano, HUD, e soprattutto "
        "difetti visibili come rettangoli colorati, sovrapposizioni, oggetti fuori posto, scala sbagliata, "
        "strade nere, marker. Non dire che non ci sono difetti se li vedi. Non inventare."
    )
    payload = {
        "model": "qwen2.5vl:3b",
        "prompt": prompt,
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
    return str(data.get("response", "")).strip()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    image = Image.open(IMAGE).convert("RGB")
    image.save(PNG)
    flat = np.asarray(image).reshape(-1, 3).astype(np.float32)
    gray = np.asarray(image.convert("L"), dtype=np.float32)
    gx, gy = np.gradient(gray)
    edges = float((np.hypot(gx, gy) > 40).mean() * 100)
    lines = [
        "# Screenshot segnalato dall'utente — analisi",
        "",
        f"File: `{IMAGE}`",
        f"Dimensioni: {image.size[0]}x{image.size[1]}",
        "",
        "## Misure deterministiche",
        "",
        f"- Media RGB: {flat.mean(axis=0).round(1).tolist()}",
        f"- Pixel con V<70: {float((flat.max(axis=1) < 70).mean() * 100):.2f}%",
        f"- Densità bordi (gradiente >40): {edges:.2f}%",
        "",
        "## Confronto con screenshot del progetto (istogramma colore)",
        "",
    ]
    target_hist, _ = histogram(PNG)
    candidates = sorted(
        p for folder in ("docs/M6_SCREENSHOTS", "docs/M5_SCREENSHOTS", "screenshots")
        for p in (ROOT / folder).rglob("*.png")
    )
    scores = []
    for candidate in candidates:
        hist, _ = histogram(candidate)
        scores.append((float(np.linalg.norm(target_hist - hist)), candidate))
    scores.sort(key=lambda item: item[0])
    for score, candidate in scores[:10]:
        lines.append(f"- {score:.4f} — `{candidate.relative_to(ROOT)}`")
    lines += ["", "## Descrizione visiva di supporto (qwen2.5vl:3b)", "", ollama_description(), ""]
    (OUT / "screenshot_utente_analisi.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
