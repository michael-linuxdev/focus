# Umzug nach Unity 6 / C# / Metaplay

Stand: M5. Dieses Dokument wird mit jedem Meilenstein nachgezogen.

## Was übernommen wird

| Teil | Ort | Wie |
| --- | --- | --- |
| Datendateien | `data/*.json` | Unverändert. JSON Schema (Draft-07) in `data/schemas/` beschreibt jedes Feld und lässt sich in C# prüfen. |
| Regeln | `src/sim/` | Eins zu eins nach C# übertragen: gleiche Funktionen, gleiche Reihenfolge, gleiche Ganzzahlrechnung. |
| Aktionen und Zustandsmodell | `src/sim/game.ts`, `src/sim/battle/battle.ts` | Grundlage für Spielermodell und Aktionen in Metaplay. Jede Aktion hat bereits eine Prüf-Funktion. |
| Wiederholungen | Format `Replay` in `src/sim/replay.ts` | Als Prüffälle: jede gespeicherte Wiederholung muss in C# denselben `finalTick` und `finalHash` liefern. |
| Balance-Skript | `scripts/balance.ts`, `scripts/lib/bot.ts` | Als Vorlage: dieselben Auswertungen gegen die C#-Logik laufen lassen; gleiche Daten müssen gleiche Quoten liefern. |
| Prüfvektoren | Snapshots in `tests/sim/rng.test.ts` und `tests/sim/battle.test.ts` | Zuerst portieren; stimmen sie, stimmt die Grundlage. |
| Abläufe der Oberfläche | `src/ui/`, Tutorial-Daten | Nur als Vorlage. |

## Was neu geschrieben wird

- Darstellung (`src/render/`, `src/ui/`): Canvas und Preact sind Platzhalter. Die Bilder (`art/`, `public/sprites/`) sind KI-erzeugte Platzhalter für den Prototyp; ob sie in die Unity-Fassung übernommen werden, ist offen.
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
3. Einheiten in Reihenfolge ihrer Kennung bewegen (Pechnasen bremsen); vor einem stehenden Tor und vor stehender Miliz halten sie an und beschädigen sie
4. Am Burgfried angekommene Einheiten entfernen, Burgfried-Schaden (nicht bei `unlosable`)
5. Türme in Reihenfolge der Bauplätze in `data/city.json`: außer Gefecht, Miliz nachrücken lassen, Abklingzeit herunterzählen oder wirken (Schuss, Pech, Miliz)
6. Durchbruchstiefe und Ergebnis prüfen (`breached` vor `held`, zuletzt die Zeitgrenze), Tick hochzählen

Sortierungen müssen stabil sein (in C# `OrderBy`, nicht `List.Sort`).

### Regeln der Schlacht (Stand M4)

Verteidigung und Angriff sind dieselbe Schlacht. `playerSide` legt nur fest, welche Eingaben der Spieler hat:
der Verteidiger baut Türme (`BuildTower`, `UpgradeTower`), der Angreifer löst Wellen aus und setzt Fähigkeiten ein
(`ReleaseWave`, `UseAbility`).

- **Ziel eines Turms:** die am weitesten vorgerückte Einheit in Reichweite, bei Gleichstand die mit der kleinsten Kennung.
  Reichweite über das Quadrat des Abstands zwischen Bauplatz und Ort der Einheit in Milli-Kacheln (bleibt unter 2^31).
- **Schuss:** sofortiger Treffer, kein fliegendes Geschoss. Türme schießen nacheinander; ein späterer Turm sieht die Treffer
  der früheren desselben Ticks. `splashMilli > 0` (Katapult): alle Einheiten im Umkreis um den Ort des Ziels werden getroffen.
- **Schaden:** `max(1, Schaden - armor)`; unter Schildwall danach `max(1, Schaden * damageTakenPermille / 1000)`.
  Steht der Turm im Abschnitt der Heldin des Verteidigers, gilt vorher `Schaden * (1000 + sectionBonusPermille) / 1000`.
- **Pechnase (`kind: slow`):** Jede Einheit, die zu Beginn ihrer Bewegung im Umkreis einer aktiven Pechnase steht, bewegt sich mit
  `max(1, Tempo * slowPermille / 1000)`; bei mehreren zählt der kleinste Wert. Im Takt `cooldownTicks` trifft sie alle Einheiten
  im Umkreis ohne Rüstungsabzug. Steht niemand im Umkreis, verfällt der Takt nicht.
- **Wachstube (`kind: militia`):** Die Miliz steht auf der Straße am Punkt `militiaPosition` (nächster Punkt zum Bauplatz, gesucht
  in 250er-Schritten ab `gateMilli + 250`, bei Gleichstand der frühere). Solange sie Leben hat, bleibt jede Einheit stehen, die
  den Punkt in diesem Tick erreichen oder überschreiten würde, und zieht ihr `melee` ab. Einheiten, die schon dahinter sind,
  laufen weiter. Fällt die Miliz, rückt sie `militiaRespawnTicks` später mit vollem Leben nach. Im Takt schlägt sie die
  aufgehaltene Einheit mit der kleinsten Kennung: `max(1, Schaden * militiaDamagePermille / 1000 - armor)`.
  Pro Einheit und Tick greift höchstens ein Hindernis: das Tor geht vor, danach die erste Wachstube in Listenreihenfolge.
- **Brandpfeile auf Pechnase oder Wachstube:** Bremsen, Pech und Zuschlagen setzen aus; stehende Miliz hält weiter auf.
- **Tor:** Belagerungswert 0 heißt: die Einheit steht vor dem Tor und richtet nichts aus (derzeit alles außer Rammbock, Sturmbock und Räuber).
- **Tor:** steht bei `gateMilli`. Solange es Leben hat, bleibt jede Einheit dort stehen und zieht ihm je Tick `siege` ab.
  Fällt es mitten in einem Tick, laufen die danach bewegten Einheiten desselben Ticks schon durch.
- **Durchbruchstiefe:** 1, sobald das Tor gefallen ist und eine Einheit dahinter steht; 2, sobald eine Einheit den Marktplatz
  (`marketPermille` der Straßenlänge) erreicht; 3, sobald eine Einheit den Burgfried erreicht. Sie sinkt nie.
- **Ende:** `breached`, wenn der Burgfried kein Leben mehr hat (ein Lager hat 1 Leben). `held`, wenn alle Wellen ausgelöst,
  alle Einheiten aufgestellt und keine mehr auf der Straße sind, oder wenn `maxTicks` erreicht ist.
- **Fähigkeiten:** `shield` setzt `shieldUntil`, `disableTower` setzt `disabledUntil` des gewählten Turms; beide haben
  eine Abklingzeit je Fähigkeit (`abilityReadyAt`).
- **Haltepunkt (`holdMilliUntilTower`):** Solange kein Turm steht und der vorderste Angreifer die Wegstrecke erreicht hat,
  entfallen Schritt 2 und 3, und alle geplanten Aufstellungen verschieben sich um einen Tick. Nur in der ersten Welle gesetzt.
- **Unverlierbar (`unlosable`):** Angekommene Angreifer verschwinden ohne Burgfried-Schaden. Gilt für die ersten fünf Wellen;
  sie laufen ohne Tor. Alle späteren Verteidigungen und der Nachtangriff haben das Stadttor (`cityGateHp`).
- **Besiegte je Turm (`kills`)** werden mitgezählt; daraus folgt der schwache Abschnitt.
- **Zufall:** nur der Versatz beim Aufstellen (`jitterTicks`). Angriffswellen des Spielers haben keinen.

### Regeln außerhalb der Schlacht (Stand M4)

- **Zeit:** kommt nur über `AdvanceTime` herein. Dabei wird abgerechnet (`settle`): Burgfried-Ausbau, Beitritt der Heldin
  mit Gefolge, Erträge, Ausbildung, Lazarett. Das Ergebnis hängt nur von der Zeit ab, nicht davon, wie oft abgerechnet wird.
- **Erträge:** je Gebäude in ganzen Takten (`productionIntervalSeconds`) seit Fertigstellung;
  Menge bis Takt k ist `k * producePerHour * Takt / 3600`, abgeschnitten. Ausgeschüttet wird die Differenz.
- **Beute (`computeLoot`):** je Rohstoff `ungeschützt = max(0, Vorrat - Grundstock)`, davon höchstens `lootMaxPermille`,
  davon der Anteil der Durchbruchstiefe. Jede Stufe schneidet ab. Das ist die Verlustgrenze, und sie gilt in beide Richtungen.
- **Verlust der eigenen Stadt (`cityLoss`):** Nach jeder verlierbaren Verteidigung und nach dem Nachtangriff nehmen die
  Angreifer `computeLoot(Vorräte nach der Schlacht, Grundstock der Speicher, Durchbruchstiefe)` mit, aber erst ab
  Durchbruchstiefe `cityLossMinDepth` (Marktplatz). Die ersten `freeNightRaids` Nachtangriffe kosten nichts (`raidsResolved` zählt mit). Bei `breached` gilt ein
  Schild bis `max(bisheriger Schild, jetzt + defeatShieldHours)`. Neue Spieler starten mit `newPlayerShieldHours`.
  Der Schild betrifft nur Nachbarstädte; Räuber greifen trotzdem an.
- **Nachtangriff:** Mit dem Tutorial-Schritt `announcesRaid` wird `raidDueAt = jetzt + nightRaidAfterHours` gesetzt.
  `ResolveNightRaid` ist ab dann gültig und rechnet die Verteidigung mit der Welle `nightRaidWave` ohne Eingaben; danach ist
  der nächste Angriff wieder angekündigt. Die Hülle löst die Aktion beim Öffnen aus.
- **Schwacher Abschnitt (`weakSection`):** der Abschnitt mit bebaubaren Plätzen, dessen Türme die wenigsten Angreifer besiegt
  haben; bei Gleichstand der erste in `data/city.json`.
- **Allianz (Platzhalter):** Nach `RequestHelp` wirkt die n-te Hilfe zum Zeitpunkt `Bitte + n * helpIntervalSeconds` und setzt
  `doneAt = max(dieser Zeitpunkt, doneAt - helpReduceSeconds)`, höchstens `maxHelps`-mal und nur, solange der Bau noch läuft.
- **Tagesziele:** Zähler je Tag (`floor(now / 86400000)`, also UTC-Tage). Ein neuer Tag setzt Zähler und Abholungen zurück.
- **Lazarett:** Gefallene Truppen des Spielers werden nach dem Angriff aus `ready` in `hospital` verschoben und kehren nach
  `healSeconds * Anzahl` (mal `healTimePermille` des Lazaretts) zurück. Es geht nie eine Einheit verloren.
- **Tutorial:** `tutorialStep` rückt nach jeder Aktion vor, solange die Bedingung des aktuellen Schritts erfüllt ist.
  `unlocks` steuert nur, was die Oberfläche zeigt; die Regeln prüfen es nicht.
- **Türme im Stadtbau** entstehen sofort (wie in der Schlacht). Bauzeiten haben Gebäude, Burgfried und Ausbildung.

## Wiederholungsformat

```json
{ "format": 1, "dataVersion": "1.3.1.3.2.1.1",
  "setup": { "playerSide": "attacker", "roadId": "dorf_1", "keepLevel": 1,
             "towers": [{ "slot": "s1", "def": "bogenturm", "level": 1 }],
             "gold": 0, "keepHp": 1, "unlosable": false, "holdMilliUntilTower": 0, "heroSection": null, "gateHp": 300,
             "waves": [{ "groups": [{ "unit": "ramme", "count": 2, "startTick": 0, "intervalTicks": 8, "jitterTicks": 0 }] }],
             "autoRelease": false, "abilities": ["schildwall", "brandpfeile"], "maxTicks": 1800 },
  "seed": 42,
  "inputs": [{ "tick": 0, "action": { "type": "ReleaseWave" } },
             { "tick": 40, "action": { "type": "UseAbility", "ability": "brandpfeile", "slot": "s1" } }],
  "finalTick": 739, "finalHash": 123456789 }
```

Das Setup ist in sich vollständig (Wellen stehen ausgeschrieben darin). `dataVersion` verkettet die Versionen der Dateien,
die eine Schlacht beeinflussen (game, roads, city, units, towers, hero, rules). Ändert sich eine davon, steigt ihre Version,
und alte Wiederholungen gelten nur gegen den alten Datenstand. Der Spielzustand bewahrt die letzten `maxReplays` Schlachten auf.
Die Oberfläche spielt sie über dieselbe `stepBattle`-Funktion ab und vergleicht am Ende Tick und Prüfsumme.

## Zustandsmodell (Stand M4)

- `GameState`: `version`, `now`, `nextSeed`, `resources` (Gold, Holz, Stein), `towers[]`, `buildings[]` (Bauplatz, Gebäude,
  `doneAt`, `producedUntil`), `keepLevel`, `keepDoneAt`, `roadId`, `roadChoicePending`, `hero` (beigetreten, Abschnitt),
  `army` (`ready` je Einheit, `training`, `hospital[]`), `defensesWon`, `attacksDone`, `tutorialStep`, `replays[]`, `lastAttack`,
  `shieldUntil`, `worldSeen`, `allianceJoined`, `daily` (Tag, Zähler, abgeholte Ziele), `goalsClaimed`, `raidDueAt`,
  `raidAcknowledged`, `raidReport`, `raidsResolved`; Gebäude tragen zusätzlich `helpRequestedAt` und `helpsReceived`
- `BattleState`: `tick`, `rng`, `setup`, `releasedWaves`, `pending[]`, `units[]`, `towers[]`, `gold`, `keepHp`, `gateHp`,
  `depth`, `shieldUntil`, `abilityReadyAt[]`, `fallen[]`, `leaked`, `result`; Türme tragen `kills`, `militiaHp`,
  `militiaRespawnAt`, `militiaPos`
- `army.ready` ist eine Zuordnung Einheit → Anzahl. Gelesen wird sie immer in der Reihenfolge von `data/troops.json`.

## Aktionen (Stand M4)

| Aktion | Ebene | Prüfung |
| --- | --- | --- |
| `AdvanceTime { now }` | Spiel | Zeit läuft nicht rückwärts |
| `BuildTower { slot, tower }`, `UpgradeTower { slot }` | Spiel und Schlacht | Bauplatz und Turm bekannt und für die Burgfried-Stufe frei, Platz frei bzw. belegt, Gold reicht (dieselbe Funktion `towerActionCost`) |
| `BuildBuilding { plot, building }` | Spiel | Bauplatz frei, Gebäude noch nicht vorhanden, Vorräte reichen |
| `SkipTimerFree { plot }` | Spiel | Bau läuft, und der Tutorial-Schritt erlaubt es (`freeSkip`) |
| `UpgradeKeep` | Spiel | nächste Stufe vorhanden, kein Ausbau läuft, keine offene Straßenwahl, Vorräte reichen |
| `ChooseRoad { road }` | Spiel | Wahl steht an, Verlauf gehört zur Burgfried-Stufe |
| `AssignHero { section }` | Spiel | Heldin beigetreten, Abschnitt bekannt |
| `TrainTroops { unit, count }` | Spiel | Kaserne fertig, keine Ausbildung läuft, Vorräte reichen |
| `ResolveDefense { inputs }` | Spiel | Rechnet die Verteidigung aus eigenem Startzustand, eigenem Startwert und den Eingaben nach; lehnt unfertige Schlachten ab |
| `ResolveAttack { camp, lineup, inputs }` | Spiel | Aufstellung hat die richtige Wellenzahl, nur eigene bereite Truppen, mindestens eine Einheit, Ziel nicht unter Schild; dann wie oben nachgerechnet. Beute und Lazarett stammen aus dem Ergebnis |
| `ResolveNightRaid` | Spiel | Angriff angekündigt und fällig; rechnet ohne Eingaben |
| `DismissRaidReport`, `AcknowledgeRaid`, `OpenWorldMap` | Spiel | nur Merker für Oberfläche und Tutorial |
| `JoinAlliance` | Spiel | noch nicht Mitglied (Platzhalter) |
| `RequestHelp { plot }` | Spiel | Mitglied, Bau läuft, noch keine Bitte für diesen Bau |
| `ClaimDailyGoal { goal }` | Spiel | Ziel bekannt, Zähler erreicht, heute noch nicht abgeholt |
| `ReleaseWave` | Schlacht (Angreifer) | noch eine Welle übrig |
| `UseAbility { ability, slot }` | Schlacht (Angreifer) | Fähigkeit vorhanden und bereit; `disableTower` braucht einen Turm als Ziel |

## Messung

- Ereignisformat (`GameEvent` in `src/telemetry/events.ts`): `t` (ms), `day` (Kalendertag des Geräts), `session`, `seq`, `type`,
  `data` (wenige Spielwerte), `lapse` (mit Zeitraffer entstanden). Arten: `app_open`, `app_close`, `app_reopen`, `tutorial_step`,
  `tower_built`, `building_started`, `battle_start`, `battle_end`, `action_cancelled`, `alliance_joined`, `help_requested`,
  `goal_claimed`, `raid_report`.
- Kennzahlen (`summarize` in `src/telemetry/metrics.ts`): Minute 10 erreicht = Schritt `minute10Step` erreicht; Allianz = Ereignis
  `alliance_joined`; Rückkehr am nächsten Tag = `app_open` oder `app_reopen` am Kalendertag nach dem ersten Ereignis.
- Übernommen werden die Ereignisarten und die Definition der Kennzahlen. Neu geschrieben werden Speicherung und Versand:
  im Prototyp liegen die Ereignisse im Gerätespeicher, die Sendestelle `EventSink` ist leer.
- Der Tag stammt von der Geräteuhr. Auf dem Server zählt die Serverzeit, und die Installationskennung wird durch die Spielerkennung ersetzt.

## Annahmen des Prototyps, die auf einem Server nicht gelten

- **Geräteuhr.** `AdvanceTime` bekommt die Uhr des Geräts. Wer sie verstellt, überspringt Bauzeiten. Auf dem Server kommt die Zeit vom Server.
- **Startwerte.** Der erste Startwert kommt vom Gerät, jeder weitere wird daraus abgeleitet und ist für den Client vorhersehbar. Auf dem Server vergibt ihn der Server.
- **Vertrauen.** Der Client wendet Aktionen selbst an und speichert das Ergebnis. Auf dem Server werden Aktionen geprüft und Schlachten aus der Wiederholung nachgerechnet.
- **Speicherstand.** Liegt unverschlüsselt in `localStorage` und ist veränderbar. Migrationen (`src/app/save.ts`) werden durch die Schema-Migration des Backends ersetzt.
- **Angriff ohne Sperre.** Truppen werden erst bei `ResolveAttack` abgerechnet. Bricht der Spieler den Angriff ab, ist nichts passiert. Ein Server muss den Angriff beim Start anlegen und die Truppen binden.
- **Weltkarte.** Lager und Nachbarstädte sind feste Einträge in `data/camps.json` mit Vorräten, die sich nicht leeren, und einem Schild, der nie abläuft. Nachbarn greifen nie an.
- **Allianz.** Mitglieder und ihre Hilfe sind ein Zeitplan aus `data/alliance.json`. Auf dem Server kommt Hilfe von echten Spielern.
- **Nachtangriff.** Der Client entscheidet beim Öffnen, dass der Angriff fällig ist. Der Server plant und rechnet ihn selbst.
- **Tagesgrenze.** Tagesziele wechseln um Mitternacht UTC.
- **Einzelspieler.** Es gibt keine gleichzeitigen Zugriffe auf einen Zustand, also keine Konfliktbehandlung.
- **JSON-Zahlen.** Alle Zahlen im Zustand bleiben unter 2^53 (`now` in Millisekunden), in Schlachten unter 2^31.
