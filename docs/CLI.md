# CLI

The package installs a `plugin-kit` command. Run it with
`npx @aeriondyseti/plugin-kit <command>`, or install the package
(globally, or as a dev dependency) for commands Claude Code runs often
(`record`, `statusline`).

| Command | Does | Read |
| --- | --- | --- |
| `add-kit [plugin-dir]` | depend on the plugin-kit plugin and copy `hydrate.ts` | [Widgets in Mods](Widgets-in-Mods.md) |
| `add-kit --vendor [plugin-dir]` | same as `vendor kit` | [Widgets in Mods](Widgets-in-Mods.md#vendored) |
| `vendor kit [plugin-dir]` | copy the widget code and `hydrate` into `hooks/kit/` | [Widgets in Mods](Widgets-in-Mods.md#vendored) |
| `vendor adapter [plugin-dir]` | copy the hook adapter into `hooks/adapter/` | [Hooks in Mods](Hooks-in-Mods.md) |
| `vendor testing [plugin-dir]` | copy the mod test helpers into `tests/kit-testing/` | [Testing](Testing.md#mods-claude-plugin-test) |
| `record [--out <dir>]` | as a command hook: save each payload as a fixture | [Fixtures](Fixtures.md#record) |
| `run <command> <fixture\|dir>... [--event <E>] [--json]` | replay fixtures through a hook command | [Fixtures](Fixtures.md#replay-against-a-hook-plugin-kit-run) |
| `fixtures <dir> [--out <file.ts>]` | fixtures as a TS module, for mod tests | [Fixtures](Fixtures.md#replay-in-mod-tests-plugin-kit-fixtures) |
| `statusline [--config <file>]` | as a `statusLine` command: draw the status line | [Status Line](Status-Line.md) |
| `statusline --check [--config <file>]` | preview a config, list its problems | [Status Line](Status-Line.md#configuring-it) |
| `statusline --list` | the sources a config can use | [Status Line](Status-Line.md#sources) |

`plugin-dir` defaults to the current folder. Every `vendor` and `add-kit`
run is safe to repeat: files already current are left alone, and re-running
after an upgrade refreshes the copies (they're marked `Do not edit`).

The commands Claude Code runs (`record`, `statusline`) never fail it: on
bad input they print a short note and exit 0.
