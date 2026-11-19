"""Erzeugt Willys eigene Soundboard-Sounds (komplett synthetisch, keine fremden Aufnahmen).

Aufruf: python3 scripts/make-sounds.py
Braucht numpy und ffmpeg. Die fertigen MP3s liegen schon im Repo (assets/sounds/),
das Skript ist nur zum Neu-Generieren da.

Discord-Grenzen fürs Soundboard: MP3 oder OGG, max. 5,2 Sekunden, max. 512 KB.
"""
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "assets" / "sounds"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(1312)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def osc(freq, dur, harmonics=((1, 1.0),)):
    """Oszillator mit (Teilton-Faktor, Lautstärke)-Liste. freq darf ein Array sein (Sweeps)."""
    n = int(dur * SR)
    f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    phase = 2 * np.pi * np.cumsum(f) / SR
    return sum(a * np.sin(k * phase) for k, a in harmonics)


def saw(freq, dur, n_harm=12):
    return osc(freq, dur, [(k, 1 / k) for k in range(1, n_harm + 1)])


def square(freq, dur, n_harm=9):
    return osc(freq, dur, [(k, 1 / k) for k in range(1, n_harm + 1, 2)])


def lowpass(x, alpha):
    """Einfacher Tiefpass (alpha klein = dumpfer)."""
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y


def env_exp(dur, tau):
    return np.exp(-t_axis(dur) / tau)


def fade(x, ms=8):
    n = int(SR * ms / 1000)
    if n and len(x) > 2 * n:
        x[:n] *= np.linspace(0, 1, n)
        x[-n:] *= np.linspace(1, 0, n)
    return x


def place(track, sound, at):
    i = int(at * SR)
    end = min(len(track), i + len(sound))
    track[i:end] += sound[: end - i]


def save(name, x, peak=0.89):
    x = fade(np.asarray(x, dtype=float))
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    assert len(x) / SR <= 5.2, f"{name} ist zu lang"
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        with wave.open(tmp.name, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((x * 32767).astype(np.int16).tobytes())
        mp3 = OUT / f"{name}.mp3"
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-codec:a", "libmp3lame", "-b:a", "128k", str(mp3)],
            check=True,
        )
    assert mp3.stat().st_size <= 512 * 1024, f"{name} ist zu groß"
    print(f"{mp3.name}: {len(x) / SR:.1f} s, {mp3.stat().st_size // 1024} KB")


# 1) Feueralarm: "Whoop"-Sirene, 5 Sweeps nach oben
def feueralarm():
    sweep_dur = 0.8
    one = np.linspace(520, 1150, int(sweep_dur * SR)) ** 1.0
    f = np.tile(one, 5)
    x = osc(f, len(f) / SR, [(1, 1.0), (3, 0.35), (5, 0.18), (7, 0.08)])
    x *= 0.85 + 0.15 * np.sin(2 * np.pi * 7 * t_axis(len(f) / SR))  # leichtes Flattern
    save("feueralarm", lowpass(x, 0.35))


# 2) Schulgong: "Ding Dong" mit glockigen Obertönen
def bell(freq, dur):
    parts = [(1.0, 1.0, 1.4), (2.0, 0.45, 0.7), (2.76, 0.35, 0.5), (5.4, 0.15, 0.25), (0.5, 0.25, 1.8)]
    t = t_axis(dur)
    return sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t / tau) for r, a, tau in parts)


def schulgong():
    track = np.zeros(int(3.4 * SR))
    place(track, bell(659.25, 2.6), 0.0)  # E5
    place(track, bell(523.25, 2.8), 0.65)  # C5
    save("schulgong", track)


# 3) Ladebalken 99 %: trauriges "Wah wah wah waaah"
def ladebalken():
    track = np.zeros(int(3.6 * SR))
    notes = [(233.08, 0.0, 0.45), (220.0, 0.5, 0.45), (207.65, 1.0, 0.45), (196.0, 1.5, 1.9)]
    for f, at, dur in notes:
        t = t_axis(dur)
        vib = 1 + (0.012 * np.sin(2 * np.pi * 5.5 * t) if dur > 1 else 0)
        x = saw(f * vib, dur, 10)
        wah = 0.5 + 0.5 * np.clip(t / 0.08, 0, 1)  # weicher Einsatz
        x *= wah * np.exp(-t / (dur * 1.6))
        place(track, lowpass(x, 0.12), at)
    save("ladebalken", track)


# 4) Trommelwirbel mit Becken am Ende
def trommelwirbel():
    track = np.zeros(int(4.0 * SR))
    at, rate = 0.0, 11.0
    while at < 2.5:
        hit = rng.uniform(-1, 1, int(0.06 * SR)) * env_exp(0.06, 0.018)
        hit += 0.4 * np.sin(2 * np.pi * 190 * t_axis(0.06)) * env_exp(0.06, 0.02)
        place(track, hit * (0.35 + 0.65 * at / 2.5), at)
        at += 1 / rate
        rate = min(rate * 1.035, 32)
    crash = rng.uniform(-1, 1, int(1.4 * SR))
    crash = (crash - lowpass(crash, 0.25)) * env_exp(1.4, 0.45)  # nur die Höhen
    kick = np.sin(2 * np.pi * np.linspace(120, 50, int(0.35 * SR)).cumsum() / SR) * env_exp(0.35, 0.09)
    place(track, crash * 0.9, 2.55)
    place(track, kick * 1.2, 2.55)
    save("trommelwirbel", track)


# 5) RAM geklaut: Computer-Gepiepe, dann "Piuuu" nach unten
def ram_geklaut():
    track = np.zeros(int(2.6 * SR))
    for i in range(48):
        f = rng.choice([880, 1175, 1568, 1760, 2093, 2349])
        place(track, square(f, 0.028, 5) * 0.5, i * 0.032)
    pew_dur = 0.9
    pew = osc(np.geomspace(1800, 140, int(pew_dur * SR)), pew_dur, [(1, 1.0), (2, 0.3)]) * env_exp(pew_dur, 0.5)
    place(track, pew, 1.6)
    save("ram-geklaut", lowpass(track, 0.5))


# 6) Captcha falsch: zwei dumpfe Fehler-Pieptöne
def captcha_falsch():
    track = np.zeros(int(1.0 * SR))
    place(track, square(440, 0.17, 7) * env_exp(0.17, 0.3), 0.0)
    place(track, square(311, 0.45, 7) * env_exp(0.45, 0.25), 0.21)
    save("captcha-falsch", lowpass(track, 0.25))


# 7) Willys Besen: zweimal "Wusch"
def besen():
    track = np.zeros(int(1.6 * SR))
    for at in (0.0, 0.7):
        dur = 0.6
        n = rng.uniform(-1, 1, int(dur * SR))
        shape = np.sin(np.pi * np.clip(t_axis(dur) / dur, 0, 1)) ** 2
        swish = lowpass(n, 0.18) - lowpass(n, 0.03)  # Bandpass-artig
        place(track, swish * shape, at)
    save("besen", track)


# 8) Pausenklingel: elektrische Schulklingel
def pausenklingel():
    dur = 2.6
    t = t_axis(dur)
    metal = sum(a * np.sin(2 * np.pi * 1250 * r * t) for r, a in [(1, 1.0), (2.32, 0.5), (3.9, 0.3), (5.1, 0.15)])
    hammer = np.clip(np.sin(2 * np.pi * 19 * t), 0, 1) ** 0.6
    x = metal * hammer * np.clip((dur - t) / 0.3, 0, 1)
    save("pausenklingel", lowpass(x, 0.4))


if __name__ == "__main__":
    feueralarm()
    schulgong()
    ladebalken()
    trommelwirbel()
    ram_geklaut()
    captcha_falsch()
    besen()
    pausenklingel()
