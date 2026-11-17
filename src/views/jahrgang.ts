// „Mein Jahrgang“: der eigene Geburtsjahrgang in Zahlen – Geburten, heutige Größe, Lebenserwartung, Alterung.
import { birthRank, cohortPath, largestAge, oldAgeRatio } from "../lib/cohort.ts";
import { formatNumber, formatSigned } from "../lib/format.ts";
import { valueAt } from "../lib/stats.ts";
import type { CohortData, Point } from "../lib/types.ts";
import { loadCohorts } from "../state.ts";
import { legend, lineChart } from "../ui/chart.ts";
import { h, set } from "../ui/dom.ts";

const STORAGE_KEY = "lagebild.jahrgang";
const whole = (value: number): string => formatNumber(value, 0);
const jan = (year: number): number => Date.UTC(year, 0, 1);

function readYear(): number | null {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(stored) && stored > 1900 ? stored : null;
  } catch {
    return null;
  }
}

function fact(label: string, value: string, text: string): HTMLElement {
  return h("div", { class: "panel" }, h("div", { class: "muted small" }, label), h("div", { class: "big" }, value), h("p", { class: "small", style: "margin-top:6px;color:var(--ink-2)" }, text));
}

export function viewJahrgang(params: URLSearchParams): HTMLElement {
  const body = h("div", {}, h("p", { class: "muted" }, "Daten werden geladen …"));
  const root = h(
    "div",
    {},
    h("h1", {}, "Mein Jahrgang"),
    h("p", { class: "lead" }, "Gib dein Geburtsjahr ein und sieh, wie groß dein Jahrgang war und ist, welche Lebenserwartung die Statistik nennt und wie sich die Altersstruktur seit deiner Geburt verschoben hat."),
    body,
  );

  loadCohorts().then(
    (data: CohortData) => {
      const firstBirth = data.births[0]![0];
      const lastBirth = data.births[data.births.length - 1]![0];
      const lastYear = data.years[data.years.length - 1]!;
      const firstYear = data.years[0]!;
      const requested = Number(params.get("j"));
      let birthYear = Number.isInteger(requested) && requested >= firstBirth && requested <= lastBirth ? requested : (readYear() ?? 1985);
      birthYear = Math.min(Math.max(birthYear, firstBirth), lastBirth);
      const ratio = oldAgeRatio(data);
      const largest = largestAge(data);

      const output = h("div", {});
      const render = (): void => {
        const age = lastYear - birthYear;
        const rank = birthRank(data, birthYear);
        const path = cohortPath(data, birthYear);
        const today = path[path.length - 1];
        const facts: HTMLElement[] = [];

        if (rank) {
          facts.push(
            fact(
              `Geboren ${birthYear}`,
              whole(rank.births),
              `Kinder kamen in diesem Jahr in Deutschland zur Welt. Unter den ${rank.of} Jahrgängen seit ${firstBirth} ist das Platz ${rank.rank}${rank.rank === 1 ? " – der geburtenstärkste" : rank.rank === rank.of ? " – der geburtenschwächste" : ""}.`,
            ),
          );
        }
        if (today && rank && age < 85) {
          const diff = (today[1] / rank.births - 1) * 100;
          facts.push(
            fact(
              `Ende ${lastYear}: ${age} Jahre alt`,
              whole(today[1]),
              `Menschen dieses Jahrgangs leben in Deutschland, ${formatSigned(diff, 1)} % gegenüber den damals Geborenen. Die Differenz ist der Saldo aus Zuzügen, Fortzügen und Sterbefällen.`,
            ),
          );
        } else if (age >= 85) {
          facts.push(fact(`Ende ${lastYear}: ${age} Jahre alt`, "85 und älter", "Die Statistik fasst alle ab 85 Jahren zu einer Gruppe zusammen; ein einzelner Jahrgang lässt sich dort nicht mehr ablesen."));
        }
        const male = data.remaining.male[Math.min(age, data.remaining.male.length - 1)];
        const female = data.remaining.female[Math.min(age, data.remaining.female.length - 1)];
        if (male !== undefined && female !== undefined && age >= 0) {
          facts.push(
            fact(
              `Fernere Lebenserwartung mit ${age} Jahren`,
              `${formatNumber(female, 1)} / ${formatNumber(male, 1)} Jahre`,
              `Frauen / Männer, nach der Sterbetafel ${data.remaining.period}. Das ist keine Prognose: Die Tafel rechnet mit den heutigen Sterblichkeitsverhältnissen; sinkt die Sterblichkeit weiter, leben die Jüngeren im Schnitt länger.`,
            ),
          );
        }
        const ratioThen = birthYear >= firstYear ? valueAt(ratio, jan(birthYear)) : ratio[0]![1];
        const ratioNow = ratio[ratio.length - 1]![1];
        if (ratioThen !== null) {
          facts.push(
            fact(
              "Ältere je 100 Menschen im Erwerbsalter",
              `${formatNumber(ratioThen, 0)} → ${formatNumber(ratioNow, 0)}`,
              `${birthYear >= firstYear ? `In deinem Geburtsjahr` : `${firstYear} (frühere Werte liegen nicht vor)`} kamen ${formatNumber(ratioThen, 1)} Menschen ab 65 auf 100 Menschen von 20 bis 64, Ende ${lastYear} sind es ${formatNumber(ratioNow, 1)}.`,
            ),
          );
        }

        const birthsLine: Point[] = data.births.map(([year, value]) => [jan(year), value / 1000]);
        set(
          output,
          h("div", { class: "cols" }, ...facts),
          h(
            "div",
            { class: "cols" },
            path.length > 1
              ? h(
                  "div",
                  { class: "panel" },
                  h("h3", {}, `Jahrgang ${birthYear} über die Zeit`),
                  h("p", { class: "muted small" }, `Menschen dieses Jahrgangs in Deutschland, in Tausend, jeweils am 31. Dezember${birthYear < firstYear ? `. Altersjahre liegen erst ab ${firstYear} vor` : ""}. Anstiege kommen von Zuwanderung, Rückgänge von Fortzügen und Sterbefällen.`),
                  lineChart({ series: [{ name: `Jahrgang ${birthYear}`, slot: 1, data: path.map(([t, v]) => [t, v / 1000]) }], frequency: "jährlich", decimals: 0, unit: "Tsd.", height: 240, label: `Größe des Jahrgangs ${birthYear} je Jahr` }),
                )
              : null,
            h(
              "div",
              { class: "panel" },
              h("h3", {}, "Geburten je Jahr"),
              h(
                "p",
                { class: "muted small" },
                `Lebendgeborene in Tausend.${rank ? ` ${birthYear}: ${whole(rank.births / 1000)} Tausend.` : ""}${largest ? ` Am stärksten besetzt sind Ende ${lastYear} die ${largest.age}-Jährigen (Jahrgang ${largest.birthYear}, ${whole(largest.count / 1000)} Tausend).` : ""}`,
              ),
              lineChart({ series: [{ name: "Lebendgeborene", slot: 1, data: birthsLine }], frequency: "jährlich", decimals: 0, unit: "Tsd.", height: 240, label: "Lebendgeborene je Jahr in Tausend" }),
            ),
          ),
          h(
            "div",
            { class: "cols" },
            h(
              "div",
              { class: "panel" },
              h("h3", {}, "Lebenserwartung bei Geburt"),
              h("p", { class: "muted small" }, "In Jahren, nach den Sterbetafeln über jeweils drei Jahre; aufgetragen am letzten Jahr des Zeitraums."),
              legend([{ name: "Frauen", slot: 1 }, { name: "Männer", slot: 2 }]),
              lineChart({
                series: [
                  { name: "Frauen", slot: 1, data: data.atBirth.female.map(([year, v]) => [jan(year), v]) },
                  { name: "Männer", slot: 2, data: data.atBirth.male.map(([year, v]) => [jan(year), v]) },
                ],
                frequency: "jährlich",
                decimals: 1,
                unit: "Jahre",
                height: 240,
                label: "Lebenserwartung bei Geburt, Frauen und Männer",
              }),
            ),
            h(
              "div",
              { class: "panel" },
              h("h3", {}, "Ältere je 100 Menschen im Erwerbsalter"),
              h("p", { class: "muted small" }, "Menschen ab 65 Jahren je 100 Menschen von 20 bis 64 Jahren (Altenquotient), jeweils am 31. Dezember."),
              lineChart({ series: [{ name: "Altenquotient", slot: 1, data: ratio }], frequency: "jährlich", decimals: 1, unit: "", height: 240, label: "Altenquotient je Jahr" }),
            ),
          ),
        );
      };

      const input = h("input", { type: "number", min: firstBirth, max: lastBirth, step: 1, value: birthYear, "aria-label": "Geburtsjahr" });
      const hint = h("span", { class: "muted small" }, `${firstBirth} bis ${lastBirth}`);
      input.addEventListener("input", () => {
        const value = Number(input.value);
        if (!Number.isInteger(value) || value < firstBirth || value > lastBirth) return;
        birthYear = value;
        try {
          localStorage.setItem(STORAGE_KEY, String(value));
        } catch {
          // Ohne Speicher gilt die Eingabe nur bis zum Neuladen.
        }
        history.replaceState(null, "", `#/jahrgang?j=${value}`);
        render();
      });

      set(
        body,
        h("div", { class: "filters" }, h("label", { class: "field" }, "Geburtsjahr", input), hint),
        output,
        h(
          "p",
          { class: "muted small" },
          "Quelle: Statistisches Bundesamt (Destatis), GENESIS-Online, Tabellen 12612-0001 (Geburten), 12411-0005 (Bevölkerung nach Altersjahren) und 12621-0002 (Sterbetafeln). Das Geburtsjahr bleibt nur in diesem Browser gespeichert.",
        ),
      );
      render();
    },
    (error: unknown) => set(body, h("p", { class: "note" }, String(error))),
  );
  return root;
}
