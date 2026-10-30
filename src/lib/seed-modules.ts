import { addDays, startOfISOWeek, toISODate } from "@/lib/dates"
import type { Decision, DecisionImportance, EnergyLevel, EnergyLog, DeclineLog, ModuleHabit, ModuleHabitKind } from "@/lib/types"

const SHUTDOWN: Record<number, readonly boolean[]> = {
  [-5]: [true, true, true, true, false],
  [-4]: [false, false, false, false, true],
  [-3]: [true, true, true, true, true],
  [-2]: [true, true, true, true, true],
  [-1]: [true, true, false, true, false],
  [0]: [true, false, false, false, true],
}

const WINDOWS: Record<number, readonly boolean[]> = {
  [-5]: [true, true, false, true, true],
  [-4]: [false, false, true, false, false],
  [-3]: [true, true, true, true, false],
  [-2]: [true, true, true, true, true],
  [-1]: [true, true, true, false, true],
  [0]: [true, true, true, true, false],
}

const BUDGET: Record<number, readonly boolean[]> = {
  [-5]: [true, true, true, true, true],
  [-4]: [true, true, false, true, true],
  [-3]: [true, true, true, true, true],
  [-2]: [true, true, true, true, true],
  [-1]: [true, true, true, true, true],
  [0]: [true, true, true, true, true],
}

const ENERGY: Record<number, readonly EnergyLevel[]> = {
  [-5]: [3, 3, 4, 3, 3],
  [-4]: [2, 1, 2, 1, 2],
  [-3]: [2, 3, 3, 4, 4],
  [-2]: [4, 5, 4, 5, 5],
  [-1]: [3, 4, 3, 3, 4],
  [0]: [3, 4, 3, 2, 3],
}

const DECLINES: Record<number, readonly number[]> = {
  [-5]: [1, 0, 1, 2, 0],
  [-4]: [0, 0, 0, 0, 0],
  [-3]: [2, 1, 0, 2, 1],
  [-2]: [3, 2, 4, 1, 3],
  [-1]: [1, 2, 0, 1, 2],
  [0]: [1, 0, 2, 1, 0],
}

const RECOVERY: Array<{ offset: number; day: number }> = [
  { offset: -5, day: 1 },
  { offset: -5, day: 4 },
  { offset: -3, day: 0 },
  { offset: -3, day: 2 },
  { offset: -3, day: 3 },
  { offset: -2, day: 2 },
  { offset: -2, day: 4 },
  { offset: -1, day: 1 },
]

interface DemoDecisionSpec {
  offset: number
  day: number
  title: string
  importance: DecisionImportance
  sleptOn: boolean
  proContra: boolean
  learning: string
}

const DEMO_DECISIONS: DemoDecisionSpec[] = [
  {
    offset: -5,
    day: 1,
    title: "Wachstumshebel 2027 auf drei verdichten",
    importance: "gross",
    sleptOn: true,
    proContra: true,
    learning: "Weniger Hebel, klarere Führung.",
  },
  {
    offset: -5,
    day: 3,
    title: "Führungsrunde auf die Hebel ausrichten",
    importance: "wichtig",
    sleptOn: true,
    proContra: true,
    learning: "Die Runde braucht eine Seite, nicht zehn.",
  },
  {
    offset: -4,
    day: 2,
    title: "Sonderfreigabe für den Key Account",
    importance: "wichtig",
    sleptOn: false,
    proContra: false,
    learning: "Unter Druck entschieden, ohne die Strategie zu prüfen.",
  },
  {
    offset: -4,
    day: 2,
    title: "Lieferant wechseln oder nachverhandeln",
    importance: "gross",
    sleptOn: false,
    proContra: false,
    learning: "",
  },
  {
    offset: -4,
    day: 2,
    title: "Zusätzliche Krisenrunde am selben Tag",
    importance: "wichtig",
    sleptOn: false,
    proContra: false,
    learning: "",
  },
  {
    offset: -4,
    day: 2,
    title: "Kurzfristiger Preisnachlass",
    importance: "wichtig",
    sleptOn: false,
    proContra: false,
    learning: "Der Nachlass hat die Krise nicht gelöst.",
  },
  {
    offset: -3,
    day: 1,
    title: "Ein Angebot stoppen, eines skalieren",
    importance: "gross",
    sleptOn: true,
    proContra: true,
    learning: "Stoppen wurde leicht, als die Annahmen auf einer Seite standen.",
  },
  {
    offset: -3,
    day: 4,
    title: "Profil der Bereichsleitung Vertrieb",
    importance: "wichtig",
    sleptOn: true,
    proContra: true,
    learning: "Das Profil folgt der Strategie, nicht der Vakanz.",
  },
  {
    offset: -2,
    day: 0,
    title: "Vorstandsvorlage auf eine Empfehlung kürzen",
    importance: "gross",
    sleptOn: true,
    proContra: true,
    learning: "Eine Empfehlung schlägt drei offene Optionen.",
  },
  {
    offset: -2,
    day: 3,
    title: "Organisationsschnitt Vertrieb festlegen",
    importance: "wichtig",
    sleptOn: true,
    proContra: true,
    learning: "Der Schnitt folgt der Kundenlogik, nicht der Historie.",
  },
  {
    offset: -1,
    day: 2,
    title: "Lieferkettenrisiko in eine Entscheidung übersetzen",
    importance: "wichtig",
    sleptOn: true,
    proContra: false,
    learning: "Eine Nacht hat gereicht. Die Liste hätte es klarer gemacht.",
  },
  {
    offset: -1,
    day: 4,
    title: "KI-Einsatz auf drei Prozesse begrenzen",
    importance: "wichtig",
    sleptOn: true,
    proContra: true,
    learning: "Alles darüber hinaus ist Spielerei.",
  },
  {
    offset: 0,
    day: 1,
    title: "Reise zur Messe freigeben",
    importance: "klein",
    sleptOn: false,
    proContra: false,
    learning: "",
  },
  {
    offset: 0,
    day: 2,
    title: "Preisstrategie Industriegeschäft",
    importance: "gross",
    sleptOn: true,
    proContra: true,
    learning: "",
  },
  {
    offset: 0,
    day: 3,
    title: "Ad-hoc-Zusage an einen Lieferanten",
    importance: "wichtig",
    sleptOn: false,
    proContra: false,
    learning: "",
  },
  {
    offset: 0,
    day: 4,
    title: "Jahresplanung auf eine Seite bringen",
    importance: "wichtig",
    sleptOn: false,
    proContra: true,
    learning: "",
  },
]

function stamp(date: string): string {
  return `${date}T12:00:00.000Z`
}

function habit(kind: ModuleHabitKind, date: string): ModuleHabit {
  return {
    id: `demo-habit-${kind}-${date}`,
    kind,
    date,
    done: true,
    demo: true,
    updatedAt: stamp(date),
  }
}

export function demoHabitsForDay(offset: number, dayIndex: number, date: string): ModuleHabit[] {
  if (dayIndex < 0 || dayIndex > 4) return []
  const habits: ModuleHabit[] = []
  if (SHUTDOWN[offset]?.[dayIndex]) habits.push(habit("shutdown", date))
  if (WINDOWS[offset]?.[dayIndex]) habits.push(habit("message-windows", date))
  if (BUDGET[offset]?.[dayIndex]) habits.push(habit("decision-budget", date))
  if (RECOVERY.some((item) => item.offset === offset && item.day === dayIndex)) habits.push(habit("recovery", date))
  return habits
}

export function demoEnergy(offset: number, dayIndex: number, date: string): EnergyLog | null {
  const level = ENERGY[offset]?.[dayIndex]
  if (!level) return null
  return { id: `demo-energy-${date}`, date, level, demo: true, updatedAt: stamp(date) }
}

export function demoDecline(offset: number, dayIndex: number, date: string): DeclineLog | null {
  const count = DECLINES[offset]?.[dayIndex] ?? 0
  if (count <= 0) return null
  return { id: `demo-decline-${date}`, date, count, demo: true, updatedAt: stamp(date) }
}

export function demoDecisions(today: Date): { decisions: Decision[]; habits: ModuleHabit[] } {
  const todayIso = toISODate(today)
  const monday = startOfISOWeek(today)
  const decisions: Decision[] = []
  const habits: ModuleHabit[] = []
  const seen = new Set<string>()

  function addHabit(kind: ModuleHabitKind, date: string) {
    const key = `${kind}|${date}`
    if (seen.has(key)) return
    seen.add(key)
    habits.push(habit(kind, date))
  }

  DEMO_DECISIONS.forEach((spec, index) => {
    const date = toISODate(addDays(addDays(monday, spec.offset * 7), spec.day))
    if (date > todayIso) return
    const at = stamp(date)
    decisions.push({
      id: `demo-decision-${index}`,
      title: spec.title,
      importance: spec.importance,
      date,
      sleptOn: spec.sleptOn,
      proContra: spec.proContra,
      learning: spec.learning,
      demo: true,
      createdAt: at,
      updatedAt: at,
    })
    if (spec.sleptOn) addHabit("sleep-on-it", date)
    if (spec.proContra) addHabit("pro-contra", date)
    if (spec.learning.trim()) addHabit("decision-review", date)
  })

  return { decisions, habits }
}
