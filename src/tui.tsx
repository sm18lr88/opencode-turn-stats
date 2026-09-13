import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createMemo, ErrorBoundary, Show } from "solid-js"

import { formatTokenCount, readTurnProcessed } from "./turn.js"

type TurnStatsApi = Pick<TuiPluginApi, "slots" | "state" | "theme">

type TurnStatsProps = {
  readonly api: TurnStatsApi
  readonly sessionID: string
}

function readProcessed(api: TurnStatsApi, sessionID: string): number | undefined {
  const session = api.state.session.get(sessionID)
  if (!session) return
  const loaded = api.state.session
    .messages(sessionID)
    .filter((message) => message.sessionID === sessionID)
  const cutoff = session.revert
    ? loaded.findIndex((message) => message.id === session.revert?.messageID)
    : loaded.length
  if (cutoff < 0) return
  return readTurnProcessed(api.state, session.revert ? loaded.slice(0, cutoff) : loaded)
}

function TurnStats(props: TurnStatsProps) {
  const processed = createMemo(() => {
    try {
      const value = readProcessed(props.api, props.sessionID)
      return value === undefined ? undefined : formatTokenCount(value)
    } catch {
      return undefined
    }
  })

  return (
    <Show when={processed()}>
      {(value) => (
        <box flexDirection="row" flexWrap="wrap">
          <text fg={props.api.theme.current.textMuted}>This turn </text>
          <text fg={props.api.theme.current.text} wrapMode="word">
            {value()} processed
          </text>
        </box>
      )}
    </Show>
  )
}

const tui = (async (api: TurnStatsApi): Promise<void> => {
  api.slots.register({
    order: 150,
    slots: {
      sidebar_content(_context, props) {
        return (
          <ErrorBoundary fallback={() => null}>
            <TurnStats api={api} sessionID={props.session_id} />
          </ErrorBoundary>
        )
      },
    },
  })
}) satisfies TuiPlugin

export default {
  id: "opencode-turn-stats",
  tui,
} satisfies TuiPluginModule
