"""Confronto visivo locale tra foto di riferimento e screenshot del gioco.

Crea un'affiancata per il controllo umano e mette a confronto l'analisi Ollama
della fotografia con il giudizio già prodotto sullo screenshot E2E da
`check_screenshots_vision.py`. Uso:
    python tools/compare_reference_game.py
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
REFERENCE_DATA = ROOT / "docs" / "REFERENCE_IMAGES_M4.json"
SHOT = ROOT / "screenshots" / "world-chromium-desktop.png"
OUT_IMAGE = ROOT / "docs" / "QA_reference_vs_world.png"
OUT_REPORT = ROOT / "docs" / "VISION_COMPARISON_M4.md"
MODEL = "qwen2.5vl:3b"


def fit(path: Path, height: int = 360) -> Image.Image:
    image = Image.open(path).convert("RGB")
    width = max(1, round(image.width * height / image.height))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def main() -> None:
    entry = json.loads(REFERENCE_DATA.read_text(encoding="utf-8"))["entries"][0]
    reference = Path(entry["file"])
    left = fit(reference)
    right = fit(SHOT)
    gap = 16
    header = 44
    canvas = Image.new(
        "RGB", (left.width + right.width + gap * 3, max(left.height, right.height) + header + gap * 2),
        "#0c1823",
    )
    canvas.paste(left, (gap, header + gap))
    canvas.paste(right, (left.width + gap * 2, header + gap))
    draw = ImageDraw.Draw(canvas)
    draw.text((gap, 14), "FOTO REFERENZA - BACOLI", fill="#d3b59d")
    draw.text((left.width + gap * 2, 14), "SIMULATORE - SCALA 1 m = 16 px", fill="#d3b59d")
    OUT_IMAGE.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT_IMAGE)

    # qwen2.5vl risponde 500 sulle immagini affiancate e, in modo
    # intermittente, anche sullo screenshot con questa domanda specifica.
    # Si riutilizza quindi il giudizio già prodotto su quello stesso screenshot
    # da check_screenshots_vision.py, evitando un confronto inventato.
    review_path = ROOT / "docs" / "SCREENSHOT_VISION_REVIEW.md"
    review = review_path.read_text(encoding="utf-8")
    marker = "## `world-chromium-desktop.png`"
    section = review.split(marker, 1)[1].split("\n## ", 1)[0].strip() if marker in review else ""
    text = section or "Verifica visiva non disponibile: eseguire check_screenshots_vision.py."

    report = [
        "# Confronto proporzioni foto ↔ simulatore",
        "",
        f"Modello: `{MODEL}` · generato: {datetime.now().isoformat(timespec='seconds')}",
        "",
        f"Foto: `{reference.name}` · screenshot: `{SHOT.name}` · affiancata: `{OUT_IMAGE.name}`.",
        "",
        "## Riferimento fotografico (analisi precedente)",
        "",
        entry["response"].strip(),
        "",
        "## Giudizio sullo screenshot",
        "",
        text,
        "",
        "Nota: il giudizio del modello è indicativo e può essere contraddittorio "
        "su immagini in prospettiva. La verifica decisiva delle proporzioni è "
        "quella dei test E2E, che controllano le dimensioni native a runtime "
        "(personaggio 16×32, edifici 56–212 px, auto 72×40, bus 192×52).",
        "",
    ]
    OUT_REPORT.write_text("\n".join(report), encoding="utf-8")
    print(f"salvato {OUT_IMAGE}")
    print(f"salvato {OUT_REPORT}")


if __name__ == "__main__":
    main()
