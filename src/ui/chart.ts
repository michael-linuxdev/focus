// Liniendiagramm als SVG: eine gemeinsame Achse, Fadenkreuz mit Wertefenster, Tastaturbedienung.
import { formatDate, formatNumber } from "../lib/format.ts";
import { niceTicks, thin } from "../lib/stats.ts";
import type { Frequency, Point } from "../lib/types.ts";
import { h, s } from "./dom.ts";

export interface ChartSeries {
  name: string;
  /** Farbplatz 1 bis 8, gehört fest zur Reihe. */
  slot: number;
  data: Point[];
}

export interface ChartOptions {
  series: ChartSeries[];
  frequency: Frequency;
  decimals: number;
  unit: string;
  height?: number;
  /** Kurzbeschreibung für Screenreader. */
  label: string;
}

const MARGIN = { top: 12, right: 16, bottom: 26, left: 52 };

function nearest(data: Point[], time: number): Point | null {
  if (data.length === 0) return null;
  let lo = 0;
  let hi = data.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (data[mid]![0] <= time) lo = mid;
    else hi = mid;
  }
  return Math.abs(data[lo]![0] - time) <= Math.abs(data[hi]![0] - time) ? data[lo]! : data[hi]!;
}

function yearTicks(from: number, to: number, width: number): number[] {
  const first = new Date(from).getUTCFullYear();
  const last = new Date(to).getUTCFullYear();
  const maxTicks = Math.max(2, Math.floor(width / 64));
  const step = [1, 2, 5, 10, 20, 50].find((st) => (last - first) / st <= maxTicks) ?? 50;
  const ticks: number[] = [];
  for (let y = Math.ceil(first / step) * step; y <= last; y += step) {
    const t = Date.UTC(y, 0, 1);
    if (t >= from && t <= to) ticks.push(t);
  }
  return ticks;
}

export function lineChart(options: ChartOptions): HTMLElement {
  const root = h("div", { class: "chart" });
  const tooltip = h("div", { class: "chart-tip", hidden: true });
  const series = options.series.filter((sr) => sr.data.length > 0);
  const height = options.height ?? 300;

  if (series.length === 0) {
    root.append(h("p", { class: "muted" }, "Für diesen Zeitraum liegen keine Werte vor."));
    return root;
  }

  const times = [...new Set(series.flatMap((sr) => sr.data.map((p) => p[0])))].sort((a, b) => a - b);
  const t0 = times[0]!;
  const t1 = times[times.length - 1]!;
  const values = series.flatMap((sr) => sr.data.map((p) => p[1]));
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.06;
  // Die Achse beginnt bei null, wenn die Werte ohnehin in deren Nähe liegen.
  const yMin = lo >= 0 && lo < (hi - lo) * 0.6 ? 0 : lo - pad;
  const yMax = hi + pad;
  const ticks = niceTicks(yMin, yMax, 4);
  const tickDecimals = ticks.some((t) => !Number.isInteger(t)) ? Math.max(1, Math.min(options.decimals, 2)) : 0;

  let active = times.length - 1;

  function draw(): void {
    const width = Math.max(280, root.clientWidth || 640);
    const iw = width - MARGIN.left - MARGIN.right;
    const ih = height - MARGIN.top - MARGIN.bottom;
    const x = (t: number) => MARGIN.left + (t1 === t0 ? iw / 2 : ((t - t0) / (t1 - t0)) * iw);
    const y = (v: number) => MARGIN.top + ih - ((v - yMin) / (yMax - yMin)) * ih;

    const svg = s("svg", {
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: "img",
      tabindex: 0,
      "aria-label": `${options.label}. Mit den Pfeiltasten lassen sich die Werte ablesen.`,
    });

    for (const tick of ticks) {
      svg.append(
        s("line", { class: "grid", x1: MARGIN.left, x2: width - MARGIN.right, y1: y(tick), y2: y(tick) }),
        s("text", { class: "tick", x: MARGIN.left - 8, y: y(tick) + 4, "text-anchor": "end" }, formatNumber(tick, tickDecimals)),
      );
    }
    if (yMin < 0 && yMax > 0) {
      svg.append(s("line", { class: "baseline", x1: MARGIN.left, x2: width - MARGIN.right, y1: y(0), y2: y(0) }));
    }
    for (const tick of yearTicks(t0, t1, iw)) {
      svg.append(s("text", { class: "tick", x: x(tick), y: height - 6, "text-anchor": "middle" }, String(new Date(tick).getUTCFullYear())));
    }

    for (const sr of series) {
      const pts = thin(sr.data, Math.max(200, Math.round(iw * 1.5)));
      const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
      svg.append(s("path", { class: `line slot-${sr.slot}`, d }));
      const end = sr.data[sr.data.length - 1]!;
      svg.append(s("circle", { class: `dot slot-${sr.slot}`, cx: x(end[0]), cy: y(end[1]), r: 4 }));
    }

    const cross = s("line", { class: "cross", y1: MARGIN.top, y2: MARGIN.top + ih, visibility: "hidden" });
    const marks = series.map((sr) => s("circle", { class: `dot slot-${sr.slot}`, r: 4, visibility: "hidden" }));
    svg.append(cross, ...marks);

    function show(index: number): void {
      active = Math.max(0, Math.min(times.length - 1, index));
      const time = times[active]!;
      cross.setAttribute("x1", String(x(time)));
      cross.setAttribute("x2", String(x(time)));
      cross.setAttribute("visibility", "visible");
      tooltip.replaceChildren(h("div", { class: "tip-date" }, formatDate(time, options.frequency)));
      // Eine Reihe erscheint nur, wenn sie nahe am gewählten Zeitpunkt einen Wert hat.
      const tolerance = Math.max((t1 - t0) / 60, 45 * 86_400_000);
      series.forEach((sr, i) => {
        const p = nearest(sr.data, time);
        const mark = marks[i]!;
        if (!p || Math.abs(p[0] - time) > tolerance) {
          mark.setAttribute("visibility", "hidden");
          return;
        }
        mark.setAttribute("cx", String(x(p[0])));
        mark.setAttribute("cy", String(y(p[1])));
        mark.setAttribute("visibility", "visible");
        tooltip.append(
          h(
            "div",
            { class: "tip-row" },
            h("span", { class: `key slot-${sr.slot}` }),
            h("strong", {}, formatNumber(p[1], options.decimals) + (options.unit ? ` ${options.unit}` : "")),
            h("span", { class: "tip-name" }, sr.name),
          ),
        );
      });
      tooltip.hidden = false;
      const left = x(time);
      const flip = left > width * 0.6;
      tooltip.style.left = flip ? "" : `${left + 12}px`;
      tooltip.style.right = flip ? `${width - left + 12}px` : "";
    }

    function hide(): void {
      cross.setAttribute("visibility", "hidden");
      for (const mark of marks) mark.setAttribute("visibility", "hidden");
      tooltip.hidden = true;
    }

    svg.addEventListener("pointermove", (event) => {
      const rect = svg.getBoundingClientRect();
      const time = t0 + ((event.clientX - rect.left - MARGIN.left) / iw) * (t1 - t0);
      let best = 0;
      let lo2 = 0;
      let hi2 = times.length - 1;
      while (hi2 - lo2 > 1) {
        const mid = (lo2 + hi2) >> 1;
        if (times[mid]! <= time) lo2 = mid;
        else hi2 = mid;
      }
      best = Math.abs(times[lo2]! - time) <= Math.abs(times[hi2]! - time) ? lo2 : hi2;
      show(best);
    });
    svg.addEventListener("pointerleave", hide);
    svg.addEventListener("blur", hide);
    svg.addEventListener("focus", () => show(active));
    svg.addEventListener("keydown", (event) => {
      const key = (event as KeyboardEvent).key;
      const stepSize = (event as KeyboardEvent).shiftKey ? 12 : 1;
      if (key === "ArrowLeft") show(active - stepSize);
      else if (key === "ArrowRight") show(active + stepSize);
      else if (key === "Home") show(0);
      else if (key === "End") show(times.length - 1);
      else return;
      event.preventDefault();
    });

    root.replaceChildren(svg, tooltip);
  }

  let lastWidth = 0;
  new ResizeObserver(() => {
    if (root.clientWidth !== lastWidth) {
      lastWidth = root.clientWidth;
      draw();
    }
  }).observe(root);
  draw();
  return root;
}

export function legend(series: { name: string; slot: number }[]): HTMLElement {
  return h(
    "ul",
    { class: "legend" },
    ...series.map((sr) => h("li", {}, h("span", { class: `key slot-${sr.slot}` }), sr.name)),
  );
}

export function sparkline(values: number[], width = 96, height = 32): SVGElement {
  const svg = s("svg", { class: "spark", viewBox: `0 0 ${width} ${height}`, width, height, "aria-hidden": "true" });
  if (values.length < 2) return svg;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i: number) => 4 + (i / (values.length - 1)) * (width - 8);
  const y = (v: number) => (hi === lo ? height / 2 : 4 + (1 - (v - lo) / (hi - lo)) * (height - 8));
  svg.append(
    s("path", { class: "line slot-1", d: values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("") }),
    s("circle", { class: "dot slot-1", cx: x(values.length - 1), cy: y(values[values.length - 1]!), r: 3 }),
  );
  return svg;
}
