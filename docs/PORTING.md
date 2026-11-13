# Umzug nach Unity 6 / C# / Metaplay

Stand: M0. Dieses Dokument wird mit jedem Meilenstein nachgezogen.

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
4. Angekommene Einheiten zählen und entfernen
5. Ergebnis prüfen, Tick hochzählen

Sortierungen müssen stabil sein (in C# `OrderBy`, nicht `List.Sort`).

## Wiederholungsformat

```json
{ "format": 1, "dataVersion": "1.1.1.1", "setup": { "roadId": "dorf_1", "waveId": "demo_1" },
  "seed": 42, "inputs": [{ "tick": 20, "action": { "type": "ReleaseWave" } }],
  "finalTick": 675, "finalHash": 2437633192 }
```

`dataVersion` verkettet die Versionen der Datendateien. Ändert sich eine Datei mit Einfluss auf Schlachten,
steigt ihre Version, und alte Wiederholungen gelten nur gegen den alten Datenstand.

## Aktionen (Stand M0)

| Aktion | Ebene | Prüfung |
| --- | --- | --- |
| `AdvanceTime { now }` | Spielzustand | Zeit läuft nicht rückwärts |
| `FinishBattle { arrived }` | Spielzustand | Platzhalter bis M1; später aus der nachgerechneten Schlacht abgeleitet |
| `ReleaseWave` | Schlacht | Schlacht läuft, Welle noch nicht ausgelöst |

## Annahmen des Prototyps, die auf einem Server nicht gelten

- **Geräteuhr.** `AdvanceTime` bekommt die Uhr des Geräts. Wer sie verstellt, überspringt Bauzeiten. Auf dem Server kommt die Zeit vom Server.
- **Startwerte.** Der Client würfelt den Startwert der Schlacht selbst. Auf dem Server vergibt ihn der Server.
- **Vertrauen.** Der Client wendet Aktionen selbst an und speichert das Ergebnis. Auf dem Server werden Aktionen geprüft und Schlachten aus der Wiederholung nachgerechnet.
- **Speicherstand.** Liegt unverschlüsselt in `localStorage` und ist veränderbar. Migrationen (`src/app/save.ts`) werden durch die Schema-Migration des Backends ersetzt.
- **Einzelspieler.** Es gibt keine gleichzeitigen Zugriffe auf einen Zustand, also keine Konfliktbehandlung.
- **JSON-Zahlen.** Alle Zahlen im Zustand bleiben unter 2^53 (`now` in Millisekunden), in Schlachten unter 2^31.
