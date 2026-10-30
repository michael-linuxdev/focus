# Strategic Focus Tracker

Ein ruhiges Werkzeug für Geschäftsführerinnen und Geschäftsführer. Im Mittelpunkt bleibt der Anteil gestaltender gegenüber reagierender Zeit. Darum herum wächst ein Gedankenpalast: Fokus, Entscheidungen, Grenzen.

## Gedankenpalast

Auf dem Überblick steht ein gemeinsames Haus mit drei Flügeln.

- **Fokus** — Strategieblock, Deep Work, Top 3, Tagesreflexion
- **Entscheidungen** — Nacht darüber schlafen, Pro und Contra, Tagesbudget, Nachlese
- **Grenzen & Energie** — Abendritual, Nachrichtenfenster, Erholung, Nein gesagt

Räume, Stockwerke und Details erscheinen mit Serie und Beständigkeit. Lässt eine Gewohnheit nach, verblasst nur der betroffene Teil: weniger Deckkraft, weniger Farbe, etwas Staub. Nichts wird abgerissen. Sobald du wieder hältst, kehrt das Licht zurück.

## Funktionen

- **Einrichtung.** Drei Fragen: Rolle, was gerade drückt (zu operativ, zu viele Entscheidungen, kaum Grenzen), wie viel Zeit am Tag. Danach sind passende Gewohnheiten schon angehakt. Du schaltest nur um, was nicht passt. Wer die App schon genutzt hat, bekommt die neuen Flügel einmal angeboten.
- **Tagesnutzung.** Auf dem Überblick reicht ein Tipp pro Gewohnheit. Das Abendritual dauert etwa dreißig Sekunden: Energieschieber, „reagiert oder gestaltet?“, Laptop zu.
- **Zeiterfassung.** Blöcke mit Datum, Zeitraum oder Dauer, Kategorie „strategisch“ (gestaltend) oder „operativ“ (reagierend) und optionaler Notiz. Einträge lassen sich bearbeiten und löschen.
- **Fokus.** Strategie-Block in der Länge, die du festlegst. Deep Work vor 10 Uhr. Top 3 der Woche. Tagesreflexion.
- **Entscheidungen.** Eine Entscheidung notieren: Titel, Gewicht, ob eine Nacht vergangen ist, ob Pro und Contra stehen. Wichtige Entscheidungen zählen gegen ein Tagesbudget. Ältere ohne Nachlese fragen: „Was habe ich gelernt?“
- **Grenzen & Energie.** Abendritual, feste Fenster für E-Mail und Slack, Erholung nach dünnen Tagen, ein Tipp für jedes Nein. Der Energieschieber liegt im Abendritual.
- **Überblick.** Der Palast, der Tagesstreifen, das Abendritual, darunter der strategische Anteil der Woche, Verlauf, Kalender und Serien.
- **Einstellungen.** Zielanteil, Länge des Strategieblocks, Entscheidungsbudget, Nachrichtenfenster, Einrichtung erneut öffnen. Demodaten entfernen, neu laden oder alles löschen.

Wochenenden unterbrechen eine Tagesserie nicht. Ein noch nicht markierter heutiger Werktag bricht die Serie erst, wenn der Tag vorbei ist.

## Demodaten

Beim ersten Öffnen liegen sechs Wochen eines beispielhaften Geschäftsführers im Browser: eine Krisenwoche mit sehr wenig Strategie, eine starke Woche über dem Ziel und die laufende Woche knapp darunter. Entscheidungen, Energie und Grenzen sind mit dabei, damit der Palast beim ersten Blick schon bewohnt ist — der Grenzenflügel ist absichtlich etwas staubig. Alles ist als Demo gekennzeichnet. Eigene Einträge bleiben erhalten, wenn du die Demo entfernst.

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

Alles bleibt in `localStorage` unter dem Schlüssel `strategic-focus-tracker.v1`. Es gibt kein Konto und keinen Server. Der Schlüssel ist derselbe geblieben: ältere Stände ohne die neuen Felder werden gelesen, die Fokus-Gewohnheiten bleiben an, und die Einrichtung für Entscheidungen und Grenzen wird einmal angeboten.

Die Oberfläche spricht nur mit der Schnittstelle `FocusPersistence` (`src/lib/persistence`). `LocalStoragePersistence` ist die aktuelle Umsetzung. Eine spätere API kann dieselbe Schnittstelle implementieren; Auswertungen in `src/lib/stats.ts`, der Palast in `src/lib/palace.ts` und die Seiten bleiben unverändert. Die Kennzahlen sind reine Funktionen der gespeicherten Einträge.
