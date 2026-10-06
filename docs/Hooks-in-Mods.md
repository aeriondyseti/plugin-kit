# Hooks in Mods

A command hook and a mod's `classic.<Event>` hook answer the same events in
different shapes:

| | Command hook prints | Mod hook returns |
| --- | --- | --- |
| block a prompt | `{"decision":"block","reason":"no"}` | `{ block: 'no' }` |
| add context | `{"hookSpecificOutput":{"additionalContext":"…"}}` | `{ additionalContext: ['…'] }` |
| deny a tool call | `{"hookSpecificOutput":{"permissionDecision":"deny",…}}` | `{ deny: 'reason' }` |

`@aeriondyseti/plugin-kit/adapter` translates, so hook logic moves into a
mod without a rewrite. Mods can't import npm code, so copy it in:

```bash
npx @aeriondyseti/plugin-kit vendor adapter
```

That writes `hooks/adapter/index.ts` (no imports, no Node).

## One policy, both ways

Write the decision once as a pure function over this package's types:

```ts
// hooks/policy.ts
import type { UserPromptSubmitEmitOptions, UserPromptSubmitInput } from '@aeriondyseti/plugin-kit';

export function guardPrompt(input: UserPromptSubmitInput): UserPromptSubmitEmitOptions {
    return input.prompt.includes('secret') ? { deny: true, reason: 'no secrets in prompts' } : {};
}
```

`import type` is erased when the mod loads, so the mod can use this file
(for type-checking, install the package as a dev dependency).

As a **command hook**:

```ts
import { runHook, UserPromptSubmit } from '@aeriondyseti/plugin-kit';
import { guardPrompt } from './policy.ts';

runHook(() => UserPromptSubmit.emitOutput(guardPrompt(UserPromptSubmit.parse())));
```

As a **mod**:

```ts
import type { Register } from 'claude-code';
import { fromToolCall, toClassic } from './adapter/index.ts';
import { guardBash, guardPrompt } from './policy.ts';

export const register: Register = (on) => {
    on('classic.UserPromptSubmit', ($, e, next) => toClassic('UserPromptSubmit', guardPrompt(e)) ?? next(e));

    on('classic.PreToolUse', ($, e, next) => {
        if (e.tool !== 'Bash') return next(e);
        return toClassic('PreToolUse', guardBash(fromToolCall(e))) ?? next(e);
    });
};
```

- `toClassic(event, options)` returns the mod's answer, or `undefined`
  when the options say nothing the event reads, so `?? next(e)` passes the
  event on.
- `fromToolCall(e, base?)` turns a mod's tool call (`{ tool, ...args }`)
  into a script's `PreToolUseInput` (`{ tool_name, tool_input }`). The call
  carries no session fields; pass `{ session_id, cwd, ... }` as `base` if
  your policy reads them. Every other event's `e` already has a script's
  input shape.

What doesn't carry over: `toUser` (a mod shows text with `$.ui.toast`),
`suppressOutput`, and Elicitation's answers, which a mod's classic hook
can't give. Pass strings, not `OutputBuilder`s: it doesn't load in a mod.

The mapping is tested against every event class's real `emitOutput`, so
the two paths can't drift.

## An existing script, unchanged

Run a hook script you already have from a mod, through `$.process.run`:

```ts
import { fromCommandOutput, toCommandInput } from './adapter/index.ts';

on('classic.Stop', async ($, e, next) => {
    const run = await $.process.run(['node', 'scripts/stop-check.mjs'], { stdin: toCommandInput('Stop', e) });
    const answer = fromCommandOutput('Stop', run);
    return Object.keys(answer).length > 0 ? answer : next(e);
});
```

`fromCommandOutput` follows the protocol: exit 2 blocks with stderr (a deny
for PreToolUse), another non-zero exit changes nothing, exit 0 reads the
JSON. This spawns a process per event, so it's a migration path; move hot
policies to `toClassic`.
