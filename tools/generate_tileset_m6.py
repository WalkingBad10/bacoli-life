"""Genera il tileset M6 a 16x16 frame (256x256 px).

Uso: python tools/generate_tileset_m6.py
I GID 1-16 restano identici al tileset M5; i successivi sono pavimentazioni
autotilate, segnaletica orizzontale, attraversamenti pedonali e parcheggi.
"""
from __future__ import annotations

from pathlib import Path

from m6_tiles import SIZE, build_tileset

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'assets' / 'scale' / 'tileset.png'


def main() -> None:
    image = build_tileset()
    assert image.size == (SIZE, SIZE)
    image.save(OUT)
    print(f'tileset M6: {OUT.relative_to(ROOT)} {image.size[0]}x{image.size[1]}')


if __name__ == '__main__':
    main()
