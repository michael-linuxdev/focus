import type { ComponentChildren } from 'preact';
import type { Resources, RoadDef } from '../sim/index.ts';

/**
 * Oberfläche über dem Spielfeld. Zeigt ein fertig berechnetes Modell und löst Rückrufe aus;
 * sie hält keinen Spielzustand und kennt keine Regeln.
 */
export interface Btn {
  readonly id: string;
  readonly label: string;
  readonly sub?: string | undefined;
  readonly cost?: Resources | undefined;
  readonly disabled?: boolean | undefined;
  /** Tutorial-Hinweis: Schaltfläche pulsiert. */
  readonly hint?: boolean | undefined;
  readonly active?: boolean | undefined;
  /** Nebenaktion (Schließen, Abbrechen, Zurück). */
  readonly quiet?: boolean | undefined;
  /** Kleine Karte eines Straßenverlaufs. */
  readonly road?: RoadDef | undefined;
  readonly onClick: () => void;
}

export interface StepperRow {
  readonly label: string;
  readonly cells: readonly { readonly id: string; readonly label: string; readonly count: number; readonly onMinus: () => void; readonly onPlus: () => void }[];
}

export interface HudModel {
  readonly resources: Resources;
  readonly showAllResources: boolean;
  readonly goldDenied: boolean;
  readonly topRight: string;
  /** Durchbruchstiefe 0 bis 3 als drei Marken; `null` blendet sie aus. */
  readonly depth: number | null;
  readonly banner: string | null;
  readonly bottom: readonly Btn[];
  readonly sheet: { readonly title: string; readonly note?: string | undefined; readonly options: readonly Btn[]; readonly onClose: (() => void) | null; readonly closeLabel: string } | null;
  readonly panel: { readonly title: string; readonly lines: readonly string[]; readonly loot?: Resources | undefined; readonly rows: readonly StepperRow[]; readonly buttons: readonly Btn[] } | null;
}

const RES_COLOR = { gold: '#e9b949', wood: '#a9743a', stone: '#9aa3ab' } as const;

function Res({ kind, value, big }: { kind: keyof typeof RES_COLOR; value: number | string; big?: boolean }) {
  const size = big ? '18px' : '11px';
  return (
    <span data-testid={`res-${kind}`} style={{ display: 'inline-flex', alignItems: 'center', gap: big ? '7px' : '4px', marginRight: big ? '14px' : '8px' }}>
      <span style={{ width: size, height: size, borderRadius: kind === 'gold' ? '50%' : '3px', background: RES_COLOR[kind], display: 'inline-block' }} />
      {value}
    </span>
  );
}

function Cost({ cost }: { cost: Resources }) {
  return (
    <span style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
      {cost.gold > 0 && <Res kind="gold" value={cost.gold} />}
      {cost.wood > 0 && <Res kind="wood" value={cost.wood} />}
      {cost.stone > 0 && <Res kind="stone" value={cost.stone} />}
    </span>
  );
}

function MiniRoad({ road }: { road: RoadDef }) {
  const points = road.waypoints.map((p) => `${(p[0] ?? 0) + 0.5},${(p[1] ?? 0) + 0.5}`).join(' ');
  return (
    <svg viewBox="0 0 9 14" width="54" height="84" style={{ background: '#2c4030', borderRadius: '6px', flex: 'none' }}>
      <polyline points={points} fill="none" stroke="#b79a63" stroke-width="0.9" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
  );
}

function Button({ b, wide, children }: { b: Btn; wide?: boolean; children?: ComponentChildren }) {
  return (
    <button
      data-testid={b.id}
      class={`btn${b.hint && !b.disabled ? ' pulse' : ''}${b.active ? ' active' : ''}${b.quiet ? ' quiet' : ''}`}
      disabled={b.disabled}
      onClick={b.onClick}
      style={wide ? { width: '100%', justifyContent: 'space-between', textAlign: 'left' } : { flex: 1 }}
    >
      {b.road && <MiniRoad road={b.road} />}
      <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: wide ? 1 : undefined }}>
        <span>{b.label}</span>
        {b.sub !== undefined && <span style={{ fontSize: '13px', fontWeight: 400, opacity: 0.8 }}>{b.sub}</span>}
      </span>
      {b.cost && <Cost cost={b.cost} />}
      {children}
    </button>
  );
}

export function Hud({ m }: { m: HudModel }) {
  return (
    <>
      <div class="bar" style={{ top: 'env(safe-area-inset-top)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '19px', fontWeight: 600 }}>
        <span style={{ color: m.goldDenied ? '#e2574c' : '#f1ead6', transition: 'color 150ms' }}>
          <Res kind="gold" value={m.resources.gold} big />
          {m.showAllResources && <Res kind="wood" value={m.resources.wood} big />}
          {m.showAllResources && <Res kind="stone" value={m.resources.stone} big />}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', opacity: 0.85 }}>
          {m.depth !== null && (
            <span data-testid="depth" data-depth={m.depth} style={{ display: 'flex', gap: '4px' }}>
              {[1, 2, 3].map((d) => (
                <span style={{ width: '14px', height: '14px', transform: 'rotate(45deg)', background: m.depth !== null && m.depth >= d ? '#d9a441' : '#3d4a3f' }} />
              ))}
            </span>
          )}
          <span data-testid="top-right">{m.topRight}</span>
        </span>
      </div>

      {m.banner !== null && <div data-testid="banner" class="banner">{m.banner}</div>}

      {m.bottom.length > 0 && !m.sheet && !m.panel && (
        <div class="bar" style={{ bottom: 'env(safe-area-inset-bottom)', paddingBottom: '18px', display: 'flex', gap: '8px' }}>
          {m.bottom.map((b) => <Button b={b} key={b.id} />)}
        </div>
      )}

      {m.sheet && (
        <div data-testid="sheet" class="sheet">
          <div style={{ fontSize: '17px', fontWeight: 600, marginBottom: m.sheet.note ? '2px' : '10px' }}>{m.sheet.title}</div>
          {m.sheet.note !== undefined && <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '10px' }}>{m.sheet.note}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {m.sheet.options.map((b) => <Button b={b} wide key={b.id} />)}
            {m.sheet.onClose && <button data-testid="sheet-close" class="btn quiet" onClick={m.sheet.onClose}>{m.sheet.closeLabel}</button>}
          </div>
        </div>
      )}

      {m.panel && (
        <div data-testid="panel" class="panel">
          <div style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>{m.panel.title}</div>
          {m.panel.lines.map((line) => <div style={{ fontSize: '15px', opacity: 0.85, marginBottom: '4px' }}>{line}</div>)}
          {m.panel.loot && (
            <div data-testid="loot" style={{ fontSize: '20px', fontWeight: 600, margin: '10px 0' }}>
              <Res kind="gold" value={`+${m.panel.loot.gold}`} big />
              <Res kind="wood" value={`+${m.panel.loot.wood}`} big />
              <Res kind="stone" value={`+${m.panel.loot.stone}`} big />
            </div>
          )}
          {m.panel.rows.map((row) => (
            <div style={{ margin: '10px 0' }}>
              <div style={{ fontSize: '14px', opacity: 0.8, marginBottom: '4px' }}>{row.label}</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {row.cells.map((c) => (
                  <div style={{ flex: 1, background: '#26352a', borderRadius: '10px', padding: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>{c.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <button data-testid={`${c.id}-minus`} class="step" onClick={c.onMinus}>−</button>
                      <span data-testid={`${c.id}-count`} style={{ fontSize: '18px', fontWeight: 600 }}>{c.count}</span>
                      <button data-testid={`${c.id}-plus`} class="step" onClick={c.onPlus}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
            {m.panel.buttons.map((b) => <Button b={b} wide key={b.id} />)}
          </div>
        </div>
      )}
    </>
  );
}
