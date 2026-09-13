import assert from "node:assert/strict"
import { mkdir, rm } from "node:fs/promises"
import { dirname, posix, resolve } from "node:path"

const shipped = ["package.json", "dist/tui.js", "README.md", "LICENSE"]

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function archiveName(value: unknown): string {
  assert.ok(record(value), "The package manifest must be an object.")
  const name = value["name"]
  const version = value["version"]
  assert.match(typeof name === "string" ? name : "", /^[a-z0-9][a-z0-9._-]*$/)
  assert.match(
    typeof version === "string" ? version : "",
    /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?(?:\+[a-zA-Z0-9.-]+)?$/,
  )
  return `${name}-${version}.tgz`
}

const localManifest: unknown = await Bun.file("package.json").json()
const archivePath = process.argv[2] === "--packed" ? archiveName(localManifest) : process.argv[2]
const files = archivePath
  ? new Map(
      [...(await new Bun.Archive(await Bun.file(archivePath).bytes()).files())].map(
        ([name, file]) => [name.replace(/^package\//, ""), file],
      ),
    )
  : new Map(shipped.map((name) => [name, Bun.file(name)]))

assert.deepEqual(
  [...files.keys()].sort(),
  [...shipped].sort(),
  "The release has unexpected files or lacks required files.",
)

async function text(name: string): Promise<string> {
  const file = files.get(name)
  assert.ok(file, `The package does not contain ${name}.`)
  return file.text()
}

const manifest: unknown = JSON.parse(await text("package.json"))
assert.ok(record(manifest))
archiveName(manifest)
assert.equal(manifest["name"], "opencode-turn-stats")
assert.equal(manifest["type"], "module")
assert.equal(manifest["license"], "MIT")
assert.deepEqual(manifest["repository"], {
  type: "git",
  url: "git+https://github.com/sm18lr88/opencode-turn-stats.git",
})
assert.equal(manifest["homepage"], "https://github.com/sm18lr88/opencode-turn-stats#readme")
assert.deepEqual(manifest["bugs"], {
  url: "https://github.com/sm18lr88/opencode-turn-stats/issues",
})
assert.equal(manifest["main"], undefined, "Remove main. OpenCode detects it as a server entry.")
assert.equal(manifest["dependencies"], undefined, "Runtime packages must remain host-owned peers.")
assert.ok(record(manifest["exports"]))
assert.deepEqual(manifest["exports"], { "./tui": "./dist/tui.js" })
assert.deepEqual(
  manifest["files"],
  shipped.filter((name) => name !== "package.json"),
)
assert.ok(record(manifest["engines"]))
assert.equal(manifest["engines"]["opencode"], ">=1.18.30 <2")
assert.ok(record(manifest["peerDependencies"]))
assert.equal(manifest["peerDependencies"]["@opencode-ai/plugin"], ">=1.18.30 <2")
assert.match(await text("LICENSE"), /Copyright \(c\) 2026 Field Logic/)

const code = await text("dist/tui.js")
if (archivePath)
  assert.equal(
    code,
    await Bun.file("dist/tui.js").text(),
    "The archive bundle differs from the current build.",
  )
const scan = new Bun.Transpiler({ loader: "js", target: "bun" }).scan(code)
assert.deepEqual(scan.exports, ["default"])
const runtime = new Set(["@opentui/core", "@opentui/solid", "solid-js"])
for (const dependency of scan.imports) {
  const name = dependency.path.startsWith("@")
    ? dependency.path.split("/").slice(0, 2).join("/")
    : dependency.path.split("/")[0]
  assert.ok(name && runtime.has(name), `Unsupported runtime import: ${dependency.path}`)
  assert.equal(
    typeof manifest["peerDependencies"][name],
    "string",
    `Declare ${name} as a peer dependency.`,
  )
}
for (const name of ["@opentui/solid", "solid-js"])
  assert.ok(
    scan.imports.some((dependency) => dependency.path === name),
    `Keep ${name} external. The host supplies its runtime.`,
  )
assert.doesNotMatch(code, /(?:[A-Z]:[\\/](?:Users|Apps|tmp)[\\/])|\/Users\/|\/home\//)
assert.doesNotMatch(code, /\bfetch\s*\(|node:(?:fs|child_process)|Bun\.(?:spawn|spawnSync)/)

for (const name of shipped.filter((file) => file.endsWith(".md"))) {
  const content = await text(name)
  for (const match of content.matchAll(/\]\(([^)\s]+)\)/g)) {
    const link = match[1]?.split("#")[0]
    if (!link || /^(?:[a-z]+:|\/)/i.test(link)) continue
    const target = posix.normalize(posix.join(posix.dirname(name), link))
    assert.ok(files.has(target), `${name} links to an unpackaged file: ${target}`)
  }
}

console.log(
  `Package checks passed for ${manifest["name"]}@${manifest["version"]}. The package contains ${files.size} files.`,
)

if (archivePath) {
  const destination = resolve(".qa/packed")
  await rm(destination, { recursive: true, force: true })
  for (const [name, file] of files) {
    const target = resolve(destination, name)
    await mkdir(dirname(target), { recursive: true })
    await Bun.write(target, file)
  }
  console.log(`Packed QA entry: ${resolve(destination, "dist/tui.js")}`)
}
