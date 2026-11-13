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
| Browsertest in Handygröße (nach dem Bauen) | `npm run test:e2e` |
| Gebauten Stand ansehen | `npm run preview` |

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
Nachtangriff: beim ersten Öffnen nach mindestens vier Stunden Abwesenheit (Wert in den Daten).

## Ordner

- `data/` Datendateien und Schemas (werden unverändert nach Unity übernommen)
- `src/sim/` Spiellogik · `src/app/` Hülle (Schleife, Uhr, Speicher, Service Worker)
- `src/render/` Canvas-Darstellung (liest nur) · `src/ui/` Preact-Oberfläche (löst nur Aktionen aus)
- `tests/sim/`, `tests/app/` Vitest · `tests/e2e/` Browsertest mit Playwright

## Konventionen

- Bezeichner englisch, Spieltexte und Dokumente deutsch. Alle Spieltexte in `data/texts.de.json`, Zugriff über `t()`.
- Grafik nur aus eigenen geometrischen Formen. Keine fremden Grafiken, Namen oder Symbole.
- Nicht im Umfang: Server, Konten, Chat, Käufe, Werbung, fremde Tracking-Dienste, Unity-Umsetzung.
- Bot-Allianz und Weltkarte sind Attrappen und im Code als Platzhalter zu markieren.
- Arbeit in Meilensteinen M0 bis M5; nach jedem anhalten und Bericht geben.
- Veröffentlichung: Push auf `main` baut und veröffentlicht nach `focus.micana.de` (GitHub Pages).
