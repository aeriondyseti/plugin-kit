#!/usr/bin/env node
/**
 * Dogfood UserPromptSubmit hook.
 *
 * Demonstrates:
 *   - Rejecting a prompt with `deny: true`.
 *   - `appendDivider` and `appendList` for simple section separators.
 *
 * In a real project, replace the relative import with:
 *   import { runHook, UserPromptSubmit, OutputBuilder, ICONS } from '@aeriondyseti/plugin-kit';
 */
import { ICONS, OutputBuilder, runHook, UserPromptSubmit } from '../../src/index.js';

const FORBIDDEN_TOKENS = ['leak-my-secrets', 'exfiltrate'];

export function handle(input: ReturnType<typeof UserPromptSubmit.parse>): void {
    const lower = input.prompt.toLowerCase();
    const hit = FORBIDDEN_TOKENS.find((tok) => lower.includes(tok));
    if (hit) {
        UserPromptSubmit.emitOutput({
            deny: true,
            reason: `${ICONS.cross} prompt contained forbidden token: "${hit}"`,
        });
    }

    const toUser = new OutputBuilder()
        .appendDivider('─', { color: 'cyan' })
        .appendLine(`${ICONS.info} <color:"cyan"><bold>UserPromptSubmit</bold></color>`)
        .appendList([
            `<color:"gray">session</color> ${input.session_id}`,
            `<color:"gray">cwd</color> ${input.cwd}`,
            `<color:"gray">length</color> ${input.prompt.length} chars`,
        ])
        .appendDivider('─', { color: 'cyan' });

    UserPromptSubmit.emitOutput({ toUser });
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runHook(() => handle(UserPromptSubmit.parse()));
}
