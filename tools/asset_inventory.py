"""Inventario deterministico degli asset M6: usati a runtime vs archiviati.

Uso: python tools/asset_inventory.py
Scrive docs/M6_ASSET_INVENTORY.md. Nessun giudizio quality automatico: elenca
solo cio` che BootScene carica davvero e cio` che resta fuori dal bundle.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCALE = ROOT / 'public/assets/scale'
ORIGINAL = ROOT / 'public/assets/original'
WORLD = ROOT / 'src/data/bacoli_world.json'
OUT = ROOT / 'docs/M6_ASSET_INVENTORY.md'

CHARACTERS = ['player', 'npc_fisher'] + [f'npc_{i}' for i in range(1, 13)]
PROPS = [
    'palm', 'olive_tree', 'bench', 'lamp', 'umbrella', 'boat', 'cafe_table',
    'fisher', 'casina', 'flowerpot', 'trash_bin', 'street_sign', 'parking_sign',
    'car_white', 'car_blue', 'car_red', 'car_yellow', 'moto', 'bus', 'train',
    'station_eav', 'platform', 'rail', 'bus_stop',
]
FURNITURE = [
    'bed', 'sofa', 'table', 'chair', 'fridge', 'stove', 'shelf', 'tv',
    'espresso', 'register', 'bathtub', 'toilet', 'plant',
    'washing_machine', 'microwave', 'desk', 'crib',
]


def loaded_keys() -> dict[str, set[str]]:
    world = json.loads(WORLD.read_text(encoding='utf-8'))
    buildings: set[str] = set()
    roofs: set[str] = set()
    shadows: set[str] = set()
    for region in world['regions']:
        for place in region['places']:
            if not place.get('bounds'):
                continue
            width = place.get('facadeWidth', 128)
            floors = place.get('floors', 3)
            variant = place.get('variant', 0)
            buildings.add(f'building_{width}_{floors}_{variant}')
            roofs.add(f'roof_{width}_{variant}')
            shadows.add(f'shadow_{width}')
    return {
        'personaggi': {f'{key}.png' for key in CHARACTERS},
        'edifici OSM': {f'{key}.png' for key in buildings},
        'tetti': {f'{key}.png' for key in roofs},
        'ombre': {f'{key}.png' for key in shadows},
        'arredo e veicoli': {f'{key}.png' for key in PROPS},
        'interni': {f'f_{key}.png' for key in FURNITURE},
        'tileset': {'tileset.png', 'room_floors.png'},
    }


def main() -> None:
    groups = loaded_keys()
    used = set().union(*groups.values())
    available = {path.name for path in SCALE.glob('*.png')}
    missing = sorted(used - available)
    archived = sorted(available - used - {'tileset_m5_legacy.png'})

    lines = [
        '# M6 — Inventario asset (usati vs archiviati)',
        '',
        'Generato da `tools/asset_inventory.py`. "Usati" sono le chiavi che '
        '`BootScene.preload()` carica davvero; il resto resta su disco ma non '
        'entra nel bundle runtime.',
        '',
        f'- PNG in `public/assets/scale/`: **{len(available)}**',
        f'- PNG caricati a runtime: **{len(used)}**',
        f'- PNG archiviati (non caricati): **{len(archived)}**',
        f'- Chiavi mancanti: **{len(missing)}**',
        '',
        '| Categoria | File caricati |',
        '|---|---:|',
    ]
    for name, keys in groups.items():
        lines.append(f'| {name} | {len(keys)} |')
    lines += [
        '',
        '## Asset originali forniti',
        '',
        'L\'audit distingue gli asset originali effettivamente usati come drop-in '
        'dagli asset consultati solo come riferimento. La tabella seguente è '
        'stabilita dal confronto byte-per-byte fra `public/assets/original/` e '
        '`public/assets/scale/`.',
        '',
        '| File originale | Stato |',
        '|---|---|',
    ]
    for path in sorted(ORIGINAL.rglob('*.png')):
        target = SCALE / path.name
        if target.exists() and target.read_bytes() == path.read_bytes():
            state = '**usato** (identico in `scale/`)'
        elif target.exists():
            state = 'sostituito dalla versione M6 rigenerata'
        else:
            state = 'archiviato / riferimento'
        lines.append(f'| `{path.relative_to(ROOT).as_posix()}` | {state} |')

    lines += [
        '',
        '## Archiviati (estratto)',
        '',
        'I primi 40 nomi, in ordine lessicografico; l\'elenco completo è '
        'ricostruibile con lo script.',
        '',
    ]
    lines += [f'- `{name}`' for name in archived[:40]]
    if missing:
        lines += ['', '## Mancanti', ''] + [f'- `{name}`' for name in missing]
    lines += [
        '',
        '## Tavole e fotografie',
        '',
        'Le tavole e le fotografie consegnate sono state usate solo come '
        'riferimento per palette, geometria delle facciate e arredo; il loro '
        'ritaglio automatico con alpha/GrabCut è risultato inaffidabile e non '
        'è stato immesso nel runtime. `tileset_m5_legacy.png` conserva il '
        'vecchio tileset per confronto e rollback.',
        '',
    ]
    OUT.write_text('\n'.join(lines), encoding='utf-8')
    print(f'inventario: {len(used)} usati, {len(archived)} archiviati, {len(missing)} mancanti')


if __name__ == '__main__':
    main()
