type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

const SVG_NS = "http://www.w3.org/2000/svg";

function apply(el: Element, attrs: Attrs, children: Child[]): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === "function") el.addEventListener(key.replace(/^on/, ""), value);
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    // Texte kommen aus der API und werden nie als HTML eingesetzt.
    el.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  apply(el, attrs, children);
  return el;
}

export function s(tag: string, attrs: Attrs = {}, ...children: Child[]): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, attrs, children);
  return el;
}

/** Ersetzt den Inhalt eines Elements; leere Einträge werden übergangen. */
export function set(el: Element, ...children: Child[]): void {
  el.replaceChildren(...children.filter((c): c is Node | string => c !== null && c !== undefined && c !== false));
}
