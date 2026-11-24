# Direzione artistica — BACOLI LIFE

## Principi
- Pixel art originale su griglia 16×16, visuale dall'alto a tre quarti.
- Filtro nearest-neighbor sempre attivo (`pixelArt: true`, `image-rendering: pixelated`).
- Nessuna fotografia incollata nelle mappe: le foto sono solo riferimenti.
- Ogni finestra è disegnata dentro la facciata; tetti, ombre e proporzioni
  sono calcolati nello stesso sistema di coordinate.

## Palette
| Ruolo | Colore |
| --- | --- |
| Ombra / contorno | `#0C1823` |
| Pietra calda | `#D3B59D`, `#BC9E87` |
| Intonaco | `#DBC8A6`, `#B69375` |
| Terracotta | `#B67352`, `#825834` |
| Ocra | `#E6AB2D` |
| Mare | `#185F76`, `#337A98`, `#3A9FF3`, `#AFD7E3` |
| Verde oliva | `#4C6E44`, `#51B526` |
| Legno | `#78614C`, `#4E3F2D` |

## Asset
- `tileset.png`: 16 tile modulari (erba, sabbia, acciottolato, asfalto,
  pavimento, 4 frame d'acqua, schiuma, muro, tetto, aiuola).
- `building_0..5.png`: facciate con persiane, balconi, ringhiere, panni stesi,
  vasi, insegne e marcapiano. La cappella ha portale ad arco e campanile.
- `player.png`, `npc_1..4.png`: 4 direzioni × 4 frame, 16×32 px.
- `room_floors.png` e `f_*.png`: pavimenti e 13 arredi per interni distinti.
- Audio sintetizzato: onde, gabbiani, pioggia, campane, melodia acustica.

## Scala
Un tile corrisponde a circa 4 metri. La disposizione delle strade è presa da
OpenStreetMap; la scala è adattata al gameplay senza alterare la topologia.
