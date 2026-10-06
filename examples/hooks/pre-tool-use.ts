#!/usr/bin/env node
/**
 * Dogfood PreToolUse hook.
 *
 * Demonstrates:
 *   - `runHook` for protocol-correct error handling.
 *   - Tri-state `PreToolUse.emitOutput({ decision })`.
 *   - `OutputBuilder` with icons, tags, box, and table.
 *
 * In a real project, replace the relative import with:
 *   import { runHook, PreToolUse, OutputBuilder, ICONS } from '@aeriondyseti/plugin-kit';
 */
import { ICONS, OutputBuilder, PreToolUse, runHook } from '../../src/index.js';
import { flatten } from './_flatten.js';

export function handle(input: ReturnType<typeof PreToolUse.parse>): void {
    const cmd = String((input.tool_input as { command?: unknown }).command ?? '');
    const isDangerousRm = /\brm\b.*\s-[a-z]*rf?\s+\//.test(cmd);

    if (isDangerousRm) {
        PreToolUse.emitOutput({
            decision: 'deny',
            reason: `Refusing ${ICONS.cross} dangerous rm -rf on the filesystem root.`,
        });
    }

    const toUser = new OutputBuilder()
        .appendBox(`${ICONS.arrow} ${input.tool_name}`, {
            title: `${ICONS.bullet} PreToolUse`,
            color: 'yellow',
        })
        .appendTable(flatten(input.tool_input), {
            headers: ['key', 'value'],
            color: 'yellow',
        });

    PreToolUse.emitOutput({ toUser });
}

// Only drive stdin when run as a script, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
    runHook(() => handle(PreToolUse.parse()));
}
