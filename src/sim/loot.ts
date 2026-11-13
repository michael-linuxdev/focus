import { PERMILLE, mulDiv } from './fixed.ts';
import { RESOURCE_KEYS, type Resources, type RulesData } from './data.ts';

/**
 * Beute nach einer Schlacht. Die Verlustgrenze ist fest:
 * erbeutet wird höchstens `lootMaxPermille` der ungeschützten Vorräte, davon der Anteil der Durchbruchstiefe.
 * Der geschützte Grundstock bleibt immer unberührt. Gilt für Angriffe des Spielers wie für Angriffe auf ihn.
 */
export function computeLoot(stock: Resources, protectedStock: Resources, depth: number, rules: RulesData): Resources {
  const share = rules.depthLootPermille[Math.max(0, Math.min(3, depth))] ?? 0;
  const out = { gold: 0, wood: 0, stone: 0 };
  for (const key of RESOURCE_KEYS) {
    const unprotected = Math.max(0, stock[key] - protectedStock[key]);
    const limit = mulDiv(unprotected, rules.lootMaxPermille, PERMILLE);
    out[key] = mulDiv(limit, share, PERMILLE);
  }
  return out;
}

/** Obergrenze der Beute unabhängig von der Tiefe (für Tests und Anzeige). */
export function lootLimit(stock: Resources, protectedStock: Resources, rules: RulesData): Resources {
  return computeLoot(stock, protectedStock, 3, { ...rules, depthLootPermille: [1000, 1000, 1000, 1000] });
}
