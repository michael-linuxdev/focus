import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildPalace, growthStage, roomOf } from "./palace"
import { createDemoState } from "./seed"
import { parseISODate } from "./dates"
import { createEmptyState, type AppState } from "./types"

const today = "2026-10-30"
const state = createDemoState(parseISODate(today))

describe("Gedankenpalast", () => {
  it("lässt gewachsene Räume stehen, wenn die Gewohnheit nachlässt", () => {
    const palace = buildPalace(state, today)
    const shutdown = roomOf(palace.wings.boundaries, "shutdown")
    const windows = roomOf(palace.wings.boundaries, "windows")
    assert.ok(palace.wings.focus.stage >= 3)
    assert.equal(palace.wings.focus.tone, "bright")
    assert.ok(shutdown.stage >= 3)
    assert.equal(shutdown.dust, true)
    assert.ok(shutdown.vitality < windows.vitality)
    assert.equal(windows.dust, false)
    assert.equal(palace.wings.boundaries.tone, "resting")

    const faded: AppState = {
      ...state,
      moduleHabits: state.moduleHabits.filter((habit) => !(habit.kind === "shutdown" && habit.date >= "2026-10-26")),
    }
    const after = roomOf(buildPalace(faded, today).wings.boundaries, "shutdown")
    assert.equal(after.stage, shutdown.stage)
    assert.ok(after.vitality < shutdown.vitality)
  })

  it("beginnt mit einem Grundriss und mauert ab dem ersten Tag", () => {
    assert.equal(growthStage(0, 0), 0)
    assert.equal(growthStage(1, 1), 1)
    const empty = buildPalace(createEmptyState(), today)
    assert.equal(empty.wings.focus.stage, 0)
    assert.equal(empty.wings.boundaries.tone, "waiting")
    assert.match(empty.summary, /Grundrisse/)
  })
})
