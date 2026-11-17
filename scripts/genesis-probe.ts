// Prüft, was ein GENESIS-Konto liefert: Anmeldung und einige Tabellenabrufe, mit Umfang und den ersten Zeilen.
// Zugangsdaten aus GENESIS_USER (Benutzername oder API-Token) und bei Bedarf GENESIS_PASSWORD;
// ohne sie läuft der Gastzugang (nur zum Vergleich). Aufruf: node scripts/genesis-probe.ts [Tabellencode[:startyear] …]
import { parseFlatCsv, rowTime } from "../src/lib/genesis-table.ts";
import { authFromEnv, fetchTableCsv, genesisPost, SOURCES, type Source } from "./lib/genesis.ts";

// PROBE_SOURCE=regional prüft die Regionaldatenbank, PROBE_GUEST=true erzwingt den Gastzugang.
// Ein Eintrag „find=Begriff“ sucht Tabellen, statt eine abzurufen.
const source: Source = process.env.PROBE_SOURCE === "regional" ? "regional" : "destatis";
const auth = (process.env.PROBE_GUEST === "true" ? null : authFromEnv()) ?? { username: "GAST", password: "GAST" };
console.log(`Datenbank: ${SOURCES[source]}`);
const tables = process.argv.slice(2).length ? process.argv.slice(2) : ["12411-0001", "61111-0002", "62361-0001", "12411-0010"];

console.log(`Konto: ${auth.username === "GAST" ? "Gastzugang" : auth.password ? "eigenes Konto mit Passwort" : "API-Token ohne Passwort"}`);
const login = await genesisPost(auth, "helloworld/logincheck", {}, source);
console.log(`Anmeldung: HTTP ${login.status} ${(await login.text()).slice(0, 200).replace(/\s+/g, " ")}`);

let failed = 0;
for (const spec of tables) {
  // Form: Code[:Startjahr[:weitere Parameter als a=b&c=d]]
  const [name = "", startyear, extra = ""] = spec.split(":");
  const params: Record<string, string> = Object.fromEntries(new URLSearchParams(extra));
  if (startyear) params.startyear = startyear;
  const started = Date.now();
  if (spec.startsWith("find=")) {
    const res = await genesisPost(auth, "find/find", { term: spec.slice(5).replace(/_/g, " "), category: "tables", pagelength: "40" }, source);
    const found = res.ok ? ((await res.json()) as { Tables?: { Code: string; Content: string }[] | null }).Tables ?? [] : [];
    console.log(`\n== ${spec}: HTTP ${res.status}, ${found.length} Tabellen`);
    for (const table of found) console.log(`${table.Code}  ${table.Content.replace(/\s+/g, " ").slice(0, 110)}`);
    continue;
  }
  try {
    const csv = await fetchTableCsv(auth, name, params, source);
    const lines = csv.split(/\r?\n/).filter(Boolean);
    const rows = parseFlatCsv(csv);
    console.log(`\n== ${spec}: ${csv.length} Zeichen, ${rows.length} Zeilen, ${Date.now() - started} ms`);
    console.log(lines.slice(1, 2).join("\n"));
    const times = rows.map(rowTime).filter((t) => t !== null).sort((a, b) => a - b);
    const day = (t: number | undefined): string => (t === undefined ? "?" : new Date(t).toISOString().slice(0, 10));
    console.log(`Zeitraum: ${day(times[0])} bis ${day(times[times.length - 1])}`);
    const count = (key: (row: Record<string, string>) => string): string => {
      const seen = new Map<string, number>();
      for (const row of rows) seen.set(key(row), (seen.get(key(row)) ?? 0) + 1);
      // Kurz halten: Die Ausgabe wird im Protokoll gelesen. PROBE_LIST erhöht die Zahl der gezeigten Ausprägungen.
      const cap = Number(process.env.PROBE_LIST ?? 8);
      return [...seen.entries()].slice(0, cap).map(([k, n]) => `${k} (${n})`).join(" · ") + (seen.size > cap ? ` · … insgesamt ${seen.size}` : "");
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
