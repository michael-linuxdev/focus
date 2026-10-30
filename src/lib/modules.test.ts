import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { importantCount, isModuleHabitDone, pendingReviews, suggestHabits } from "./modules"
import { sanitizeState } from "./persistence/local-storage"
import { createDemoState } from "./seed"
import { parseISODate } from "./dates"
import { HABIT_KEYS } from "./types"

const state = createDemoState(parseISODate("2026-10-30"))

describe("Vorschläge", () => {
  it("legt in zwei Minuten eine Gewohnheit pro Flügel nahe", () => {
    for (const pain of ["operational", "decisions", "boundaries"] as const) {
      const enabled = suggestHabits(pain, "light")
      const chosen = HABIT_KEYS.filter((key) => enabled[key])
      assert.equal(chosen.length, 3)
      assert.equal(enabled["strategy-block"] || enabled["deep-work"] || enabled["weekly-priorities"] || enabled.reflection, true)
      assert.equal(
        enabled["sleep-on-it"] || enabled["pro-contra"] || enabled["decision-budget"] || enabled["decision-review"],
        true,
      )
      assert.equal(enabled.shutdown || enabled["message-windows"] || enabled.recovery || enabled["said-no"], true)
    }
  })

  it("schaltet bei zehn Minuten alles ein", () => {
    const enabled = suggestHabits("boundaries", "deep")
    assert.ok(HABIT_KEYS.every((key) => enabled[key]))
  })
})

describe("Demodaten der neuen Module", () => {
  it("sind als Demo markiert und erzählen Budget, Nachlese und Energie", () => {
    assert.ok(state.decisions.length >= 12)
    assert.ok(state.decisions.every((decision) => decision.demo))
    assert.ok(state.moduleHabits.length > 40)
    assert.ok(state.moduleHabits.every((habit) => habit.demo))
    assert.ok(state.energyLogs.every((entry) => entry.demo))
    assert.ok(state.declines.every((entry) => entry.demo && entry.count > 0))

    const counts = new Map<string, number>()
    for (const decision of state.decisions) {
      if (decision.importance === "klein") continue
      counts.set(decision.date, (counts.get(decision.date) ?? 0) + 1)
    }
    const overloaded = [...counts.entries()].find(([, count]) => count >= 4)
    assert.ok(overloaded, "ein Tag sprengt das Budget")
    assert.equal(isModuleHabitDone(state, "decision-budget", overloaded[0]), false)
    assert.ok(importantCount(state, overloaded[0]) > state.settings.decisionBudget)

    const reviews = pendingReviews(state, "2026-10-30")
    assert.ok(reviews.some((decision) => decision.title.includes("Preisstrategie")))
    assert.ok(reviews.every((decision) => decision.date < "2026-10-30"))
  })
})

describe("Alte Speicherstände", () => {
  it("bietet die neuen Module einmal an und behält den Fokus", () => {
    const restored = sanitizeState({
      version: 1,
      timeBlocks: [],
      dailyHabits: [],
      weeklyPriorities: [],
      reflections: [],
      settings: { targetPercent: 55, strategyBlockMinutes: 60 },
    })
    assert.ok(restored)
    assert.equal(restored.onboarding.status, "offer")
    assert.equal(restored.onboarding.completed, false)
    assert.equal(restored.settings.targetPercent, 55)
    assert.equal(restored.settings.strategyBlockMinutes, 60)
    assert.equal(restored.settings.decisionBudget, 3)
    assert.equal(restored.settings.enabledHabits["strategy-block"], true)
    assert.equal(restored.settings.enabledHabits.shutdown, false)
    assert.deepEqual(restored.decisions, [])
    assert.equal(sanitizeState({ version: 2 }), null)
  })
})
