import { findById, type DefenseDef, type GameData, type WaveGroupDef } from './data.ts';
import { mulDiv, PERMILLE } from './fixed.ts';

/**
 * Wellen nach dem geführten Ablauf: Sie werden nicht einzeln aufgeschrieben, sondern aus `waves.scaling`
 * berechnet und wachsen mit der Stadt. Welle n (ab 0) hat ein Budget an Lebenspunkten, das auf die
 * Einheiten verteilt wird, die ab dieser Welle dabei sind; zusätzlich sind alle Angreifer um einen
 * Faktor zäher. Jede Burgfried-Stufe gibt eine feste Zahl weiterer Wellen frei, die letzte davon führt
 * ein Anführer an. Nur Ganzzahlen, kein Zufall: dieselbe Nummer ergibt immer dieselbe Welle.
 */
export interface ScaledWave {
  readonly groups: readonly WaveGroupDef[];
  /** Faktor auf die Lebenspunkte aller Angreifer dieser Welle. */
  readonly hpPermille: number;
  readonly boss: boolean;
}

/** `base * (permille / 1000) ^ n`, abschneidend Schritt für Schritt. */
export function growPermille(base: number, permille: number, n: number): number {
  let value = base;
  for (let i = 0; i < n; i++) value = mulDiv(value, permille, PERMILLE);
  return value;
}

/** Zahl der berechneten Wellen, die bis zu dieser Burgfried-Stufe freigegeben sind. */
export function wavesUnlocked(keepLevel: number, data: GameData): number {
  return Math.max(0, keepLevel - 1) * data.waves.scaling.wavesPerKeepLevel;
}

export function isBossWave(index: number, data: GameData): boolean {
  const per = data.waves.scaling.wavesPerKeepLevel;
  return index % per === per - 1;
}

/** Die berechnete Welle mit der Nummer `index` (ab 0). Als Nachtangriff (`raid`) kommt sie kleiner, mit eigener Zähigkeit und ohne Anführer. */
export function scaledWave(index: number, data: GameData, raid = false): ScaledWave {
  const sc = data.waves.scaling;
  const budget = mulDiv(growPermille(sc.budgetBase, sc.budgetGrowthPermille, index), raid ? sc.raidStrengthPermille : PERMILLE, PERMILLE);
  // Nachts greift niemand ein: Die Zähigkeit der Angreifer wächst dort nach eigenen, flacheren Werten.
  const hpPermille = raid ? growPermille(sc.raidHpBasePermille, sc.raidHpGrowthPermille, index) : growPermille(sc.hpBasePermille, sc.hpGrowthPermille, index);
  const mix = sc.units.filter((u) => u.fromWave <= index);
  const shares = mix.reduce((n, u) => n + u.sharePermille, 0);
  const groups: WaveGroupDef[] = [];
  mix.forEach((entry, i) => {
    const unit = findById(data.units.units, entry.unit, 'Einheit');
    const count = Math.max(1, Math.floor(mulDiv(budget, entry.sharePermille, shares) / unit.hp));
    // Jede Art kommt in zwei Schüben, versetzt über das Zeitfenster der Welle.
    const first = Math.ceil(count / 2);
    const offset = mulDiv(sc.windowTicks, i, mix.length * 2);
    const interval = (n: number): number => Math.max(sc.minIntervalTicks, Math.min(sc.maxIntervalTicks, Math.floor(sc.burstTicks / Math.max(1, n))));
    groups.push({ unit: unit.id, count: first, startTick: sc.firstTick + offset, intervalTicks: interval(first), jitterTicks: sc.jitterTicks });
    if (count > first) groups.push({ unit: unit.id, count: count - first, startTick: sc.firstTick + offset + Math.floor(sc.windowTicks / 2), intervalTicks: interval(count - first), jitterTicks: sc.jitterTicks });
  });
  const boss = !raid && isBossWave(index, data);
  if (boss) groups.push({ unit: sc.boss.unit, count: 1, startTick: sc.firstTick + sc.boss.startTick, intervalTicks: 1, jitterTicks: 0 });
  return { groups, hpPermille, boss };
}

/** Eine anstehende Verteidigung mit ausgeschriebener Welle. */
export interface PlannedDefense extends DefenseDef {
  readonly groups: readonly WaveGroupDef[];
  readonly hpPermille: number;
  /** Nummer der berechneten Welle (ab 0); `null` im geführten Ablauf und bei der Übungswelle. */
  readonly index: number | null;
  readonly boss: boolean;
  /** Schon geschlagene Welle: bringt weniger Gold und keinen Fortschritt. */
  readonly repeat: boolean;
}

/** Verteidigung zu einer berechneten Welle. */
export function scaledDefense(index: number, repeat: boolean, data: GameData): PlannedDefense {
  const sc = data.waves.scaling;
  const wave = scaledWave(index, data);
  const gold = growPermille(sc.victoryGoldBase, sc.victoryGoldGrowthPermille, index);
  return {
    wave: `welle_${index + 1}`, holdMilliUntilTower: 0, unlosable: false,
    victoryGold: repeat ? mulDiv(gold, sc.repeatGoldPermille, PERMILLE) : gold,
    parSeconds: sc.parSeconds + (wave.boss ? sc.boss.extraParSeconds : 0),
    groups: wave.groups, hpPermille: wave.hpPermille, index, boss: wave.boss, repeat,
  };
}

/** Eine fest aufgeschriebene Verteidigung (geführter Ablauf, Übungswelle). */
export function fixedDefense(def: DefenseDef, repeat: boolean, data: GameData): PlannedDefense {
  return { ...def, groups: findById(data.waves.waves, def.wave, 'Welle').groups, hpPermille: PERMILLE, index: null, boss: false, repeat };
}
