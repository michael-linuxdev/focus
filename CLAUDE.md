# Lagebild Deutschland

Statische Web-App auf Basis der Schnittstellen des Statistischen Bundesamts. Sie führt die Indikatoren von
Dashboard Deutschland zusammen und macht Reihen über Themengrenzen hinweg vergleichbar.
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
Ansichten im Browser ansehen.

## Aufbau

- `scripts/fetch-data.ts` holt die Rohdaten, `src/lib/normalize.ts` bereitet sie auf. Ergebnis: `public/data/catalog.json`
  (Themen, Indikatoren, Kennwerte) und `public/data/series/<id>.json` (Zeitreihen). Der Stand ist eingecheckt, damit die
  Seite auch baut, wenn der Abruf scheitert.
- `src/lib/` reine Funktionen ohne DOM (Aufbereitung, Formate, Vergleichsrechnung), mit Tests in `tests/`.
- `src/lib/curated.ts` redaktionelle Auswahl: Kacheln im Überblick und vorbereitete Vergleiche.
- `src/ui/` Diagramm und DOM-Hilfen, `src/main.ts` Ansichten und Navigation über den Adress-Anker.

## Regeln

- Die Schnittstellen erlauben keinen Zugriff aus dem Browser. Daten kommen immer über `npm run data` beim Bauen.
- Texte aus der Schnittstelle nie als HTML einsetzen (nur über `h()` aus `src/ui/dom.ts`).
- Diagramme: eine Achse je Diagramm, nie zwei Skalen. Verschiedene Einheiten werden indexiert oder getrennt gezeigt.
  Farbplätze gehören fest zur Reihe; höchstens acht gleichzeitig. Jede Zahl ist auch über die Tabelle erreichbar.
- Keine Zugangsdaten im Repository. Ein GENESIS-Konto käme als Geheimnis in GitHub Actions.
- Bezeichner englisch, Oberflächentexte und Dokumente deutsch.
- Veröffentlichung: Push auf `main` baut und veröffentlicht nach `focus.micana.de` (GitHub Pages), dazu täglich per Zeitplan.
