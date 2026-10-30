import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseISODate, weekStartOffset } from "./dates"
import { dailyHabitStreak, isDailyHabitDone, priorityStreak } from "./habits"
import { createDemoState } from "./seed"
import { summarize } from "./stats"
import { minutesBetween } from "./time"
import { DEEP_WORK_BEFORE, DEFAULT_SETTINGS } from "./types"

const today = parseISODate("2026-10-30")
const state = createDemoState(today)

function weekPercent(offset: number): number | null {
  const start = weekStartOffset(today, offset)
  const endDate = new Date(parseISODate(start).getFullYear(), parseISODate(start).getMonth(), parseISODate(start).getDate() + 6)
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`
  return summarize(state.timeBlocks, start, end).percent
}

describe("Demodaten", () => {
  it("sind vollständig als Demo markiert und überlappen sich nicht", () => {
    assert.ok(state.timeBlocks.length > 100)
    assert.ok(state.timeBlocks.every((block) => block.demo))
    assert.ok(state.reflections.every((reflection) => reflection.demo))
    assert.ok(state.weeklyPriorities.every((week) => week.demo))
    const byDay = new Map<string, typeof state.timeBlocks>()
    for (const block of state.timeBlocks) {
      const duration = minutesBetween(block.start ?? "", block.end ?? "")
      assert.equal(duration, block.durationMinutes)
      const list = byDay.get(block.date) ?? []
      list.push(block)
      byDay.set(block.date, list)
    }
    for (const blocks of byDay.values()) {
      const sorted = [...blocks].sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
      for (let index = 1; index < sorted.length; index += 1) {
        assert.ok((sorted[index].start ?? "") >= (sorted[index - 1].end ?? ""))
      }
    }
  })

  it("erzählt sechs Wochen mit Schock, Erholung und einer starken Woche", () => {
    const crisis = weekPercent(-4)
    const strong = weekPercent(-2)
    const current = weekPercent(0)
    assert.ok(crisis !== null && crisis < 12, `Krisenwoche ${crisis}`)
    assert.ok(strong !== null && strong > 48, `Starke Woche ${strong}`)
    assert.ok(current !== null && current > 32 && current < 38, `Aktuelle Woche ${current}`)
  })

  it("leitet Gewohnheiten aus den Blöcken ab", () => {
    const min = DEFAULT_SETTINGS.strategyBlockMinutes
    const weekdays = new Set<string>()
    for (const block of state.timeBlocks) {
      const date = parseISODate(block.date)
      const day = date.getDay()
      if (day === 0 || day === 6) continue
      weekdays.add(block.date)
      const sameDay = state.timeBlocks.filter((item) => item.date === block.date && item.category === "strategic")
      const expectsStrategy = sameDay.some((item) => item.durationMinutes >= min)
      const expectsDeep = sameDay.some((item) => item.start !== null && item.start < DEEP_WORK_BEFORE)
      assert.equal(isDailyHabitDone(state, "strategy-block", block.date), expectsStrategy)
      assert.equal(isDailyHabitDone(state, "deep-work", block.date), expectsDeep)
    }
    assert.ok(weekdays.size > 20)
    const strategy = dailyHabitStreak(state, "strategy-block", "2026-10-30")
    const deep = dailyHabitStreak(state, "deep-work", "2026-10-30")
    const priorities = priorityStreak(state, "2026-10-30")
    assert.equal(strategy.current, 4, `Strategie aktuell ${strategy.current}, Bestwert ${strategy.best}`)
    assert.equal(strategy.best, 9)
    assert.equal(deep.current, 4, `Deep Work aktuell ${deep.current}, Bestwert ${deep.best}`)
    assert.equal(deep.best, 6)
    assert.equal(priorities.current, 6)
    assert.equal(priorities.best, 6)
  })
})
