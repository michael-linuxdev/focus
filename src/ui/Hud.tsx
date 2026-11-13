import { t } from '../app/texts.ts';

export interface HudProps {
  readonly title: string;
  readonly phase: 'ready' | 'running' | 'done';
  readonly arrived: number;
  readonly tick: number;
  readonly hash: string;
  readonly battles: number;
  readonly offlineReady: boolean;
  readonly onPrimary: () => void;
}

const bar = { position: 'absolute', left: 0, right: 0, padding: '8px 12px', boxSizing: 'border-box' } as const;

/** Oberfläche des M0-Gerüsts. Löst nur Aktionen aus und hält keinen Spielzustand. */
export function Hud(p: HudProps) {
  const label = p.phase === 'ready' ? t('m0.releaseWave') : p.phase === 'running' ? t('m0.running') : t('m0.again');
  return (
    <>
      <div style={{ ...bar, top: 'env(safe-area-inset-top)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <strong data-testid="title">{p.title}</strong>
        <small data-testid="status">
          {t('status.battles', { n: p.battles })}
          {p.offlineReady ? ` · ${t('status.offlineReady')}` : ''}
        </small>
      </div>
      <div style={{ ...bar, bottom: 'env(safe-area-inset-bottom)', textAlign: 'center' }}>
        <small data-testid="debug" style={{ display: 'block', opacity: 0.7, marginBottom: '6px' }}>
          {t('m0.arrived', { n: p.arrived })} · {t('m0.debug', { tick: p.tick, hash: p.hash })}
        </small>
        <button
          data-testid="primary"
          disabled={p.phase === 'running'}
          onClick={p.onPrimary}
          style={{
            pointerEvents: 'auto', minHeight: '52px', width: '100%', maxWidth: '360px', fontSize: '18px', fontWeight: 600,
            border: 0, borderRadius: '10px', background: p.phase === 'running' ? '#56604f' : '#d9a441', color: '#1d2a1f',
          }}
        >
          {label}
        </button>
      </div>
    </>
  );
}
