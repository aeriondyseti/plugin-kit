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

## Mods: `claude plugin test`

Mods run inside Claude Code, so test them with Claude Code's own kit:
`*.test.tsx` files importing `claude-code/testing`, run by
`claude plugin test <plugin-folder>`. Mount a component on each surface and
act on it by key:

```tsx
import { expect, test } from 'claude-code/testing';

const ABOVE = {
    plugin: 'my-mod',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const;

test('draws the health bar', async ($) => {
    for (const surface of ['terminal', 'desktop'] as const) {
        const ui = await $.ui.mount({ ...ABOVE, surface });
        expect((await ui.find({ type: 'Text', text: /▰/ }))?.text).toBe('▰▰▰▰▰▰▰▱▱▱');
        await ui.unmount();
    }
});
```

`claude plugin test` loads only the plugin under test, not its
dependencies. To test a mod that uses `$.kit`, load a stand-in through
`test(name, { plugins: [...] }, body)`, or test the drawing with a vendored
kit. The plugin's own tests
([`plugin/tests/kit.test.tsx`](https://github.com/aeriondyseti/plugin-kit/blob/main/plugin/tests/kit.test.tsx))
do the reverse: they load a consumer inline and press the kit's buttons.
