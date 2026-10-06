#!/usr/bin/env node
/**
 * Dogfood PreToolUse hook — the tri-state + updatedInput branches.
 *
 * Two policies layered on one hook:
 *
 *   1. `decision: 'ask'` — any Bash command that uses `sudo` gets escalated
 *      to a user confirmation prompt instead of silently allowed.
 *
 *   2. `updatedInput` — Write calls whose `content` lacks a trailing newline
 *      are transparently normalized. The tool still runs; it just runs with
 *      a slightly different payload than Claude proposed.
 *
 * Everything else is allowed.
 *
 * In a real project, replace the relative import with:
 *   import { runHook, PreToolUse } from '@aeriondyseti/plugin-kit';
 */
import { pathToFileURL } from 'node:url';
import { PreToolUse, runHook } from '../../src/index.js';

export function handle(input: ReturnType<typeof PreToolUse.parse>): void {
    if (input.tool_name === 'Bash') {
        const cmd = String((input.tool_input as { command?: unknown }).command ?? '');
        if (/\bsudo\b/.test(cmd)) {
            PreToolUse.emitOutput({
                decision: 'ask',
                reason: 'Command uses sudo — please confirm before running.',
            });
        }
    }

    if (input.tool_name === 'Write') {
        const content = (input.tool_input as { content?: unknown }).content;
        if (typeof content === 'string' && content.length > 0 && !content.endsWith('\n')) {
            PreToolUse.emitOutput({
                updatedInput: { ...input.tool_input, content: content + '\n' },
            });
        }
    }

    PreToolUse.emitOutput({});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runHook(() => handle(PreToolUse.parse()));
}
