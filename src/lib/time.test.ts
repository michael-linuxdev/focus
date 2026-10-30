import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { minutesBetween, resolveDuration } from "./time"

describe("Dauer", () => {
  it("rechnet einen Zeitraum in Minuten", () => {
    assert.equal(minutesBetween("07:45", "09:15"), 90)
    assert.equal(minutesBetween("17:00", "17:45"), 45)
  })

  it("lehnt Mitternacht und leere Zeiten ab", () => {
    assert.equal(minutesBetween("18:00", "08:00"), null)
    const overnight = resolveDuration({ mode: "range", start: "22:00", end: "01:00", hours: 0, minutes: 0 })
    assert.equal(overnight.ok, false)
    const empty = resolveDuration({ mode: "range", start: "", end: "", hours: 0, minutes: 0 })
    assert.equal(empty.ok, false)
  })

  it("nimmt Stunden und Minuten als Dauer", () => {
    const result = resolveDuration({ mode: "duration", start: "", end: "", hours: 1, minutes: 30 })
    assert.deepEqual(result, { ok: true, minutes: 90, start: null, end: null })
  })
})
