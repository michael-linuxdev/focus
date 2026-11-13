# Sprite-Runde: Prompts für die Bild-KI (Grok)

Ziel: Die geometrischen Platzhalter durch einen einheitlichen, eigenen Bildsatz ersetzen.
Stil: flache Bilderbuch-Formen. Ansicht: Draufsicht, leicht gekippt.

Die Bilder sind eigene Erzeugnisse. Sie dürfen kein bestehendes Spiel nachahmen und keine fremden
Figuren, Wappen, Logos oder Schriftzüge enthalten.

## Stand

Alle sieben Blätter sind erzeugt, freigestellt und eingebaut. Abweichungen von den Prompts unten, wie sie sich beim
Erzeugen ergeben haben:

- Türme, Gebäude und Stadt sind detaillierter und isometrisch gezeichnet (Blatt 1 war der Stil-Anker).
- Einheiten und Symbole sind bewusst einfacher (gedrungene Figuren, flache Flächen), damit sie in 30 bis 40 Pixel
  lesbar bleiben. Je Figur gibt es ein Bild; die Bewegung kommt aus dem Code.
- Die Böden werden aus einem sauberen Ausschnitt gespiegelt zu einer nahtlosen Kachel zusammengesetzt.
- Neu erzeugen: Rohbild unter demselben Namen in `art/roh/` ersetzen, dann `python3 scripts/sprites.py`.
- Für den Spielmonat fehlen noch 24 Bilder. Die Prompts dafür stehen einzeln am Ende dieses Dokuments
  (Abschnitt „Einzelbilder für den Spielmonat“).

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


---

# Einzelbilder für den Spielmonat

Für den Spielmonat (M7 bis M11) fehlen 24 Bilder. Anders als bei den Blättern oben gibt es **je Bild einen eigenen
Prompt und eine eigene Datei mit genau einem Motiv**. Das Spiel läuft auch ohne sie: Bis ein Bild da ist, zeigt es
das der niedrigeren Stufe bzw. eine vergrößerte Leihfigur.

## So gehst du vor

1. Je Bild: **Einzel-Stilblock + Prompt** zusammen einfügen.
2. Das genannte **Referenzbild** mit hochladen (liegt in `art/roh/`) und davor schreiben:
   `Match the art style, level of detail, outline weight, camera angle and colour palette of the attached image exactly. Draw only the one new object described below.`
3. Als PNG speichern, quadratisch, nicht zuschneiden, unter **`art/roh/einzeln/<dateiname>`** ablegen (oder mir schicken).
   Der Dateiname ist der Name im Spiel und muss genau stimmen.
4. `python3 scripts/sprites.py` stellt frei und baut den Atlas neu; unbekannte Dateinamen meldet es.

Reihenfolge nach Nutzen: erst die drei Gegner (A), dann die Türme (B), dann der Burgfried (C), zuletzt die Gebäude (D).
Stufenbilder müssen nicht vollständig sein: Fehlt etwa `bogenturm_4`, zeigt das Spiel auf Stufe 4 weiter `bogenturm_3`.

Worauf du achtest: Hintergrund einfarbig Magenta ohne Boden und Schatten, das Motiv vollständig und mit Abstand zum Rand,
keine Schrift, keine Wappen. Höhere Stufen müssen als **dasselbe Bauwerk** erkennbar bleiben, nur größer und reicher.

## Einzel-Stilblock (immer zuerst, unverändert)

```
One single game sprite for an original medieval strategy game: exactly one object, centred, filling
about two thirds of a square image. Thick soft dark-brown outlines of even weight, flat colour areas,
at most one lighter and one darker tone per colour, no gradients, no photorealism, no pixel art.
Colour palette, use only these and close tones: warm stone beige #d8d2c0, sand #b79a63, wood brown
#7a5a3a, slate blue #4b6a8a, moss green #2c4030, leaf green #7fbf7f, brick red #b3372f, gold #e9b949,
dark outline #2a2420. Lit from the top left.
Background: one single flat solid magenta #ff00ff everywhere, no ground, no floor, no cast shadow,
no vignette. The object does not touch the image edge.
No text, no letters, no numbers, no labels, no borders, no frames, no logos, no heraldry of real
families or countries. Original design, not resembling any existing game, film or brand.
```

## A. Gegner (Referenzbild: `art/roh/einheiten.jpg`)

Die Figuren sind bewusst einfach: gedrungen, großer Kopf, flache Flächen, lesbar in 30 bis 40 Pixeln. Alle blicken
nach **links** (das Spiel spiegelt sie beim Lauf nach rechts) und tragen das Ziegelrot der Räuber.

### A1 · Läufer · `laeufer.png`

```
A small enemy raider scout, seen from above at a slight tilt, facing and running to the left.
Stocky simple figure with a big head, same style as the hooded raider in the reference image but
clearly lighter and faster: slim build, no armour, a short brick-red hooded cape flying behind,
bare forearms, a small dagger in one hand, leaning forward mid-stride. No shield, no club.
```

### A2 · Ritter · `ritter.png`

```
A heavy enemy knight on foot, seen from above at a slight tilt, facing and walking to the left.
Stocky simple figure with a big head, same style as the shield raider in the reference image but
clearly heavier and more dangerous: full dark iron plate armour, a closed helmet with a short
brick-red plume, a large iron kite shield painted plain brick red with an iron rim, a heavy mace
in the other hand. Broad shoulders, slow and massive. No symbols on the shield.
```

### A3 · Hauptmann · `hauptmann.png`

```
The raiders' captain, a boss enemy, seen from above at a slight tilt, facing and striding to the left.
Stocky simple figure with a big head, same style as the raiders in the reference image but about
one and a half times as bulky: a towering warlord in dark iron armour with a long tattered brick-red
cloak, a horned iron helmet, a huge two-handed war hammer resting on the shoulder, and a tall
brick-red banner pole strapped to the back with a plain red cloth, no symbol on it. Gold trim on
the belt and shoulder plates so he reads as the leader.
```

## B. Türme, Stufen 3 bis 5 (Referenzbild: `art/roh/tuerme.jpg`)

Detailgrad und Blickwinkel wie im Referenzbild (isometrisch, leicht von oben). Jeder Turm hat dieselbe Grundfläche
wie seine niedrigeren Stufen und steht aufrecht. Die untere Reihe des Referenzbilds zeigt Stufe 2; die neuen Stufen
bauen darauf auf.

### B1 · Bogenturm Stufe 3 · `bogenturm_3.png`

```
Archer tower, upgrade level 3 of 5. It is clearly the same building as in the reference image
(a slim square stone tower with a pointed slate-blue roof and arrow slits), same footprint, standing upright, but grown:
Level 3: taller than before, a wooden archers' gallery running around below the roof, two arrow slits per side, a small gold pennant on the roof tip.
```

### B2 · Bogenturm Stufe 4 · `bogenturm_4.png`

```
Archer tower, upgrade level 4 of 5. It is clearly the same building as in the reference image
(a slim square stone tower with a pointed slate-blue roof and arrow slits), same footprint, standing upright, but grown:
Level 4: a tall tower on a wider stone base, two stacked slate-blue roof tiers, a roofed wooden gallery, iron-banded corners, a gold pennant.
```

### B3 · Bogenturm Stufe 5 · `bogenturm_5.png`

```
Archer tower, upgrade level 5 of 5. It is clearly the same building as in the reference image
(a slim square stone tower with a pointed slate-blue roof and arrow slits), same footprint, standing upright, but grown:
Level 5: a mighty royal archer tower: broad buttressed base, stone battlements below a steep two-tier slate-blue roof with gold trim, a large gold-and-blue banner on top.
```

### B4 · Katapult Stufe 3 · `katapult_3.png`

```
Catapult, upgrade level 3 of 5. It is clearly the same building as in the reference image
(a wooden catapult with a long throwing arm on a low stone platform), same footprint, standing upright, but grown:
Level 3: a larger catapult with a reinforced iron-banded frame on a raised stone platform, a neat stack of round stones beside it.
```

### B5 · Katapult Stufe 4 · `katapult_4.png`

```
Catapult, upgrade level 4 of 5. It is clearly the same building as in the reference image
(a wooden catapult with a long throwing arm on a low stone platform), same footprint, standing upright, but grown:
Level 4: a heavy counterweight trebuchet with a tall A-frame and a hanging stone counterweight, on a square stone platform with a low parapet.
```

### B6 · Katapult Stufe 5 · `katapult_5.png`

```
Catapult, upgrade level 5 of 5. It is clearly the same building as in the reference image
(a wooden catapult with a long throwing arm on a low stone platform), same footprint, standing upright, but grown:
Level 5: a great royal trebuchet: massive iron-bound timber frame, large gold-rimmed counterweight, on a fortified stone bastion with small battlements and a gold pennant.
```

### B7 · Pechnase Stufe 3 · `pechnase_3.png`

```
Pitch tower, upgrade level 3 of 5. It is clearly the same building as in the reference image
(a squat round stone tower with a large black iron cauldron of dark pitch on top), same footprint, standing upright, but grown:
Level 3: the round tower is taller, with a ring of stone battlements around a bigger cauldron and a wooden pouring chute sticking out to one side.
```

### B8 · Pechnase Stufe 4 · `pechnase_4.png`

```
Pitch tower, upgrade level 4 of 5. It is clearly the same building as in the reference image
(a squat round stone tower with a large black iron cauldron of dark pitch on top), same footprint, standing upright, but grown:
Level 4: a broad round tower with two iron cauldrons, a small crane arm with a chain for tipping them, and dark pitch streaks down the wall.
```

### B9 · Pechnase Stufe 5 · `pechnase_5.png`

```
Pitch tower, upgrade level 5 of 5. It is clearly the same building as in the reference image
(a squat round stone tower with a large black iron cauldron of dark pitch on top), same footprint, standing upright, but grown:
Level 5: a mighty round bastion with thick battlements, three steaming iron cauldrons on an iron grate, gold-trimmed rim and a small gold pennant.
```

### B10 · Wachstube Stufe 3 · `wachstube_3.png`

```
Guardhouse, upgrade level 3 of 5. It is clearly the same building as in the reference image
(a small stone guard hut with a green shield hanging on the front and a wooden door), same footprint, standing upright, but grown:
Level 3: a two-storey stone guardhouse with a leaf-green roof, the green shield over a sturdier door, a weapon rack with halberds beside it.
```

### B11 · Wachstube Stufe 4 · `wachstube_4.png`

```
Guardhouse, upgrade level 4 of 5. It is clearly the same building as in the reference image
(a small stone guard hut with a green shield hanging on the front and a wooden door), same footprint, standing upright, but grown:
Level 4: a fortified guardhouse with a small corner watch turret, leaf-green roof tiers, two green shields and a lantern over the iron-banded door.
```

### B12 · Wachstube Stufe 5 · `wachstube_5.png`

```
Guardhouse, upgrade level 5 of 5. It is clearly the same building as in the reference image
(a small stone guard hut with a green shield hanging on the front and a wooden door), same footprint, standing upright, but grown:
Level 5: a royal garrison house: broad stone building with battlements, a watch turret with a gold pennant, gold-rimmed green shields and a wide iron-banded gate.
```

## C. Burgfried (Referenzbild: `art/roh/stadt.jpg`)

Drei Bilder für sechs Stufen: `burgfried_3` gilt für Stufe 3 und 4, `burgfried_5` für 5 und 6, `burgfried_7` für 7 und 8.
Das zweite Motiv im Referenzbild ist der Burgfried der Stufe 2.

### C1 · Burgfried Stufe 3 und 4 · `burgfried_3.png`

```
Castle keep, third stage. Clearly the same square stone keep as the upgraded keep in the reference
image, same footprint, but grown: a third storey, four corner turrets with slate-blue pointed
roofs, battlements on every level, an arched iron-banded gate at the front and three slate-blue
banners with plain gold trim, no symbols.
```

### C2 · Burgfried Stufe 5 und 6 · `burgfried_5.png`

```
Castle keep, fourth stage: a ducal stronghold. Clearly the same square stone keep as in the
reference image, same footprint, but much grander: a tall central tower rising above four strong
corner towers, all with slate-blue pointed roofs and gold roof tips, a ring of battlements, a
stone gate porch with a raised portcullis, and four slate-blue and gold banners, no symbols.
```

### C3 · Burgfried Stufe 7 und 8 · `burgfried_7.png`

```
Castle keep, final stage: a royal castle. Clearly grown from the same square stone keep as in the
reference image, same footprint, but majestic: a high central great tower with a steep slate-blue
roof crowned by a gold finial shaped like a simple crown, four tall corner towers with gold-trimmed
roofs, double battlements, bright gold window frames, a grand arched gate with gold-banded doors,
and long slate-blue and gold banners on every tower, no symbols.
```

## D. Gebäude, ausgebaut (Referenzbild: `art/roh/gebaeude.jpg`)

Ein zweites Aussehen je Gebäude, das ab Stufe 4 gezeigt wird. Davor bleibt das bisherige Bild; die Stufe steht als Zahl daneben.

### D1 · Holzfäller · `holzfaeller_4.png`

```
Sawmill, the upgraded version of the woodcutter's hut in the reference image. Clearly the same
timber hut, same footprint, but grown: a larger two-part timber building with a covered saw
bench, a big wooden water wheel on one side, tall neat stacks of sawn planks and logs.
```

### D2 · Steinbruch · `steinbruch_4.png`

```
Large quarry, the upgraded version of the quarry in the reference image. Clearly the same open
stone pit, same footprint, but grown: a deeper terraced pit, two wooden cranes with ropes and
pulleys, a wooden ramp, and many neatly cut stone blocks stacked at the edge.
```

### D3 · Kaserne · `kaserne_4.png`

```
Garrison, the upgraded version of the barracks in the reference image. Clearly the same long stone
building with a slate-blue roof, same footprint, but grown: a second storey, a small corner turret
with a slate-blue pennant, a stone-walled training yard with two training dummies and a full rack
of spears and shields.
```

### D4 · Hof · `hof_4.png`

```
Manor farm, the upgraded version of the farmstead in the reference image. Clearly the same thatched
farmhouse, same footprint, but grown: a larger farmhouse with a second thatched barn, a small
windmill with four cloth sails, a bigger golden wheat field and a loaded hay cart.
```

### D5 · Speicher · `speicher_4.png`

```
Great storehouse, the upgraded version of the storehouse in the reference image. Clearly the same
sturdy timber-framed warehouse, same footprint, but grown: three storeys with a stone ground floor,
a wooden hoist beam with a rope and hook under the gable, iron-banded double doors, and many
barrels, crates and sacks stacked outside.
```

### D6 · Lazarett · `lazarett_4.png`

```
Hospital, the upgraded version of the infirmary in the reference image. Clearly the same
white-walled house with a leaf-green roof, same footprint, but grown: a larger two-wing building
with a small bell turret, a walled herb garden with neat beds, a well, and two stretchers under a
wooden porch.
```
