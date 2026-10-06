# examples

Dogfood hooks that use `plugin-kit` itself. Each file demonstrates a different
slice of the library and ships with a colocated test.

| Hook                                          | What it shows                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| [`hooks/pre-tool-use.ts`](hooks/pre-tool-use.ts)                 | Deny branch, `OutputBuilder` with box + table, icons.                         |
| [`hooks/pre-tool-use-advanced.ts`](hooks/pre-tool-use-advanced.ts) | `decision: 'ask'` escalation and `updatedInput` rewrites.                     |
| [`hooks/post-tool-use.ts`](hooks/post-tool-use.ts)               | Binary `deny: true` → top-level block, `toClaude` context injection.          |
| [`hooks/user-prompt-submit.ts`](hooks/user-prompt-submit.ts)     | Prompt-level deny, `appendDivider` + `appendList` for compact output.         |
| [`hooks/session-start.ts`](hooks/session-start.ts)               | Context-injection pattern — no deny concept, just `toClaude` + `toUser`.      |

Each hook's companion test file (`*.test.ts`) shows how to:

- construct synthetic inputs with `mockXxx(overrides)`,
- drive the hook under `testHook(...)`,
- assert behavior via the normalized result fields (`wasDenied`,
  `wasAllowed`, `toUser`, `toClaude`).

## Running

```bash
npm test           # runs src + examples together
npx tsc -p examples/tsconfig.json   # typecheck just the examples
```

## Importing from your own project

The examples import from a relative path so the monorepo build works without
`npm link`. In your own project, replace the relative import:

```ts
// examples use this:
import { runHook, PreToolUse } from '../../src/index.js';

// your code would use this:
import { runHook, PreToolUse } from '@aeriondyseti/plugin-kit';
```
