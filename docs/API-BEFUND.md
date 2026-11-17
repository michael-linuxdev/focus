# Befund: Schnittstellen des Statistischen Bundesamts

Geprüft am 17. November 2026 mit echten Abrufen.

## GENESIS-Online

- Adresse: `https://genesis.destatis.de/genesisWS/rest/2020/…`. Die alte Adresse `www-genesis.destatis.de` leitet per 307 dorthin um.
- Nur `POST`; Zugangsdaten stehen in den Kopfzeilen `username` und `password`. `GET` mit Zugangsdaten in der Adresse
  endet in einer Umleitung auf eine Hinweisseite.
- Gastzugang (`GAST`/`GAST`): `helloworld/logincheck` und `find/find` (Suche) funktionieren.
- Mit dem Gastzugang abgelehnt (HTTP 401, Code 15 „nicht berechtigt“): `data/table`, `data/tablefile`, `data/timeseries`,
  `metadata/table`, `catalogue/tables`. Für Tabellendaten braucht es also ein eigenes, kostenloses Konto.
- Kein Zugriff aus dem Browser: Die Vorabanfrage (`OPTIONS`) wird mit 403 abgelehnt. GENESIS lässt sich nur von einem Skript
  oder Server aus abfragen, nicht direkt von einer Webseite.
- Laut Anmeldemeldung: höchstens drei gleichzeitige Anfragen.
- Nicht geprüft, weil kein Konto vorlag: Format und Umfang der Tabellenabrufe.

## Dashboard Deutschland

- Betrieben vom Statistischen Bundesamt, ohne Anmeldung, `GET`, JSON.
- `https://www.dashboard-deutschland.de/api/dashboard/get`: 17 Themen mit den Kennungen ihrer Indikatoren.
- `https://www.dashboard-deutschland.de/api/tile/indicators?ids=a;b;c`: je Indikator ein Feld `json` (als Text) mit Titel,
  Introtext, Quellen, Datenstand und einer fertigen Diagrammbeschreibung samt vollständiger Zeitreihen.
- 100 Indikatoren, davon 99 mit lesbarem Zeitreihendiagramm. Enthalten sind auch Reihen anderer Stellen
  (ifo, Bundesbank, Bundesnetzagentur und weitere); die Quelle steht je Indikator dabei.
- Antwort ohne CORS-Freigabe, also ebenfalls nicht direkt aus dem Browser nutzbar.
- Einheiten sind uneinheitlich gepflegt: Mal steht die Größenordnung im Introtext („in Mio. Personen“) und die Werte liegen
  in Grundeinheiten vor, mal ist nur ein Währungszeichen hinterlegt. `src/lib/normalize.ts` gleicht das aus.
- Auffällig: Am Prüftag endeten die meisten Reihen zwischen Januar und Mai 2026, auch tägliche. Die App weist auf
  ungewöhnlich alte Reihen hin.

## Folgerung für die App

Beide Schnittstellen sind nur von einem Skript aus erreichbar. Die App ist deshalb eine statische Seite: `npm run data`
holt die Daten beim Bauen und legt sie aufbereitet unter `public/data/` ab. GENESIS-Tabellen lassen sich auf demselben Weg
ergänzen, sobald ein Konto vorliegt (Zugangsdaten dann als Geheimnis in GitHub Actions, nie im Repository).
