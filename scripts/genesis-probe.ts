// Prüft, was ein GENESIS-Konto liefert: Anmeldung und einige Tabellenabrufe, mit Umfang und den ersten Zeilen.
// Zugangsdaten aus GENESIS_USER (Benutzername oder API-Token) und bei Bedarf GENESIS_PASSWORD;
// ohne sie läuft der Gastzugang (nur zum Vergleich). Aufruf: node scripts/genesis-probe.ts [Tabellencode[:startyear] …]
import { authFromEnv, fetchTableCsv, genesisPost } from "./lib/genesis.ts";

const auth = authFromEnv() ?? { username: "GAST", password: "GAST" };
const tables = process.argv.slice(2).length ? process.argv.slice(2) : ["12411-0001", "61111-0002", "62361-0001", "12411-0010"];

console.log(`Konto: ${auth.username === "GAST" ? "Gastzugang" : auth.password ? "eigenes Konto mit Passwort" : "API-Token ohne Passwort"}`);
const login = await genesisPost(auth, "helloworld/logincheck", {});
console.log(`Anmeldung: HTTP ${login.status} ${(await login.text()).slice(0, 200).replace(/\s+/g, " ")}`);

let failed = 0;
for (const spec of tables) {
  const [name = "", startyear] = spec.split(":");
  const started = Date.now();
  try {
    const csv = await fetchTableCsv(auth, name, startyear ? { startyear } : {});
    const lines = csv.split(/\r?\n/).filter(Boolean);
    console.log(`\n== ${spec}: ${csv.length} Zeichen, ${lines.length} Zeilen, ${Date.now() - started} ms`);
    console.log(lines.slice(0, 6).join("\n"));
    console.log("…");
    console.log(lines.slice(-3).join("\n"));
  } catch (error) {
    failed++;
    console.log(`\n== ${spec}: ${String(error)}`);
  }
}
if (failed) {
  console.log(`\n${failed} von ${tables.length} Abrufen ohne Erfolg.`);
  process.exit(1);
}
