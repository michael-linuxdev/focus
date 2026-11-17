# Lagebild Deutschland

Statische Web-App, die die Indikatoren des [Dashboard Deutschland](https://www.dashboard-deutschland.de/) und Tabellen aus
[GENESIS-Online](https://genesis.destatis.de/) (beide Statistisches Bundesamt) zusammenführt: Überblick mit Vorjahresvergleich, Themenseiten, Detailansicht je Indikator und ein Vergleich
beliebiger Reihen über Themengrenzen hinweg.

```sh
npm install
npm run data    # Daten holen und aufbereiten (public/data/)
npm run dev     # Entwicklungsserver
npm test        # Tests
npm run build   # Typprüfung und Bauen nach dist/
```

Was die Schnittstellen können und was nicht, steht in [docs/API-BEFUND.md](docs/API-BEFUND.md).
Der frühere Spielprototyp liegt in der Git-Historie (bis Commit 09d6e4b).
