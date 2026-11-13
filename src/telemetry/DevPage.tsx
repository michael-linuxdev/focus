import { t } from '../app/texts.ts';
import type { GameEvent } from './events.ts';
import type { Summary } from './metrics.ts';

/**
 * Versteckte Entwicklerseite: zeigt die lokal aufgezeichneten Ereignisse und die drei Kennzahlen,
 * exportiert sie als Datei und bietet Testhilfen (Zeitraffer, Schlachttempo, Zurücksetzen).
 * Erreichbar über fünf schnelle Tipps auf die Anzeige oben rechts oder über `#dev` in der Adresse.
 */
export interface DevProps {
  readonly install: string;
  readonly session: number;
  readonly summary: Summary;
  readonly events: readonly GameEvent[];
  readonly truncated: boolean;
  readonly speed: number;
  readonly message: string | null;
  readonly confirming: string | null;
  readonly onExport: () => void;
  readonly onSkip: (seconds: number) => void;
  readonly onSpeed: () => void;
  readonly onClearEvents: () => void;
  readonly onReset: () => void;
  readonly onClose: () => void;
}

function Kpi({ id, label, value, sub }: { id: string; label: string; value: boolean; sub?: string | null }) {
  return (
    <div data-testid={id} data-value={String(value)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #2c3a30', fontSize: '16px' }}>
      <span>{label}</span>
      <strong style={{ color: value ? '#8fd18f' : '#e2574c' }}>{value ? t('dev.yes') : t('dev.no')}{sub ? ` · ${sub}` : ''}</strong>
    </div>
  );
}

export function DevPage(p: DevProps) {
  const s = p.summary;
  const counts = new Map<string, number>();
  for (const e of p.events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  const recent = p.events.slice(-40).reverse();
  const time = (ms: number): string => new Date(ms).toLocaleTimeString('de-DE');
  return (
    <div data-testid="dev" class="dev">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '20px' }}>{t('dev.title')}</strong>
        <button data-testid="dev-close" class="btn quiet" style={{ minHeight: '44px' }} onClick={p.onClose}>{t('dev.close')}</button>
      </div>
      <div style={{ fontSize: '12px', opacity: 0.7, margin: '4px 0 10px' }}>{t('dev.install', { id: p.install, n: p.session })}</div>

      <div style={{ fontSize: '14px', opacity: 0.8 }}>{t('dev.kpi')}</div>
      <Kpi id="kpi-minute10" label={t('dev.minute10')} value={s.reachedMinute10} sub={s.secondsToMinute10 === null ? null : t('dev.after', { n: s.secondsToMinute10 })} />
      <Kpi id="kpi-alliance" label={t('dev.alliance')} value={s.joinedAlliance} />
      <Kpi id="kpi-nextday" label={t('dev.nextDay')} value={s.returnedNextDay} />
      <div style={{ fontSize: '13px', opacity: 0.85, margin: '8px 0', lineHeight: 1.5 }}>
        <div data-testid="dev-sessions">{t('dev.sessions', { n: s.sessions, days: s.daysActive, events: s.events })}</div>
        <div>{t('dev.lastStep', { step: s.lastStep ?? '–' })}{s.secondsToFirstTower !== null ? ` · ${t('dev.firstTower', { n: s.secondsToFirstTower })}` : ''}</div>
        <div>{t('dev.battles', { held: s.defenses.held, breached: s.defenses.breached, attacks: s.attacks.count })}</div>
        {s.usedTimeLapse && <div data-testid="dev-lapse" style={{ color: '#e9b949' }}>{t('dev.lapse')}</div>}
        {p.truncated && <div style={{ color: '#e2574c' }}>{t('dev.truncated')}</div>}
      </div>

      <button data-testid="dev-export" class="btn" style={{ width: '100%' }} onClick={p.onExport}>{t('dev.export')}</button>
      {p.message !== null && <div data-testid="dev-message" style={{ fontSize: '13px', margin: '6px 0', opacity: 0.85 }}>{p.message}</div>}

      <div style={{ fontSize: '14px', opacity: 0.8, margin: '14px 0 6px' }}>{t('dev.lapseTitle')}</div>
      <div class="small" style={{ display: 'flex', gap: '6px' }}>
        <button data-testid="dev-10m" class="btn" style={{ flex: 1 }} onClick={() => p.onSkip(600)}>{t('dev.plus10m')}</button>
        <button data-testid="dev-4h" class="btn" style={{ flex: 1 }} onClick={() => p.onSkip(4 * 3600 + 60)}>{t('dev.plus4h')}</button>
        <button data-testid="dev-1d" class="btn" style={{ flex: 1 }} onClick={() => p.onSkip(24 * 3600)}>{t('dev.plus1d')}</button>
        <button data-testid="dev-speed" class="btn" style={{ flex: 1 }} onClick={p.onSpeed}>{t('dev.speed', { n: p.speed })}</button>
      </div>

      <div style={{ fontSize: '14px', opacity: 0.8, margin: '14px 0 6px' }}>{t('dev.counts')}</div>
      <div style={{ fontSize: '13px', fontFamily: 'ui-monospace, monospace', lineHeight: 1.5 }}>
        {[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([type, n]) => <div>{String(n).padStart(4, ' ')} {type}</div>)}
      </div>

      <div style={{ fontSize: '14px', opacity: 0.8, margin: '14px 0 6px' }}>{t('dev.recent')}</div>
      <div data-testid="dev-recent" style={{ fontSize: '12px', fontFamily: 'ui-monospace, monospace', lineHeight: 1.5, wordBreak: 'break-word' }}>
        {recent.map((e) => <div>{time(e.t)} #{e.session} {e.type} {Object.keys(e.data).length > 0 ? JSON.stringify(e.data) : ''}</div>)}
      </div>

      <div class="small" style={{ display: 'flex', gap: '6px', margin: '16px 0 8px' }}>
        <button data-testid="dev-clear" class="btn" style={{ flex: 1 }} onClick={p.onClearEvents}>{p.confirming === 'clear' ? t('dev.confirm') : t('dev.clearEvents')}</button>
        <button data-testid="dev-reset" class="btn" style={{ flex: 1 }} onClick={p.onReset}>{p.confirming === 'reset' ? t('dev.confirm') : t('dev.reset')}</button>
      </div>
    </div>
  );
}
