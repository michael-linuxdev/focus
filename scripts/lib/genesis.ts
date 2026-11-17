// Zugriff auf GENESIS-Online. Nur für Skripte (Node), nicht für den Browser.
import { inflateRawSync } from "node:zlib";

const BASE = "https://genesis.destatis.de/genesisWS/rest/2020";

export interface GenesisAuth {
  /** Benutzername oder API-Token. */
  username: string;
  /** Bei einem API-Token leer. */
  password: string;
}

export function authFromEnv(): GenesisAuth | null {
  const username = process.env.GENESIS_USER;
  return username ? { username, password: process.env.GENESIS_PASSWORD ?? "" } : null;
}

export async function genesisPost(auth: GenesisAuth, path: string, params: Record<string, string>): Promise<Response> {
  return fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { username: auth.username, password: auth.password, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ language: "de", ...params }),
  });
}

/** Erste Datei eines ZIP-Archivs als Text. GENESIS liefert Tabellen immer als ZIP mit genau einer CSV-Datei. */
export function unzipFirst(zip: Buffer): string {
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Kein ZIP-Archiv");
  const central = zip.readUInt32LE(eocd + 16);
  if (zip.readUInt32LE(central) !== 0x02014b50) throw new Error("ZIP-Verzeichnis nicht lesbar");
  const method = zip.readUInt16LE(central + 10);
  const compressedSize = zip.readUInt32LE(central + 20);
  const local = zip.readUInt32LE(central + 42);
  const dataStart = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const data = zip.subarray(dataStart, dataStart + compressedSize);
  if (method === 0) return data.toString("utf8");
  if (method === 8) return inflateRawSync(data).toString("utf8");
  throw new Error(`ZIP-Verfahren ${method} wird nicht unterstützt`);
}

/** Lädt eine Tabelle im flachen CSV-Format (eine Zeile je Wert). */
export async function fetchTableCsv(auth: GenesisAuth, name: string, params: Record<string, string> = {}): Promise<string> {
  const res = await genesisPost(auth, "data/tablefile", { name, format: "ffcsv", ...params });
  const body = Buffer.from(await res.arrayBuffer());
  if (!res.ok) throw new Error(`GENESIS ${name}: HTTP ${res.status} ${body.toString("utf8").slice(0, 300)}`);
  if ((res.headers.get("content-type") ?? "").includes("zip")) return unzipFirst(body);
  return body.toString("utf8");
}
