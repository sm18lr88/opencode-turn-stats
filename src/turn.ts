import type { TuiState } from "@opencode-ai/plugin/tui"
import type { AssistantMessage, Message, StepFinishPart } from "@opencode-ai/sdk/v2"

function nonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
}

// Sum per-step records. assistant.tokens mirrors the latest step and detects observable lag.
// The host exposes no completeness marker, so an earlier missing step cannot be inferred.
export function readTurnProcessed(
  state: TuiState,
  messages: readonly Message[],
): number | undefined {
  const user = messages.findLast((message) => message.role === "user")
  const latest = messages.findLast((message) => message.role === "assistant")
  const parentID = user?.id ?? (latest?.role === "assistant" ? latest.parentID : undefined)
  if (!parentID) return

  const userParts = state.part(parentID)
  if (
    userParts.some(
      (part) =>
        part.type === "compaction" ||
        (part.type === "text" && part.synthetic === true && part.metadata?.["compaction_continue"]),
    )
  )
    return

  const activity = user ? state.session.status(user.sessionID)?.type : undefined
  const running = activity === "busy" || activity === "retry"
  let processed = 0
  let requests = 0
  let complete = user !== undefined
  const seen = new Set<string>()

  const accumulate = (reported: AssistantMessage["tokens"]): void => {
    const input = nonNegative(reported.input)
    const output = nonNegative(reported.output)
    const reasoning = nonNegative(reported.reasoning)
    const read = nonNegative(reported.cache.read)
    const write = nonNegative(reported.cache.write)
    if (
      input === undefined ||
      output === undefined ||
      reasoning === undefined ||
      read === undefined ||
      write === undefined ||
      (input === 0 && read === 0 && write === 0)
    ) {
      complete = false
      return
    }
    const fresh = input + write + output + reasoning
    if (nonNegative(fresh) === undefined) {
      complete = false
      return
    }
    processed += fresh
    requests += 1
  }

  for (const message of messages) {
    if (message.role !== "assistant" || message.parentID !== parentID || message.summary) continue
    if (
      message.error ||
      (message.time.completed === undefined && (!running || message.id !== latest?.id))
    )
      complete = false

    const steps = state
      .part(message.id)
      .filter(
        (part): part is StepFinishPart =>
          part.type === "step-finish" &&
          part.messageID === message.id &&
          part.sessionID === message.sessionID,
      )
    if (steps.length > 0) {
      const last = steps.at(-1)?.tokens
      if (
        last &&
        (last.input !== message.tokens.input ||
          last.output !== message.tokens.output ||
          last.reasoning !== message.tokens.reasoning ||
          last.cache.read !== message.tokens.cache.read ||
          last.cache.write !== message.tokens.cache.write)
      )
        complete = false
      for (const step of steps) {
        const key = `${message.id}/${step.id}`
        if (seen.has(key)) continue
        seen.add(key)
        accumulate(step.tokens)
      }
    } else {
      complete = false
      if (message.time.completed !== undefined) {
        const key = `message/${message.id}`
        if (seen.has(key)) continue
        seen.add(key)
        accumulate(message.tokens)
      }
    }
  }

  if (!complete || requests === 0 || nonNegative(processed) === undefined) return
  return processed
}

const tokenFormats: Partial<Record<"floor" | "halfExpand", Intl.NumberFormat>> = {}

export function formatTokenCount(value: number, lowerBound = false): string {
  const mode = lowerBound ? "floor" : "halfExpand"
  const rounded =
    value >= 1_000 && value < 1_000_000
      ? (lowerBound ? Math.floor(value / 1_000) : Math.round(value / 1_000)) * 1_000
      : value
  tokenFormats[mode] ??= new Intl.NumberFormat("en-GB", {
    notation: "compact",
    maximumFractionDigits: 2,
    roundingMode: mode,
  })
  return tokenFormats[mode].format(rounded).replace("K", "k")
}
