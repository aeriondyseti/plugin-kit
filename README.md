# @aeriondyseti/plugin-kit

A typed toolkit for [Claude Code](https://code.claude.com/docs/en/hooks)
plugins: hook scripts, styled output, and widgets that mods share through the
[plugin-kit plugin](plugin). Covers all 33 hook events as of Claude Code
2.1.283. Formerly `@aeriondyseti/hook-kit`.

- One class per hook event with two static methods: `parse()` reads and
  validates stdin, `emitOutput()` writes the response JSON and exits.
- A small `OutputBuilder` for styled multi-line text — boxes, tables, lists,
  dividers, icons, colors via tag markup.
- Widgets (`@aeriondyseti/plugin-kit/widgets`): meters, clocks, counters,
  lists and tags, validated and drawn the same way in hook output and in mods.
- A testing subpath (`@aeriondyseti/plugin-kit/testing`) with `testHook`,
  `mockXxx` input factories, and normalized result fields so you can assert
  `result.wasDenied` instead of spelunking the payload.

**Documentation:** the [wiki](https://github.com/aeriondyseti/plugin-kit/wiki),
also in [`docs/`](docs/Home.md). This README is the quick tour.

## Which part do you need?

| You're writing | Use | Section |
| --- | --- | --- |
| A **hook script**: a `command` hook in `settings.json` or a plugin's `hooks.json` | the npm package: typed events, `OutputBuilder`, `/testing` | [Hook scripts](#a-minimal-hook) |
| A **mod** (a plugin with function hooks) that should look like other mods and follow the user's kit settings | the **plugin-kit plugin** through `$.kit` | [Widgets in a mod: `$.kit`](#widgets-in-a-mod-kit) |
| A **mod** that must stand alone, with no plugin to install | the widget code **vendored** into your mod | [Widgets in a mod: vendored](#widgets-in-a-mod-vendored) |
| Hook **typings** | hook scripts: this package; mods: Claude Code's own `claude-code` types | [Hook typings](#hook-typings) |
| Hook logic in a **mod**, or moved there from a script | the adapter (`vendor adapter`) | [Hooks in mods](#hooks-in-mods) |
| A **status line** | `plugin-kit statusline`, or `/statusline` | [Status line](#status-line) |
| Tests from **real sessions** | `plugin-kit record`, `run`, `fixtures`; `vendor testing` for mods | [Fixtures and mod tests](#fixtures-and-mod-tests) |

## Install

```bash
npm install @aeriondyseti/plugin-kit
```

Requires Node 20+. ESM-only. Mods don't install it: they use the plugin
(`$.kit`) or a vendored copy, both below.

## A minimal hook

```ts
#!/usr/bin/env node
import { PreToolUse, runHook } from '@aeriondyseti/plugin-kit';

runHook(() => {
    const input = PreToolUse.parse();
    const cmd = String((input.tool_input as { command?: unknown }).command ?? '');

    if (/\brm\b.*-rf?\s+\//.test(cmd)) {
        PreToolUse.emitOutput({
            decision: 'deny',
            reason: 'Refusing dangerous rm on the filesystem root.',
        });
    }

    PreToolUse.emitOutput({});
});
```

Wire it up in your `settings.json`:

```json
{
    "hooks": {
        "PreToolUse": [
            {
                "matcher": "Bash",
                "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/pre-tool-use.ts" }]
            }
        ]
    }
}
```

Running a `.ts` file directly needs Node 22.18+ (type stripping is on by
default there). On older Node, compile the hook first or run it with `tsx`.

## Events

One class per event, each with `parse()` and `emitOutput(opts)`. Every
`emitOutput` accepts the common options — `toUser` (shown to the user),
`continue: false` + `stopReason` (halt Claude), `suppressOutput`,
`terminalSequence` — plus the event-specific ones below. `toClaude` always
means "add to Claude's context" (`additionalContext`); `deny` + `reason`
always means "block this" (`decision: "block"`).

| Event | Fires | Event-specific options |
| ----- | ----- | ---------------------- |
| `PreToolUse` | before a tool call | `decision` (`allow`/`deny`/`ask`/`defer`), `reason`, `updatedInput`, `toClaude` |
| `PermissionRequest` | a permission dialog is about to show | `decision: 'allow'` + `updatedInput`/`updatedPermissions`, or `decision: 'deny'` + `reason`/`interrupt` |
| `PermissionDenied` | auto mode denied a tool call | `retry` |
| `PostToolUse` | after a tool call succeeds | `deny`, `reason`, `toClaude`, `updatedToolOutput` |
| `PostToolUseFailure` | after a tool call fails | `toClaude` |
| `PostToolBatch` | after a batch of parallel tool calls resolves | `toClaude` |
| `UserPromptSubmit` | the user submits a prompt | `deny`, `reason`, `toClaude`, `suppressOriginalPrompt`, `sessionTitle` |
| `UserPromptExpansion` | a slash command / MCP prompt expands | `deny`, `reason`, `toClaude`, `suppressOriginalPrompt` |
| `SessionStart` | a session starts, resumes, clears, compacts or forks | `toClaude`, `initialUserMessage`, `sessionTitle`, `watchPaths`, `reloadSkills` |
| `SessionEnd` | a session ends | — |
| `Setup` | `--init` / `--init-only` / `--maintenance` | `toClaude` |
| `Stop` | Claude finishes responding | `deny`, `reason`, `toClaude` |
| `StopFailure` | a turn ends on an API error | — |
| `SubagentStart` | a subagent spawns | `toClaude` |
| `SubagentStop` | a subagent finishes | `deny`, `reason`, `toClaude` |
| `TeammateIdle` | an agent-team teammate is about to idle | `deny`, `reason` |
| `TaskCreated` | a task is created | `deny`, `reason` |
| `TaskCompleted` | a task is marked complete | `deny`, `reason` |
| `PreCompact` | before compaction | `deny`, `reason` |
| `PostCompact` | after compaction | — |
| `PreModelSwitch` | before a model change | `decision` (`allow`/`deny`/`ask`), `reason` |
| `PostModelSwitch` | after a model change | `toClaude` |
| `Notification` | Claude Code notifies the user | `toClaude` |
| `MessageDisplay` | streamed assistant text is displayed | `displayContent` |
| `Elicitation` | an MCP server asks the user for input | `action`, `content`, `reason` |
| `ElicitationResult` | the user answered an elicitation | `action`, `content`, `reason` |
| `ConfigChange` | a settings file or skill changes | `deny`, `reason` |
| `InstructionsLoaded` | a CLAUDE.md / rules file loads | — |
| `CwdChanged` | the working directory changes | `watchPaths` |
| `FileChanged` | a watched file changes | `watchPaths` |
| `DirectoryAdded` | a directory is added mid-session | — |
| `WorktreeCreate` | a worktree is needed (replaces `git worktree add`) | `worktreePath` (required; printed as plain text) |
| `WorktreeRemove` | a worktree is removed | — |

Each class's source file opens with a short note on when to reach for it.

## Hook typings

**In a hook script**, every event's input and options are exported types, in
Claude Code's own field names (snake_case input, camelCase options):

```ts
import { PreToolUse, type PreToolUseInput, type PreToolUseEmitOptions } from '@aeriondyseti/plugin-kit';

export function handle(input: PreToolUseInput): PreToolUseEmitOptions {
    if (input.tool_name === 'Bash' && String(input.tool_input.command).includes('rm -rf')) {
        return { decision: 'deny', reason: 'No rm -rf.' };
    }
    return {};
}

PreToolUse.emitOutput(handle(PreToolUse.parse()));
```

`CommonHookInput`, `HookEventName` / `HOOK_EVENT_NAMES`, `PermissionMode`,
`PermissionUpdate` and the other shared types are exported too.

**In a mod**, don't use these: Claude Code types every hook itself. The
same settings-hook events arrive as `classic.<Event>`, already typed from the
`claude-code` declarations the engine lays beside your mod:

```ts
import type { Register } from 'claude-code';

export const register: Register = (on) => {
    on('classic.UserPromptSubmit', ($, e, next) => {
        // e.prompt, e.session_id, e.cwd, ... typed by Claude Code
        return next(e);
    });
};
```

One difference to know: in a mod, `classic.PreToolUse` carries the tool call
in the engine's shape (`e.tool`, narrowed per tool), not the script's
`tool_name` / `tool_input`.

The kit's own types reach a mod the same way: listing plugin-kit under
`dependencies` lays its contract into your `.claude-plugin/types/`, so `$.kit`
and its `Kit*` types are typed with nothing installed. A vendored kit brings
its types with it (`import type { Widgets } from './kit/index.ts'`).

## Styled output

```ts
import { ICONS, OutputBuilder, PostToolUse } from '@aeriondyseti/plugin-kit';

const toUser = new OutputBuilder()
    .appendBox(`${ICONS.check} ${input.tool_name}`, { title: '● PostToolUse', color: 'green' })
    .appendTable(rows, { headers: ['key', 'value'], color: 'green' });

PostToolUse.emitOutput({ toUser });
```

Colors and modifiers also work via inline tags:

```ts
builder.appendLine('<color:"red"><bold>boom</bold></color>');
```

Available icons: `check cross warn info arrow bullet dot star`.
Available colors: `black red green yellow blue magenta cyan white gray`.
Available modifiers: `bold dim italic underline`.

## Widgets

Small, typed pieces of state — `text`, `counter`, `meter`, `clock`, `list`,
`tags` — with validation a model can learn from, and two ways to draw them.

```ts
import { parseWidget, renderWidgetLine, widgetJsonSchema } from '@aeriondyseti/plugin-kit/widgets';

const parsed = parseWidget('Health', { type: 'meter', value: 88 });
// { ok: false, error: 'Health: meter needs max: the value is drawn as a bar out of it' }

renderWidgetLine('Health', { type: 'meter', value: 88, max: 100 }); // 'Health 88/100'
widgetJsonSchema(); // a tool input schema whose descriptions are the catalog
```

In hook output, `OutputBuilder` draws them as plugin-kit does in a mod:

```ts
new OutputBuilder().appendWidgets({
    Health: { type: 'meter', value: 7, max: 10, color: 'red' },
    Suspicion: { type: 'clock', value: 2, of: 6 },
});
// Health ▰▰▰▰▰▰▰▱▱▱ 7/10
// Suspicion ◆◆◇◇◇◇
```

The subpath is pure (no Node, no dependencies), which is what lets a mod use
it too, in either of two ways.

| | `$.kit` (plugin dependency) | Vendored |
| --- | --- | --- |
| Install | your users install plugin-kit (automatic with the allowlist) | nothing |
| Look | the user's kit settings (`glyphs`, `barWidth`, `listLimit`) | whatever you pass |
| Long lists | fold behind `+N more`; the kit answers the press | shown whole unless you track folding |
| Calls | `await $.kit.render(...)` | `describeWidgets(...)`, synchronous |
| Updates | upgrade the plugin | re-run `add-kit --vendor` |

Both end in the same `hydrate`, which turns the kit's plain-JSON description
into elements and gives every Button its `onPress`. Your own buttons get
their handler by key: `hydrate(tree, h, { save: () => ... })`.

### Widgets in a mod: `$.kit`

In your plugin's folder:

```bash
npx @aeriondyseti/plugin-kit add-kit
```

That adds `{ "name": "plugin-kit", "marketplace": "aeriondyseti-plugins" }` to
your `plugin.json` dependencies and copies `hydrate.ts` beside your hooks
module. For installing your plugin to install the kit too, add
`"allowCrossMarketplaceDependenciesOn": ["aeriondyseti-plugins"]` to your
marketplace's `marketplace.json`. Then:

```tsx
import type { Register } from 'claude-code';
import { hydrate } from './hydrate.ts';

export const register: Register = (on) => {
    on('ui.render', { component: 'Pane', requestId: 'stats' }, async ($, e, next) => {
        const { Box } = $.ui.resolve(e);
        const tree = await $.kit.render({
            id: `my-mod:${e.requestId}`,
            widgets: {
                Health: { type: 'meter', value: 88, max: 100, color: 'red', group: 'Body' },
                Clues: { type: 'list', value: ['a torn ticket', 'wet boots'] },
            },
        });
        return <Box>{hydrate(tree, h)}</Box>;
    });
};
```

`$.kit` also has `line({ widgets })` for a status line, `parse({ name, widget })`
to validate a model's input, and `catalog()` for a prompt table and a tool
schema. The [plugin's README](plugin) covers the rest: installing it, the
user's settings, and restyling the kit from another plugin.

### Widgets in a mod: vendored

In your plugin's folder:

```bash
npx @aeriondyseti/plugin-kit add-kit --vendor
```

That copies the widget code and `hydrate` into `hooks/kit/` (with an
`index.ts` to import from) and leaves `plugin.json` alone. Then:

```tsx
import type { Register } from 'claude-code';
import { describeWidgets, hydrate, type Widgets } from './kit/index.ts';

export const register: Register = (on) => {
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
        const { Box } = $.ui.resolve(e);
        const widgets: Widgets = {
            Health: { type: 'meter', value: 7, max: 10, color: 'red' },
            Suspicion: { type: 'clock', value: 2, of: 6 },
        };
        const tree = describeWidgets(widgets, { id: 'my-mod:above', barWidth: 8 });
        return <Box>{hydrate(tree, h)}</Box>;
    });
};
```

The rest of the subpath is there too: `parseWidget`, `loadWidgets`,
`renderWidgetLine`, `widgetTable`, `widgetJsonSchema`. Re-run the command
after upgrading to refresh the copy.

## Testing your hooks

```ts
import { describe, expect, it } from 'vitest';
import { PreToolUse } from '@aeriondyseti/plugin-kit';
import { mockPreToolUse, testHook } from '@aeriondyseti/plugin-kit/testing';
import { handle } from './pre-tool-use.js';

it('denies rm -rf', () => {
    const result = testHook(
        mockPreToolUse({ tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }),
        () => handle(PreToolUse.parse()),
    );
    expect(result.wasDenied).toBe(true);
    expect(result.toClaude).toContain('rm');
});
```

`TestHookResult` carries normalized fields so you don't have to walk the
payload yourself:

| Field          | Meaning                                                                    |
| -------------- | -------------------------------------------------------------------------- |
| `wasDenied`    | a `deny` decision (any event) or top-level `decision === 'block'`          |
| `wasAllowed`   | explicit allow, or no blocking/ask/defer signal at all                     |
| `wasAsked`     | `permissionDecision === 'ask'`                                             |
| `wasDeferred`  | `permissionDecision === 'defer'`                                           |
| `toUser`       | `payload.systemMessage`                                                    |
| `toClaude`     | `additionalContext` → deny reason → top-level `reason`                     |

Negative paths (malformed stdin, wrong `hook_event_name`) surface as a
thrown `HookParseError`:

```ts
expect(() => testHook(wrongEvent, () => PreToolUse.parse())).toThrow(HookParseError);
```

## Fixtures and mod tests

Record what real sessions send, then replay it in seconds. Add
`plugin-kit record` as a command hook (it saves each payload under
`.claude/fixtures/<Event>/` and never changes what Claude does), then:

```bash
plugin-kit run "node .claude/hooks/pre-tool-use.ts" .claude/fixtures
# ✓ .claude/fixtures/PreToolUse/20261006-145042-Bash.json  PreToolUse  denied  60ms
#     to Claude: refused: rm -rf /
```

In unit tests, `loadFixtures(dir)` feeds `testHook`. For mods,
`plugin-kit fixtures .claude/fixtures --out tests/fixtures.ts` makes them
importable, and `plugin-kit vendor testing` adds helpers for
`claude plugin test`: `mountTarget` (valid component props), `kitStub` (a
stand-in for the plugin-kit plugin) and `replayAll($, fixtures)`. See
[Fixtures](docs/Fixtures.md) and [Testing](docs/Testing.md).

## Hooks in mods

`@aeriondyseti/plugin-kit/adapter` runs hook logic written for scripts in a
mod. Vendor it (`plugin-kit vendor adapter`), and one policy serves both:

```ts
// a policy: handle(input) => emit options, typed by this package
on('classic.UserPromptSubmit', ($, e, next) => toClassic('UserPromptSubmit', guardPrompt(e)) ?? next(e));
on('classic.PreToolUse', ($, e, next) => toClassic('PreToolUse', guardBash(fromToolCall(e))) ?? next(e));
```

`fromCommandOutput` runs an existing script unchanged through
`$.process.run`. See [Hooks in Mods](docs/Hooks-in-Mods.md).

## Status line

```json
{ "statusLine": { "type": "command", "command": "plugin-kit statusline" } }
```

```
Opus 5.5 · plugin-kit · main · #42
ctx ▰▰▰▰▰▰▰▱▱▱ 72% · 5h 38% · week 91% · $1.23 · +120 -34
```

Configure it in `.claude/statusline.json` from 25 sources (model, context,
usage windows, cost, git, PR, cache, ...), each drawn as a widget with
labels, colors and warn/alert thresholds; `plugin-kit statusline --check`
previews and lints a config. In code, `composeStatusLine` takes your own
sources too. See [Status Line](docs/Status-Line.md).

## Examples

Runnable dogfood hooks with colocated tests live in
[`examples/hooks/`](examples/hooks). Each hook exports a pure `handle(input)`
function so its policy is testable without touching stdin, with an
`import.meta.url` guard that drives the real parse/emit only when run as a
script.

| Hook                                                             | Shows                                                       |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| [`pre-tool-use.ts`](examples/hooks/pre-tool-use.ts)              | Deny branch, `OutputBuilder` with box + table, icons        |
| [`pre-tool-use-advanced.ts`](examples/hooks/pre-tool-use-advanced.ts) | `decision: 'ask'` and `updatedInput` rewrites               |
| [`post-tool-use.ts`](examples/hooks/post-tool-use.ts)            | Binary `deny: true`, `toClaude` context injection           |
| [`user-prompt-submit.ts`](examples/hooks/user-prompt-submit.ts)  | Prompt-level deny, divider + list                           |
| [`session-start.ts`](examples/hooks/session-start.ts)            | Context-injection pattern (no deny concept)                 |

## Project direction

- [`docs/`](docs/Home.md) — the full documentation, published to the
  [wiki](https://github.com/aeriondyseti/plugin-kit/wiki) with
  `npm run docs:wiki`.

- [`ROADMAP.md`](ROADMAP.md) — features under consideration for future
  releases.
- [`CHANGELOG.md`](CHANGELOG.md) — release history, [Keep a Changelog]
  format.
- [`TECH-DEBT.md`](TECH-DEBT.md) — known shortcuts and the context behind
  them, so contributors know what's intentional vs. what's waiting.

## License

MIT.

[Keep a Changelog]: https://keepachangelog.com/en/1.1.0/
