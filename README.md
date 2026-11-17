# Lagebild Deutschland

Statische Web-App, die die Indikatoren des [Dashboard Deutschland](https://www.dashboard-deutschland.de/) und Tabellen aus
[GENESIS-Online](https://genesis.destatis.de/) (beide Statistisches Bundesamt) zusammenführt:

- **Überblick** mit Kennzahlen, Vorjahresvergleich und automatisch erkannten auffälligen Werten
- **Mein Geld**: persönliche Teuerung mit eigenem Warenkorb, Verdienste gegen Preise, Arbeitszeit statt Euro, Erschwinglichkeit von Wohneigentum
- **Länder**: Rangliste, Veränderung und Schere zwischen den Bundesländern, auch für abgeleitete Größen wie Kaufkraft
- **Vergleichen**: beliebige Reihen nebeneinander, indexiert, preisbereinigt oder je Einwohner, mit Gleichlauf und Vorlauf
- Themenseiten und Detailansicht je Indikator

```sh
npm install
npm run data    # Daten holen und aufbereiten (public/data/)
npm run dev     # Entwicklungsserver
npm test        # Tests
npm run build   # Typprüfung und Bauen nach dist/
```

Was die Schnittstellen können und was nicht, steht in [docs/API-BEFUND.md](docs/API-BEFUND.md).
Der frühere Spielprototyp liegt in der Git-Historie (bis Commit 09d6e4b).
