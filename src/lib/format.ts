import type { Frequency } from "./types.ts";

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

export function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatValue(value: number, decimals: number, unit: string): string {
  const text = formatNumber(value, decimals);
  return unit ? `${text} ${unit}` : text;
}

export function formatSigned(value: number, decimals: number): string {
  const text = formatNumber(Math.abs(value), decimals);
  if (Number(Math.abs(value).toFixed(decimals)) === 0) return `±${text}`;
  return value > 0 ? `+${text}` : `−${text}`;
}

export function formatDate(time: number, frequency: Frequency): string {
  const d = new Date(time);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  switch (frequency) {
    case "jährlich":
      return String(year);
    case "vierteljährlich":
      return `${Math.floor(month / 3) + 1}. Quartal ${year}`;
    case "monatlich":
      return `${MONTHS[month]} ${year}`;
    default:
      return `${d.getUTCDate()}. ${MONTHS[month]} ${year}`;
  }
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
