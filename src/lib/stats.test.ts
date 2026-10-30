import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { weekdayStreak, weeklyStreak } from "./stats"

describe("Serien", () => {
  it("zählt Werktage und überspringt das Wochenende", () => {
    const streak = weekdayStreak(["2026-10-23", "2026-10-26"], "2026-10-26")
    assert.equal(streak.current, 2)
  })

  it("lässt die Serie am laufenden Werktag offen, wenn heute noch fehlt", () => {
    const streak = weekdayStreak(["2026-10-27", "2026-10-28", "2026-10-29"], "2026-10-30")
    assert.equal(streak.current, 3)
  })

  it("bricht die Serie, wenn der Vortag fehlt", () => {
    const streak = weekdayStreak(["2026-10-28", "2026-10-30"], "2026-10-30")
    assert.equal(streak.current, 1)
    assert.equal(streak.best, 1)
  })

  it("zählt definierte Wochen über die Zeitumstellung", () => {
    const weeks = ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]
    const streak = weeklyStreak(weeks, "2026-10-26")
    assert.equal(streak.current, 4)
    assert.equal(streak.best, 4)
  })

  it("beginnt die Wochenserie bei der Vorwoche, wenn die aktuelle noch leer ist", () => {
    const streak = weeklyStreak(["2026-10-12", "2026-10-19"], "2026-10-26")
    assert.equal(streak.current, 2)
  })
})
