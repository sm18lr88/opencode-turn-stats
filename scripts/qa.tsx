import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type {
  TuiHostSlotMap,
  TuiSlotContext,
  TuiSlotPlugin,
  TuiState,
  TuiTheme,
} from "@opencode-ai/plugin/tui"
import type { Message, Part, Session } from "@opencode-ai/sdk/v2"
import { createTestRenderer } from "@opentui/core/testing"
import { createSlot, createSolidSlotRegistry, render } from "@opentui/solid"
import { createSignal } from "solid-js"

import type plugin from "../src/tui.js"
import { assistant, colours, emptyState, session, step, user } from "./fixtures.js"

const firstUser = user()
const firstResponse = assistant()

const built: { default: typeof plugin } = await import(
  process.argv[3]
    ? pathToFileURL(resolve(process.argv[3])).href
    : new URL("../dist/tui.js", import.meta.url).href
)
const output = resolve(process.argv[2] ?? ".qa")
await mkdir(output, { recursive: true })
const setup = await createTestRenderer({ width: 42, height: 18, autoFocus: false })
const [messages, setMessages] = createSignal<readonly Message[]>([firstUser, firstResponse])
const [parts, setParts] = createSignal<Readonly<Record<string, readonly Part[]>>>({})
const [currentSession, setCurrentSession] = createSignal<Session | undefined>(session)
const [activity, setActivity] = createSignal<ReturnType<TuiState["session"]["status"]>>({
  type: "idle",
})
const [broken, setBroken] = createSignal(false)
const [themeBroken, setThemeBroken] = createSignal(false)
const theme: TuiTheme = {
  get current() {
    if (themeBroken()) throw new TypeError("Injected unavailable theme")
    return colours
  },
  selected: "qa",
  ready: true,
  has: () => true,
  set: () => true,
  install: async () => {},
  mode: () => "dark",
}
const state: TuiState = {
  ...emptyState,
  session: {
    ...emptyState.session,
    get: () => currentSession(),
    messages: () => {
      if (broken()) throw new TypeError("Injected unavailable host state")
      return messages()
    },
    status: () => activity(),
  },
  part: (id) => {
    const override = parts()[id]
    if (override) return override
    const message = messages().find((candidate) => candidate.id === id)
    return message?.role === "assistant" ? [step(message)] : []
  },
}
const registry = createSolidSlotRegistry<TuiHostSlotMap, TuiSlotContext>(setup.renderer, { theme })
registry.register({
  id: "context-fixture",
  order: 100,
  slots: {
    sidebar_content: () => <text>Context</text>,
  },
})
registry.register({
  id: "mcp-fixture",
  order: 200,
  slots: {
    sidebar_content: () => <text>MCP</text>,
  },
})
const registerPlugin = async (): Promise<void> => {
  await built.default.tui({
    state,
    theme,
    slots: {
      register: (entry: TuiSlotPlugin) => {
        registry.register({ ...entry, id: built.default.id })
        return built.default.id
      },
    },
  })
}
await registerPlugin()
assert.deepEqual(
  registry.resolveEntries("sidebar_content").map((entry) => entry.id),
  ["context-fixture", "opencode-turn-stats", "mcp-fixture"],
)

const Slot = createSlot(registry)
await render(
  () => (
    <box width="100%" height="100%" paddingLeft={2} paddingRight={2}>
      <scrollbox flexGrow={1}>
        <box gap={1}>
          <Slot name="sidebar_content" session_id={session.id} />
        </box>
      </scrollbox>
    </box>
  ),
  setup.renderer,
)
const captures: { name: string; text: string }[] = []
const capture = async (name: string): Promise<string> => {
  await setup.flush()
  const text = setup.captureCharFrame()
  captures.push({ name, text })
  await Bun.write(resolve(output, `${name}.txt`), text)
  return text
}

try {
  const initial = await capture("initial")
  assert.match(initial, /Context[\s\S]*This turn 13k processed[\s\S]*MCP/)
  assert.doesNotMatch(initial, /Context stats|Cost|Traffic|\$/)

  setup.resize(30, 18)
  assert.match(await capture("narrow"), /This turn 13k processed/)
  setup.resize(42, 18)

  const secondResponse = {
    ...assistant("msg_second"),
    tokens: {
      input: 1_000,
      output: 500,
      reasoning: 500,
      cache: { read: 900_000, write: 0 },
    },
  }
  setMessages([firstUser, firstResponse, secondResponse])
  assert.match(await capture("tool-continuation"), /This turn 15k processed/)

  setMessages([
    firstUser,
    {
      ...firstResponse,
      tokens: { ...firstResponse.tokens, cache: { read: 9_000_000, write: 0 } },
    },
  ])
  assert.match(await capture("cache-read-excluded"), /This turn 13k processed/)

  const activeResponse = assistant("msg_active", firstUser.id, false)
  setMessages([firstUser, firstResponse, activeResponse])
  setParts({ [activeResponse.id]: [] })
  setActivity({ type: "busy" })
  assert.doesNotMatch(await capture("active-missing-step-records"), /This turn/)

  const zeroResponse = {
    ...assistant("msg_zero"),
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 1_000, write: 0 },
    },
  }
  setMessages([firstUser, zeroResponse])
  setParts({})
  setActivity({ type: "idle" })
  assert.match(await capture("zero-processed"), /This turn 0 processed/)

  setMessages([firstUser, firstResponse])
  setParts({ [firstResponse.id]: [] })
  assert.doesNotMatch(await capture("missing-step-records"), /This turn/)

  setParts({
    [firstResponse.id]: [{ ...step(firstResponse), tokens: { ...firstResponse.tokens, input: 1 } }],
  })
  assert.doesNotMatch(await capture("lagging-step-record"), /This turn/)

  setParts({})
  const nextUser = user("msg_next_user")
  setMessages([firstUser, firstResponse, nextUser])
  assert.doesNotMatch(await capture("new-turn-waiting"), /This turn/)

  const runningResponse = assistant("msg_running", nextUser.id, false)
  setMessages([firstUser, firstResponse, nextUser, runningResponse])
  setActivity({ type: "busy" })
  assert.match(await capture("running"), /This turn 13k processed/)

  setActivity({ type: "idle" })
  assert.doesNotMatch(await capture("incomplete-idle"), /This turn/)

  setParts({
    [nextUser.id]: [
      {
        id: "compact",
        messageID: nextUser.id,
        sessionID: session.id,
        type: "text",
        text: "Continue",
        synthetic: true,
        metadata: { compaction_continue: true },
      },
    ],
  })
  assert.doesNotMatch(await capture("compaction"), /This turn/)

  const postCompactUser = user("msg_post_compact_user")
  const postCompactResponse = assistant("msg_post_compact_response", postCompactUser.id)
  setParts({})
  setMessages([
    firstUser,
    firstResponse,
    nextUser,
    runningResponse,
    postCompactUser,
    postCompactResponse,
  ])
  assert.match(await capture("post-compaction"), /This turn 13k processed/)

  setCurrentSession({ ...session, revert: { messageID: nextUser.id, partID: "part_revert" } })
  assert.match(await capture("reverted-history"), /This turn 13k processed/)
  setCurrentSession(session)

  setCurrentSession(undefined)
  assert.doesNotMatch(await capture("missing-session"), /This turn/)
  setCurrentSession(session)

  setBroken(true)
  const failure = await capture("error-contained")
  assert.doesNotMatch(failure, /This turn|unavailable|error/i)
  assert.match(failure, /Context[\s\S]*MCP/)
  setBroken(false)
  assert.match(await capture("error-recovered"), /This turn 13k processed/)

  setThemeBroken(true)
  const renderFailure = await capture("render-error-contained")
  assert.doesNotMatch(renderFailure, /This turn|unavailable|error/i)
  assert.match(renderFailure, /Context[\s\S]*MCP/)
  setThemeBroken(false)

  registry.unregister(built.default.id)
  const unloaded = await capture("unloaded")
  assert.doesNotMatch(unloaded, /This turn/)
  assert.match(unloaded, /Context[\s\S]*MCP/)

  await registerPlugin()
  assert.deepEqual(
    registry.resolveEntries("sidebar_content").map((entry) => entry.id),
    ["context-fixture", "opencode-turn-stats", "mcp-fixture"],
  )
  assert.match(await capture("remounted"), /This turn 13k processed/)
  assert.equal(registry.getPluginErrors().length, 0)
  await Bun.write(resolve(output, "captures.json"), JSON.stringify(captures, null, 2))
} finally {
  registry.clear()
  setup.renderer.destroy()
}

console.log(`Renderer QA passed with ${captures.length} states. Captures: ${output}`)
console.log(captures.find((capture) => capture.name === "initial")?.text)
