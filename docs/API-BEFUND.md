# Befund: Schnittstellen des Statistischen Bundesamts

Geprüft am 17. November 2026 mit echten Abrufen.

## GENESIS-Online

- Adresse: `https://genesis.destatis.de/genesisWS/rest/2020/…`. Die alte Adresse `www-genesis.destatis.de` leitet per 307 dorthin um.
- Nur `POST`; Zugangsdaten stehen in den Kopfzeilen `username` und `password`. `GET` mit Zugangsdaten in der Adresse
  endet in einer Umleitung auf eine Hinweisseite.
- Gastzugang (`GAST`/`GAST`): `helloworld/logincheck` und `find/find` (Suche) funktionieren.
- Mit dem Gastzugang abgelehnt (HTTP 401, Code 15 „nicht berechtigt“): `data/table`, `data/tablefile`, `data/timeseries`,
  `metadata/table`, `catalogue/tables`. Für Tabellendaten braucht es ein eigenes, kostenloses Konto.
- Mit Konto genügt ein API-Token: Token in die Kopfzeile `username`, `password` leer. Geprüft mit `helloworld/logincheck`
  und `data/tablefile` für 12411-0001, 12411-0010, 61111-0002 und 62361-0001.
- `data/tablefile` mit `format=ffcsv` antwortet immer mit einem ZIP-Archiv, das genau eine CSV-Datei enthält
  (auch mit `compress=false`). Inhalt: UTF-8 mit BOM, Semikolon als Trenner, Dezimalkomma, eine Zeile je Wert,
  Zeilen ungeordnet. Spalten: `time` (Stichtag oder Jahr), je Gliederung vier Spalten `n_variable_…`
  (Monate stehen dort als `MONAT01` … `MONAT12`), dann `value`, `value_unit`, `value_variable_code`, `value_variable_label`.
- Veränderungsraten stehen als eigene Zeilen mit Einheit `%` in derselben Tabelle; ihr `value_variable_label` ist
  verstümmelt („in“). Die App übernimmt nur die Niveauwerte und rechnet Veränderungen selbst.
- Ohne `startyear` liefern manche Tabellen nur die jüngsten Jahre (61111-0002: zwei Jahre). Der Reallohnindex
  beginnt in der Quelle erst 2022.
- Filter über `classifyingvariable1`/`classifyingkey1` wirken bei `data/tablefile` nicht wie erhofft: Bei 61111-0007
  kam trotzdem die ganze Tabelle, bei 61111-0004 mit `startyear` eine leere Antwort. Die App filtert deshalb selbst
  (`where` in `scripts/genesis-tables.ts`).
- Gegliederte Tabellen führen alle Ebenen in denselben Spalten: Bei den Verbraucherpreisen nach Verwendungszweck
  steht die Ebene im Gliederungscode (`CC13A2` Zweisteller bis `CC13A5` Fünfsteller, zusammen 441 Positionen).
  „Insgesamt“ hat einen leeren Ausprägungsschlüssel.
- Weitere Zeitformen: Stichmonat `2025-04P1M`, Zeitraum `2018-P2Y` (2018 bis 2020).
- Tabellen ohne Zeitreihe: 61111-0007 (Wägungsschema, nur Basisjahr 2020) und 62361-0031 (Verdienste, nur der
  jüngste Stichmonat). Sie landen in `public/data/facts.json`.
- Die Verdienstindizes nach Branchen (62361-0026) beginnen 2007, die Gesamtwirtschaft „A-S“ aber erst 2022;
  „B-S“ (Produzierendes Gewerbe und Dienstleistungsbereich) reicht bis 2007 zurück.
- Die Rendite zehnjähriger Bundesanleihen liegt nur im Dashboard vor und dort erst ab 2020.
- Antwortzeiten: zwei bis elf Sekunden je Tabelle.
- Kein Zugriff aus dem Browser: Die Vorabanfrage (`OPTIONS`) wird mit 403 abgelehnt. GENESIS lässt sich nur von einem Skript
  oder Server aus abfragen, nicht direkt von einer Webseite.
- Laut Anmeldemeldung: höchstens drei gleichzeitige Anfragen.
- Die GENESIS-Reihen sind aktueller als das Dashboard: am Prüftag Verbraucherpreisindex bis Oktober 2026,
  Lohnindizes bis September 2026.

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
holt die Daten beim Bauen und legt sie aufbereitet unter `public/data/` ab. Der Token liegt als Geheimnis `GENESIS_USER`
in GitHub Actions und nirgends sonst; welche Tabellen übernommen werden, steht in `scripts/genesis-tables.ts`.
