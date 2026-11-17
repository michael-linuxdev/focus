// Waagerechte Balkenliste: ein Wert je Zeile, Beschriftung links, Wert an der Balkenspitze.
import { h } from "./dom.ts";

export interface BarItem {
  label: string;
  value: number;
  /** Hebt die Zeile hervor (fette Beschriftung, eigene Farbe, Zusatztext). */
  highlight?: boolean;
  /** Zusatz hinter der Beschriftung, z. B. „dein Land“. */
  note?: string;
  /** Macht die Beschriftung zur Schaltfläche. `pressed` zeigt den Zustand einer Auswahl. */
  onClick?: () => void;
  pressed?: boolean;
}

export function barList(items: BarItem[], format: (value: number) => string, label: string): HTMLElement {
  const values = items.map((item) => item.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const zero = ((0 - min) / span) * 100;
  return h(
    "ul",
    { class: "bars", "aria-label": label },
    ...items.map((item) => {
      const width = (Math.abs(item.value) / span) * 100;
      const left = item.value >= 0 ? zero : zero - width;
      return h(
        "li",
        { class: item.highlight ? "bar-row highlight" : "bar-row", title: `${item.label}: ${format(item.value)}` },
        item.onClick
          ? h("button", { type: "button", class: "bar-label bar-button", "aria-pressed": item.pressed === undefined ? undefined : String(item.pressed), onclick: item.onClick }, item.label)
          : h("span", { class: "bar-label" }, item.label, item.note ? h("span", { class: "muted" }, ` · ${item.note}`) : null),
        h(
          "span",
          { class: "bar-track" },
          min < 0 ? h("span", { class: "bar-zero", style: `left:${zero}%` }) : null,
          h("span", { class: `bar-fill ${item.value >= 0 ? "pos" : "neg"} ${item.highlight ? "slot-2" : "slot-1"}`, style: `left:${left}%;width:${Math.max(width, 0.4)}%` }),
        ),
        h("span", { class: "bar-value" }, format(item.value)),
      );
    }),
  );
}
