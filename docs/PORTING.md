# Umzug nach Unity 6 / C# / Metaplay

Stand: M1. Dieses Dokument wird mit jedem Meilenstein nachgezogen.

## Was übernommen wird

| Teil | Ort | Wie |
| --- | --- | --- |
| Datendateien | `data/*.json` | Unverändert. JSON Schema (Draft-07) in `data/schemas/` beschreibt jedes Feld und lässt sich in C# prüfen. |
| Regeln | `src/sim/` | Eins zu eins nach C# übertragen: gleiche Funktionen, gleiche Reihenfolge, gleiche Ganzzahlrechnung. |
| Aktionen und Zustandsmodell | `src/sim/game.ts`, `src/sim/battle/battle.ts` | Grundlage für Spielermodell und Aktionen in Metaplay. Jede Aktion hat bereits eine Prüf-Funktion. |
| Wiederholungen | Format `Replay` in `src/sim/replay.ts` | Als Prüffälle: jede gespeicherte Wiederholung muss in C# denselben `finalTick` und `finalHash` liefern. |
| Prüfvektoren | Snapshots in `tests/sim/rng.test.ts` und `tests/sim/battle.test.ts` | Zuerst portieren; stimmen sie, stimmt die Grundlage. |
| Abläufe der Oberfläche | `src/ui/`, Tutorial-Daten | Nur als Vorlage. |

## Was neu geschrieben wird

- Darstellung (`src/render/`, `src/ui/`): Canvas und Preact sind Platzhalter.
- Hülle (`src/app/`): Bildschleife, Speicherung in `localStorage`, Migrationen, Service Worker.
- Weltkarte, Allianz, Nachbarn: im Prototyp Attrappen, werden ersetzt.
- Ereignisaufzeichnung: lokal, wird durch einen eigenen Empfänger ersetzt.

## Rechenregeln der Spiellogik

| Regel | TypeScript | C# |
| --- | --- | --- |
| Zahlentyp | Ganzzahlen im int32-Bereich | `int` |
| Division | `idiv(a, b)`, schneidet zur Null hin ab | `a / b` |
| Mal-durch | `mulDiv(a, b, c)`, wirft über 2^53 | `(int)((long)a * b / c)` |
| Zeit | Ticks, `ticksPerSecond` aus `data/game.json` (derzeit 20) | gleich |
| Strecke | Tausendstel-Kacheln entlang der Straße | gleich |
| Anteile | Promille | gleich |
| Zufall | xoshiro128** mit splitmix32-Start, Zustand vier uint32 | `uint` mit `unchecked`; `Math.imul(a, b) >>> 0` ist `a * b` |
| Zufallsbereich | `rngInt`: Verwerfen über `floor(2^32 / n) * n`, dann Modulo | `ulong` für die Grenze |
| Prüfsumme | FNV-1a 32 Bit über die in `hashBattle` festgelegte Feldfolge, je Zahl vier Bytes, niederwertiges zuerst | gleich |

Verboten in `src/sim/` (per Test erzwungen): Gleitkomma-Funktionen, `Math.random`, Uhrzeit, DOM, Speicher, Netz.

### Reihenfolge innerhalb eines Ticks

1. Eingaben dieses Ticks in Listenreihenfolge anwenden (ungültige werden übergangen)
2. Fällige Einheiten in Planreihenfolge aufstellen
3. Einheiten in Reihenfolge ihrer Kennung bewegen
4. Am Burgfried angekommene Einheiten entfernen, Burgfried-Schaden (nicht bei `unlosable`)
5. Türme in Reihenfolge der Bauplätze der Straße: Abklingzeit herunterzählen oder schießen
6. Ergebnis prüfen (`lost` vor `won`), Tick hochzählen

Sortierungen müssen stabil sein (in C# `OrderBy`, nicht `List.Sort`).

### Regeln der Verteidigung (Stand M1)

- **Ziel eines Turms:** die am weitesten vorgerückte Einheit in Reichweite, bei Gleichstand die mit der kleinsten Kennung.
  Reichweite über das Quadrat des Abstands zwischen Bauplatz und Ort der Einheit in Milli-Kacheln (bleibt unter 2^31).
- **Schuss:** sofortiger Treffer, kein fliegendes Geschoss. Stirbt das Ziel, gibt es das Kopfgeld (`bounty`) sofort.
  Türme schießen nacheinander; ein späterer Turm sieht die Treffer der früheren desselben Ticks.
- **Haltepunkt (`holdMilliUntilTower`):** Solange kein Turm steht und der vorderste Angreifer die Wegstrecke erreicht hat,
  entfallen Schritt 2 und 3, und alle geplanten Aufstellungen verschieben sich um einen Tick. Nur im ersten Tutorial-Schritt gesetzt.
- **Unverlierbar (`unlosable`):** Angekommene Angreifer verschwinden ohne Burgfried-Schaden. Gilt für die Tutorial-Wellen.
- **Zeit vor dem Auslösen:** Die Hülle rechnet vor `ReleaseWave` nur dann einen Tick, wenn eine Eingabe vorliegt.
  Für die Logik ist das unsichtbar: eine Wiederholung enthält schlicht Eingaben bei Tick 0, 1, 2 …
- **Sieggold (`victoryGold`)** vergibt nicht die Schlacht, sondern `ResolveDefense` im Spielzustand.

## Wiederholungsformat

```json
{ "format": 1, "dataVersion": "1.2.2.1.2.1",
  "setup": { "roadId": "dorf_1", "waveId": "dorf_w2", "towers": [{ "slot": "s1", "def": "bogenturm", "level": 1 }],
             "gold": 50, "keepHp": 10, "unlosable": true, "autoRelease": false, "holdMilliUntilTower": 0 },
  "seed": 42,
  "inputs": [{ "tick": 0, "action": { "type": "BuildTower", "slot": "s2", "tower": "bogenturm" } },
             { "tick": 1, "action": { "type": "ReleaseWave" } }],
  "finalTick": 430, "finalHash": 123456789 }
```

`dataVersion` verkettet die Versionen der Datendateien (game, roads, units, towers, waves, tutorial). Ändert sich eine Datei
mit Einfluss auf Schlachten, steigt ihre Version, und alte Wiederholungen gelten nur gegen den alten Datenstand.
Die letzte Verteidigung liegt als Wiederholung im Spielzustand (`lastDefense`).

## Zustandsmodell (Stand M1)

- `GameState`: `version`, `now`, `nextSeed`, `gold`, `towers[]` (Bauplatz, Turm, Stufe), `wavesWon`, `lastDefense`
- `BattleState`: `tick`, `rng`, `setup`, `released`, `pending[]`, `units[]`, `towers[]`, `gold`, `keepHp`, `killed`, `leaked`, `result`
- Der Tutorial-Schritt ist kein eigener Zustand, sondern folgt aus `wavesWon` und `data/tutorial.json`.
  Welcher Hinweis gerade gilt, berechnet `currentHint` aus Schritt und Schlachtzustand.

## Aktionen (Stand M1)

| Aktion | Ebene | Prüfung |
| --- | --- | --- |
| `AdvanceTime { now }` | Spielzustand | Zeit läuft nicht rückwärts |
| `ResolveDefense { inputs }` | Spielzustand | Rechnet die Verteidigung aus eigenem Startzustand, eigenem Startwert und den Eingaben nach; lehnt unfertige Schlachten ab. Gold, Türme und Fortschritt stammen aus dem nachgerechneten Ergebnis, nie vom Client. |
| `ReleaseWave` | Schlacht | Schlacht läuft, Welle noch nicht ausgelöst |
| `BuildTower { slot, tower }` | Schlacht | Bauplatz und Turm bekannt, Platz frei, Gold reicht |
| `UpgradeTower { slot }` | Schlacht | Turm vorhanden, nächste Stufe vorhanden, Gold reicht |

## Annahmen des Prototyps, die auf einem Server nicht gelten

- **Geräteuhr.** `AdvanceTime` bekommt die Uhr des Geräts. Wer sie verstellt, überspringt Bauzeiten. Auf dem Server kommt die Zeit vom Server.
- **Startwerte.** Der erste Startwert kommt vom Gerät, jeder weitere wird daraus abgeleitet und ist für den Client vorhersehbar. Auf dem Server vergibt ihn der Server.
- **Vertrauen.** Der Client wendet Aktionen selbst an und speichert das Ergebnis. Auf dem Server werden Aktionen geprüft und Schlachten aus der Wiederholung nachgerechnet.
- **Speicherstand.** Liegt unverschlüsselt in `localStorage` und ist veränderbar. Migrationen (`src/app/save.ts`) werden durch die Schema-Migration des Backends ersetzt.
- **Einzelspieler.** Es gibt keine gleichzeitigen Zugriffe auf einen Zustand, also keine Konfliktbehandlung.
- **JSON-Zahlen.** Alle Zahlen im Zustand bleiben unter 2^53 (`now` in Millisekunden), in Schlachten unter 2^31.
