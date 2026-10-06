/**
 * Opt-in wrapper for a hook script's body.
 *
 * The library's `parse()` methods throw `HookParseError` on bad input — that
 * keeps the parser SRP-clean, but it means a bare top-level script would
 * exit with Node's default (code 1 + a stack trace) on a misconfigured
 * `settings.json`. Claude Code's hook protocol distinguishes exit 2
 * (blocking error, stderr relayed to Claude) from exit 1 (non-blocking), so
 * that default is worse than the old auto-handling.
 *
 * Wrap your hook body in `runHook` to restore the protocol-correct behavior
 * without giving up the flexibility of opting out:
 *
 *   // hooks/pre-tool-use.ts
 *   import { runHook, PreToolUse } from '@aeriondyseti/plugin-kit';
 *
 *   runHook(() => {
 *     const input = PreToolUse.parse();
 *     if (isDangerous(input)) {
 *       PreToolUse.emitOutput({ decision: 'deny', reason: '...' });
 *     } else {
 *       PreToolUse.emitOutput({});
 *     }
 *   });
 *
 * `emitOutput` calls `process.exit(0)` itself on success, so `runHook` only
 * needs to catch failures. A non-parse error is re-thrown so Node's default
 * handling (stack trace, exit 1) still surfaces actual bugs.
 */

import { HookParseError } from './events/_parse.js';

export function runHook(fn: () => void): void {
    try {
        fn();
    } catch (e) {
        if (e instanceof HookParseError) {
            process.stderr.write(`${e.message}\n`);
            process.exit(e.exitCode);
        }
        throw e;
    }
}
