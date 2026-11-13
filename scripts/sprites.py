"""
Schneidet die Rohbilder der Bild-KI (art/roh/) in einzelne freigestellte Sprites (art/sprites/).

Die Motive stehen auf einfarbig magentafarbenem Hintergrund in einem groben Raster. Das Skript
findet die Motive als zusammenhängende Flächen, stellt jedes Motiv frei (weiche Kante, Magenta-Stich
an den Rändern entfernt) und speichert es als PNG mit den Namen aus SHEETS.

Aufruf: python3 scripts/sprites.py            (braucht Pillow und numpy; nur ein Werkzeug, nicht Teil des Spiels)
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "art" / "roh"
OUT = ROOT / "art" / "sprites"

# Namen der Motive je Blatt, zeilenweise von links oben. None = Zelle auslassen.
SHEETS = {
    "tuerme": ["bogenturm_1", "katapult_1", "pechnase_1", "wachstube_1", "bogenturm_2", "katapult_2", "pechnase_2", "wachstube_2"],
    "einheiten": ["leicht", "gepanzert", "ramme", "miliz", "raeuber", "schildtraeger", "sturmbock"],
    "gebaeude": ["holzfaeller", "steinbruch", "kaserne", "hof", "speicher", "lazarett", "baustelle", "bauplatz"],
    "stadt": ["burgfried_1", "burgfried_2", "marktplatz", "torhaus", "torhaus_kaputt", "turmplatz"],
    "symbole": ["gold", "holz", "stein", "schild", "angriff", "turm", "karte", "allianz", "ziele"],
    "heldin": ["alruna"],
}
# Längste Kante eines gespeicherten Sprites in Pixeln (im Spiel wird weiter verkleinert).
MAX_SIDE = 192


def background_distance(rgb: np.ndarray) -> np.ndarray:
    """0 = reines Hintergrund-Magenta, 1 = weit weg davon. Der Hintergrundton wird aus den Bildecken gelesen."""
    corners = np.concatenate([rgb[:12, :12].reshape(-1, 3), rgb[:12, -12:].reshape(-1, 3), rgb[-12:, :12].reshape(-1, 3), rgb[-12:, -12:].reshape(-1, 3)])
    key = np.median(corners, axis=0)
    dist = np.sqrt(((rgb - key) ** 2).sum(axis=2))
    # Unter LOW gilt als Hintergrund, über HIGH als Motiv, dazwischen weiche Kante.
    low, high = 60.0, 130.0
    return np.clip((dist - low) / (high - low), 0.0, 1.0), key


def components(solid: np.ndarray):
    """Zusammenhängende Flächen (8er-Nachbarschaft): Kästen [links, oben, rechts, unten, Fläche, Nummern] und die Nummernkarte."""
    h, w = solid.shape
    seen = np.zeros_like(solid, dtype=bool)
    labels = np.zeros(solid.shape, dtype=np.int32)
    boxes = []
    for y0, x0 in zip(*np.nonzero(solid)):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]
        seen[y0, x0] = True
        left, top, right, bottom, area = x0, y0, x0, y0, 0
        while stack:
            y, x = stack.pop()
            labels[y, x] = len(boxes) + 1
            area += 1
            left, right, top, bottom = min(left, x), max(right, x), min(top, y), max(bottom, y)
            for ny in (y - 1, y, y + 1):
                for nx in (x - 1, x, x + 1):
                    if 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        boxes.append([left, top, right + 1, bottom + 1, area, [len(boxes) + 1]])
    return boxes, labels


def find_objects(solid: np.ndarray):
    """Motive in Lesereihenfolge. Kleine lose Teile (Fahne, Splitter) werden dem nächsten großen Motiv zugeschlagen."""
    parts, labels = components(solid)
    if not parts:
        return [], labels
    biggest = max(p[4] for p in parts)
    main = [p for p in parts if p[4] >= biggest * 0.12]
    for p in parts:
        if p[4] >= biggest * 0.12 or p[4] < 30:
            continue
        cx, cy = (p[0] + p[2]) / 2, (p[1] + p[3]) / 2
        near = min(main, key=lambda m: max(m[0] - cx, 0, cx - m[2]) + max(m[1] - cy, 0, cy - m[3]))
        near[0], near[1], near[2], near[3] = min(near[0], p[0]), min(near[1], p[1]), max(near[2], p[2]), max(near[3], p[3])
        near[5] = near[5] + p[5]
    # Zeilen bilden: Motive, deren senkrechte Mitten nah beieinander liegen, gehören in dieselbe Zeile.
    main.sort(key=lambda m: (m[1] + m[3]) / 2)
    rows, height = [], float(np.median([m[3] - m[1] for m in main]))
    for m in main:
        mid = (m[1] + m[3]) / 2
        if rows and abs(mid - rows[-1]["mid"]) < height * 0.5:
            rows[-1]["items"].append(m)
        else:
            rows.append({"mid": mid, "items": [m]})
    return [(m[0], m[1], m[2], m[3], m[5]) for row in rows for m in sorted(row["items"], key=lambda m: m[0])], labels


def cut(sheet: str, names: list) -> list:
    path = next((p for p in [RAW / f"{sheet}.png", RAW / f"{sheet}.jpg", RAW / f"{sheet}.jpeg"] if p.exists()), None)
    if path is None:
        return []
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    alpha, key = background_distance(rgb)
    solid = alpha > 0.5
    boxes, labels = find_objects(solid)
    if len(boxes) != len([n for n in names if n]):
        print(f"  WARNUNG {sheet}: {len(boxes)} Motive gefunden, {len(names)} erwartet")
    (OUT / sheet).mkdir(parents=True, exist_ok=True)
    written = []
    for name, (left, top, right, bottom, ids) in zip(names, boxes):
        if not name:
            continue
        pad = 2
        l, t, r, b = max(0, left - pad), max(0, top - pad), min(rgb.shape[1], right + pad), min(rgb.shape[0], bottom + pad)
        # Nur Pixel dieses Motivs behalten (benachbarte Motive können in den Kasten ragen), mit etwas Rand für die weiche Kante.
        own = np.isin(labels[t:b, l:r], ids)
        grown = own.copy()
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                grown |= np.roll(np.roll(own, dy, axis=0), dx, axis=1)
        a = alpha[t:b, l:r] * grown
        c = rgb[t:b, l:r].copy()
        # Magenta-Stich entfernen: wo Rot und Blau das Grün deutlich übersteigen (typisch für den Rand), beide absenken.
        spill = np.clip(np.minimum(c[..., 0], c[..., 2]) - c[..., 1] - 25, 0, None) * (1 - a) * 1.0
        edge = a < 0.98
        c[..., 0] = np.where(edge, c[..., 0] - spill, c[..., 0])
        c[..., 2] = np.where(edge, c[..., 2] - spill, c[..., 2])
        rgba = np.dstack([np.clip(c, 0, 255), a * 255]).astype(np.uint8)
        img = Image.fromarray(rgba, "RGBA")
        scale = MAX_SIDE / max(img.size)
        if scale < 1:
            img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
        img.save(OUT / sheet / f"{name}.png")
        written.append({"name": name, "file": f"{sheet}/{name}.png", "w": img.width, "h": img.height})
    print(f"  {sheet}: {len(written)} Sprites aus {path.name} (Hintergrund {tuple(int(v) for v in key)})")
    return written


if __name__ == "__main__":
    only = sys.argv[1:]
    index = {}
    for sheet, names in SHEETS.items():
        if only and sheet not in only:
            continue
        done = cut(sheet, names)
        if done:
            index[sheet] = done
    if not only:
        (OUT / "index.json").write_text(json.dumps(index, indent=1) + "\n")
