#!/usr/bin/env node
/**
 * Dogfood SessionStart hook — context-injection pattern.
 *
 * SessionStart has no allow/deny concept: its job is to feed `additionalContext`
 * into Claude's next turn via `toClaude`. This hook ships a short session
 * preamble (timestamp, source, cwd) so Claude sees consistent framing every
 * time a session opens.
 *
 * Demonstrates:
 *   - `SessionStart.parse()` + `.emitOutput({ toClaude, toUser })`.
 *   - A pure `buildContext(input)` that's trivially testable without I/O.
 *   - `mockSessionStart` in the companion test.
 *
 * In a real project, replace the relative import with:
 *   import { runHook, SessionStart, OutputBuilder, ICONS } from '@aeriondyseti/plugin-kit';
 */
import { pathToFileURL } from 'node:url';
import { ICONS, OutputBuilder, runHook, SessionStart } from '../../src/index.js';

export function buildContext(input: ReturnType<typeof SessionStart.parse>): string {
    const model = input.model ?? 'unknown';
    return [
        `Session opened at ${new Date().toISOString()}.`,
        `Source: ${input.source}. Model: ${model}.`,
        `Working directory: ${input.cwd}.`,
    ].join('\n');
}

export function handle(input: ReturnType<typeof SessionStart.parse>): void {
    const toUser = new OutputBuilder().appendLine(
        `${ICONS.info} <color:"cyan">session started</color> ` +
        `<color:"gray">(${input.source}${input.model ? `, ${input.model}` : ''})</color>`,
    );

    SessionStart.emitOutput({
        toUser,
        toClaude: buildContext(input),
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    runHook(() => handle(SessionStart.parse()));
}
