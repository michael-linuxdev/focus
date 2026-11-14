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
# Einzelbilder: art/roh/einzeln/<name>.png (oder .jpg) enthält genau ein Motiv; der Dateiname ist der Name im Spiel.
# Die Art bestimmt die Größe im Atlas. Stufenbilder heißen <name>_<stufe>: das Spiel nimmt für eine Stufe das Bild
# mit der höchsten vorhandenen Stufe darunter, es müssen also nicht alle Stufen da sein.
SINGLES = {
    "einheiten": ["laeufer", "ritter", "hauptmann"],
    "tuerme": [f"{t}_{n}" for t in ("bogenturm", "katapult", "pechnase", "wachstube") for n in (3, 4, 5)],
    "stadt": ["burgfried_3", "burgfried_5", "burgfried_7"],
    "gebaeude": [f"{b}_4" for b in ("holzfaeller", "steinbruch", "kaserne", "hof", "speicher", "lazarett")],
}
# Längste Kante eines gespeicherten Sprites in Pixeln (im Spiel wird weiter verkleinert).
MAX_SIDE = 192
OUTLINE = np.array([42.0, 36.0, 32.0], dtype=np.float32)
GAME = ROOT / "public" / "sprites"

# Zielbreite je Blatt im Bildatlas des Spiels (Pixel). Figuren werden über die Höhe bemessen.
ATLAS_WIDTH = {"tuerme": 128, "gebaeude": 128, "stadt": 176}
ATLAS_UNIT_HEIGHT = 80
# Bodenflächen: Datei, sauberer Ausschnitt (links, oben, Kantenlänge) im Rohbild.
GROUNDS = {"wiese": ("boden-wiese", 24, 24, 310), "strasse": ("boden-strasse", 12, 12, 1000), "lager": ("boden-lager", 16, 16, 300)}


def background_distance(rgb: np.ndarray) -> np.ndarray:
    """0 = reines Hintergrund-Magenta, 1 = weit weg davon. Der Hintergrundton wird aus den Bildecken gelesen."""
    # Die Ecke, die dem Soll-Magenta am nächsten kommt, gibt den Ton vor (bei Porträts liegen unten Motivteile in den Ecken).
    patches = [rgb[:12, :12], rgb[:12, -12:], rgb[-12:, :12], rgb[-12:, -12:]]
    medians = [np.median(p.reshape(-1, 3), axis=0) for p in patches]
    key = min(medians, key=lambda m: float(((m - np.array([255.0, 0.0, 255.0])) ** 2).sum()))
    dist = np.sqrt(((rgb - key) ** 2).sum(axis=2))
    # Unter LOW gilt als Hintergrund, über HIGH als Motiv, dazwischen weiche Kante.
    low, high = 80.0, 150.0
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
        # Magenta-Saum entfernen: Randpixel, in denen Rot und Blau das Grün deutlich übersteigen, bekommen die
        # dunkle Konturfarbe. Die Motive haben ohnehin dunkle Umrisse, so fällt das nicht auf.
        transparent = a < 0.05
        near_edge = transparent.copy()
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                near_edge |= np.roll(np.roll(transparent, dy, axis=0), dx, axis=1)
        pinkish = (np.minimum(c[..., 0], c[..., 2]) - c[..., 1] > 28) & (c[..., 0] > 110)
        fringe = near_edge & pinkish
        c[fringe] = OUTLINE
        rgba = np.dstack([np.clip(c, 0, 255), a * 255]).astype(np.uint8)
        img = Image.fromarray(rgba, "RGBA")
        scale = MAX_SIDE / max(img.size)
        if scale < 1:
            img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
        img.save(OUT / sheet / f"{name}.png")
        written.append({"name": name, "file": f"{sheet}/{name}.png", "w": img.width, "h": img.height})
    print(f"  {sheet}: {len(written)} Sprites aus {path.name} (Hintergrund {tuple(int(v) for v in key)})")
    return written


def cut_singles() -> dict:
    """Schneidet die Einzelbilder aus art/roh/einzeln/ und liefert sie nach Art sortiert."""
    folder = RAW / "einzeln"
    found = {}
    if not folder.exists():
        return found
    kinds = {name: kind for kind, names in SINGLES.items() for name in names}
    for path in sorted(folder.iterdir()):
        if path.suffix.lower() not in (".png", ".jpg", ".jpeg"):
            continue
        kind = kinds.get(path.stem)
        if kind is None:
            print(f"  WARNUNG einzeln/{path.name}: unbekannter Name, erwartet einer von {sorted(kinds)}")
            continue
        rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
        alpha, key = background_distance(rgb)
        solid = alpha > 0.5
        if not solid.any():
            print(f"  WARNUNG einzeln/{path.name}: kein Motiv gefunden (Hintergrund nicht Magenta?)")
            continue
        # Ein Motiv je Bild: alles, was nicht Hintergrund ist, gehört dazu (auch lose Teile wie eine Fahne).
        ys, xs = np.nonzero(solid)
        l, t, r, b = max(0, xs.min() - 2), max(0, ys.min() - 2), min(rgb.shape[1], xs.max() + 3), min(rgb.shape[0], ys.max() + 3)
        a = alpha[t:b, l:r]
        c = rgb[t:b, l:r].copy()
        transparent = a < 0.05
        near_edge = transparent.copy()
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                near_edge |= np.roll(np.roll(transparent, dy, axis=0), dx, axis=1)
        pinkish = (np.minimum(c[..., 0], c[..., 2]) - c[..., 1] > 28) & (c[..., 0] > 110)
        c[near_edge & pinkish] = OUTLINE
        img = Image.fromarray(np.dstack([np.clip(c, 0, 255), a * 255]).astype(np.uint8), "RGBA")
        scale = MAX_SIDE / max(img.size)
        if scale < 1:
            img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
        (OUT / "einzeln").mkdir(parents=True, exist_ok=True)
        img.save(OUT / "einzeln" / f"{path.stem}.png")
        found.setdefault(kind, []).append({"name": path.stem, "file": f"einzeln/{path.stem}.png", "w": img.width, "h": img.height})
    if found:
        print(f"  einzeln: {sum(len(v) for v in found.values())} Einzelbilder ({', '.join(e['name'] for v in found.values() for e in v)})")
    return found


def build_game_assets(index: dict) -> None:
    """Bildatlas, Symbole, Porträt und nahtlose Bodenkacheln für das Spiel nach public/sprites/."""
    GAME.mkdir(parents=True, exist_ok=True)
    (GAME / "icons").mkdir(exist_ok=True)
    items = []
    for sheet in ("tuerme", "gebaeude", "stadt", "einheiten"):
        for entry in index.get(sheet, []):
            img = Image.open(OUT / entry["file"])
            if sheet == "einheiten":
                scale = ATLAS_UNIT_HEIGHT / img.height
            else:
                scale = ATLAS_WIDTH[sheet] / img.width
            size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
            items.append((entry["name"], img.resize(size, Image.LANCZOS)))
    # Einfaches Regalverfahren: nach Höhe sortiert in Zeilen fester Breite.
    items.sort(key=lambda it: -it[1].height)
    width, x, y, row_h, placed = 1024, 0, 0, 0, {}
    for name, img in items:
        if x + img.width + 2 > width:
            x, y, row_h = 0, y + row_h + 2, 0
        placed[name] = (x, y, img)
        x += img.width + 2
        row_h = max(row_h, img.height)
    atlas = Image.new("RGBA", (width, y + row_h), (0, 0, 0, 0))
    rects = {}
    for name, (px, py, img) in placed.items():
        atlas.paste(img, (px, py))
        rects[name] = {"x": px, "y": py, "w": img.width, "h": img.height}
    # WebP statt PNG: die Rohbilder sind verrauscht, als PNG wäre der Atlas rund 1 MB groß.
    atlas.save(GAME / "atlas.webp", quality=86, method=6)
    (ROOT / "src" / "render" / "atlas.json").write_text(json.dumps({"size": [atlas.size[0], atlas.size[1]], "sprites": rects}, indent=1, sort_keys=True) + "\n")
    for entry in index.get("symbole", []):
        img = Image.open(OUT / entry["file"])
        side = max(img.size)
        square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        square.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
        square.resize((64, 64), Image.LANCZOS).save(GAME / "icons" / f"{entry['name']}.png", optimize=True)
    for entry in index.get("heldin", []):
        img = Image.open(OUT / entry["file"])
        side = min(img.size)
        img.crop(((img.width - side) // 2, 0, (img.width - side) // 2 + side, side)).resize((128, 128), Image.LANCZOS).save(GAME / "icons" / "alruna.png", optimize=True)
    # Bodenkacheln: sauberer Ausschnitt, gespiegelt zu 2x2 zusammengesetzt. So passen alle Ränder ohne Naht.
    for name, (file, left, top, side) in GROUNDS.items():
        path = next((p for p in [RAW / f"{file}.png", RAW / f"{file}.jpg", RAW / f"{file}.jpeg"] if p.exists()), None)
        if path is None:
            continue
        part = Image.open(path).convert("RGB").crop((left, top, left + side, top + side)).resize((128, 128), Image.LANCZOS)
        tile = Image.new("RGB", (256, 256))
        tile.paste(part, (0, 0))
        tile.paste(part.transpose(Image.FLIP_LEFT_RIGHT), (128, 0))
        tile.paste(part.transpose(Image.FLIP_TOP_BOTTOM), (0, 128))
        tile.paste(part.transpose(Image.ROTATE_180), (128, 128))
        tile.save(GAME / f"boden-{name}.jpg", quality=82)
    print(f"  Spiel: atlas.webp {atlas.size[0]}x{atlas.size[1]} mit {len(rects)} Motiven, Symbole, Porträt, Böden nach public/sprites/")


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
        for kind, entries in cut_singles().items():
            index.setdefault(kind, []).extend(entries)
        (OUT / "index.json").write_text(json.dumps(index, indent=1) + "\n")
        build_game_assets(index)
