import { addDays, isWeekday, parseISODate, startOfISOWeek, toISODate } from "@/lib/dates"
import { minutesBetween } from "@/lib/time"
import {
  DEFAULT_SETTINGS,
  type AppState,
  type Category,
  type DailyHabit,
  type Reflection,
  type ReflectionScore,
  type TimeBlock,
  type WeeklyPriorities,
} from "@/lib/types"

type RawBlock = [start: string, end: string, category: Category, note: string]

interface Template {
  score: ReflectionScore
  blocks: RawBlock[]
}

interface DayPlan {
  blocks: RawBlock[]
  reflection: { score: ReflectionScore; note: string }
}

interface WeekPlan {
  offset: number
  days: DayPlan[]
  priorities: { items: [string, string, string]; done: [boolean, boolean, boolean] }
  sunday?: DayPlan
}

const meeting: Template = {
  score: 2,
  blocks: [
    ["08:30", "10:00", "operational", "Jour fixe Geschäftsleitung"],
    ["10:15", "11:30", "operational", "E-Mail, Freigaben, Rückrufe"],
    ["11:30", "12:30", "operational", "Abstimmung Personal"],
    ["13:30", "15:00", "operational", "Lenkungskreis Betrieb"],
    ["15:15", "16:15", "strategic", "Strategisches Fenster"],
    ["16:15", "17:45", "operational", "Nachsteuerung Vertrieb"],
  ],
}

const protectedDay: Template = {
  score: 4,
  blocks: [
    ["07:45", "09:15", "strategic", "Strategieblock"],
    ["09:30", "11:00", "operational", "Pipeline-Review Vertrieb"],
    ["11:15", "12:15", "operational", "Vertragsfreigaben"],
    ["13:30", "15:30", "strategic", "Schwerpunkt am Nachmittag"],
    ["15:45", "17:30", "operational", "Operative Abstimmung"],
  ],
}

const lateStrategic: Template = {
  score: 3,
  blocks: [
    ["08:30", "12:00", "operational", "Meetings am Vormittag"],
    ["13:00", "14:00", "operational", "Status Projekte"],
    ["14:00", "16:00", "strategic", "Strategische Ausarbeitung"],
    ["16:00", "17:30", "operational", "Rückfragen und Freigaben"],
  ],
}

const reactive: Template = {
  score: 1,
  blocks: [
    ["08:15", "10:00", "operational", "Krisenabstimmung"],
    ["10:00", "12:00", "operational", "Kundeneskalation"],
    ["13:00", "15:00", "operational", "Produktion und Lieferung"],
    ["15:00", "17:00", "operational", "Feuerwehr und E-Mail"],
    ["17:00", "17:45", "strategic", "Kurze Richtungsnotiz"],
  ],
}

const pureReactive: Template = {
  score: 1,
  blocks: [
    ["08:00", "10:00", "operational", "Dauerfeuer Kundenanfragen"],
    ["10:00", "12:30", "operational", "Sondertermine Betrieb"],
    ["13:30", "15:30", "operational", "Ad-hoc-Runden"],
    ["15:30", "17:30", "operational", "Liegengebliebenes Tagesgeschäft"],
  ],
}

const crisisHold: Template = {
  score: 3,
  blocks: [
    ["07:50", "09:20", "strategic", "Strategieblock trotz Lage"],
    ["09:30", "12:00", "operational", "Krisenruf mit dem Kunden"],
    ["13:00", "15:00", "operational", "Sonderfreigaben Produktion"],
    ["15:00", "17:30", "operational", "Nachsteuerung und Reporting"],
  ],
}

const strategyDay: Template = {
  score: 5,
  blocks: [
    ["07:30", "09:30", "strategic", "Ungestörter Strategieblock"],
    ["09:45", "11:15", "operational", "Führungsrunde"],
    ["11:15", "12:00", "operational", "Freigaben"],
    ["13:00", "15:00", "strategic", "Entscheidungsvorlage"],
    ["15:15", "17:00", "operational", "Laufendes Geschäft"],
  ],
}

const shortFriday: Template = {
  score: 4,
  blocks: [
    ["08:00", "09:30", "strategic", "Strategieblock"],
    ["09:45", "11:30", "operational", "Wochenausklang Führung"],
    ["11:30", "12:15", "operational", "Freigaben"],
    ["13:00", "14:30", "strategic", "Schwerpunkt zu Ende denken"],
  ],
}

function applyNotes(blocks: RawBlock[], strategic?: string[], operational?: string[]): RawBlock[] {
  let strategicIndex = 0
  let operationalIndex = 0
  return blocks.map((block) => {
    const [start, end, category, note] = block
    if (category === "strategic" && strategic?.[strategicIndex]) {
      const next = strategic[strategicIndex]
      strategicIndex += 1
      return [start, end, category, next]
    }
    if (category === "operational" && operational?.[operationalIndex]) {
      const next = operational[operationalIndex]
      operationalIndex += 1
      return [start, end, category, next]
    }
    return [start, end, category, note]
  })
}

function day(
  template: Template,
  reflection: string,
  notes?: { strategic?: string[]; operational?: string[] },
): DayPlan {
  return {
    blocks: applyNotes(template.blocks, notes?.strategic, notes?.operational),
    reflection: { score: template.score, note: reflection },
  }
}

const WEEKS: WeekPlan[] = [
  {
    offset: -5,
    days: [
      day(meeting, "Der Wochenstart gehörte den Runden. Für Richtung blieb ein kurzes Fenster.", {
        strategic: ["Wettbewerbsbeobachtung DACH"],
      }),
      day(protectedDay, "Strategieblock gehalten. Die Wachstumshebel sind zum ersten Mal auf einer Seite.", {
        strategic: ["Strategieblock: Wachstumshebel 2027", "Portfolio grob sortieren"],
      }),
      day(lateStrategic, "Der Vormittag war verplant. Am Nachmittag endlich das Marktbild.", {
        strategic: ["Marktbild DACH auf eine Seite"],
      }),
      day(meeting, "Wieder viel abgestimmt, wenig entschieden.", {
        strategic: ["Kurzer Blick auf zwei Wettbewerber"],
      }),
      day(shortFriday, "Freitag klarer als der Montag: drei Hebel, nicht zehn.", {
        strategic: ["Strategieblock: Hebel priorisieren", "Marktbild zu Ende schreiben"],
      }),
    ],
    priorities: {
      items: [
        "Marktbild DACH auf eine Seite verdichten",
        "Drei Wachstumshebel für 2027 benennen",
        "Führungsrunde auf die Hebel ausrichten",
      ],
      done: [true, true, false],
    },
  },
  {
    offset: -4,
    days: [
      day(reactive, "Key-Account-Krise ab dem Morgen. Strategie nur noch als Notiz am Abend.", {
        strategic: ["Was von der Richtung trotzdem gilt"],
      }),
      day(pureReactive, "Durchgehend reagiert. Kein Block, der den Namen Strategie verdient."),
      day(crisisHold, "Block trotz Lage gehalten — und danach nur noch den Ausfall abgearbeitet.", {
        strategic: ["Strategieblock: nicht die Woche verlieren"],
      }),
      day(meeting, "Lenkungskreis über den Lieferausfall. Richtung kam kaum vor.", {
        strategic: ["Risiko in eine Entscheidung übersetzen"],
      }),
      day(reactive, "Auch der Freitag blieb im Krisenmodus.", {
        strategic: ["Kurze Notiz für die Vorstandsvorlage"],
      }),
    ],
    priorities: {
      items: [
        "Krisenkommunikation mit dem Key Account führen",
        "Lieferausfall begrenzen, ohne die Strategie zu opfern",
        "Strategieblock trotz Lage schützen",
      ],
      done: [true, false, false],
    },
  },
  {
    offset: -3,
    days: [
      day(meeting, "Zurück im normalen Takt. Der Montag ist trotzdem fast nur operativ.", {
        strategic: ["Nachlese Krise: was strukturell war"],
      }),
      day(protectedDay, "Der geschützte Vormittag hat die Portfoliofrage wieder geöffnet.", {
        strategic: ["Strategieblock: Portfolio schärfen", "Ein Angebot stoppen, eines skalieren"],
      }),
      day(protectedDay, "Zweiter geschützter Tag. Die Preisannahmen sind nicht mehr Bauchgefühl.", {
        strategic: ["Strategieblock: Preislogik Industrie", "Annahmen mit dem Finanzbereich geprüft"],
      }),
      day(lateStrategic, "Vormittag verplant, Nachmittag tragfähig. Nicht ideal, aber gestaltet.", {
        strategic: ["Bereichsleitung Vertrieb: Profil schärfen"],
      }),
      day(shortFriday, "Die Woche endet mit einer Entscheidung, nicht mit einer Liste.", {
        strategic: ["Strategieblock: Entscheidung formulieren", "Portfolio auf eine Folie"],
      }),
    ],
    priorities: {
      items: [
        "Portfolio: ein Angebot skalieren, eines stoppen",
        "Preisannahmen Industriegeschäft prüfen",
        "Bereichsleitung Vertrieb entscheiden",
      ],
      done: [true, true, false],
    },
  },
  {
    offset: -2,
    days: [
      day(protectedDay, "Starke Woche, bewusst so gelegt. Der Montag beginnt mit Richtung.", {
        strategic: ["Strategieblock: zwei Wachstumsoptionen", "Vergleichskriterien festlegen"],
      }),
      day(strategyDay, "Selten so klar gestaltet. Die Vorstandsvorlage hat einen roten Faden.", {
        strategic: ["Strategieblock: Vorstandsvorlage", "Optionen auf fünf Seiten kürzen"],
      }),
      day(protectedDay, "Organisationsschnitt Vertrieb ist skizziert, noch nicht entschieden.", {
        strategic: ["Strategieblock: Schnitt Vertrieb/Marketing", "Offene Fragen für die Führungsrunde"],
      }),
      day(strategyDay, "Entscheidungsvorlage steht. Operatives blieb im Rahmen.", {
        strategic: ["Strategieblock: Vorlage gegenlesen", "Empfehlung in einem Satz"],
      }),
      day(shortFriday, "Die Woche schließt mit einer Empfehlung, nicht mit einem Stapel.", {
        strategic: ["Strategieblock: Empfehlung festziehen", "Was der Vorstand entscheiden soll"],
      }),
    ],
    priorities: {
      items: [
        "Zwei Wachstumsoptionen vergleichbar machen",
        "Vorstandsvorlage auf fünf Seiten kürzen",
        "Organisationsschnitt Vertrieb skizzieren",
      ],
      done: [true, true, true],
    },
    sunday: {
      blocks: [["18:00", "19:30", "strategic", "Ungestörte Vorbereitung der Vorstandsvorlage"]],
      reflection: {
        score: 5,
        note: "Sonntagabend, endlich ohne Unterbrechung an der Vorlage.",
      },
    },
  },
  {
    offset: -1,
    days: [
      day(meeting, "Nach der starken Woche wieder ein Montag aus Terminen.", {
        strategic: ["Key-Account-Plan nur angerissen"],
      }),
      day(crisisHold, "Block gehalten, danach ein Kundenproblem, das den Tag gefressen hat.", {
        strategic: ["Strategieblock: Lieferkettenrisiko"],
      }),
      day(meeting, "Viel Reporting, wenig Richtung. Der Anteil rutscht.", {
        strategic: ["Kurzer Schnitt zu den drei Prozessen für KI"],
      }),
      day(lateStrategic, "Erst am Nachmittag wieder gestaltend. Zu spät für einen ruhigen Kopf.", {
        strategic: ["KI-Einsatz auf drei Prozesse eingrenzen"],
      }),
      day(protectedDay, "Freitag zurück im Block. Der Key-Account-Plan ist endlich fertig.", {
        strategic: ["Strategieblock: Key-Account-Plan Nord", "Offene Punkte mit Vertrieb schließen"],
      }),
    ],
    priorities: {
      items: [
        "Key-Account-Plan Nord abschließen",
        "Lieferkettenrisiko in eine Entscheidung übersetzen",
        "KI-Einsatz auf drei Prozesse eingrenzen",
      ],
      done: [true, false, true],
    },
  },
  {
    offset: 0,
    days: [
      day(meeting, "Der Wochenstart ging an Jour fixe und Lenkungskreis. Für Richtung blieb ein Fenster.", {
        strategic: ["Wettbewerbsbeobachtung DACH — nur angerissen"],
        operational: [
          "Jour fixe Geschäftsleitung",
          "E-Mail und Freigaben",
          "Kundeneskalation Key Account Nord",
          "Lenkungskreis Lieferkette",
          "Abstimmung Vertrieb",
        ],
      }),
      day(protectedDay, "Der Strategieblock hat gehalten. Am Nachmittag wurde aus dem Portfolio eine echte Frage.", {
        strategic: ["Strategieblock: Jahresplanung 2027", "Portfolio: welches Angebot skalieren"],
        operational: ["Pipeline-Review Vertrieb", "Vertragsfreigaben Industrie", "Recruiting Bereichsleitung"],
      }),
      day(strategyDay, "Vormittag ungestört an der Entscheidungsvorlage. Das ist der Tag, den es zu schützen gilt.", {
        strategic: ["Strategieblock: Wachstumsoptionen für den Vorstand", "Preisstrategie Industriegeschäft"],
        operational: ["Führungsrunde operativ", "Freigaben", "Monatsreporting Finanzen"],
      }),
      day(crisisHold, "Block trotz Krisenlage gehalten — danach nur noch reagiert.", {
        strategic: ["Strategieblock trotz Kundenkrise"],
        operational: ["Krisenruf mit dem Kunden", "Sonderfreigaben Produktion", "Nachsteuerung und E-Mail"],
      }),
      day(shortFriday, "Die Preisfrage ist entscheidungsreif. Der Nachmittag war kurz und klar.", {
        strategic: ["Strategieblock: Organisationsschnitt Vertrieb", "KI auf drei Kernprozesse eingrenzen"],
        operational: ["Führungsrunde zum Wochenabschluss", "Freigaben"],
      }),
    ],
    priorities: {
      items: [
        "Jahresplanung 2027 auf eine Seite bringen",
        "Preisstrategie Industriegeschäft entscheiden",
        "Organisationsschnitt Vertrieb festlegen",
      ],
      done: [true, true, false],
    },
  },
]

function stamp(date: string): string {
  return `${date}T12:00:00.000Z`
}

function toTimeBlocks(date: string, blocks: RawBlock[]): TimeBlock[] {
  return blocks.map((block, index) => {
    const [start, end, category, note] = block
    const duration = minutesBetween(start, end)
    if (duration === null) {
      throw new Error(`Ungültiger Demoblock ${date} ${start}–${end}`)
    }
    return {
      id: `demo-block-${date}-${index}`,
      date,
      start,
      end,
      durationMinutes: duration,
      category,
      note,
      demo: true,
      createdAt: stamp(date),
      updatedAt: stamp(date),
    }
  })
}

function pushDay(
  date: string,
  plan: DayPlan,
  timeBlocks: TimeBlock[],
  dailyHabits: DailyHabit[],
  reflections: Reflection[],
  todayIso: string,
) {
  if (date > todayIso) return
  const blocks = toTimeBlocks(date, plan.blocks)
  timeBlocks.push(...blocks)
  reflections.push({
    id: `demo-reflection-${date}`,
    date,
    score: plan.reflection.score,
    note: plan.reflection.note,
    demo: true,
    updatedAt: stamp(date),
  })
  if (!isWeekday(parseISODate(date))) return
  const strategic = blocks.filter((block) => block.category === "strategic")
  if (strategic.some((block) => block.durationMinutes >= DEFAULT_SETTINGS.strategyBlockMinutes)) {
    dailyHabits.push({
      id: `demo-habit-strategy-block-${date}`,
      kind: "strategy-block",
      date,
      done: true,
      demo: true,
      updatedAt: stamp(date),
    })
  }
  if (strategic.some((block) => block.start !== null && block.start < "10:00")) {
    dailyHabits.push({
      id: `demo-habit-deep-work-${date}`,
      kind: "deep-work",
      date,
      done: true,
      demo: true,
      updatedAt: stamp(date),
    })
  }
}

export function createDemoState(today: Date): AppState {
  const todayIso = toISODate(today)
  const currentMonday = startOfISOWeek(today)
  const timeBlocks: TimeBlock[] = []
  const dailyHabits: DailyHabit[] = []
  const weeklyPriorities: WeeklyPriorities[] = []
  const reflections: Reflection[] = []

  for (const week of WEEKS) {
    const monday = addDays(currentMonday, week.offset * 7)
    const mondayIso = toISODate(monday)
    if (mondayIso > todayIso) continue
    week.days.forEach((plan, index) => {
      const date = toISODate(addDays(monday, index))
      pushDay(date, plan, timeBlocks, dailyHabits, reflections, todayIso)
    })
    if (week.sunday) {
      pushDay(toISODate(addDays(monday, 6)), week.sunday, timeBlocks, dailyHabits, reflections, todayIso)
    }
    if (mondayIso <= todayIso) {
      weeklyPriorities.push({
        id: `demo-priorities-${mondayIso}`,
        weekStart: mondayIso,
        items: week.priorities.items,
        done: week.priorities.done,
        demo: true,
        updatedAt: stamp(mondayIso),
      })
    }
  }

  timeBlocks.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? ""))

  return {
    version: 1,
    timeBlocks,
    dailyHabits,
    weeklyPriorities,
    reflections,
    settings: { ...DEFAULT_SETTINGS },
  }
}
