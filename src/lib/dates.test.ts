import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { diffDays, isoWeekNumber, parseISODate, startOfISOWeek, toISODate, weekStartOffset } from "./dates"

describe("dates", () => {
  it("kennt den 30. Oktober 2026 als Freitag in KW 44", () => {
    const friday = parseISODate("2026-10-30")
    assert.equal(friday.getDay(), 5)
    assert.equal(toISODate(startOfISOWeek(friday)), "2026-10-26")
    assert.equal(isoWeekNumber(friday), 44)
  })

  it("rechnet Wochenoffsets vom Montag", () => {
    const friday = parseISODate("2026-10-30")
    assert.equal(weekStartOffset(friday, 0), "2026-10-26")
    assert.equal(weekStartOffset(friday, -1), "2026-10-19")
    assert.equal(weekStartOffset(friday, -5), "2026-09-21")
  })

  it("rundet eine Woche über die Zeitumstellung auf 7 Tage", () => {
    const before = parseISODate("2026-10-19")
    const after = parseISODate("2026-10-26")
    assert.equal(diffDays(before, after), 7)
  })
})
