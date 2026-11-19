"""Erzeugt absichtlich hässliche Server-Icons und einen Bot-Avatar.

Aufruf: python3 scripts/make-icons.py
Braucht Pillow (pip install pillow). Die fertigen PNGs liegen schon im Repo,
das Skript ist nur zum Neu-Generieren da.
"""
import io
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent.parent / "assets" / "icons"
OUT.mkdir(parents=True, exist_ok=True)
S = 512

EMOJI_FONT = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
PIXEL_FONT = "/usr/share/fonts/opentype/unifont/unifont.otf"
BOLD_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SERIF_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

random.seed(1312_42)


def emoji(char, size):
    """Rendert ein Emoji (Noto gibt es nur in 109px) und skaliert es pixelig hoch."""
    font = ImageFont.truetype(EMOJI_FONT, 109)
    img = Image.new("RGBA", (136, 128), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((0, 0), char, font=font, embedded_color=True)
    img = img.crop(img.getbbox())
    return img.resize((size, size), Image.NEAREST)


def pixel_text(text, scale, fill, outline=None):
    """Unifont-Text in 16px rendern und grob hochskalieren (MS-Paint-Optik)."""
    font = ImageFont.truetype(PIXEL_FONT, 16)
    w = int(font.getlength(text)) + 4
    img = Image.new("RGBA", (w, 20), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if outline:
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            d.text((2 + dx, 1 + dy), text, font=font, fill=outline)
    d.text((2, 1), text, font=font, fill=fill)
    return img.resize((w * scale, 20 * scale), Image.NEAREST)


def deep_fry(img, rounds=3, quality=6):
    img = img.convert("RGB")
    img = ImageEnhance.Color(img).enhance(2.6)
    img = ImageEnhance.Contrast(img).enhance(1.6)
    img = ImageEnhance.Sharpness(img).enhance(6)
    for _ in range(rounds):
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=quality)
        buf.seek(0)
        img = Image.open(buf).convert("RGB")
    return img


def wobbly_blob(cx, cy, r, jitter, n=24):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        rr = r + random.uniform(-jitter, jitter)
        pts.append((cx + math.cos(a) * rr * 1.15, cy + math.sin(a) * rr * 0.9))
    return pts


def googly_eye(d, x, y, r, look):
    d.ellipse((x - r, y - r, x + r, y + r), fill="white", outline="black", width=5)
    pr = r * 0.45
    px, py = x + look[0] * r * 0.45, y + look[1] * r * 0.45
    d.ellipse((px - pr, py - pr, px + pr, py + pr), fill="black")


# 1) Kartoffel mit Glupschaugen und falsch geschriebenem "KLASE"
def kartoffel():
    img = Image.new("RGB", (S, S))
    d = ImageDraw.Draw(img)
    for y in range(S):  # hässlicher Magenta->Giftgrün-Verlauf
        t = y / S
        d.line([(0, y), (S, y)], fill=(int(255 * (1 - t)), int(40 + 215 * t), int(200 * (1 - t))))
    for _ in range(180):  # Sprühdose
        x, y = random.randrange(S), random.randrange(S)
        r = random.randint(2, 6)
        d.ellipse((x - r, y - r, x + r, y + r), fill=random.choice(["yellow", "cyan", "#ff6600", "white"]))
    d.polygon(wobbly_blob(256, 300, 150, 22), fill="#b5853f", outline="#5a3a10", width=8)
    for _ in range(9):  # Kartoffel-Augen (die Dellen)
        x, y = random.randint(150, 360), random.randint(220, 400)
        d.ellipse((x - 6, y - 4, x + 6, y + 4), fill="#6b4a1c")
    googly_eye(d, 205, 265, 42, (0.9, -0.6))
    googly_eye(d, 318, 255, 27, (-0.8, 0.9))
    d.arc((170, 300, 340, 400), start=10, end=150, fill="black", width=7)
    d.line((300, 368, 330, 395), fill="#ff2a6d", width=10)  # Zunge, schief
    d.polygon([(250, 70), (205, 165), (300, 160)], fill="#00e5ff", outline="black", width=4)  # Partyhut
    d.ellipse((240, 58, 262, 80), fill="yellow", outline="black", width=3)
    title = pixel_text("KLASE", 6, "#ffff00", outline="#ff0000").rotate(-7, expand=True, resample=Image.NEAREST)
    img.paste(title, (40, 8), title)
    sub = pixel_text("offiziel", 3, "white", outline="black").rotate(12, expand=True, resample=Image.NEAREST)
    img.paste(sub, (300, 440), sub)
    img.save(OUT / "kartoffel.png")


# 2) Frittierte Ente mit Sonnenbrille
def ente():
    img = Image.new("RGB", (S, S), "#ff00ff")
    d = ImageDraw.Draw(img)
    for i in range(0, S, 32):  # Schachbrett, aber schief
        for j in range(0, S, 32):
            if (i // 32 + j // 32) % 2:
                d.polygon([(i, j), (i + 32, j + 6), (i + 30, j + 38), (i - 2, j + 32)], fill="#00ff66")
    duck = emoji("🦆", 400).rotate(14, expand=True, resample=Image.NEAREST)
    img.paste(duck, (40, 70), duck)
    shades = emoji("🕶", 210).rotate(-8, expand=True, resample=Image.NEAREST)
    img.paste(shades, (215, 95), shades)
    font = ImageFont.truetype(BOLD_FONT, 92)
    for dx in range(-5, 6, 2):
        for dy in range(-5, 6, 2):
            d.text((22 + dx, 12 + dy), "SCHULE", font=font, fill="black")
    d.text((22, 12), "SCHULE", font=font, fill="white")
    small = ImageFont.truetype(SERIF_FONT, 34)
    d.text((150, 455), "seit 2009 (?)", font=small, fill="yellow", stroke_width=3, stroke_fill="red")
    for x, y in [(330, 190), (130, 330)]:  # Laseraugen-Lensflares
        for r, c in [(70, (255, 0, 0)), (35, (255, 120, 120)), (12, (255, 255, 255))]:
            d.ellipse((x - r, y - r, x + r, y + r), fill=c)
    img = deep_fry(img, rounds=3, quality=7)
    img.save(OUT / "ente.png")


# 3) Emoji-Suppe, maximal frittiert
def frittiert():
    img = Image.new("RGB", (S, S), "#ffcc00")
    d = ImageDraw.Draw(img)
    for i in range(14):  # Sonnenstrahlen
        a0, a1 = i * 2 * math.pi / 14, (i + 0.5) * 2 * math.pi / 14
        d.polygon([(256, 256), (256 + 600 * math.cos(a0), 256 + 600 * math.sin(a0)),
                   (256 + 600 * math.cos(a1), 256 + 600 * math.sin(a1))], fill="#ff3300")
    for ch, size, x, y, rot in [("🥔", 260, 120, 130, -20), ("😂", 150, 20, 300, 25), ("💯", 170, 330, 300, -15),
                                 ("🔥", 140, 340, 40, 10), ("🧦", 120, 30, 30, 40), ("🚦", 110, 220, 380, -5)]:
        e = emoji(ch, size).rotate(rot, expand=True, resample=Image.NEAREST)
        img.paste(e, (x, y), e)
    t = pixel_text("KLASSENCHAT", 4, "#00ffff", outline="#0000ff").rotate(20, expand=True, resample=Image.NEAREST)
    img.paste(t, (10, 200), t)
    img = deep_fry(img, rounds=4, quality=5).filter(ImageFilter.SHARPEN)
    img.save(OUT / "frittiert.png")


# 4) Avatar für den Bot (Hausmeister Gerd), zum Hochladen im Developer Portal
def gerd():
    img = Image.new("RGB", (S, S), "#3a7bd5")
    d = ImageDraw.Draw(img)
    d.rectangle((0, 380, S, S), fill="#5b3a29")  # Boden
    d.ellipse((136, 90, 376, 360), fill="#ffd0a8", outline="black", width=6)  # Kopf
    d.chord((126, 60, 386, 230), start=180, end=360, fill="#2d6a2d", outline="black", width=6)  # Mütze
    d.rectangle((120, 140, 392, 160), fill="#2d6a2d", outline="black", width=5)
    googly_eye(d, 210, 215, 30, (-0.9, 0.2))
    googly_eye(d, 300, 222, 22, (0.9, 0.9))
    d.rectangle((195, 270, 320, 290), fill="#4a3020")  # Schnauzer
    d.line((215, 320, 300, 315), fill="black", width=6)  # gelangweilter Mund
    d.line((420, 120, 380, 470), fill="#8b5a2b", width=14)  # Besen
    d.polygon([(350, 450), (420, 450), (440, 510), (330, 510)], fill="#e6c35c", outline="black", width=4)
    cup = emoji("☕", 110)
    img.paste(cup, (40, 360), cup)
    label = pixel_text("GERD", 5, "white", outline="black")
    img.paste(label, (40, 10), label)
    img = deep_fry(img, rounds=1, quality=25)
    img.save(OUT.parent / "gerd-avatar.png")


if __name__ == "__main__":
    kartoffel()
    ente()
    frittiert()
    gerd()
    print("Fertig:", sorted(p.name for p in OUT.parent.rglob("*.png")))
