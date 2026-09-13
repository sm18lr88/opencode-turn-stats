# CLAUDE.md

## Project

OpenCode Turn Stats is an OpenCode TUI plugin with one responsibility. It shows
`This turn X processed` in the sidebar.

## Constraints

- Use only the official OpenCode TUI plugin API.
- Register `sidebar_content` at order 150, between built-in Context and MCP.
- Read only synchronised host state. Do not call providers, read transcripts,
  start subprocesses, persist usage data, mutate messages, or compact sessions.
- Count uncached work for the current user turn: input, cache write, visible
  output, and reasoning. Exclude cache reads.
- Omit the row when the available records cannot support the number.
- Render no heading, controls, secondary metrics, notes, or error text.
- Keep Solid and OpenTUI external so the plugin shares the host runtime.
- Validate with the real renderer and slot registry, including narrow width,
  tool continuations, compaction, incomplete data, failures, and unload.

## Style

Use strict TypeScript. Use British English in prose. Use hyphens, not em dashes.
