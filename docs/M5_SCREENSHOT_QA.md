# QA visiva M5 — analisi pixel deterministica

Screenshot prodotti da `tests/e2e/m5_regions.spec.ts` su Chromium desktop. Verifica strutturale con Pillow: non sostituisce il confronto fotografico, ma garantisce che ogni regione renderingi contenuto distinto e non vuoto.

| Regione | Frame | Colori | Acqua | Verde | Costruito | Scuro | dHash |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `centro` | 320x180 | 10487 | 3.5% | 18.1% | 62.7% | 7.0% | `0011001000110010…` |
| `baia` | 320x180 | 9779 | 2.9% | 30.0% | 40.4% | 15.4% | `1001001101011100…` |
| `fusaro` | 320x180 | 9836 | 2.1% | 30.7% | 60.2% | 1.9% | `0000101100001010…` |
| `lago_miseno` | 320x180 | 7520 | 2.8% | 43.6% | 45.9% | 2.3% | `1000000001111000…` |
| `marina_grande` | 320x180 | 7490 | 3.2% | 55.0% | 33.8% | 2.6% | `0000101000110101…` |
| `miliscola` | 320x180 | 9215 | 3.4% | 32.4% | 43.9% | 11.2% | `0000011100100001…` |
| `miseno` | 320x180 | 9917 | 3.3% | 31.3% | 47.7% | 8.6% | `1000011110010111…` |
| `torregaveta` | 320x180 | 9825 | 2.5% | 20.4% | 56.8% | 10.6% | `0000100100011001…` |
| `villa_comunale` | 320x180 | 9427 | 3.6% | 26.9% | 40.6% | 16.6% | `0100111001010110…` |

**ESITO: OK** — 9 frame validi, tutti distinti, acqua presente nelle zone costiere/lacustri.
