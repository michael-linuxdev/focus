import { t } from '../app/texts.ts';

export interface HudProps {
  readonly gold: number;
  readonly wave: number;
  /** Gold-Anzeige kurz rot: eine Aktion war nicht bezahlbar. */
  readonly goldDenied: boolean;
  readonly canRelease: boolean;
  readonly hintRelease: boolean;
  readonly banner: string | null;
  readonly onRelease: () => void;
}

const bar = { position: 'absolute', left: 0, right: 0, padding: '8px 14px', boxSizing: 'border-box' } as const;

/** Oberfläche der Verteidigung. Löst nur Aktionen aus und hält keinen Spielzustand. */
export function Hud(p: HudProps) {
  return (
    <>
      <div style={{ ...bar, top: 'env(safe-area-inset-top)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '20px', fontWeight: 600 }}>
        <span data-testid="gold" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: p.goldDenied ? '#e2574c' : '#f1ead6', transition: 'color 150ms' }}>
          <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#e9b949', display: 'inline-block' }} />
          {p.gold}
        </span>
        <span data-testid="wave" style={{ opacity: 0.8, fontSize: '16px' }}>{t('hud.wave', { n: p.wave })}</span>
      </div>
      {p.banner !== null && (
        <div data-testid="banner" class="banner" style={{ position: 'absolute', left: 0, right: 0, top: '38%', textAlign: 'center', fontSize: '34px', fontWeight: 700, textShadow: '0 2px 8px #000' }}>
          {p.banner}
        </div>
      )}
      <div style={{ ...bar, bottom: 'env(safe-area-inset-bottom)', paddingBottom: '18px', textAlign: 'center' }}>
        {p.canRelease && (
          <button
            data-testid="release"
            class={p.hintRelease ? 'pulse' : ''}
            onClick={p.onRelease}
            style={{
              pointerEvents: 'auto', minHeight: '56px', width: '100%', maxWidth: '360px', fontSize: '19px', fontWeight: 600,
              border: 0, borderRadius: '12px', background: '#d9a441', color: '#1d2a1f',
            }}
          >
            {t('hud.nextWave')}
          </button>
        )}
      </div>
    </>
  );
}
