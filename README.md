# Mittelalter-Königreich (Arbeitstitel)

PWA-Prototyp der ersten 30 Spielminuten. Regeln, Befehle und Arbeitsweise stehen in [CLAUDE.md](CLAUDE.md),
der spätere Umzug nach Unity in [docs/PORTING.md](docs/PORTING.md).

```
npm ci
npm run dev        # Entwicklungsserver
npm test           # Logik-Tests
npm run build && npm run test:e2e
npm run balance    # Siegquoten aus massenhaft durchgerechneten Schlachten
npm run metrics -- export.json   # Kennzahlen aus Exporten der Entwicklerseite
```

Entwicklerseite im Spiel: fünfmal schnell auf die Anzeige oben rechts tippen oder `#dev` an die Adresse hängen.
