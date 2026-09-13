import { describe, expect, test } from "bun:test"
import type { TuiState } from "@opencode-ai/plugin/tui"

import { formatTokenCount, readTurnProcessed } from "../src/turn.js"
import { assistant, emptyState, step, user } from "./fixtures.js"

const firstUser = user()
const firstResponse = assistant()

function stateWithResponseParts(parts: ReturnType<typeof step>[]): TuiState {
  return {
    ...emptyState,
    part: (id) => (id === firstResponse.id ? parts : []),
  }
}

describe("readTurnProcessed", () => {
  test("counts uncached work from one completed step", () => {
    // Given
    const state = stateWithResponseParts([step(firstResponse)])

    // When
    const processed = readTurnProcessed(state, [firstUser, firstResponse])

    // Then
    expect(processed).toBe(13_000)
  })

  test("adds distinct steps while excluding cache reads", () => {
    // Given
    const earlier = {
      ...step(firstResponse, "step_earlier"),
      tokens: {
        input: 2_000,
        output: 100,
        reasoning: 200,
        cache: { read: 80_000, write: 300 },
      },
    }
    const latest = step(firstResponse, "step_latest")
    const state = stateWithResponseParts([earlier, latest])

    // When
    const processed = readTurnProcessed(state, [firstUser, firstResponse])

    // Then
    expect(processed).toBe(15_600)
  })

  test("deduplicates repeated step records", () => {
    // Given
    const repeated = step(firstResponse)
    const state = stateWithResponseParts([repeated, repeated])

    // When
    const processed = readTurnProcessed(state, [firstUser, firstResponse])

    // Then
    expect(processed).toBe(13_000)
  })

  test("omits the count when step records are absent", () => {
    // Given
    const state = stateWithResponseParts([])

    // When
    const processed = readTurnProcessed(state, [firstUser, firstResponse])

    // Then
    expect(processed).toBeUndefined()
  })

  test("omits the count when the user boundary is absent", () => {
    // Given
    const state = stateWithResponseParts([step(firstResponse)])

    // When
    const processed = readTurnProcessed(state, [firstResponse])

    // Then
    expect(processed).toBeUndefined()
  })
})

describe("formatTokenCount", () => {
  test("formats thousands with a lower-case suffix", () => {
    // Given
    const tokens = 13_000

    // When
    const formatted = formatTokenCount(tokens)

    // Then
    expect(formatted).toBe("13k")
  })

  test("formats millions with two significant decimal places", () => {
    // Given
    const tokens = 1_250_000

    // When
    const formatted = formatTokenCount(tokens)

    // Then
    expect(formatted).toBe("1.25M")
  })
})
