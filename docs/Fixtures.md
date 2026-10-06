# Fixtures

Testing a hook by running a session takes minutes; replaying what a session
sent takes milliseconds. A **fixture** is one real payload Claude Code sent a
hook, saved as JSON:

```
.claude/fixtures/PreToolUse/20261006-142233-Bash.json
.claude/fixtures/UserPromptSubmit/20261006-142301.json
```

## Record

Add `plugin-kit record` as a command hook for the events you want, in
`settings.json`:

```json
{
    "hooks": {
        "PreToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "plugin-kit record" }] }],
        "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "plugin-kit record" }] }]
    }
}
```

Use a session normally; each call is saved under
`$CLAUDE_PROJECT_DIR/.claude/fixtures/<Event>/` (or `--out <dir>`), named by
time and the tool, source or trigger. The recorder prints nothing and always
exits 0, so it never changes what Claude does. Install the package globally
(`npm i -g @aeriondyseti/plugin-kit`) or in the project: through `npx` every
call would pay its start-up time.

Payloads hold what the session held: paths, prompts, file contents. Read
them before you commit them.

## Replay against a hook: `plugin-kit run`

```bash
plugin-kit run "node .claude/hooks/pre-tool-use.ts" .claude/fixtures
plugin-kit run "node hook.ts" .claude/fixtures --event PreToolUse
plugin-kit run "python guard.py" fixture.json --json
```

Each fixture is piped to the command through the shell, exactly as a
settings hook gets it, and you get what it decided:

```
✓ .claude/fixtures/PreToolUse/20261006-145042-Bash.json  PreToolUse  denied  60ms
    to Claude: refused: rm -rf /
✓ .claude/fixtures/PreToolUse/20261006-145043-Bash.json  PreToolUse  allowed  58ms
2 run, 0 failed
```

A run fails (✗, exit code 1) when the hook crashes, exits with anything
but 0 or 2, times out (60 s), or prints something that isn't JSON. Exit 2
is reported as `blocked (exit 2)`, the protocol's blocking error. It works
with a hook in any language.

## Replay in unit tests: `loadFixtures`

```ts
import { PreToolUse } from '@aeriondyseti/plugin-kit';
import { loadFixtures, testHook } from '@aeriondyseti/plugin-kit/testing';
import { handle } from './pre-tool-use.js';

for (const fixture of loadFixtures('.claude/fixtures', { event: 'PreToolUse' })) {
    it(`handles ${fixture.path}`, () => {
        const result = testHook(fixture.input, () => PreToolUse.emitOutput(handle(PreToolUse.parse())));
        expect(result.wasDenied).toBe(JSON.stringify(fixture.input.tool_input).includes('rm -rf'));
    });
}
```

`loadFixture(path)` loads one; both return `{ path, event, input }`.

## Replay in mod tests: `plugin-kit fixtures`

`claude plugin test` runs where there's no file system, but a test can
import a `.ts` file. Turn a fixtures folder into one:

```bash
plugin-kit fixtures .claude/fixtures --out tests/fixtures.ts
```

and replay it through your mod with the [testing helpers](Testing.md#replaying-fixtures):

```ts
import { replayAll } from './kit-testing/index.ts';
import { fixtures } from './fixtures.ts';

const answers = await replayAll($, fixtures);
```
