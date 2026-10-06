import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CI_TSCONFIG, CI_TYPES, copyEngineTypes } from './types.js';

function plugin(withTypes: boolean): string {
    const dir = mkdtempSync(join(tmpdir(), 'types-'));
    if (withTypes) {
        mkdirSync(join(dir, '.claude-plugin', 'types', 'claude-code'), { recursive: true });
        writeFileSync(join(dir, '.claude-plugin', 'types', 'claude-code', 'index.d.ts'), '// Written by Claude Code 2.1.290.\ndeclare module "claude-code" {}\n');
        writeFileSync(join(dir, '.claude-plugin', 'types', 'tsconfig.json'), '{ "include": ["../../hooks"] }');
    }
    return dir;
}

describe('copyEngineTypes', () => {
    it('copies the laid types to the same depth and writes a CI tsconfig once', () => {
        const dir = plugin(true);
        expect(copyEngineTypes(dir)).toEqual({ version: 'Claude Code 2.1.290', tsconfigWritten: true });
        expect(readFileSync(join(dir, CI_TYPES, 'tsconfig.json'), 'utf8')).toContain('../../hooks');
        expect(JSON.parse(readFileSync(join(dir, CI_TSCONFIG), 'utf8'))).toEqual({
            extends: './.claude-ci/types/tsconfig.json',
            compilerOptions: { allowImportingTsExtensions: true },
        });
        expect(copyEngineTypes(dir).tsconfigWritten).toBe(false);
    });

    it('says how to get the types when Claude Code has not laid them', () => {
        expect(() => copyEngineTypes(plugin(false))).toThrow(/run `claude --plugin-dir/);
    });
});
