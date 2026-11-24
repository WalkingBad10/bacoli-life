"""Genera audio originale per BACOLI LIFE (nessun file coperto da copyright).

Uso: python tools/generate_audio.py
"""
from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "public" / "assets" / "audio"
OUT.mkdir(parents=True, exist_ok=True)
RATE = 22050


def write_wav(name: str, samples: list[float]) -> None:
    peak = max(1e-6, max(abs(s) for s in samples))
    data = b"".join(struct.pack("<h", int(max(-1, min(1, s / peak)) * 22000)) for s in samples)
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data)
    print(f"{name}: {len(samples) / RATE:.1f}s")


def sea() -> list[float]:
    rnd = random.Random(7)
    out: list[float] = []
    smooth = 0.0
    for i in range(RATE * 12):
        t = i / RATE
        smooth = smooth * 0.93 + rnd.uniform(-1, 1) * 0.07
        swell = 0.55 + 0.45 * math.sin(t * 0.55) * math.sin(t * 0.13 + 1)
        out.append(smooth * swell)
    return out


def gulls() -> list[float]:
    rnd = random.Random(19)
    out = [0.0] * (RATE * 14)
    for start in (1.2, 4.5, 7.8, 11.0):
        base = int(start * RATE)
        for i in range(int(0.9 * RATE)):
            t = i / RATE
            freq = 900 + 380 * math.sin(t * 9) + 120 * math.sin(t * 23)
            env = math.sin(math.pi * t / 0.9) ** 2
            out[base + i] += 0.28 * env * math.sin(2 * math.pi * freq * t)
    return out


def rain() -> list[float]:
    rnd = random.Random(31)
    out: list[float] = []
    smooth = 0.0
    for _ in range(RATE * 10):
        smooth = smooth * 0.6 + rnd.uniform(-1, 1) * 0.4
        out.append(smooth * 0.7)
    return out


def bell() -> list[float]:
    out: list[float] = []
    for i in range(RATE * 2):
        t = i / RATE
        env = math.exp(-2.2 * t)
        tone = (math.sin(2 * math.pi * 523.25 * t)
                + 0.5 * math.sin(2 * math.pi * 1046.5 * t)
                + 0.25 * math.sin(2 * math.pi * 1568 * t))
        out.append(env * tone * 0.5)
    return out


def music() -> list[float]:
    """Melodia acustica malinconica in stile mediterraneo anni '80/'90."""
    notes = [440.00, 493.88, 523.25, 587.33, 659.25, 587.33, 523.25, 493.88,
             440.00, 392.00, 440.00, 493.88, 523.25, 440.00, 392.00, 349.23]
    bass = [110.00, 130.81, 146.83, 98.00]
    out: list[float] = []
    beat = 0.48
    for idx, freq in enumerate(notes):
        for i in range(int(beat * RATE)):
            t = i / RATE
            env = math.exp(-2.5 * t)
            pluck = (math.sin(2 * math.pi * freq * t)
                     + 0.28 * math.sin(2 * math.pi * freq * 2 * t)
                     + 0.12 * math.sin(2 * math.pi * freq * 3 * t))
            b = bass[(idx // 4) % len(bass)]
            low = 0.22 * math.sin(2 * math.pi * b * t) * math.exp(-1.1 * t)
            out.append((pluck * env * 0.34 + low) * 0.8)
    return out


if __name__ == "__main__":
    write_wav("sea.wav", sea())
    write_wav("gulls.wav", gulls())
    write_wav("rain.wav", rain())
    write_wav("bell.wav", bell())
    write_wav("music.wav", music())
