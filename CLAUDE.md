# Lagebild Deutschland

Statische Web-App auf Basis der Schnittstellen des Statistischen Bundesamts. Sie führt die Indikatoren von
Dashboard Deutschland und Tabellen aus GENESIS-Online zusammen und macht Reihen über Themengrenzen hinweg vergleichbar.
Befund zu den Schnittstellen (GENESIS-Online, Dashboard Deutschland): `docs/API-BEFUND.md`.

## Befehle

| Zweck | Befehl |
| --- | --- |
| Daten holen und aufbereiten | `npm run data` |
| Entwicklungsserver | `npm run dev` |
| Typprüfung | `npm run typecheck` |
| Tests | `npm test` |
| Bauen (prüft Typen) | `npm run build` |
| Gebauten Stand ansehen | `npm run preview` |
| GENESIS-Tabellen suchen (Gastzugang) | `npm run genesis:find -- Suchbegriff` |

In Cloud-Sitzungen braucht Node für Abrufe `NODE_USE_ENV_PROXY=1`, und die Hosts `www.dashboard-deutschland.de` und
`genesis.destatis.de` müssen in der Umgebung freigegeben sein.

Kein Commit mit fehlschlagenden Tests. Vor jeder Fertigmeldung: `npm test && npm run build`, danach die geänderten
Ansichten im Browser ansehen (Desktop und 390 px Breite, ohne waagerechtes Scrollen).

## Aufbau

- `scripts/fetch-data.ts` holt die Rohdaten, `src/lib/normalize.ts` bereitet sie auf. Ergebnis: `public/data/catalog.json`
  (Themen, Indikatoren, Kennwerte) und `public/data/series/<id>.json` (Zeitreihen). Der Stand ist eingecheckt, damit die
  Seite auch baut, wenn der Abruf scheitert.
- `src/lib/` reine Funktionen ohne DOM (Aufbereitung, Formate, Vergleichsrechnung), mit Tests in `tests/`.
- `scripts/lib/genesis.ts` Abruf bei GENESIS-Online, `src/lib/genesis-table.ts` Aufbereitung der Tabellen,
  `scripts/genesis-tables.ts` Auswahl der Tabellen. GENESIS-Indikatoren heißen `genesis_<Tabellencode>`.
- `src/lib/curated.ts` redaktionelle Auswahl: Kacheln im Überblick und vorbereitete Vergleiche.
- `src/ui/` Diagramm, Balkenliste und DOM-Hilfen, `src/state.ts` geladene Daten, `src/main.ts` Überblick, Themen,
  Indikator, Vergleich und Navigation über den Adress-Anker.
- `src/views/geld.ts` Bereich „Mein Geld“ (Rechenwege in `src/lib/money.ts`): persönliche Teuerung mit eigenem Warenkorb,
  Verdienste gegen Preise, Arbeitszeit je Ausgabengruppe, Erschwinglichkeit von Wohneigentum.
  Braucht `public/data/facts.json` (Wägungsschema, Verdienste im Stichmonat).
- `src/views/preise.ts` „Preise im Detail“: alle 441 Positionen des Verbraucherpreisindex nach Preisänderung, mit Suche
  (`public/data/prices.json`).
- `src/views/jahrgang.ts` „Mein Jahrgang“ (Rechenwege in `src/lib/cohort.ts`): Geburtenzahl, heutige Größe des Jahrgangs,
  fernere Lebenserwartung, Altenquotient (`public/data/cohorts.json`).
- `src/views/laender.ts` Ländervergleich (Rechenwege in `src/lib/regions.ts`): Rangliste, Veränderung, Schere; die
  Kennzahlen samt abgeleiteter Größen stehen in der Liste `METRICS`.
- Auffällige Werte: `findExtreme` in `src/lib/stats.ts` vermerkt beim Datenabruf je Reihe, ob der jüngste Wert seit
  mindestens fünf Jahren nicht erreicht wurde; der Überblick zeigt die auffälligsten.

## Regeln

- Die Schnittstellen erlauben keinen Zugriff aus dem Browser. Daten kommen immer über `npm run data` beim Bauen.
- Texte aus der Schnittstelle nie als HTML einsetzen (nur über `h()` aus `src/ui/dom.ts`).
- Diagramme: eine Achse je Diagramm, nie zwei Skalen. Verschiedene Einheiten werden indexiert oder getrennt gezeigt.
  Farbplätze gehören fest zur Reihe; höchstens acht gleichzeitig. Jede Zahl ist auch über die Tabelle erreichbar.
- Indizes (Preise, Mieten, Verdienste) zeigen nur Entwicklungen. Nie als Rangliste von Ständen ausgeben und nie zwischen
  Ländern als Niveau vergleichen.
- Auf Brüche in den Quellen achten: Der Bevölkerungsstand vor 1990 gilt nur für das frühere Bundesgebiet und wird
  nicht verwendet. Bei neuen langen Reihen den Gebietsstand prüfen, bevor sie als „Deutschland“ erscheinen.
- Abgeleitete Zahlen nennen ihre Annahmen direkt an der Zahl (z. B. Zinsnäherung, brutto statt netto).
- Keine Zugangsdaten im Repository. Ein GENESIS-Konto käme als Geheimnis in GitHub Actions.
- Bezeichner englisch, Oberflächentexte und Dokumente deutsch.
- Veröffentlichung: Push auf `main` baut und veröffentlicht nach `focus.micana.de` (GitHub Pages), dazu täglich per Zeitplan.

## GENESIS-Online

- Der API-Token des Auftraggebers liegt als Geheimnis `GENESIS_USER` in GitHub Actions, nicht in der Cloud-Umgebung.
  Abrufe mit Konto laufen deshalb nur dort; lokal holt `npm run data` nur das Dashboard und behält die gespeicherten
  GENESIS-Reihen.
- Neue Tabelle: Code mit `npm run genesis:find -- Begriff` suchen, in `scripts/genesis-tables.ts` eintragen, pushen.
  Dann den Workflow „GENESIS-Zugang prüfen“ (`genesis-probe.yml`) auf dem Arbeitsbranch auslösen: mit Eingabe `tables`
  zeigt er Aufbau und Zeitraum einer Tabelle im Protokoll, mit `refresh: true` holt er alle Daten und committet sie auf
  den Branch (danach `git pull`). Auf `main` verweigert er das Committen.
