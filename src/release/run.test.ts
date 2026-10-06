import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyRelease, describePlan, gitIn, planRelease } from './run.js';

const CHANGELOG = '# Changelog\n\n## [Unreleased]\n\n- A thing.\n\n## [1.0.0] - 2026-01-01\n\n- First.\n\n[Unreleased]: https://github.com/o/r/compare/v1.0.0...HEAD\n';

// A real git repo with a package, a plugin and a CHANGELOG, committed.
function repo(): string {
    const root = mkdtempSync(join(tmpdir(), 'release-'));
    const git = gitIn(root);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    git('config', 'commit.gpgsign', 'false');
    git('config', 'tag.gpgsign', 'false');
    writeFileSync(join(root, 'package.json'), '{\n    "name": "pkg",\n    "version": "1.0.0"\n}\n');
    mkdirSync(join(root, 'plugin', '.claude-plugin'), { recursive: true });
    writeFileSync(join(root, 'plugin', '.claude-plugin', 'plugin.json'), '{ "name": "kit", "version": "0.1.0" }\n');
    writeFileSync(join(root, 'CHANGELOG.md'), CHANGELOG);
    git('add', '-A');
    git('commit', '-q', '-m', 'init');
    return root;
}

describe('planRelease', () => {
    it('plans every edit without writing anything', () => {
        const root = repo();
        const plan = planRelease({ root, bump: 'minor', plugin: 'plugin', date: '2026-10-06' });
        expect(plan).toMatchObject({ version: '1.1.0', pluginVersion: '0.2.0', tag: 'v1.1.0', branch: 'main' });
        expect(plan.edits.map((e) => e.path)).toEqual(['package.json', 'plugin/.claude-plugin/plugin.json', 'CHANGELOG.md']);
        expect(readFileSync(join(root, 'package.json'), 'utf8')).toContain('"1.0.0"');
        expect(describePlan(plan, root)).toContain('release 1.1.0 (plugin 0.2.0) on main');
    });

    it('refuses a dirty tree, an existing tag, and an empty changelog', () => {
        const root = repo();
        writeFileSync(join(root, 'stray.txt'), 'x');
        expect(() => planRelease({ root, bump: 'patch' })).toThrow(/working tree has changes/);

        const tagged = repo();
        gitIn(tagged)('tag', 'v1.0.1');
        expect(() => planRelease({ root: tagged, bump: 'patch' })).toThrow(/tag v1.0.1 already exists/);

        const empty = repo();
        writeFileSync(join(empty, 'CHANGELOG.md'), '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - x\n');
        gitIn(empty)('commit', '-qam', 'empty');
        expect(() => planRelease({ root: empty, bump: 'patch' })).toThrow(/nothing to release/);
    });
});

describe('applyRelease', () => {
    it('commits, tags, and pins the marketplace to the tagged commit', () => {
        const root = repo();
        const market = join(mkdtempSync(join(tmpdir(), 'market-')), 'marketplace.json');
        writeFileSync(market, '{"plugins": [{ "name": "kit", "source": { "source": "git-subdir", "ref": "v0", "sha": "old" }, "version": "0.1.0" }]}\n');

        const plan = planRelease({ root, bump: 'patch', plugin: 'plugin', marketplace: market, date: '2026-10-06' });
        applyRelease(plan, root);

        const git = gitIn(root);
        expect(git('log', '-1', '--format=%s')).toBe('Release 1.0.1');
        expect(git('cat-file', '-t', 'v1.0.1')).toBe('tag'); // annotated
        expect(git('status', '--porcelain')).toBe('');
        const sha = git('rev-parse', 'v1.0.1^{commit}');
        expect(readFileSync(market, 'utf8')).toBe(`{"plugins": [{ "name": "kit", "source": { "source": "git-subdir", "ref": "v1.0.1", "sha": "${sha}" }, "version": "0.1.1" }]}\n`);
        expect(readFileSync(join(root, 'CHANGELOG.md'), 'utf8')).toContain('## [1.0.1] - 2026-10-06\n\n- A thing.');
    });

    it('releases a plugin-only repo by its plugin.json version', () => {
        const root = repo();
        const git = gitIn(root);
        git('rm', '-q', 'package.json');
        git('commit', '-qm', 'no package');
        const plan = planRelease({ root, bump: 'minor', plugin: 'plugin' });
        expect(plan).toMatchObject({ version: '0.2.0', pluginVersion: '0.2.0', tag: 'v0.2.0' });
    });
});
