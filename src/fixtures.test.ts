import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixturesModule, loadFixture, loadFixtures, recordFixture } from './fixtures.js';
import { PreToolUse } from './events/PreToolUse.js';
import { mockPreToolUse, mockStop, testHook } from './testing.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'fixtures-'));
const NOW = new Date('2026-10-06T14:22:33.456Z');

describe('recordFixture', () => {
    it('files a payload by event and time, labelled by the tool', () => {
        const dir = tmp();
        const path = recordFixture(JSON.stringify(mockPreToolUse({ tool_name: 'Bash' })), dir, NOW);
        expect(path).toBe(join(dir, 'PreToolUse', '20261006-142233-Bash.json'));
        expect(JSON.parse(readFileSync(path, 'utf8')).tool_name).toBe('Bash');
    });

    it('never overwrites a fixture recorded in the same second', () => {
        const dir = tmp();
        const first = recordFixture(JSON.stringify(mockStop()), dir, NOW);
        const second = recordFixture(JSON.stringify(mockStop()), dir, NOW);
        expect(second).not.toBe(first);
        expect(second).toMatch(/-2\.json$/);
    });

    it('refuses what is not a JSON object', () => {
        expect(() => recordFixture('not json', tmp())).toThrow(/not JSON/);
        expect(() => recordFixture('[1]', tmp())).toThrow(/not a JSON object/);
    });
});

describe('loadFixtures', () => {
    it('loads recursively, sorted, optionally by event', () => {
        const dir = tmp();
        recordFixture(JSON.stringify(mockStop()), dir, NOW);
        recordFixture(JSON.stringify(mockPreToolUse({ tool_name: 'Read' })), dir, NOW);
        mkdirSync(join(dir, 'notes'));
        writeFileSync(join(dir, 'notes', 'README.md'), 'ignored');

        expect(loadFixtures(dir).map((f) => f.event)).toEqual(['PreToolUse', 'Stop']);
        expect(loadFixtures(dir, { event: 'Stop' })).toHaveLength(1);
    });

    it('feeds testHook', () => {
        const dir = tmp();
        const path = recordFixture(JSON.stringify(mockPreToolUse({ tool_name: 'Bash', tool_input: { command: 'rm -rf /' } })), dir, NOW);
        const result = testHook(loadFixture(path).input, () => {
            const input = PreToolUse.parse();
            PreToolUse.emitOutput(String(input.tool_input.command).includes('rm') ? { decision: 'deny', reason: 'no' } : {});
        });
        expect(result.wasDenied).toBe(true);
    });
});

describe('fixturesModule', () => {
    it('is a TS module keyed by relative path', () => {
        const dir = tmp();
        recordFixture(JSON.stringify(mockStop()), dir, NOW);
        const source = fixturesModule(loadFixtures(dir), dir);
        expect(source).toContain('"Stop/20261006-142233.json": {"hook_event_name":"Stop"');
        expect(source).toMatch(/} as const;\n$/);
    });
});
