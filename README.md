# @aeriondyseti/hook-kit

Ergonomic, typed helpers for writing [Claude Code](https://code.claude.com/docs/en/hooks) hook scripts.
Covers all 33 hook events as of Claude Code 2.1.283.

- One class per hook event with two static methods: `parse()` reads and
  validates stdin, `emitOutput()` writes the response JSON and exits.
- A small `OutputBuilder` for styled multi-line text — boxes, tables, lists,
  dividers, icons, colors via tag markup.
- A testing subpath (`@aeriondyseti/hook-kit/testing`) with `testHook`,
  `mockXxx` input factories, and normalized result fields so you can assert
  `result.wasDenied` instead of spelunking the payload.

## Install

```bash
npm install @aeriondyseti/hook-kit
```

Requires Node 20+. ESM-only.

## A minimal hook

```ts
#!/usr/bin/env node
import { PreToolUse, runHook } from '@aeriondyseti/hook-kit';

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

## Styled output

```ts
import { ICONS, OutputBuilder, PostToolUse } from '@aeriondyseti/hook-kit';

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
import { parseWidget, renderWidgetLine, widgetJsonSchema } from '@aeriondyseti/hook-kit/widgets';

const parsed = parseWidget('Health', { type: 'meter', value: 88 });
// { ok: false, error: 'Health: meter needs max: the value is drawn as a bar out of it' }

renderWidgetLine('Health', { type: 'meter', value: 88, max: 100 }); // 'Health 88/100'
widgetJsonSchema(); // a tool input schema whose descriptions are the catalog
```

The subpath is pure (no Node, no dependencies). In a Claude Code mod, use
the **plugin-kit** plugin in [`plugin/`](plugin) instead: depend on it and
draw widgets through `$.kit`. Its README covers the setup.

## Testing your hooks

```ts
import { describe, expect, it } from 'vitest';
import { PreToolUse } from '@aeriondyseti/hook-kit';
import { mockPreToolUse, testHook } from '@aeriondyseti/hook-kit/testing';
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

- [`ROADMAP.md`](ROADMAP.md) — features under consideration for future
  releases.
- [`CHANGELOG.md`](CHANGELOG.md) — release history, [Keep a Changelog]
  format.
- [`TECH-DEBT.md`](TECH-DEBT.md) — known shortcuts and the context behind
  them, so contributors know what's intentional vs. what's waiting.

## License

MIT.

[Keep a Changelog]: https://keepachangelog.com/en/1.1.0/
