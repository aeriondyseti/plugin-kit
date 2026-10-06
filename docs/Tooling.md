# Tooling

Commands for the rest of a plugin's life: starting one, checking it,
type-checking it in CI, and releasing it. All are `plugin-kit` commands
([CLI](CLI.md)).

## Start: `plugin-kit new`

A command hook, with its test:

```bash
plugin-kit new hook PreToolUse            # into .claude/hooks/ (or --dir)
```

writes `pre-tool-use.ts` (a pure `handle(input)`, and a guard that runs it
when executed) and `pre-tool-use.test.ts`, and prints the `settings.json`
entry that runs it. Every one of the 33 events has a template.

A mod:

```bash
plugin-kit new mod my-mod                 # plain Text
plugin-kit new mod my-mod --kit           # draws widgets through $.kit
plugin-kit new mod my-mod --vendor-kit    # draws widgets with a vendored kit
```

writes `my-mod/` with a manifest (author from `git config user.name`),
`hooks.json`, a `register.tsx` whose `/my-mod` command opens a pane, a
tsconfig, a README, a `.gitignore`, the [test helpers](Testing.md#mods-claude-plugin-test)
and a test that passes. It validates and passes `claude plugin test` as
generated. Neither command overwrites a file without `--force`.

## Check: `plugin-kit doctor`

```bash
plugin-kit doctor [dir]          # a plugin, or a project with .claude/settings.json hooks
plugin-kit doctor --json
```

It reports, worst first, with a fix for each:

| Check | Catches |
| --- | --- |
| manifest | missing, invalid, no `name`; no `version` |
| modules | a module in `hooks.json` that doesn't exist |
| `mod/dynamic-import` | `import()`, which stops a module loading |
| `mod/npm-import` | a value import from npm (`import type` is fine) |
| `mod/noun-as-value` | `const ui = $.ui`, `f($.kit)`: a noun of `$` used as a value (passing `$` itself to a helper is fine) |
| `mod/button-onpress` | a `Button` without `onPress`, which fails to draw |
| `ts/ts-extensions` | `./x.ts` imports with a tsconfig (the one nearest the module) lacking `allowImportingTsExtensions` |
| `deps/*` | a bare `plugin-kit` dependency, and the allowlist a cross-marketplace one needs |
| `vendor/stale` | vendored kit, adapter, testing or `hydrate` copies older than your plugin-kit |
| `command/*` | each command hook: the program it resolves to on PATH, a missing script, `.ts` under Node older than 22.18, an unquoted `$CLAUDE_...` path |

With Claude Code installed it also runs `claude plugin validate` and
includes its errors and warnings. Exit code 1 when anything is an error.
The source checks are pattern-based, not a parser: treat a finding as
likely, and `claude plugin validate` as the authority.

## Type-check in CI: `plugin-kit types`

A mod's types come from declarations Claude Code writes into
`.claude-plugin/types/` when it loads the mod, so a CI machine without
Claude Code can't type-check it. After loading the mod once
(`claude --plugin-dir .`):

```bash
plugin-kit types
```

copies them to `.claude-ci/types/` and writes `tsconfig.ci.json`. Commit
both, and in CI run `npx tsc -p tsconfig.ci.json`. Re-run after Claude Code
updates to pick up its new declarations.

## Release: `plugin-kit release`

```bash
plugin-kit release minor --dry-run
plugin-kit release minor --plugin plugin --marketplace ../my-marketplace/.claude-plugin/marketplace.json
```

From a clean tree, it:

1. bumps `package.json` (and `package-lock.json`); with `--plugin <dir>`,
   that plugin's `plugin.json` too, by the same kind (a repo with no
   package.json releases by its plugin's version);
2. moves the CHANGELOG's `[Unreleased]` under the new dated version and
   moves the compare links;
3. commits `Release x.y.z` and creates the annotated tag `vx.y.z`;
4. with `--marketplace`, pins the plugin's entry there to the new tag and
   commit (`ref`, `sha`, `version`), editing only those values.

It takes `patch`, `minor`, `major` or an explicit `x.y.z`, refuses a dirty
tree, an existing tag or an empty `[Unreleased]`, and never pushes: it
prints `git push origin <branch> --follow-tags`. Push the marketplace
change after the tag.
