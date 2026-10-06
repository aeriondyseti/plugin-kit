# Status Line

Claude Code runs a `statusLine` command after each update and shows what
it prints. plugin-kit gives you one with no code, and the pieces to build
your own.

## With no code: `plugin-kit statusline`

`settings.json`:

```json
{ "statusLine": { "type": "command", "command": "plugin-kit statusline" } }
```

(Install the package globally or in the project; `npx` start-up on every
refresh is slow.) With no config it draws:

```
Opus 5.5 · plugin-kit · main · #42
ctx ▰▰▰▰▰▰▰▱▱▱ 72% · 5h 38% · week 91% · $1.23 · +120 -34
```

The context meter turns yellow at 70% and red at 90%; so do the usage
windows. Items with nothing to show (no PR, no usage limits on your plan)
are left out.

## Configuring it

The first of these it finds: `--config <file>`, the project's
`.claude/statusline.json`, your `~/.claude/statusline.json`.

```json
{
    "lines": [
        [{ "source": "model", "color": "cyan" }, { "source": "git.branch", "color": "magenta" }],
        [
            { "source": "context.percent", "type": "meter", "label": "ctx", "width": 10, "suffix": "%", "warn": 70, "alert": 90 },
            { "source": "cost.usd", "label": "spent" },
            { "source": "session.duration" }
        ]
    ],
    "separator": " · ",
    "glyphs": "unicode"
}
```

Each item is a **source** drawn as a widget:

| Field | |
| --- | --- |
| `source` | what to show; `plugin-kit statusline --list` prints them all |
| `type` | `text`, `counter`, `meter` or `tags`; default from the value |
| `label` | drawn dim before the value |
| `max` | meter: the value the bar is out of (default 100) |
| `width` | meter: cells in the bar; leave out for no bar |
| `suffix` | after the value (`%`); a meter without one shows `/max` |
| `color` | a named color (`red`, `cyan`, ...); overrides `warn`/`alert` |
| `warn`, `alert` | meter: from this value on, yellow / red |

Check a config and see it drawn from a sample session:

```bash
plugin-kit statusline --check
```

It lists every problem with the fix (`source "context.pct" is unknown; did
you mean context.percent, context.tokens?`) and exits 1 if there are any.
When the real status line meets a bad item it skips it, and a config with
no usable line falls back to the default: the status line always draws.

## Sources

| Source | Shows |
| --- | --- |
| `model` | model name |
| `context.percent`, `context.tokens` | context window used (0-100), input tokens |
| `usage.five_hour`, `usage.seven_day` | usage windows used, 0-100 (Pro/Max) |
| `spend.percent` | spend limit used |
| `cost.usd`, `session.duration` | `$1.23`, `1h 05m` |
| `lines.added`, `lines.removed`, `lines.changed` | `+12 -3` |
| `cache.hit`, `cache.warm` | prompt cache hit ratio (0-100), `warm`/`cold` |
| `dir`, `project` | folder names |
| `git.branch`, `worktree` | branch (from the worktree, else git), worktree name |
| `pr`, `pr.state` | `#12`, review state |
| `effort`, `output.style`, `vim.mode`, `agent`, `session`, `version` | as named |

## In code

```ts
#!/usr/bin/env node
import { composeStatusLine, DEFAULT_STATUS_LINE, parseStatusLine } from '@aeriondyseti/plugin-kit/statusline';

const input = parseStatusLine();            // stdin, typed; never throws
const config = {
    lines: [...DEFAULT_STATUS_LINE.lines, [{ source: 'todo', label: 'todo' }]],
};
console.log(composeStatusLine(config, input, {
    sources: { todo: () => countTodos(input.workspace?.project_dir) },
}));
```

- `StatusLineInput` types everything Claude Code sends: model, workspace,
  cost, context window, rate limits, prompt cache, PR, worktree, and more.
  Nearly all of it is optional; it arrives with the features that produce
  it.
- Your own sources are functions of the input (or `{ describe, read }`).
  One that throws is skipped instead of blanking the line.
- `parseStatusLineConfig(json, knownSources)` checks a config the way
  `--check` does; `renderStatusItem` draws one item.
