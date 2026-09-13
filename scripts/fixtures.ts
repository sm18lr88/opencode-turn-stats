import type { TuiState, TuiThemeCurrent } from "@opencode-ai/plugin/tui"
import type { AssistantMessage, Session, StepFinishPart, UserMessage } from "@opencode-ai/sdk/v2"
import { RGBA } from "@opentui/core"

export const session: Session = {
  id: "ses_qa",
  slug: "qa",
  projectID: "project_qa",
  directory: "/qa",
  title: "Plugin QA",
  version: "1.18.30",
  time: { created: 1, updated: 3 },
  cost: 0.2,
}

export function user(id = "msg_user"): UserMessage {
  return {
    id,
    sessionID: session.id,
    role: "user",
    time: { created: 1 },
    agent: "build",
    model: { providerID: "anthropic", modelID: "claude-sonnet-4-6" },
  }
}

export function assistant(
  id = "msg_assistant",
  parentID = "msg_user",
  completed = true,
): AssistantMessage {
  return {
    id,
    sessionID: session.id,
    role: "assistant",
    parentID,
    time: completed ? { created: 2, completed: 3 } : { created: 2 },
    modelID: "claude-sonnet-4-6",
    providerID: "anthropic",
    mode: "build",
    agent: "build",
    path: { cwd: "/qa", root: "/qa" },
    cost: 0.2,
    tokens: {
      input: 10_000,
      output: 1_000,
      reasoning: 2_000,
      cache: { read: 90_000, write: 0 },
    },
    finish: "stop",
  }
}

export function step(message: AssistantMessage, id = `step_${message.id}`): StepFinishPart {
  return {
    id,
    messageID: message.id,
    sessionID: message.sessionID,
    type: "step-finish",
    reason: "stop",
    cost: message.cost,
    tokens: message.tokens,
  }
}

export const emptyState: TuiState = {
  ready: true,
  config: {},
  provider: [],
  path: { state: "", config: "", worktree: "/qa", directory: "/qa" },
  vcs: undefined,
  session: {
    count: () => 1,
    get: () => session,
    diff: () => [],
    todo: () => [],
    messages: () => [],
    status: () => ({ type: "idle" }),
    permission: () => [],
    question: () => [],
  },
  part: () => [],
  lsp: () => [],
  mcp: () => [],
}

const text = RGBA.fromHex("#eeeeee")
const muted = RGBA.fromHex("#999999")
const background = RGBA.fromHex("#181818")
export const colours: TuiThemeCurrent = {
  primary: text,
  secondary: text,
  accent: text,
  error: RGBA.fromHex("#ff8080"),
  warning: RGBA.fromHex("#e5c07b"),
  success: RGBA.fromHex("#98c379"),
  info: text,
  text,
  textMuted: muted,
  selectedListItemText: text,
  background,
  backgroundPanel: background,
  backgroundElement: background,
  backgroundMenu: background,
  border: muted,
  borderActive: text,
  borderSubtle: muted,
  diffAdded: text,
  diffRemoved: text,
  diffContext: text,
  diffHunkHeader: text,
  diffHighlightAdded: text,
  diffHighlightRemoved: text,
  diffAddedBg: background,
  diffRemovedBg: background,
  diffContextBg: background,
  diffLineNumber: muted,
  diffAddedLineNumberBg: background,
  diffRemovedLineNumberBg: background,
  markdownText: text,
  markdownHeading: text,
  markdownLink: text,
  markdownLinkText: text,
  markdownCode: text,
  markdownBlockQuote: text,
  markdownEmph: text,
  markdownStrong: text,
  markdownHorizontalRule: text,
  markdownListItem: text,
  markdownListEnumeration: text,
  markdownImage: text,
  markdownImageText: text,
  markdownCodeBlock: text,
  syntaxComment: muted,
  syntaxKeyword: text,
  syntaxFunction: text,
  syntaxVariable: text,
  syntaxString: text,
  syntaxNumber: text,
  syntaxType: text,
  syntaxOperator: text,
  syntaxPunctuation: text,
  thinkingOpacity: 0.5,
}
