// Sucht in GENESIS-Online (Statistisches Bundesamt) nach Tabellen. Aufruf: npm run genesis:find -- Verbraucherpreisindex
// Die Suche funktioniert mit dem Gastzugang. Für Tabellendaten braucht es ein eigenes Konto, siehe docs/API-BEFUND.md.
export {};
const term = process.argv.slice(2).join(" ").trim();
if (!term) {
  console.error("Suchbegriff fehlt, z. B.: npm run genesis:find -- Verbraucherpreisindex");
  process.exit(1);
}

const res = await fetch("https://genesis.destatis.de/genesisWS/rest/2020/find/find", {
  method: "POST",
  headers: {
    username: process.env.GENESIS_USER ?? "GAST",
    password: process.env.GENESIS_PASSWORD ?? "GAST",
    "content-type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({ term, category: "tables", pagelength: "25", language: "de" }),
});
if (!res.ok) {
  console.error(`GENESIS antwortet mit HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const body = (await res.json()) as { Status?: { Content?: string }; Tables?: { Code: string; Content: string }[] | null };
for (const table of body.Tables ?? []) console.log(`${table.Code}\t${table.Content.replace(/\s+/g, " ")}`);
if (!body.Tables?.length) console.log(`Keine Tabellen gefunden (${body.Status?.Content ?? "ohne Statusmeldung"}).`);
