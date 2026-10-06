import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { vendorFiles } from '../cli/addKit.js';
import { checkCommand, diagnose, formatFindings, which } from './run.js';

function tree(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), 'doctor-'));
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
    }
    return root;
}

// A PATH holding only `node`, so command checks don't depend on the machine.
const bin = tree({ [process.platform === 'win32' ? 'node.exe' : 'node']: '' });
const OPTS = { validate: false, path: bin, nodeVersion: '24.0.0' } as const;
const checks = (findings: Array<{ check: string }>) => findings.map((f) => f.check).sort();

describe('diagnose', () => {
    it('finds nothing wrong with a well-formed mod', () => {
        const root = tree({
            '.claude-plugin/plugin.json': '{ "name": "m", "version": "0.1.0" }',
            'hooks/hooks.json': '{ "modules": ["./register.tsx"] }',
            'hooks/register.tsx': "import type { Register } from 'claude-code'\nimport { x } from './x.ts'\nexport const register: Register = on => {}\n",
            'hooks/x.ts': 'export const x = 1\n',
            'tsconfig.json': '{ "compilerOptions": { "allowImportingTsExtensions": true } }',
        });
        expect(diagnose(root, OPTS).filter((f) => f.level !== 'info')).toEqual([]);
    });

    it('finds each problem in a broken one', () => {
        const root = tree({
            '.claude-plugin/plugin.json': '{ "name": "m", "dependencies": ["plugin-kit"] }',
            'hooks/hooks.json': JSON.stringify({
                modules: ['./register.tsx', './gone.ts'],
                hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node ${CLAUDE_PLUGIN_ROOT}/scripts/missing.mjs' }, { type: 'command', command: 'nosuchprogram --x' }] }] },
            }),
            'hooks/register.tsx': [
                "import { describeWidgets } from '@aeriondyseti/plugin-kit/widgets'",
                "import { y } from './y.ts'",
                "export const register = on => on('x', async ($, e, next) => { helper($); const ui = $.ui; return <Button key=\"b\" label=\"B\" /> })",
            ].join('\n'),
            'hooks/y.ts': 'export const y = await import("./z.ts")\n',
            'tsconfig.json': '{ "extends": "./.claude-plugin/types/tsconfig.json" }',
        });
        expect(checks(diagnose(root, OPTS))).toEqual([
            'command/launch',
            'command/not-found',
            'command/script-missing',
            'deps/bare-kit',
            'hooks/module-missing',
            'manifest/version',
            'mod/button-onpress',
            'mod/dynamic-import',
            'mod/noun-as-value',
            'mod/npm-import',
            'ts/ts-extensions',
        ]);
    });

    it('uses the tsconfig nearest the module, as tsc would', () => {
        const root = tree({
            '.claude-plugin/plugin.json': '{ "name": "m", "version": "0.1.0" }',
            'hooks/hooks.json': '{ "modules": ["../mod/register.ts"] }',
            'mod/register.ts': "import { x } from './x.ts'\n",
            'mod/x.ts': '',
            'mod/tsconfig.json': '{ "compilerOptions": { "allowImportingTsExtensions": true } }',
            'tsconfig.json': '{ "extends": "./.claude-plugin/types/tsconfig.json" }',
        });
        expect(diagnose(root, OPTS).filter((f) => f.level !== 'info')).toEqual([]);
    });

    it('flags a vendored copy that differs from this version', () => {
        const root = tree({ '.claude-plugin/plugin.json': '{ "name": "m", "version": "1.0.0" }' });
        vendorFiles(root, 'adapter', { 'index.ts': 'old\n' });
        const findings = diagnose(root, { ...OPTS, vendorSources: () => ({ 'index.ts': 'new\n' }) });
        expect(findings.map((f) => [f.check, f.file])).toEqual([['vendor/stale', 'hooks/adapter/index.ts']]);
        // A file of the same name the plugin wrote itself isn't judged.
        writeFileSync(join(root, 'hooks', 'adapter', 'index.ts'), '// my own\n');
        expect(diagnose(root, { ...OPTS, vendorSources: () => ({ 'index.ts': 'new\n' }) })).toEqual([]);
    });

    it("checks a project's settings hooks", () => {
        const root = tree({
            '.claude/settings.json': JSON.stringify({ hooks: { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/a.ts' }] }] } }),
            '.claude/hooks/a.ts': '',
        });
        const findings = diagnose(root, { ...OPTS, nodeVersion: '20.11.0' });
        expect(checks(findings)).toEqual(['command/launch', 'command/node-ts']);
        expect(diagnose(tree({}), OPTS).map((f) => f.check)).toEqual(['doctor/nothing']);
    });
});

describe('checkCommand', () => {
    it('suggests quoting an unquoted Claude path variable', () => {
        const root = tree({ 'h.js': '' });
        expect(checks(checkCommand('node $CLAUDE_PROJECT_DIR/h.js x', 's', root, false, OPTS))).toEqual(['command/launch', 'command/quoting']);
    });

    it('resolves programs on PATH', () => {
        expect(which('node', bin)).toBeDefined();
        expect(which('nosuchprogram', bin)).toBeUndefined();
    });
});

describe('formatFindings', () => {
    it('lists errors first, with fixes, and counts', () => {
        const text = formatFindings([
            { level: 'info', check: 'a', message: 'note' },
            { level: 'error', check: 'b', file: 'x.ts', line: 3, message: 'broken', fix: 'mend it' },
        ]);
        expect(text).toBe('✗ x.ts:3: broken\n    fix: mend it\nℹ note\n1 error(s), 0 warning(s), 1 note(s)');
    });
});
