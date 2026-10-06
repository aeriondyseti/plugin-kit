# Testing

## Hook scripts: `testHook`

`@aeriondyseti/plugin-kit/testing` runs a hook's parse → emit flow in
process: it feeds the input as stdin, captures what `emitOutput` would
write, and stops the exit.

```ts
import { expect, it } from 'vitest';
import { PreToolUse } from '@aeriondyseti/plugin-kit';
import { mockPreToolUse, testHook } from '@aeriondyseti/plugin-kit/testing';
import { handle } from './pre-tool-use.js';

it('denies rm -rf', () => {
    const result = testHook(
        mockPreToolUse({ tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }),
        () => PreToolUse.emitOutput(handle(PreToolUse.parse())),
    );
    expect(result.wasDenied).toBe(true);
    expect(result.toClaude).toContain('rm');
});
```

Every event has a `mockXxx(overrides)` factory filling in valid defaults.

`testHook` returns:

| Field | Meaning |
| --- | --- |
| `payload` | the JSON the hook would have written |
| `exitCode` | the exit code it would have used |
| `wasDenied` | a deny decision (any event) or `decision: 'block'` |
| `wasAllowed` | an explicit allow, or no block/ask/defer at all |
| `wasAsked` | `permissionDecision: 'ask'` |
| `wasDeferred` | `permissionDecision: 'defer'` |
| `toUser` | `systemMessage` |
| `toClaude` | `additionalContext`, else the deny reason, else `reason` |

Bad input surfaces as a thrown `HookParseError`:

```ts
expect(() => testHook({ hook_event_name: 'Stop' }, () => PreToolUse.parse())).toThrow(HookParseError);
```

If your policy is a pure `handle(input)`, you can also test it directly
with no `testHook` at all.

Real payloads beat hand-written mocks: record a session's with
`plugin-kit record`, then load them with `loadFixtures` or replay them
against the script with `plugin-kit run` (see [Fixtures](Fixtures.md)).

## Mods: `claude plugin test`

Mods run inside Claude Code, so test them with Claude Code's own kit:
`*.test.tsx` files importing `claude-code/testing`, run by
`claude plugin test <plugin-folder>`. plugin-kit adds helpers on top; test
files can only import the plugin's own files, so copy them in:

```bash
npx @aeriondyseti/plugin-kit vendor testing
```

That writes `tests/kit-testing/index.ts`.

### Mounting

`mountTarget` fills in valid props for `AbovePrompt` and `Pane`, so a test
names only what matters; `SURFACES` is the surfaces to loop over:

```tsx
import { expect, test } from 'claude-code/testing';
import { mountTarget, SURFACES } from './kit-testing/index.ts';

test('draws the health bar', async ($) => {
    for (const surface of SURFACES) {
        const ui = await $.ui.mount(mountTarget('my-mod', 'Pane', surface, { title: 'Stats' }, 'stats'));
        expect((await ui.find({ type: 'Text', text: /Health/ }))?.text).toBe('Health 7/10');
        await ui.unmount();
    }
});
```

The last argument is the instance (`requestId`), which a `ui.render`
matcher like `{ component: 'Pane', requestId: 'stats' }` names. Defaults are
in `DEFAULT_PROPS`; `ALL_SURFACES` adds `vscode` and `mobile`.

### Mods that use `$.kit`

`claude plugin test` loads only the plugin under test, not its
dependencies, so `$.kit` isn't there. Load `kitStub`, a stand-in, beside it:

```tsx
import { kitStub, mountTarget } from './kit-testing/index.ts';

test('draws through the kit', { plugins: [kitStub] }, async ($) => { ... });
```

The stub draws each widget as one Text, `Name value` (`Health 7/10`,
`Clues ticket, boots`): assert on your names and values, not the kit's
layout, which the kit tests itself.

### Replaying fixtures

Recorded [fixtures](Fixtures.md), turned into a module with
`plugin-kit fixtures .claude/fixtures --out tests/fixtures.ts`, replay
through your mod's hooks:

```tsx
import { replayAll } from './kit-testing/index.ts';
import { fixtures } from './fixtures.ts';

test('recorded sessions', async ($, on) => {
    on('classic.UserPromptSubmit', () => ({}));   // what sits beneath your mod
    on('tool.call', () => ({ result: 'ran' }));   // needed to replay PreToolUse
    const answers = await replayAll($, fixtures);
    expect(answers.find((a) => a.event === 'UserPromptSubmit')?.answer).toEqual({ block: 'no secrets' });
});
```

Each classic event is raised with `$.classic.<Event>`; PreToolUse, which
the test kit raises only through a tool call, replays as `$.tool.call`.
`replay($, payload)` does one; `replayPlan` shows what it would raise.

The plugin's own tests
([`plugin/tests/kit.test.tsx`](https://github.com/aeriondyseti/plugin-kit/blob/main/plugin/tests/kit.test.tsx))
do the reverse of `kitStub`: they load a consumer inline and press the
kit's buttons.
