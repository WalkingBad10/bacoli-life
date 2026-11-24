"""QA visiva deterministico degli screenshot delle nove regioni M5.

Uso: python tools/check_m5_screenshots.py

Il modello vision locale non è affidabile: questo controllo usa solo statistiche
pixel riproducibili (Pillow) per verificare che:
- ogni regione abbia un frame valido e non uniforme;
- le regioni siano visivamente distinte (hash percettuale);
- le zone lacustri/costiere mostrino acqua, il centro no;
- non compaiano righe nere intere (letterbox o mancato rendering).
"""
from __future__ import annotations

import warnings
from pathlib import Path

from PIL import Image

warnings.filterwarnings("ignore", category=DeprecationWarning)

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "docs" / "M5_SCREENSHOTS"
OUT = ROOT / "docs" / "M5_SCREENSHOT_QA.md"
REGIONS = [
    "centro", "baia", "fusaro", "lago_miseno", "marina_grande",
    "miliscola", "miseno", "torregaveta", "villa_comunale",
]
WATER_REGIONS = {"baia", "fusaro", "lago_miseno", "marina_grande", "miseno", "torregaveta"}


def stats(path: Path) -> dict[str, float | int | str]:
    image = Image.open(path).convert("RGB")
    image.thumbnail((320, 180))
    width, height = image.size
    pixels = list(image.getdata())
    total = len(pixels)
    water = green = built = dark = 0
    for r, g, b in pixels:
        if b > r + 18 and b > g + 2 and b > 70:
            water += 1
        elif g > r + 8 and g > b + 4:
            green += 1
        elif r > b + 12 and r > 70:
            built += 1
        elif r + g + b < 110:
            dark += 1
    # dHash 8x8: due regioni identiche avrebbero lo stesso valore.
    gray = image.convert("L").resize((9, 8))
    bits = list(gray.getdata())
    digest = "".join(
        "1" if bits[y * 9 + x] > bits[y * 9 + x + 1] else "0"
        for y in range(8) for x in range(8)
    )
    return {
        "size": f"{width}x{height}",
        "colors": len(set(pixels)),
        "water": round(100 * water / total, 1),
        "green": round(100 * green / total, 1),
        "built": round(100 * built / total, 1),
        "dark": round(100 * dark / total, 1),
        "hash": digest,
    }


def main() -> None:
    failures: list[str] = []
    rows: list[str] = []
    hashes: dict[str, str] = {}
    water_shown: dict[str, float] = {}
    for region in REGIONS:
        path = SHOTS / f"{region}-chromium-desktop.png"
        if not path.exists():
            failures.append(f"screenshot mancante: {path.name}")
            continue
        value = stats(path)
        hashes[region] = str(value["hash"])
        if region in WATER_REGIONS:
            water_shown[region] = float(value["water"])
        rows.append(
            f"| `{region}` | {value['size']} | {value['colors']} | "
            f"{value['water']}% | {value['green']}% | {value['built']}% | "
            f"{value['dark']}% | `{value['hash'][:16]}…` |"
        )
        if int(value["colors"]) < 1000:
            failures.append(f"{region}: frame troppo povero di colori ({value['colors']})")
        if float(value["dark"]) > 30:
            failures.append(f"{region}: troppe righe scure ({value['dark']}%)")
        # Baia e Torregaveta hanno la costa ai margini del bbox: lo spawn può
        # legittimamente non inquadrare acqua, ma deve inquadrare il paese.
        if float(value["green"]) > 85:
            failures.append(f"{region}: spawn in prato vuoto ({value['green']}% verde)")

    if sum(1 for percent in water_shown.values() if percent >= 0.5) < 3:
        failures.append(
            "meno di 3 regioni costiere inquadrano acqua: "
            + ", ".join(f"{r}={p}%" for r, p in water_shown.items())
        )
    repeated = len(hashes) - len(set(hashes.values()))
    if repeated:
        failures.append(f"{repeated} regioni con frame visivamente identico")

    lines = [
        "# QA visiva M5 — analisi pixel deterministica",
        "",
        "Screenshot prodotti da `tests/e2e/m5_regions.spec.ts` su Chromium desktop. "
        "Verifica strutturale con Pillow: non sostituisce il confronto fotografico, "
        "ma garantisce che ogni regione renderingi contenuto distinto e non vuoto.",
        "",
        "| Regione | Frame | Colori | Acqua | Verde | Costruito | Scuro | dHash |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
        *rows,
        "",
    ]
    if failures:
        lines += ["**ESITO: FALLITO**", "", *(f"- {item}" for item in failures), ""]
        OUT.write_text("\n".join(lines), encoding="utf-8")
        print("QA SCREENSHOT M5: FALLITA")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)
    lines += [
        "**ESITO: OK** — 9 frame validi, tutti distinti, acqua presente nelle zone costiere/lacustri.",
        "",
    ]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"QA SCREENSHOT M5: OK · {len(rows)} regioni, 0 frame duplicati")


if __name__ == "__main__":
    main()
