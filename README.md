# Strategic Focus Tracker

Ein ruhiges Werkzeug für Geschäftsführerinnen und Geschäftsführer, die sehen wollen, wie viel ihrer Zeit wirklich strategisch ist. Nicht noch eine Gewohnheits-App: Im Mittelpunkt steht der Anteil gestaltender gegenüber reagierender Zeit.

## Funktionen

- **Zeiterfassung.** Blöcke mit Datum, Zeitraum oder Dauer, Kategorie „strategisch“ (gestaltend) oder „operativ“ (reagierend) und optionaler Notiz. Einträge lassen sich bearbeiten und löschen.
- **Fokus-Gewohnheiten mit Serien.**
  - Strategie-Block in der Länge, die du festlegst
  - Deep Work vor 10 Uhr
  - Top 3 der Woche, mit Text und Abhaken
  - Tagesreflexion: „Habe ich heute eher reagiert oder gestaltet?“
- **Überblick.** Große Kennzahl („X % deiner Zeit war diese Woche strategisch“) gegen ein selbst gesetztes Ziel, Ring, Wochenverlauf, Kalender der strategischen Zeit, Reflexionsverlauf und aktuelle Serien.
- **Einstellungen.** Zielanteil und Länge des Strategieblocks. Demodaten entfernen, neu laden oder alles löschen.

Wochenenden unterbrechen eine Tagesserie nicht. Ein noch nicht markierter heutiger Werktag bricht die Serie erst, wenn der Tag vorbei ist.

## Demodaten

Beim ersten Öffnen liegen sechs Wochen eines beispielhaften Geschäftsführers im Browser: eine Krisenwoche mit sehr wenig Strategie, eine starke Woche über dem Ziel und die laufende Woche knapp darunter. Alles ist als Demo gekennzeichnet. Eigene Einträge bleiben erhalten, wenn du die Demo entfernst.

## Lokal starten

Voraussetzung: Node.js 20.9 oder neuer.

```bash
npm install
npm run dev
```

Die App läuft danach unter [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run lint
npm run build
```

`npm run build` erzeugt einen statischen Export im Ordner `out` (`output: 'export'`). Bilder sind unoptimiert, es gibt keinen Server und keinen `basePath`. Die Seite hängt an der Domain-Wurzel.

## GitHub Pages

Die Seite wird aus `main` nach GitHub Pages gebaut und liegt unter [https://focus.micana.de](https://focus.micana.de). Der Workflow `.github/workflows/deploy.yml` läuft bei jedem Push auf `main`, lädt `out` mit `actions/upload-pages-artifact` hoch und veröffentlicht mit `actions/deploy-pages`.

`public/CNAME` setzt die Domain, `public/.nojekyll` liegt im Export, damit GitHub Pages die Dateien nicht durch Jekyll schickt. Routen enden mit einem Schrägstrich (`/zeit/`), weil Pages Verzeichnis-Indexdateien ausliefert.

In den Repository-Einstellungen unter **Settings → Pages** noch setzen:

1. **Build and deployment → Source:** GitHub Actions
2. **Custom domain:** `focus.micana.de`
3. **Enforce HTTPS** aktivieren

Beim DNS-Anbieter zeigt ein CNAME-Eintrag von `focus.micana.de` auf `michael-linuxdev.github.io`.

## Daten

Alles bleibt in `localStorage` unter dem Schlüssel `strategic-focus-tracker.v1`. Es gibt kein Konto und keinen Server.

Die Oberfläche spricht nur mit der Schnittstelle `FocusPersistence` (`src/lib/persistence`). `LocalStoragePersistence` ist die aktuelle Umsetzung. Eine spätere API kann dieselbe Schnittstelle implementieren; Auswertungen in `src/lib/stats.ts` und die Seiten bleiben unverändert. Die Kennzahlen sind reine Funktionen der gespeicherten Blöcke.
