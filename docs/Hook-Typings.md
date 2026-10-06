# Hook Typings

Where your types come from depends on what you're writing.

## In a hook script: this package

Each event exports its input and its options:

```ts
import { PreToolUse, type PreToolUseEmitOptions, type PreToolUseInput } from '@aeriondyseti/plugin-kit';

export function handle(input: PreToolUseInput): PreToolUseEmitOptions {
    if (input.tool_name === 'Bash' && String(input.tool_input.command).includes('rm -rf')) {
        return { decision: 'deny', reason: 'No rm -rf.' };
    }
    return {};
}

PreToolUse.emitOutput(handle(PreToolUse.parse()));
```

- `<Event>Input`: what `parse()` returns, in Claude Code's field names.
- `<Event>EmitOptions`: what `emitOutput()` takes. Where options exclude
  each other they're a union, so mixing them is a compile error
  (`PermissionRequest` allow-only and deny-only fields, for one).
- Shared: `CommonHookInput` (the fields every event has: `session_id`,
  `transcript_path`, `cwd`, ...), `HookEventName` and `HOOK_EVENT_NAMES`,
  `PermissionMode`, `PermissionUpdate`, `PermissionRule`, `McpServerInfo`,
  `EffortLevel`.

Enum-like fields that Claude Code may extend (`PermissionMode`,
`EffortLevel`) are open unions: the known values autocomplete, and an
unknown one from a newer Claude Code still type-checks.

`tool_input` and `tool_response` are `Record<string, unknown>` and
`unknown`: per-tool shapes change with Claude Code, so narrow them yourself.

The types track one Claude Code release (see the CHANGELOG for which).

## In a mod: Claude Code's own types

Mods don't use this package's event types. Claude Code types every hook
itself, from the `claude-code` declarations it lays beside your mod
(`.claude-plugin/types/`). The settings-hook events arrive as
`classic.<Event>`:

```ts
import type { Register } from 'claude-code';

export const register: Register = (on) => {
    on('classic.UserPromptSubmit', ($, e, next) => {
        // e.prompt, e.session_id, e.cwd, ... typed by Claude Code
        return next(e);
    });
};
```

One difference: in a mod, `classic.PreToolUse` carries the tool call in the
engine's shape (`e.tool`, narrowed per tool), not a script's `tool_name` /
`tool_input`.

## The kit's types in a mod

- **With the plugin dependency**, Claude Code lays plugin-kit's contract
  into `.claude-plugin/types/plugin-kit/`, so `$.kit` and the `Kit*` types
  (`KitWidget`, `KitUiElement`, `KitRenderArgs`, ...) are typed with nothing
  installed.
- **Vendored**, the types come with the code:
  `import type { Widgets } from './kit/index.ts'`.

See [Widgets in Mods](Widgets-in-Mods.md).
