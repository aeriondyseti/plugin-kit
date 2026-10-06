# Getting Started

## Install

```bash
npm install @aeriondyseti/plugin-kit
```

Node 20 or newer, ESM only. Five entry points:

| Import | Holds |
| --- | --- |
| `@aeriondyseti/plugin-kit` | hook event classes, `runHook`, `OutputBuilder`, tags, icons, shared types |
| `@aeriondyseti/plugin-kit/widgets` | widget types, validation, catalog, renderers, `hydrate` (pure: no Node, no dependencies) |
| `@aeriondyseti/plugin-kit/testing` | `testHook`, a `mockXxx` input factory per event, fixtures |
| `@aeriondyseti/plugin-kit/statusline` | status line input types, sources, composition |
| `@aeriondyseti/plugin-kit/adapter` | command hook ↔ mod translation (pure; vendored into mods) |

It also installs the `plugin-kit` command ([CLI](CLI.md)).

Writing a **mod** instead of a hook script? Mods don't install npm packages;
skip to [Widgets in Mods](Widgets-in-Mods.md).

## Your first hook

`.claude/hooks/pre-tool-use.ts`:

```ts
#!/usr/bin/env node
import { PreToolUse, runHook } from '@aeriondyseti/plugin-kit';

runHook(() => {
    const input = PreToolUse.parse();
    const cmd = String(input.tool_input.command ?? '');

    if (/\brm\b.*-rf?\s+\//.test(cmd)) {
        PreToolUse.emitOutput({ decision: 'deny', reason: 'Refusing rm on the filesystem root.' });
    }

    PreToolUse.emitOutput({});
});
```

Wire it up in `settings.json`:

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

Running a `.ts` file directly needs Node 22.18 or newer (type stripping is
on by default there). On older Node, compile first or run it with `tsx`.

## What happens

1. `PreToolUse.parse()` reads stdin, checks it's a `PreToolUse` event, and
   returns it typed. Bad input throws `HookParseError`.
2. `PreToolUse.emitOutput(...)` writes the response JSON Claude Code
   expects and exits with code 0. Nothing after it runs.
3. `runHook` turns a `HookParseError` into exit code 2 with the message on
   stderr (Claude Code's "blocking error"), instead of a stack trace.

Next: [Hook Scripts](Hook-Scripts.md) for every event and option.
