import type { ComponentChildren } from 'preact';
import type { Resources, RoadDef } from '../sim/index.ts';
import { atlasSprite } from '../render/sprites.ts';

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
  /** Symbolname aus `public/sprites/icons/`. */
  readonly icon?: string | undefined;
  readonly onClick: () => void;
}

export interface StepperRow {
  readonly label: string;
  readonly cells: readonly { readonly id: string; readonly label: string; readonly count: number; readonly onMinus: () => void; readonly onPlus: () => void }[];
}

export interface MapNode {
  readonly id: string;
  readonly kind: 'home' | 'camp' | 'city';
  readonly label: string;
  readonly sub: string;
  /** Lage in Prozent der Kartenfläche. */
  readonly x: number;
  readonly y: number;
  readonly shielded: boolean;
  readonly icon: string;
  readonly disabled: boolean;
  readonly hint: boolean;
  readonly onClick: () => void;
}

export interface HudModel {
  readonly resources: Resources;
  /** Vorräte, deren Lager voll ist (Erträge laufen dort nicht weiter); `null` außerhalb der Stadt. */
  readonly full: { readonly gold: boolean; readonly wood: boolean; readonly stone: boolean } | null;
  readonly showAllResources: boolean;
  readonly goldDenied: boolean;
  readonly topRight: string;
  /** Versteckter Zugang zur Entwicklerseite: mehrfaches Tippen auf die Anzeige oben rechts. */
  readonly onTopRight: () => void;
  /** Durchbruchstiefe 0 bis 3 als drei Marken; `null` blendet sie aus. */
  readonly depth: number | null;
  readonly banner: string | null;
  /** Vorschau der nächsten Welle über den Schaltflächen. */
  readonly preview: { readonly label: string; readonly items: readonly { readonly sprite: string; readonly scale: number; readonly count: number; readonly name: string }[]; readonly note: string | null } | null;
  readonly bottom: readonly Btn[];
  /** Zweite, kleinere Reihe über der Hauptleiste. */
  readonly bottomSecondary: readonly Btn[];
  /** Kleine Schaltfläche unter der Anzeige oben rechts (Testbericht); nur in der Stadt. */
  readonly corner: Btn | null;
  /** Kleine Statuszeile unter den Vorräten (Schild). */
  readonly status: string | null;
  readonly map: { readonly title: string; readonly nodes: readonly MapNode[]; readonly back: Btn } | null;
  readonly sheet: { readonly title: string; readonly note?: string | undefined; readonly options: readonly Btn[]; readonly onClose: (() => void) | null; readonly closeLabel: string } | null;
  readonly panel: { readonly title: string; readonly lines: readonly string[]; readonly loot?: Resources | undefined; readonly rows: readonly StepperRow[]; readonly buttons: readonly Btn[] } | null;
}

const ICON_BASE = `${import.meta.env.BASE_URL}sprites/icons/`;
const RES_ICON = { gold: 'gold', wood: 'holz', stone: 'stein' } as const;

/** Symbol aus `public/sprites/icons/` (erzeugt von `scripts/sprites.py`). */
export function Icon({ name, size }: { name: string; size: number }) {
  return <img src={`${ICON_BASE}${name}.png`} alt="" width={size} height={size} style={{ display: 'block', flex: 'none' }} draggable={false} />;
}

/** Motiv aus dem Bildatlas in der Höhe `height`. */
function AtlasIcon({ name, height }: { name: string; height: number }) {
  const a = atlasSprite(name);
  if (!a) return null;
  const k = height / a.rect.h;
  return (
    <span
      style={{
        display: 'inline-block', flex: 'none', width: `${a.rect.w * k}px`, height: `${height}px`,
        backgroundImage: `url(${a.url})`, backgroundSize: `${(a.size[0] ?? 0) * k}px ${(a.size[1] ?? 0) * k}px`,
        backgroundPosition: `${-a.rect.x * k}px ${-a.rect.y * k}px`,
      }}
    />
  );
}

function Res({ kind, value, big, full }: { kind: keyof typeof RES_ICON; value: number | string; big?: boolean; full?: boolean | undefined }) {
  return (
    <span data-testid={`res-${kind}`} data-full={full ? 'true' : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: big ? '6px' : '3px', marginRight: big ? '12px' : '8px', color: full ? '#e9b949' : undefined }}>
      <Icon name={RES_ICON[kind]} size={big ? 24 : 16} />
      {value}
    </span>
  );
}

/** Große Mengen kurz: 12 500 wird 12,5k, damit drei Vorräte in die Kopfzeile passen. */
export function compact(n: number): string {
  if (n < 10_000) return String(n);
  if (n < 1_000_000) return `${String(Math.floor(n / 100) / 10).replace('.', ',')}k`;
  return `${String(Math.floor(n / 10_000) / 100).replace('.', ',')} Mio`;
}

function Cost({ cost }: { cost: Resources }) {
  return (
    <span style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
      {cost.gold > 0 && <Res kind="gold" value={compact(cost.gold)} />}
      {cost.wood > 0 && <Res kind="wood" value={compact(cost.wood)} />}
      {cost.stone > 0 && <Res kind="stone" value={compact(cost.stone)} />}
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
      {b.icon !== undefined && <Icon name={b.icon} size={wide ? 32 : 28} />}
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
          <Res kind="gold" value={m.showAllResources ? compact(m.resources.gold) : m.resources.gold} big />
          {m.showAllResources && <Res kind="wood" value={compact(m.resources.wood)} big full={m.full?.wood} />}
          {m.showAllResources && <Res kind="stone" value={compact(m.resources.stone)} big full={m.full?.stone} />}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', opacity: 0.85 }}>
          {m.depth !== null && (
            <span data-testid="depth" data-depth={m.depth} style={{ display: 'flex', gap: '4px' }}>
              {[1, 2, 3].map((d) => (
                <span style={{ width: '14px', height: '14px', transform: 'rotate(45deg)', background: m.depth !== null && m.depth >= d ? '#d9a441' : '#3d4a3f' }} />
              ))}
            </span>
          )}
          <span data-testid="top-right" style={{ pointerEvents: 'auto', padding: '10px 0 10px 10px' }} onClick={m.onTopRight}>{m.topRight}</span>
        </span>
      </div>

      {m.status !== null && (
        <div data-testid="status" class="bar" style={{ top: 'calc(env(safe-area-inset-top) + 38px)', fontSize: '13px', opacity: 0.85, padding: '0 14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Icon name="schild" size={14} />
          {m.status}
        </div>
      )}

      {m.corner && !m.sheet && !m.panel && !m.map && (
        <button data-testid={m.corner.id} class={`corner${m.corner.hint ? ' pulse' : ''}`} onClick={m.corner.onClick}>{m.corner.label}</button>
      )}

      {m.map && (
        <div data-testid="map" class="map">
          <div style={{ position: 'absolute', left: '14px', top: '8px', fontSize: '15px', opacity: 0.7 }}>{m.map.title}</div>
          {m.map.nodes.map((n) => (
            <button
              key={n.id}
              data-testid={`node-${n.id}`}
              class={`node ${n.kind}${n.hint ? ' pulse' : ''}`}
              disabled={n.disabled}
              onClick={n.onClick}
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              <span class={`mark${n.shielded ? ' shielded' : ''}`}><Icon name={n.icon} size={40} /></span>
              <span style={{ fontWeight: 600 }}>{n.label}</span>
              <span style={{ fontSize: '12px', opacity: 0.8 }}>{n.sub}</span>
            </button>
          ))}
          <div class="bar" style={{ bottom: 'env(safe-area-inset-bottom)', paddingBottom: '18px', display: 'flex' }}><Button b={m.map.back} /></div>
        </div>
      )}

      {m.banner !== null && <div data-testid="banner" class="banner">{m.banner}</div>}

      {m.bottom.length > 0 && !m.sheet && !m.panel && !m.map && (
        <div class="bar" style={{ bottom: 'env(safe-area-inset-bottom)', paddingBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {m.preview?.note != null && <div data-testid="preview-note" style={{ fontSize: '12px', padding: '0 4px', color: '#e9b949' }}>{m.preview.note}</div>}
          {m.preview && (
            <div data-testid="preview" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '2px 4px', height: '26px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {m.preview.items.length <= 2 && <span style={{ opacity: 0.75 }}>{m.preview.label}</span>}
              {m.preview.items.map((it) => (
                <span title={it.name} style={{ display: 'inline-flex', alignItems: 'flex-end', gap: '3px', fontWeight: 600 }}>
                  <AtlasIcon name={it.sprite} height={Math.round(24 * it.scale)} />
                  {it.count}{m.preview !== null && m.preview.items.length <= 3 ? ` ${it.name}` : ''}
                </span>
              ))}
            </div>
          )}
          {m.bottomSecondary.length > 0 && (
            <div class="small" style={{ display: 'flex', gap: '6px' }}>{m.bottomSecondary.map((b) => <Button b={b} key={b.id} />)}</div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>{m.bottom.map((b) => <Button b={b} key={b.id} />)}</div>
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
