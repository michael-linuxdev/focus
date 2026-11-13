/**
 * Vollbild-Hinweis „Zuerst die App installieren" und Testbericht. Beide zeigen ein fertig berechnetes
 * Modell und lösen Rückrufe aus; sie kennen weder Spielzustand noch Regeln.
 */
export interface GateModel {
  readonly appTitle: string;
  readonly title: string;
  /** Statt der Anleitung: Die App ist schon installiert und soll über ihr Symbol geöffnet werden. */
  readonly installedNote: string | null;
  readonly howTitle: string;
  readonly detected: string;
  /** Schritte; `{S}` wird durch das Teilen-Symbol ersetzt. */
  readonly steps: readonly string[];
  readonly nativeLabel: string | null;
  readonly onNative: () => void;
  readonly copyLabel: string | null;
  readonly onCopy: () => void;
  readonly message: string | null;
  readonly reasons: readonly (readonly [string, string])[];
  readonly warning: string | null;
  readonly skipLabel: string;
  readonly onSkip: () => void;
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ verticalAlign: '-3px', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
      <path d="M12 3v12M8 7l4-4 4 4M5 12v8h14v-8" />
    </svg>
  );
}

function Step({ text }: { text: string }) {
  const parts = text.split('{S}');
  return <li>{parts.map((part, i) => <>{i > 0 && <ShareIcon />}{part}</>)}</li>;
}

export function InstallGate({ m }: { m: GateModel }) {
  return (
    <div data-testid="gate" class="page gate" role="dialog" aria-modal="true">
      <div class="page-in">
        <div style={{ fontSize: '14px', opacity: 0.75, marginBottom: '18px' }}>{m.appTitle}</div>
        <h1 data-testid="gate-title">{m.title}</h1>
        {m.installedNote !== null ? (
          <div class="notice ok">{m.installedNote}</div>
        ) : (
          <>
            <div class="card">
              <div style={{ fontSize: '17px', fontWeight: 700 }}>{m.howTitle}</div>
              <div data-testid="gate-detected" style={{ fontSize: '13px', opacity: 0.7, margin: '2px 0 10px' }}>{m.detected}</div>
              {m.nativeLabel !== null && <button data-testid="gate-native" class="btn" style={{ width: '100%', marginBottom: '12px' }} onClick={m.onNative}>{m.nativeLabel}</button>}
              <ol data-testid="gate-steps" class="steps">{m.steps.map((s) => <Step text={s} key={s} />)}</ol>
              {m.copyLabel !== null && <button data-testid="gate-copy" class="btn quiet" style={{ width: '100%', marginTop: '6px' }} onClick={m.onCopy}>{m.copyLabel}</button>}
              {m.message !== null && <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '6px' }}>{m.message}</div>}
            </div>
            <ul class="why">{m.reasons.map(([head, rest]) => <li key={head}><b>{head}</b> – {rest}</li>)}</ul>
            {m.warning !== null && <div data-testid="gate-warning" class="notice">{m.warning}</div>}
          </>
        )}
        <button data-testid="gate-skip" class="skip" onClick={m.onSkip}>{m.skipLabel}</button>
      </div>
    </div>
  );
}

export interface ReportModel {
  readonly title: string;
  readonly intro: string;
  readonly noteLabel: string;
  readonly note: string;
  readonly onNote: (text: string) => void;
  readonly sendLabel: string;
  readonly onSend: () => void;
  readonly message: string | null;
  readonly installLabel: string | null;
  readonly onInstall: () => void;
  readonly footer: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
}

export function ReportPanel({ m }: { m: ReportModel }) {
  return (
    <div data-testid="report" class="page">
      <div class="page-in">
        <h1>{m.title}</h1>
        <p style={{ fontSize: '15px', lineHeight: 1.45, opacity: 0.9 }}>{m.intro}</p>
        <label style={{ display: 'block', fontSize: '14px', opacity: 0.8, margin: '14px 0 6px' }} for="report-note">{m.noteLabel}</label>
        <textarea
          id="report-note" data-testid="report-note" rows={4} maxLength={2000} value={m.note}
          onInput={(e) => m.onNote((e.target as HTMLTextAreaElement).value)}
        />
        <button data-testid="report-send" class="btn" style={{ width: '100%', marginTop: '12px' }} onClick={m.onSend}>{m.sendLabel}</button>
        {m.message !== null && <div data-testid="report-message" style={{ fontSize: '14px', margin: '8px 0', opacity: 0.9 }}>{m.message}</div>}
        {m.installLabel !== null && <button data-testid="report-install" class="btn quiet" style={{ width: '100%', marginTop: '8px' }} onClick={m.onInstall}>{m.installLabel}</button>}
        <button data-testid="report-close" class="btn quiet" style={{ width: '100%', marginTop: '8px' }} onClick={m.onClose}>{m.closeLabel}</button>
        <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '14px' }}>{m.footer}</div>
      </div>
    </div>
  );
}
