import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addKit, HYDRATE_HEADER, KIT_DEPENDENCY } from './addKit.js';

function plugin(manifest: object, hooksJson?: object): string {
    const dir = mkdtempSync(join(tmpdir(), 'add-kit-'));
    mkdirSync(join(dir, '.claude-plugin'));
    mkdirSync(join(dir, 'hooks'));
    writeFileSync(join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify(manifest, null, 4));
    if (hooksJson) writeFileSync(join(dir, 'hooks', 'hooks.json'), JSON.stringify(hooksJson));
    return dir;
}

const manifestOf = (dir: string): Record<string, unknown> =>
    JSON.parse(readFileSync(join(dir, '.claude-plugin', 'plugin.json'), 'utf8'));

describe('addKit', () => {
    it('adds the dependency and writes hydrate.ts beside the hooks module', () => {
        const dir = plugin({ name: 'mine', dependencies: ['other'] }, { modules: ['./mod/register.tsx'] });
        mkdirSync(join(dir, 'hooks', 'mod'));

        const result = addKit(dir, 'export const x = 1;\n');

        expect(result).toEqual({ dependencyAdded: true, hydratePath: 'hooks/mod/hydrate.ts', hydrate: 'created' });
        expect(manifestOf(dir).dependencies).toEqual(['other', KIT_DEPENDENCY]);
        expect(readFileSync(join(dir, 'hooks', 'mod', 'hydrate.ts'), 'utf8')).toBe(`${HYDRATE_HEADER}export const x = 1;\n`);
    });

    it('keeps the manifest indentation', () => {
        const dir = plugin({ name: 'mine' });
        addKit(dir, '');
        expect(readFileSync(join(dir, '.claude-plugin', 'plugin.json'), 'utf8')).toMatch(/^\{\n {4}"name"/);
    });

    it('is idempotent, and leaves any existing spelling of the dependency alone', () => {
        for (const existing of ['plugin-kit', 'plugin-kit@elsewhere', { name: 'plugin-kit', version: '^0.1.0' }]) {
            const dir = plugin({ name: 'mine', dependencies: [existing] });
            addKit(dir, 'a');
            const again = addKit(dir, 'a');
            expect(again).toEqual({ dependencyAdded: false, hydratePath: 'hooks/hydrate.ts', hydrate: 'unchanged' });
            expect(manifestOf(dir).dependencies).toEqual([existing]);
        }
    });

    it('updates a stale hydrate.ts', () => {
        const dir = plugin({ name: 'mine' });
        addKit(dir, 'old');
        expect(addKit(dir, 'new').hydrate).toBe('updated');
    });

    it('creates hooks/ for a plugin that has none yet', () => {
        const dir = mkdtempSync(join(tmpdir(), 'add-kit-'));
        mkdirSync(join(dir, '.claude-plugin'));
        writeFileSync(join(dir, '.claude-plugin', 'plugin.json'), '{"name":"t"}');
        expect(addKit(dir, 'x').hydratePath).toBe('hooks/hydrate.ts');
        expect(readFileSync(join(dir, 'hooks', 'hydrate.ts'), 'utf8')).toBe(`${HYDRATE_HEADER}x`);
    });

    it('refuses a folder that is not a plugin', () => {
        const dir = mkdtempSync(join(tmpdir(), 'add-kit-'));
        expect(() => addKit(dir, '')).toThrow(/no \.claude-plugin\/plugin\.json/);
    });
});
