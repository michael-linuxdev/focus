import de from '../../data/texts.de.json';

const texts: Readonly<Record<string, string>> = de.texts;

/** Text zu einem Schlüssel, Platzhalter `{name}` werden ersetzt. Fehlende Schlüssel fallen auf. */
export function t(key: string, params: Readonly<Record<string, string | number>> = {}): string {
  const raw = texts[key];
  if (raw === undefined) return `⟦${key}⟧`;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
