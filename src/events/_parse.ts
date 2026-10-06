/**
 * Shared stdin read + event-name validation for all hook events.
 *
 * Each event's static `parse()` calls `readHookInput('PreToolUse')` to get a
 * validated raw payload, typed so `hook_event_name` is narrowed to the
 * expected literal. Field keys stay snake_case — they match the Claude Code
 * hook spec verbatim, so what you read in the docs is what you type.
 *
 * Parse failures throw `HookParseError`. It carries the would-be exit code
 * (2) and a human-readable message so callers can handle it however they
 * like — write to stderr and exit, turn it into a different signal, swallow
 * it in tests, etc.
 */
import {
    readStdinSync,
    type CommonHookInput,
    type HookEventName,
} from '../common.js';

export type RawHookInput<N extends HookEventName> =
    CommonHookInput & { hook_event_name: N };

/**
 * Thrown when `readHookInput` can't produce a valid payload for the expected
 * event. The message is user-facing; `exitCode` is the hook-protocol signal
 * a top-level runner should relay to the OS.
 */
export class HookParseError extends Error {
    readonly exitCode = 2 as const;
    constructor(public readonly parseError: string) {
        super(`plugin-kit: ${parseError}`);
        this.name = 'HookParseError';
    }
}

/**
 * Read + JSON-parse stdin, verify it matches `expected`. Throws
 * `HookParseError` on any failure — malformed JSON or a mismatched
 * `hook_event_name`.
 */
export function readHookInput<N extends HookEventName>(expected: N): RawHookInput<N> {
    const raw = readStdinSync();
    let json: CommonHookInput;
    try {
        json = JSON.parse(raw) as CommonHookInput;
    } catch (e) {
        throw new HookParseError(`failed to parse stdin as JSON (${(e as Error).message})`);
    }
    if (json.hook_event_name !== expected) {
        throw new HookParseError(
            `this script expects a ${expected} hook, but got ` +
            `hook_event_name="${json.hook_event_name}". ` +
            `Check settings.json — the script is wired to the wrong event.`,
        );
    }
    return json as RawHookInput<N>;
}
