#!/usr/bin/env node
/**
 * Dogfood PostToolUse hook.
 *
 * Demonstrates:
 *   - Binary-deny events: `deny: true` maps to the protocol's top-level
 *     `decision: 'block'`.
 *   - `toClaude` for feeding extra context back into Claude's next turn.
 *
 * In a real project, replace the relative import with:
 *   import { runHook, PostToolUse, OutputBuilder, ICONS } from '@aeriondyseti/plugin-kit';
 */
import { pathToFileURL } from 'node:url';
import { ICONS, OutputBuilder, PostToolUse, runHook } from '../../src/index.js';
import { flatten } from './_flatten.js';

export function handle(input: ReturnType<typeof PostToolUse.parse>): void {
    const response = input.tool_response as { stderr?: string } | undefined;
    const stderr = response?.stderr ?? '';

    if (/permission denied/i.test(stderr)) {
        PostToolUse.emitOutput({
            deny: true,
            reason: `${ICONS.cross} Tool failed with a permission error — investigate before retrying.`,
            toClaude: 'The previous tool call was blocked by filesystem permissions.',
        });
    }

    const toUser = new OutputBuilder()
        .appendBox(`${ICONS.check} ${input.tool_name}`, {
            title: `${ICONS.bullet} PostToolUse`,
            color: 'green',
        })
        .appendTable(flatten({ tool_input: input.tool_input, tool_response: input.tool_response }), {
            headers: ['key', 'value'],
            color: 'green',
        });

    PostToolUse.emitOutput({ toUser });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runHook(() => handle(PostToolUse.parse()));
}
