# Hook Scripts

Every hook event is a class with two static methods:

```ts
const input = UserPromptSubmit.parse();          // read and check stdin, typed
UserPromptSubmit.emitOutput({ toClaude: '...' }); // write the response, exit 0
```

Input fields use Claude Code's names verbatim (snake_case), so what you read
in the [hook docs](https://code.claude.com/docs/en/hooks) is what you type.
Option names are camelCase: they're this library's, mapped to the spec's
JSON for you.

## Options every event takes

| Option | Effect |
| --- | --- |
| `toUser` | text shown to the user (`systemMessage`); a string or an `OutputBuilder` |
| `continue: false` + `stopReason` | stop Claude after this hook |
| `suppressOutput` | hide the hook's stdout from the transcript |
| `terminalSequence` | raw escape sequence for the terminal |

Two names mean the same thing everywhere they appear:

- `toClaude`: add text to Claude's context (`additionalContext`).
- `deny` + `reason`: block this (`decision: "block"`).

## Events

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

Each class's source file (`src/events/<Event>.ts`) opens with a short note on
when to reach for it. `HOOK_EVENT_NAMES` lists all 33.

## Errors and exit codes

`parse()` throws `HookParseError` when stdin isn't JSON, isn't an object, or
is a different event. Its `exitCode` is 2, Claude Code's "blocking error":
the message goes back to Claude. Wrap the body in `runHook` to get that
behavior:

```ts
runHook(() => {
    const input = Stop.parse();
    Stop.emitOutput({});
});
```

Any other error is re-thrown, so real bugs still crash with a stack trace
(exit 1, non-blocking).

## Keeping the policy testable

Put the decision in a pure function and keep `parse`/`emit` at the edge:

```ts
import { pathToFileURL } from 'node:url';

export function handle(input: PreToolUseInput): PreToolUseEmitOptions { /* ... */ }

// Runs only when executed, not when a test imports `handle`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runHook(() => PreToolUse.emitOutput(handle(PreToolUse.parse())));
}
```

Compare through `pathToFileURL`: a hand-built `` `file://${process.argv[1]}` ``
never matches on Windows, so the hook would silently do nothing.
`plugin-kit new hook <Event>` writes this shape for you.

The [examples](https://github.com/aeriondyseti/plugin-kit/tree/main/examples/hooks)
all follow this shape; [Testing](Testing.md) shows both ways to test it.
