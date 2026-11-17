// Prüft, was ein GENESIS-Konto liefert: Anmeldung und einige Tabellenabrufe, mit Status und den ersten Zeilen.
// Zugangsdaten aus GENESIS_USER und GENESIS_PASSWORD; ohne sie läuft der Gastzugang (nur zum Vergleich).
// Aufruf: node scripts/genesis-probe.ts [Tabellencode …]
export {};

const BASE = "https://genesis.destatis.de/genesisWS/rest/2020";
const username = process.env.GENESIS_USER || "GAST";
const password = process.env.GENESIS_PASSWORD || "GAST";
const tables = process.argv.slice(2).length ? process.argv.slice(2) : ["12411-0001", "61111-0002", "62361-0001", "12411-0010"];

async function call(path: string, params: Record<string, string>): Promise<{ status: number; type: string; text: string }> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { username, password, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ language: "de", ...params }),
  });
  return { status: res.status, type: res.headers.get("content-type") ?? "", text: await res.text() };
}

console.log(`Konto: ${username === "GAST" ? "Gastzugang" : "eigenes Konto"}`);
const login = await call("helloworld/logincheck", {});
console.log(`Anmeldung: HTTP ${login.status} ${login.text.slice(0, 200).replace(/\s+/g, " ")}`);

let failed = 0;
for (const name of tables) {
  const started = Date.now();
  const res = await call("data/tablefile", { name, format: "ffcsv", compress: "false" });
  const lines = res.text.split(/\r?\n/);
  console.log(`\n== ${name}: HTTP ${res.status}, ${res.type}, ${res.text.length} Zeichen, ${lines.length} Zeilen, ${Date.now() - started} ms`);
  console.log(lines.slice(0, 12).map((l) => l.slice(0, 400)).join("\n"));
  if (res.status !== 200) failed++;
}
if (failed) {
  console.log(`\n${failed} von ${tables.length} Abrufen ohne Erfolg.`);
  process.exit(1);
}
