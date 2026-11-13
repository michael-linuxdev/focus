# Mittelalter-Königreich (Arbeitstitel) – PWA-Prototyp

Spielbarer Prototyp der ersten 30 Spielminuten eines Mobile-Strategiespiels. Später Neuumsetzung in
Unity 6 / C# mit Metaplay; deshalb zählt portierbare Spiellogik mehr als alles andere.
Der Name steht nur in `data/game.json`.

Kernidee, an der jede Designentscheidung gemessen wird: Jede Stadt ist eine Tower-Defense-Karte,
die der Spieler selbst baut. Dieselbe Mechanik trägt Einstieg, Stadtausbau und Kampf.

## Befehle

| Zweck | Befehl |
| --- | --- |
| Entwicklungsserver | `npm run dev` |
| Typprüfung | `npm run typecheck` |
| Logik-Tests | `npm test` |
| Bauen (prüft Typen) | `npm run build` |
| Browsertest in Handygröße (nach dem Bauen, Bildschirmfotos nach `test-results/`) | `npm run test:e2e` |
| Gebauten Stand ansehen | `npm run preview` |
| Ablauf des Tutorial-Bots ausgeben | `FLOW_LOG=flow.txt npm test` |
| Balance: Schlachten massenhaft durchrechnen, Siegquoten ausgeben | `npm run balance` (optional `-- 500` Startwerte) |
| Kennzahlen aus Exportdateien (eine je Spieler) | `npm run metrics -- a.json b.json` |
| Leistung mit gedrosselter CPU und langsamem Netz (nach dem Bauen) | `npm run perf` |
| Speicherstand am Ende des Ablaufs erzeugen | `node scripts/make-save.ts > stand.json` |
| Sprites aus den Rohbildern neu erzeugen (braucht Pillow und numpy) | `python3 scripts/sprites.py` |

Kein Commit mit fehlschlagenden Tests. Vor jeder Fertigmeldung: `npm test && npm run build && npm run test:e2e`.

## Architekturregeln (nicht verhandelbar)

1. **Spiellogik strikt getrennt von der Darstellung.** `src/sim/` enthält alle Regeln als reine
   Funktionen: Zustand plus Aktion ergibt neuen Zustand. Kein Zugriff auf DOM, Canvas, Uhrzeit,
   Zufall oder Speicher. Uhrzeit (`AdvanceTime`), Startwert und Datendateien werden hineingereicht.
   `src/sim/` importiert nur aus `src/sim/`. `tests/sim/purity.test.ts` erzwingt das.
2. **Deterministische Schlachten.** Fester Zeitschritt (`ticksPerSecond` in `data/game.json`),
   Zufall nur über `src/sim/rng.ts`, nur Ganzzahlen (Strecken in Tausendstel-Kacheln, Anteile in
   Promille, Division abschneidend über `idiv`/`mulDiv`). Keine Gleitkomma-Funktionen, keine
   Abhängigkeit von Iterationsreihenfolgen außer Arrays. Eine Wiederholung ist nur Setup, Startwert
   und Eingaben mit Tick. Die Reihenfolge innerhalb eines Ticks ist in `battle.ts` festgeschrieben.
3. **Alle Zahlen als Daten.** Kosten, Schaden, Reichweiten, Zeiten, Wellen, Straßenverläufe,
   Tutorial-Schritte und Texte liegen in `data/*.json` mit Schema in `data/schemas/` und
   `version`-Feld. Vorläufige Balance-Werte tragen `"preliminary": true`. Keine Balance im Code.
4. **Aktionen statt direkter Änderungen.** Jede Spielerhandlung ist eine benannte Aktion mit Daten,
   geprüft durch `validate…`, angewendet durch `reduce…`/`stepBattle`. Die Oberfläche löst nur
   Aktionen aus. Ungültige Aktionen ändern nichts und liefern einen Fehlercode.

`docs/PORTING.md` bei jeder Änderung an Zustand, Aktionen, Tick-Reihenfolge oder Datenformat nachziehen.

## Verlustgrenzen (fest, per Test abzusichern)

- Angreifer erbeuten höchstens einen festen Anteil der ungeschützten Vorräte; der Speicher schützt einen Grundstock.
- Besiegte Truppen kommen ins Lazarett und sind nicht verloren.
- Nach einer Niederlage schützt ein Schild die Stadt für einige Stunden.
- Neue Spieler haben einen längeren Schutz.
- Der Ablauf der ersten zehn Minuten ist nicht verlierbar.

Abgestimmte Auslegungen: Der Schild schützt vor Nachbarstädten, nicht vor Räubern; Räuberbeute
unterliegt denselben Grenzen. Türme entstehen während einer Welle sofort, Bauzeiten gelten für
Gebäude, Ausbau und Burgfried. Tutorial-Schritte hängen am Fortschritt, nicht an der Uhr.
Im ersten Schritt wartet die Welle am Haltepunkt, bis der erste Turm steht;
die ersten fünf Wellen sind `unlosable` (kein Burgfried-Schaden). Türme entstehen auch im Stadtbau sofort.
Die Heldin kommandiert einen Abschnitt und führt zugleich Angriffe. Lazarett gilt immer, das Gebäude verkürzt nur die Zeit. Nachtangriff: beim ersten Öffnen nach mindestens vier Stunden Abwesenheit (Wert in den Daten).
Wachstube und Rammbock: beides gilt. Rammböcke räumen Miliz schnell weg, nehmen dabei aber besonders viel Schaden.
Verlierbare Verteidigungen und der Nachtangriff kosten Vorräte nach Durchbruchstiefe, innerhalb der Verlustgrenze,
aber erst ab dem Marktplatz (ein genommenes Tor allein kostet nichts). Der erste Nachtangriff kostet nichts.
Der erste Angriff auf das Räuberlager bleibt leicht: mit der vorgeschlagenen Aufstellung soll er fast immer gelingen.
Nach jedem Nachtangriff ist der nächste angekündigt.
Nur Rammböcke brechen Tore (Leichte und Gepanzerte haben Belagerungswert 0).

## Ordner

- `data/` Datendateien und Schemas (werden unverändert nach Unity übernommen)
- `src/sim/` Spiellogik · `src/app/` Hülle (Schleife, Uhr, Speicher, Service Worker)
- `src/render/` Canvas-Darstellung (liest nur) · `src/ui/` Preact-Oberfläche (löst nur Aktionen aus)
- `src/telemetry/` Ereignisaufzeichnung (lokal), Kennzahlen, Entwicklerseite
- `scripts/` Balance, Auswertung, Hilfen; laufen direkt mit Node (TypeScript ohne Bauen)
- `tests/sim/`, `tests/app/` Vitest · `tests/e2e/` Browsertest mit Playwright
- `scripts/lib/bot.ts` spielt den geführten Ablauf nach den Hinweisen durch; nach jeder Änderung an `data/tutorial.json`
  oder an Kosten zeigt `flow.test.ts`, ob der Ablauf noch ohne Sackgasse und ohne lange Wartezeit durchläuft
- `window.__mk` (in `src/app/main.tsx`): Zustand lesen, Zeitraffer (`skip`) und Schlachttempo (`speed`) für Browsertests

## Messung

- Entwicklerseite: fünf schnelle Tipps auf die Anzeige oben rechts („Welle n“) oder `#dev` an die Adresse hängen.
  Zeigt die drei Kennzahlen, alle Ereignisse, Export als Datei, Zeitraffer, Schlachttempo, Zurücksetzen.
- Ereignisse bleiben auf dem Gerät (`localStorage`, Schlüssel `mk.ev.*`). Keine personenbezogenen Daten, keine fremden
  Dienste, nichts wird gesendet. Felder eines Ereignisses: Zeit, Tag, Sitzung, Nummer, Art, wenige Spielwerte, Zeitraffer-Merker.
- Sendestelle: `EventSink` in `src/telemetry/events.ts`; der Prototyp nutzt `noSink`.
- Neue Messpunkte nur über `record(...)` in `src/app/main.tsx`; neue Arten in `EventType` eintragen.
- „Minute 10 erreicht“ heißt: Tutorial-Schritt `minute10Step` aus `data/tutorial.json` erreicht.
- Balance-Werte nie nach Gefühl ändern: erst `npm run balance`, dann Daten ändern, dann wieder laufen lassen.
- Zielwerte der Balance stehen in `scripts/balance-targets.json`. `npm run balance -- --check` endet mit Fehler,
  wenn einer verfehlt wird. Nach jeder Änderung an `data/` (Türme, Einheiten, Wellen, Lager, Regeln) laufen lassen.

## Konventionen

- Bezeichner englisch, Spieltexte und Dokumente deutsch. Alle Spieltexte in `data/texts.de.json`, Zugriff über `t()`.
- Grafik: eigene, mit einer Bild-KI erzeugte Bilder nach den Prompts in `docs/SPRITES.md`; als Rückfall einfache
  geometrische Formen. Keine fremden Grafiken, Namen, Wappen oder Symbole, kein Nachahmen bestehender Spiele.
  Rohbilder liegen in `art/roh/`, `python3 scripts/sprites.py` stellt frei und erzeugt `public/sprites/` und
  `src/render/atlas.json`. Je Figur ein Bild; Bewegung (Hüpfen, Spiegeln, Aufblitzen) kommt aus `src/render/stage.ts`.
- Nicht im Umfang: Server, Konten, Chat, Käufe, Werbung, fremde Tracking-Dienste, Unity-Umsetzung.
- Bot-Allianz und Weltkarte sind Attrappen und im Code als Platzhalter zu markieren.
- Arbeit in Meilensteinen M0 bis M5; nach jedem anhalten und Bericht geben.
- Veröffentlichung: Push auf `main` baut und veröffentlicht nach `focus.micana.de` (GitHub Pages).
