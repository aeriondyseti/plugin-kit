/**
 * Shared emit: serialize payload to stdout, then exit.
 *
 * Uses `writeSync` on fd 1 so the payload is flushed before `process.exit`
 * (async stdout can drop buffered writes when the process exits).
 *
 * Test harness hooks in via `_setEmitCapture`: when a capture slot is
 * installed, `emitJson` stores the payload + exit code and throws a
 * sentinel instead of writing/exiting. The harness catches the sentinel
 * and returns what would've been emitted.
 */
import { writeSync } from 'node:fs';

export const _CAPTURED_SENTINEL: unique symbol = Symbol('plugin-kit:captured');

export interface EmitCaptureSlot {
    payload?: unknown;
    exitCode?: number;
}

let _capture: EmitCaptureSlot | undefined;

export function _setEmitCapture(slot: EmitCaptureSlot): void {
    _capture = slot;
}

export function _clearEmitCapture(): void {
    _capture = undefined;
}

export function emitJson(payload: object, exitCode = 0): never {
    return emitRaw(payload, JSON.stringify(payload), exitCode);
}

/** For the rare event whose protocol is plain stdout text, not JSON (WorktreeCreate). */
export function emitText(text: string, exitCode = 0): never {
    return emitRaw(text, text, exitCode);
}

function emitRaw(payload: unknown, serialized: string, exitCode: number): never {
    if (_capture) {
        _capture.payload = payload;
        _capture.exitCode = exitCode;
        throw _CAPTURED_SENTINEL;
    }
    writeSync(1, serialized);
    process.exit(exitCode);
}
