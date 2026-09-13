import solidPlugin from "@opentui/solid/bun-plugin"

const result = await Bun.build({
  entrypoints: ["src/tui.tsx"],
  outdir: "dist",
  target: "bun",
  format: "esm",
  packages: "external",
  plugins: [solidPlugin],
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exitCode = 1
}
