"""
Schneidet die Rohbilder der Bild-KI (art/roh/) in einzelne freigestellte Sprites (art/sprites/).

Die Motive stehen auf einfarbig magentafarbenem Hintergrund in einem groben Raster. Das Skript
findet die Zeilen und Spalten über leere Streifen, stellt jedes Motiv frei (weiche Kante, Magenta-Stich
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


def runs(filled: np.ndarray, min_gap: int, min_size: int):
    """Zusammenhängende Abschnitte eines 1D-Belegungsprofils; Lücken unter min_gap werden überbrückt."""
    out, start, gap = [], None, 0
    for i, f in enumerate(filled):
        if f:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                out.append((start, i - gap + 1))
                start, gap = None, 0
    if start is not None:
        out.append((start, len(filled)))
    return [(a, b) for a, b in out if b - a >= min_size]


def cut(sheet: str, names: list) -> list:
    path = next((p for p in [RAW / f"{sheet}.png", RAW / f"{sheet}.jpg", RAW / f"{sheet}.jpeg"] if p.exists()), None)
    if path is None:
        return []
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    alpha, key = background_distance(rgb)
    solid = alpha > 0.5
    boxes = []
    for top, bottom in runs(solid.any(axis=1), min_gap=6, min_size=24):
        for left, right in runs(solid[top:bottom].any(axis=0), min_gap=6, min_size=24):
            rows = np.where(solid[top:bottom, left:right].any(axis=1))[0]
            boxes.append((left, top + rows[0], right, top + rows[-1] + 1))
    if len(boxes) != len([n for n in names if n]):
        print(f"  WARNUNG {sheet}: {len(boxes)} Motive gefunden, {len(names)} erwartet")
    (OUT / sheet).mkdir(parents=True, exist_ok=True)
    written = []
    for name, (left, top, right, bottom) in zip(names, boxes):
        if not name:
            continue
        pad = 2
        l, t, r, b = max(0, left - pad), max(0, top - pad), min(rgb.shape[1], right + pad), min(rgb.shape[0], bottom + pad)
        a = alpha[t:b, l:r]
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
