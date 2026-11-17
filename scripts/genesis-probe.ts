// Prüft, was ein GENESIS-Konto liefert: Anmeldung und einige Tabellenabrufe, mit Umfang und den ersten Zeilen.
// Zugangsdaten aus GENESIS_USER (Benutzername oder API-Token) und bei Bedarf GENESIS_PASSWORD;
// ohne sie läuft der Gastzugang (nur zum Vergleich). Aufruf: node scripts/genesis-probe.ts [Tabellencode[:startyear] …]
import { parseFlatCsv, rowTime } from "../src/lib/genesis-table.ts";
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
    const rows = parseFlatCsv(csv);
    console.log(`\n== ${spec}: ${csv.length} Zeichen, ${rows.length} Zeilen, ${Date.now() - started} ms`);
    console.log(lines.slice(0, 3).join("\n"));
    const times = rows.map(rowTime).filter((t) => t !== null).sort((a, b) => a - b);
    const day = (t: number | undefined): string => (t === undefined ? "?" : new Date(t).toISOString().slice(0, 10));
    console.log(`Zeitraum: ${day(times[0])} bis ${day(times[times.length - 1])}`);
    const count = (key: (row: Record<string, string>) => string): string => {
      const seen = new Map<string, number>();
      for (const row of rows) seen.set(key(row), (seen.get(key(row)) ?? 0) + 1);
      return [...seen.entries()].slice(0, 25).map(([k, n]) => `${k} (${n})`).join(" · ") + (seen.size > 25 ? ` · … insgesamt ${seen.size}` : "");
    };
    console.log(`Merkmale: ${count((row) => `${row.value_variable_code} „${row.value_variable_label}“ [${row.value_unit}]`)}`);
    for (let n = 1; rows[0]?.[`${n}_variable_code`] !== undefined; n++) {
      console.log(`Gliederung ${n}: ${count((row) => `${row[`${n}_variable_code`]}=${row[`${n}_variable_attribute_code`]} „${row[`${n}_variable_attribute_label`]}“`)}`);
    }
  } catch (error) {
    failed++;
    console.log(`\n== ${spec}: ${String(error)}`);
  }
}
if (failed) {
  console.log(`\n${failed} von ${tables.length} Abrufen ohne Erfolg.`);
  process.exit(1);
}
