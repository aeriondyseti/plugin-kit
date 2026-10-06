import { describe, expect, it } from 'vitest';
import type { Fixture } from '../fixtures.js';
import { mockPreToolUse } from '../testing.js';
import { formatResults, runFixtures } from './run.js';

const fixture: Fixture = { path: 'f.json', event: 'PreToolUse', input: { ...mockPreToolUse({ tool_name: 'Bash' }) } };
// A tiny hook written inline, so the test runs a real child process.
const hook = (body: string) => `node -e "${body.replace(/"/g, '\\"')}"`;

describe('runFixtures', () => {
    it('reports a JSON deny, with what Claude is told', () => {
        const [r] = runFixtures(
            hook(`process.stdin.resume();process.stdin.on('end',()=>{console.log(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:'nope'}}))})`),
            [fixture],
        );
        expect(r).toMatchObject({ verdict: 'denied', toClaude: 'nope', exitCode: 0 });
        expect(r?.problem).toBeUndefined();
    });

    it('sends the fixture on stdin', () => {
        const [r] = runFixtures(
            hook(`let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.stringify({systemMessage:JSON.parse(s).tool_name}))})`),
            [fixture],
        );
        expect(r?.toUser).toBe('Bash');
    });

    it('treats exit 2 as a block and other exits as failures', () => {
        expect(runFixtures(hook(`console.error('blocked');process.exit(2)`), [fixture])[0]).toMatchObject({ verdict: 'blocked (exit 2)', stderr: 'blocked' });
        expect(runFixtures(hook(`process.exit(1)`), [fixture])[0]?.problem).toBe('exit 1');
    });

    it('flags output that is not JSON, and allows an empty one', () => {
        expect(runFixtures(hook(`console.log('hello')`), [fixture])[0]?.problem).toMatch(/not JSON/);
        expect(runFixtures(hook(``), [fixture])[0]).toMatchObject({ verdict: 'allowed (no output)' });
    });
});

describe('formatResults', () => {
    it('marks failures and counts them', () => {
        const text = formatResults([
            { fixture: 'a.json', event: 'Stop', exitCode: 0, ms: 5, verdict: 'allowed' },
            { fixture: 'b.json', event: 'Stop', exitCode: 1, ms: 5, verdict: 'failed (non-blocking)', problem: 'exit 1' },
        ]);
        expect(text).toContain('✓ a.json  Stop  allowed  5ms');
        expect(text).toContain('✗ b.json');
        expect(text).toMatch(/2 run, 1 failed$/);
    });
});
