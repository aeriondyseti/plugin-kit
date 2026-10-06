import { afterEach, describe, expect, it, vi } from 'vitest';
import { HookParseError } from './events/_parse.js';
import { runHook } from './runHook.js';

describe('runHook', () => {
    afterEach(() => vi.restoreAllMocks());

    it('runs the body and returns when it completes without throwing', () => {
        const body = vi.fn();
        runHook(body);
        expect(body).toHaveBeenCalledOnce();
    });

    it('writes HookParseError to stderr and exits with the error exitCode', () => {
        const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
        // process.exit is declared `never`; make it throw so we can observe the call
        // without actually tearing down the test runner.
        const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
            throw new Error(`__exit:${code}`);
        }) as never);

        expect(() =>
            runHook(() => {
                throw new HookParseError('bad input');
            }),
        ).toThrow('__exit:2');

        expect(stderr).toHaveBeenCalledWith('plugin-kit: bad input\n');
        expect(exit).toHaveBeenCalledWith(2);
    });

    it('re-throws non-parse errors so real bugs still surface', () => {
        const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
        const boom = new Error('something broke');
        expect(() =>
            runHook(() => {
                throw boom;
            }),
        ).toThrow(boom);
        expect(stderr).not.toHaveBeenCalled();
    });
});
