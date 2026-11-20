"""Erzeugt die Avatare der Lehrer-Figuren (für die Fachräume).

Aufruf: python3 scripts/make-teachers.py  (braucht Pillow; nutzt Helfer aus make-icons.py)
"""
import importlib.util
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("mk", HERE / "make-icons.py")
mk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mk)

OUT = HERE.parent / "assets" / "lehrer"
OUT.mkdir(parents=True, exist_ok=True)
S = 256

# (Datei, Hintergrund, Hautfarbe, Haare, Accessoire-Emoji, Brille?)
TEACHERS = [
    ("mathe", "#2e86de", "#ffd8b1", "#4a4a4a", "🧮", True),
    ("deutsch", "#8e44ad", "#f1c27d", "#c0392b", "📖", True),
    ("englisch", "#c0392b", "#ffe0bd", "#f1c40f", "☕", False),
    ("bio", "#27ae60", "#e0ac69", "#6d4c41", "🌱", False),
    ("geschichte", "#7f6a4f", "#ffd8b1", "#dddddd", "🏛", True),
    ("sport", "#e67e22", "#c68642", "#222222", "📣", False),
    ("chemie", "#16a085", "#ffe0bd", "#ff5722", "🧪", True),
    ("musik", "#d81b60", "#f1c27d", "#311b92", "🎵", False),
    ("kunst", "#fbc02d", "#e0ac69", "#00897b", "🎨", False),
]


def face(bg, skin, hair, acc, glasses, look):
    img = Image.new("RGB", (S, S), bg)
    d = ImageDraw.Draw(img)
    d.ellipse((48, 52, 208, 220), fill=skin, outline="black", width=4)  # Kopf
    d.chord((44, 30, 212, 150), start=180, end=360, fill=hair, outline="black", width=4)  # Haare
    mk.googly_eye(d, 100, 130, 20, look)
    mk.googly_eye(d, 158, 128, 16, (-look[0], look[1]))
    if glasses:
        d.rectangle((76, 108, 124, 152), outline="black", width=4)
        d.rectangle((136, 108, 180, 150), outline="black", width=4)
        d.line((124, 128, 136, 128), fill="black", width=4)
    d.arc((100, 160, 160, 196), start=20, end=160, fill="black", width=5)  # Lächeln
    e = mk.emoji(acc, 76)
    img.paste(e, (170, 170), e)
    return img


if __name__ == "__main__":
    looks = [(0.8, -0.5), (-0.7, 0.6), (0.2, 0.9), (-0.9, -0.2), (0.6, 0.6), (-0.3, -0.9), (0.9, 0.9), (-0.6, -0.6), (0.0, -1.0)]
    for (name, bg, skin, hair, acc, glasses), look in zip(TEACHERS, looks):
        face(bg, skin, hair, acc, glasses, look).save(OUT / f"{name}.png")
    print("Fertig:", sorted(p.name for p in OUT.glob("*.png")))
