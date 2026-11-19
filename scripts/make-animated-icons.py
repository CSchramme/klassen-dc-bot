"""Erzeugt animierte (GIF) Server-Logos. Discord erlaubt die ab Boost-Level 1.

Aufruf: python3 scripts/make-animated-icons.py
Benutzt die Zeichen-Helfer aus make-icons.py. Die fertigen GIFs liegen schon im Repo.
"""
import colorsys
import importlib.util
import io
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("mk", HERE / "make-icons.py")
mk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mk)

OUT = HERE.parent / "assets" / "icons-animated"
OUT.mkdir(parents=True, exist_ok=True)
S = 512  # gezeichnet wird groß, gespeichert in 256x256
SIZE = 256
FRAMES = 24
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def save_gif(name, frames, duration=80):
    small = [f.convert("RGB").resize((SIZE, SIZE), Image.LANCZOS) for f in frames]
    pal = [f.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE) for f in small]
    path = OUT / f"{name}.gif"
    pal[0].save(path, save_all=True, append_images=pal[1:], duration=duration, loop=0, optimize=True, disposal=2)
    print(f"{path.name}: {len(frames)} Bilder, {path.stat().st_size // 1024} KB")


def rainbow_bg(phase):
    img = Image.new("RGB", (S, S))
    d = ImageDraw.Draw(img)
    for y in range(0, S, 4):
        r, g, b = colorsys.hsv_to_rgb((phase + y / S) % 1.0, 1.0, 1.0)
        d.rectangle((0, y, S, y + 4), fill=(int(r * 255), int(g * 255), int(b * 255)))
    return img


# 1) Kartoffel: Regenbogen läuft, Glupschaugen rollen, "KLASE" hüpft
def kartoffel():
    random.seed(7)
    frames = []
    for i in range(FRAMES):
        a = 2 * math.pi * i / FRAMES
        img = rainbow_bg(i / FRAMES)
        d = ImageDraw.Draw(img)
        random.seed(42)  # gleiche Kartoffelform in jedem Bild ...
        blob = mk.wobbly_blob(256, 300 + 6 * math.sin(2 * a), 150, 22)
        d.polygon(blob, fill="#b5853f", outline="#5a3a10", width=8)
        for _ in range(9):
            x, y = random.randint(150, 360), random.randint(220, 400)
            d.ellipse((x - 6, y - 4, x + 6, y + 4), fill="#6b4a1c")
        mk.googly_eye(d, 205, 265, 42, (math.cos(a), math.sin(a)))
        mk.googly_eye(d, 318, 255, 27, (math.cos(-2 * a), math.sin(-2 * a)))
        d.arc((170, 300, 340, 400), start=10, end=150, fill="black", width=7)
        hat_y = -10 * abs(math.sin(2 * a))
        d.polygon([(250, 70 + hat_y), (205, 165 + hat_y), (300, 160 + hat_y)], fill="#00e5ff", outline="black", width=4)
        title = mk.pixel_text("KLASE", 6, "#ffff00", outline="#ff0000").rotate(-7 + 6 * math.sin(a), expand=True, resample=Image.NEAREST)
        img.paste(title, (40, int(8 - 14 * abs(math.sin(2 * a)))), title)
        frames.append(img)
    save_gif("kartoffel", frames)


# 2) Ente: dreht sich, Laseraugen blinken, Schachbrett flackert, alles frittiert
def ente():
    duck = mk.emoji("🦆", 360)
    shades = mk.emoji("🕶", 190)
    font = ImageFont.truetype(BOLD, 92)
    frames = []
    for i in range(FRAMES):
        img = Image.new("RGB", (S, S), "#ff00ff" if i % 4 < 2 else "#00ffff")
        d = ImageDraw.Draw(img)
        for x in range(0, S, 32):
            for y in range(0, S, 32):
                if (x // 32 + y // 32 + i // 2) % 2:
                    d.rectangle((x, y, x + 32, y + 32), fill="#00ff66")
        body = Image.new("RGBA", (420, 420), (0, 0, 0, 0))
        body.paste(duck, (30, 40), duck)
        body.paste(shades, (190, 75), shades)
        body = body.rotate(-360 * i / FRAMES, resample=Image.BICUBIC)
        img.paste(body, (46, 70), body)
        for dx in range(-5, 6, 2):
            for dy in range(-5, 6, 2):
                d.text((22 + dx, 12 + dy), "SCHULE", font=font, fill="black")
        d.text((22, 12), "SCHULE", font=font, fill="white" if i % 6 < 3 else "yellow")
        if i % 4 < 2:  # Laseraugen
            for x, y in [(330, 210), (150, 330)]:
                for r, c in [(60, (255, 0, 0)), (28, (255, 140, 140)), (10, (255, 255, 255))]:
                    d.ellipse((x - r, y - r, x + r, y + r), fill=c)
        frames.append(mk.deep_fry(img, rounds=1, quality=15))
    save_gif("ente", frames)


# 3) RAM-Riegel: wackelt, weint, "WO RAM???" blinkt
def ram():
    random.seed(3)
    stars = [(random.randrange(S), random.randrange(S)) for _ in range(90)]
    frames = []
    for i in range(FRAMES):
        a = 2 * math.pi * i / FRAMES
        img = Image.new("RGB", (S, S), "#000080")
        d = ImageDraw.Draw(img)
        for k, (x, y) in enumerate(stars):
            if (k + i) % 5:
                d.point((x, y), fill="white")
        shake = int(10 * math.sin(4 * a))
        stick = Image.new("RGBA", (440, 150), (0, 0, 0, 0))
        sd = ImageDraw.Draw(stick)
        sd.rectangle((0, 0, 439, 120), fill="#0b6b2b", outline="black", width=4)
        for k in range(8):
            sd.rectangle((18 + k * 52, 22, 58 + k * 52, 78), fill="#111111")
        for k in range(40):
            sd.rectangle((6 + k * 11, 120, 13 + k * 11, 148), fill="#e6b422")
        stick = stick.rotate(-12 + 4 * math.sin(4 * a), expand=True, resample=Image.BICUBIC)
        img.paste(stick, (30 + shake, 175), stick)
        mk.googly_eye(d, 190 + shake, 255, 34, (0.6 * math.cos(3 * a), -0.9))
        mk.googly_eye(d, 300 + shake, 240, 26, (-0.7, -0.9 * math.cos(3 * a)))
        d.arc((200 + shake, 280, 300 + shake, 340), start=200, end=340, fill="white", width=7)
        for x0, offset in [(160, 0), (330, 0.5)]:  # Tränen fallen
            p = (i / FRAMES + offset) % 1.0
            y = 290 + p * 200
            d.ellipse((x0 + shake - 9, y, x0 + shake + 9, y + 26), fill="#66ccff")
        color = "#ff00ff" if i % 6 < 3 else "#ffff00"
        title = mk.pixel_text("WO RAM???", 5, color, outline="yellow" if color == "#ff00ff" else "#ff00ff").rotate(4, expand=True, resample=Image.NEAREST)
        img.paste(title, (25, 20), title)
        if i % 8 < 6:
            sub = mk.pixel_text("0 GB frei", 4, "#00ff00", outline="black").rotate(-6, expand=True, resample=Image.NEAREST)
            img.paste(sub, (110, 410), sub)
        frames.append(img)
    save_gif("ram", frames)


# 4) "Server lädt… 99 %": Balken läuft voll und bleibt bei 99 % hängen
def laden():
    font_big = ImageFont.truetype(BOLD, 64)
    font_pct = ImageFont.truetype(BOLD, 96)
    frames = []
    total = 30
    for i in range(total):
        img = Image.new("RGB", (S, S), "#1e1f22")
        d = ImageDraw.Draw(img)
        d.text((S // 2, 90), "Server", font=font_big, fill="white", anchor="mm")
        dots = "." * (1 + i % 3)
        d.text((S // 2 - 120, 165), f"lädt{dots}", font=font_big, fill="white", anchor="lm")
        pct = min(99, int(99 * (i / 14) ** 0.7)) if i < 14 else 99
        x0, x1, y0, y1 = 50, S - 50, 250, 320
        d.rounded_rectangle((x0, y0, x1, y1), 18, outline="white", width=6)
        fill_w = int((x1 - x0 - 16) * pct / 100)
        if fill_w > 0:
            d.rounded_rectangle((x0 + 8, y0 + 8, x0 + 8 + fill_w, y1 - 8), 12, fill="#23a55a")
        blink = i >= 14 and i % 4 < 2
        d.text((S // 2, 410), f"{pct} %", font=font_pct, fill="#ed4245" if blink else "white", anchor="mm")
        cx, cy, r = 420, 170, 30  # Lade-Kringel (innerhalb des runden Ausschnitts)
        start = (i * 40) % 360
        d.arc((cx - r, cy - r, cx + r, cy + r), start=start, end=start + 270, fill="#5865f2", width=10)
        frames.append(img)
    save_gif("laden", frames, duration=110)


if __name__ == "__main__":
    kartoffel()
    ente()
    ram()
    laden()
