import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { unzipFirst } from "../scripts/lib/genesis.ts";

/** Baut ein ZIP mit einer Datei so, wie GENESIS es liefert: Größen erst im Verzeichnis (Datendeskriptor). */
function zipOne(name: string, content: string, method: 0 | 8): Buffer {
  const raw = Buffer.from(content, "utf8");
  const data = method === 8 ? deflateRawSync(raw) : raw;
  const file = Buffer.from(name, "utf8");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(file.length, 26);
  const descriptor = Buffer.alloc(16);
  descriptor.writeUInt32LE(0x08074b50, 0);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(file.length, 28);
  central.writeUInt32LE(0, 42);
  const centralStart = local.length + file.length + data.length + descriptor.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + file.length, 12);
  end.writeUInt32LE(centralStart, 16);
  return Buffer.concat([local, file, data, descriptor, central, file, end]);
}

describe("unzipFirst", () => {
  it("liest komprimierte und unkomprimierte Einträge mit Umlauten", () => {
    const text = "Zeit;Wert\n2025;Bevölkerung\n".repeat(50);
    expect(unzipFirst(zipOne("t_de_flat.csv", text, 8))).toBe(text);
    expect(unzipFirst(zipOne("t_de_flat.csv", text, 0))).toBe(text);
  });

  it("lehnt anderes ab", () => {
    expect(() => unzipFirst(Buffer.from("{\"Code\":15}"))).toThrow("Kein ZIP-Archiv");
  });
});
