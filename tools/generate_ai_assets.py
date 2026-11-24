"""Pipeline AI gratuita per BACOLI LIFE.

Pollinations.ai genera immagini senza API key. Le immagini vengono scaricate,
ridotte e quantizzate sulla palette mediterranea del gioco, diventando pixel art
utilizzabile (non semplici foto incollate). Le immagini grezze restano in
`docs/ai_references` come riferimento d'autore.

Uso: python tools/generate_ai_assets.py
"""
from __future__ import annotations

import io
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
A = ROOT / "public" / "assets"
TILES = A / "tiles"
REFERENCES = ROOT / "docs" / "ai_references"
REFERENCES.mkdir(parents=True, exist_ok=True)

PALETTE = [
    "#0C1823", "#1B2C33", "#12335F", "#144D90", "#185F76", "#337A98",
    "#3A9FF3", "#AFD7E3", "#A6CEF3", "#D3B59D", "#E8D3B8", "#AD8370",
    "#DBC8A6", "#B69375", "#93806B", "#BC9E87", "#5C4E35", "#B67352",
    "#C08952", "#825834", "#E6AB2D", "#4C6E44", "#51B526", "#2F5B32",
    "#78614C", "#4E3F2D", "#F2EAD8", "#B1403B", "#D98B96", "#3A6EA5",
    "#D3A078", "#A96E4C", "#4E3F2D", "#78614C",
]

# (nome, prompt, dimensione output pixel art)
PROMPTS = [
    ("roof_terracotta", "top down texture of old terracotta roof tiles, warm red orange, weathered mediterranean, seamless, no people", (16, 16)),
    ("plaster_wall", "top down texture of weathered ochre lime plaster wall, mediterranean village, subtle cracks, seamless, no people", (16, 16)),
    ("stone_paving", "top down texture of irregular limestone cobblestone street, Naples old town, seamless, no people", (16, 16)),
    ("stone_wall", "top down texture of ancient tuff stone blocks, warm grey, Campania archaeology, seamless", (16, 16)),
    ("sea_surface", "top down mediterranean sea water surface, gentle waves, turquoise and deep blue, sunny day, seamless", (16, 16)),
    ("olive_grove", "top down olive trees and green mediterranean vegetation, sunlit, seamless, no people", (16, 16)),
    ("facade_bacoli", "pixel art style facade of a small pastel mediterranean italian house, balconies with flowers, shutters, terracotta roof, flat 2d game sprite, centered", (80, 96)),
    ("waterfront", "pixel art style small mediterranean fishing waterfront with boats and stone pier, warm sunlight, flat 2d game sprite, centered", (80, 96)),
]


def palette_image() -> Image.Image:
    im = Image.new("P", (len(PALETTE), 1))
    flat = []
    for color in PALETTE:
        flat.extend(int(color[i:i + 2], 16) for i in (1, 3, 5))
    im.putpalette(flat + [0] * (768 - len(flat)))
    return im


ENDPOINTS = (
    "https://image.pollinations.ai/prompt/{prompt}?width=512&height=512&seed={seed}&nologo=true",
    "https://gen.pollinations.ai/image/{prompt}?model=black-forest-labs%2Fflux.1-schnell&width=512&height=512&seed={seed}",
    "https://image.pollinations.ai/prompt/{prompt}?width=512&height=512&seed={seed}",
)


def fetch(name: str, prompt: str, seed: int) -> Image.Image | None:
    """Prova più endpoint gratuiti: la rete di Pollinations limita le richieste."""
    encoded = urllib.parse.quote(prompt)
    for attempt, template in enumerate(ENDPOINTS, start=1):
        url = template.format(prompt=encoded, seed=seed + attempt)
        try:
            with urllib.request.urlopen(url, timeout=90) as response:
                data = response.read()
            image = Image.open(io.BytesIO(data)).convert("RGB")
            image.save(REFERENCES / f"{name}_{seed}.jpg", quality=90)
            return image
        except Exception as error:  # rete intermittente o quota gratuita
            print(f"  endpoint {attempt} fallito: {error}")
            time.sleep(4)
    return None


def to_pixel_art(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    # Ritaglio quadrato centrale, downsample e quantizzazione senza dithering:
    # il risultato usa solo i colori del gioco e resta nitido su griglia 16x16.
    side = min(image.size)
    image = image.crop(((image.width - side) // 2, (image.height - side) // 2,
                        (image.width + side) // 2, (image.height + side) // 2))
    image = ImageOps.fit(image, (size[0] * 4, size[1] * 4), method=Image.Resampling.LANCZOS)
    image = ImageEnhance.Contrast(image).enhance(1.16)
    image = image.resize(size, Image.Resampling.LANCZOS)
    return image.quantize(palette=palette_image(), dither=Image.Dither.NONE).convert("RGBA")


def main() -> None:
    output = A / "ai"
    output.mkdir(parents=True, exist_ok=True)
    generated = []
    for seed, (name, prompt, size) in enumerate(PROMPTS, start=70):
        print(f"AI: {name}")
        source = fetch(name, prompt, seed)
        if source is None:
            print(f"  saltato {name}")
            continue
        pixels = to_pixel_art(source, size)
        pixels.save(output / f"{name}.png")
        colors = len(set(pixels.get_flattened_data() if hasattr(pixels, 'get_flattened_data') else pixels.getdata()))
        print(f"  {name}.png {size[0]}x{size[1]} colori={colors}")
        generated.append(name)
        time.sleep(20)  # la quota gratuita permette poche richieste per IP
    print(f"generati {len(generated)}/{len(PROMPTS)} asset AI")


if __name__ == "__main__":
    main()
