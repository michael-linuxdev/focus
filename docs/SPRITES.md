# Sprite-Runde: Prompts für die Bild-KI (Grok)

Ziel: Die geometrischen Platzhalter durch einen einheitlichen, eigenen Bildsatz ersetzen.
Stil: flache Bilderbuch-Formen. Ansicht: Draufsicht, leicht gekippt.

Die Bilder sind eigene Erzeugnisse. Sie dürfen kein bestehendes Spiel nachahmen und keine fremden
Figuren, Wappen, Logos oder Schriftzüge enthalten.

## So gehst du vor

1. Für jedes der sieben Blätter unten: **Stilblock + Blatt-Prompt** zusammen in Grok einfügen (der Stilblock steht
   immer zuerst, unverändert).
2. Zwei bis vier Varianten erzeugen und die nehmen, bei der alle Motive vollständig, getrennt und im selben Stil sind.
3. Beginne mit Blatt 1 (Türme). Dieses Bild ist der Stil-Anker: Lade es bei allen weiteren Blättern als
   Referenzbild mit hoch und schreibe davor: `Match the art style, outline weight and colour palette of the attached image exactly.`
4. Bilder in voller Auflösung als PNG speichern, unter `art/roh/` mit den Dateinamen aus der Tabelle ablegen
   (oder mir schicken). Nicht zuschneiden, nicht freistellen: das mache ich per Skript.

| Blatt | Datei | Inhalt |
| --- | --- | --- |
| 1 | `art/roh/tuerme.png` | 4 Türme in 2 Stufen |
| 2 | `art/roh/einheiten.png` | 3 Truppen, 3 Räuber, Miliz |
| 3 | `art/roh/gebaeude.png` | 6 Gebäude, Baustelle, leerer Bauplatz |
| 4 | `art/roh/stadt.png` | Burgfried in 2 Stufen, Torhaus heil und zerstört, Marktplatz, Turm-Bauplatz |
| 5a–5c | `art/roh/boden-wiese.png`, `boden-strasse.png`, `boden-lager.png` | Bodenflächen, je ein Bild |
| 6 | `art/roh/symbole.png` | 9 Symbole |
| 7 | `art/roh/heldin.png` | Porträt der Heldin |

Was ich danach baue: ein Skript, das die Motive anhand der Hintergrundfarbe findet, freistellt und auf
Kachelgröße bringt, und den Einbau in die Darstellung. Die Spiellogik bleibt unberührt.

## Worauf du beim Auswählen achtest

- **Hintergrund einfarbig Magenta**, ohne Verlauf, ohne Boden, ohne Schatten unter den Motiven. Nur so lässt sich sauber freistellen.
- **Motive berühren sich nicht** und nicht den Bildrand. Die Anordnung im Raster muss nicht exakt sein.
- **Keine Schrift, keine Zahlen, keine Rahmen** im Bild.
- **Gleiche Blickrichtung und gleiche Lichtseite** bei allen Motiven eines Blatts.
- Stufe 2 muss als dasselbe Gebäude erkennbar sein wie Stufe 1, nur größer und reicher.
- Wenn Grok ein Motiv auslässt oder verdoppelt: neu erzeugen statt nachbessern. Notfalls das Blatt in zwei Hälften teilen
  (zum Beispiel erst die vier Türme der Stufe 1, dann die der Stufe 2 mit Blatt 1 als Referenz).

---

## Stilblock (immer zuerst, unverändert)

```
Game sprite sheet for an original medieval strategy game. Art style: flat storybook illustration,
like a modern children's picture book about the Middle Ages. Simple rounded shapes, large flat colour
areas, thick soft dark-brown outlines of even weight, at most one lighter and one darker tone per
colour, no gradients, no textures, no photorealism, no 3D render, no pixel art.

Camera: top-down view tilted about 30 degrees, so roofs are seen from above and a little of the front
wall is visible. Every object is drawn from exactly the same angle, lit from the top left.

Colour palette, use only these and close tones: warm stone beige #d8d2c0, sand #b79a63, wood brown
#7a5a3a, slate blue #4b6a8a, moss green #2c4030, leaf green #7fbf7f, brick red #b3372f, gold #e9b949,
dark outline #2a2420.

Layout: each object separate, complete and centred in its own cell of an evenly spaced grid, with
clear empty space between objects. Objects never touch each other or the image edge.
Background: one single flat solid magenta #ff00ff everywhere, no ground, no floor, no cast shadows,
no vignette.
No text, no letters, no numbers, no labels, no borders, no frames, no logos, no heraldry of real
families or countries. Original design, not resembling any existing game, film or brand.
```

---

## Blatt 1: Türme (`tuerme.png`)

```
Grid of 4 columns and 2 rows, 8 defence towers in total, square image.
Top row, basic versions, left to right:
1. Archer tower: slim square stone tower with a pointed slate-blue roof and one arrow slit.
2. Catapult: a wooden catapult with a long throwing arm on a low stone platform.
3. Pitch tower: a squat round stone tower with a large black iron cauldron of dark pitch on top.
4. Guardhouse: a small stone guard hut with a green shield hanging on the front and a wooden door.
Bottom row: the upgraded version of the tower directly above it. Clearly the same building, but
taller and richer: added battlements, a second roof tier or small gold flag, thicker walls.
All eight towers have the same footprint size and stand upright.
```

## Blatt 2: Einheiten (`einheiten.png`)

```
Grid of 4 columns and 2 rows, 7 small unit figures and one empty cell, square image.
All figures are seen from above at the same tilt, walking towards the viewer (downwards), each
figure fills about two thirds of its cell. Simple readable silhouettes, big heads, no faces needed.
Top row, the player's troops, all wearing slate-blue cloth:
1. Light soldier: unarmoured runner with a short spear and a small round shield.
2. Armoured soldier: broad figure in plate armour with a large rectangular shield and helmet.
3. Battering ram: a wooden ram on four wheels with a roof of planks, pushed by two small figures.
4. Militia guard: a town guard in leaf-green tunic with a halberd, standing still.
Bottom row, the enemy raiders, all wearing brick-red cloth:
5. Raider: hooded bandit with a club.
6. Shield raider: heavy bandit with a big wooden tower shield and an iron cap.
7. Raider ram: a crude battering ram made of a tree trunk on wheels, with red rags tied to it.
8. Leave this cell empty.
```

## Blatt 3: Gebäude (`gebaeude.png`)

```
Grid of 4 columns and 2 rows, 8 village buildings, square image. All buildings have the same
footprint size, roughly round or square, and would fit on one map tile.
Top row:
1. Woodcutter's hut: small timber hut with a stack of logs and an axe in a chopping block.
2. Quarry: an open stone pit with cut stone blocks and a wooden crane.
3. Barracks: long stone building with a slate-blue roof, a weapon rack and a training dummy outside.
4. Farmstead: thatched farmhouse with a small golden wheat field and a hay cart.
Bottom row:
5. Storehouse: sturdy timber-framed warehouse with barrels and sacks at the door.
6. Infirmary: white-walled house with a leaf-green roof, herb beds and a simple stretcher outside.
7. Construction site: wooden scaffolding around an unfinished wall, with a pile of planks and stone.
8. Empty building plot: a round patch of bare earth marked with four wooden pegs and string.
```

## Blatt 4: Stadt (`stadt.png`)

```
Grid of 3 columns and 2 rows, 6 objects, square image.
Top row:
1. Castle keep, small: a square stone keep with battlements and one slate-blue banner.
2. Castle keep, upgraded: the same keep, clearly larger, with four corner turrets, a second storey
   and two gold-trimmed banners.
3. Market square: a round cobbled plaza with a stone well in the middle and two striped market stalls.
Bottom row:
4. Gatehouse, intact: a stone gate with two short towers and a closed heavy wooden double door,
   seen so that a road could pass through it from top to bottom.
5. Gatehouse, broken: the same gatehouse with the wooden door smashed in and splintered planks.
6. Empty tower plot: a square stone foundation slab with a wooden signpost without any writing.
```

## Blatt 5: Boden (drei Einzelbilder)

Für diese drei Bilder den Stilblock **ohne** die Absätze „Layout“ und „Background“ verwenden: Hier soll die ganze
Fläche gefüllt sein.

`boden-wiese.png`
```
Seamless tileable ground texture, square image, seen exactly from above. A calm moss-green meadow
#2c4030 with a few slightly lighter grass tufts and tiny flowers scattered evenly. Flat storybook
style, very low contrast, no objects, no paths, no shadows, no border. The left edge matches the
right edge and the top edge matches the bottom edge.
```

`boden-strasse.png`
```
Seamless tileable ground texture, square image, seen exactly from above. A packed sand-coloured dirt
road surface #b79a63 with a few flat pebbles and faint cart-wheel ruts. Flat storybook style, low
contrast, no grass, no edges of the road visible, no objects, no shadows, no border. The left edge
matches the right edge and the top edge matches the bottom edge.
```

`boden-lager.png`
```
Seamless tileable ground texture, square image, seen exactly from above. Trampled dry brown earth of
a raider camp, colour around #3a3528, with scattered straw, a few dark scorch marks and small stones.
Flat storybook style, low contrast, no objects, no tents, no shadows, no border. The left edge
matches the right edge and the top edge matches the bottom edge.
```

## Blatt 6: Symbole (`symbole.png`)

```
Grid of 3 columns and 3 rows, 9 simple icons, square image. Each icon is one bold object, centred,
seen straight from the front (not tilted), readable at very small size.
Row 1: a single gold coin; a bundle of three wooden logs tied with rope; a pile of three grey cut
stone blocks.
Row 2: a slate-blue kite shield with a plain gold rim; two crossed swords; a small castle tower
with battlements.
Row 3: a rolled parchment map with a red wax dot; two hands shaking; a sun rising over a hill.
```

## Blatt 7: Heldin (`heldin.png`)

```
One single character portrait, square image, head and shoulders, facing slightly to the left.
A confident medieval woman commander in her thirties called Alruna: braided chestnut hair,
slate-blue cloak with a simple gold clasp, light leather armour, calm determined expression.
Same flat storybook style with thick soft dark-brown outlines and flat colours.
Background: one single flat solid magenta #ff00ff, no scenery, no frame, no text.
```
