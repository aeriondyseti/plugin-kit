import { describe, expect, it } from 'vitest';
import {
    checkDependencies,
    checkManifest,
    checkModSource,
    checkTsconfig,
    checkVendored,
    commandsIn,
    expandVars,
    parseHooksJson,
    splitCommand,
} from './checks.js';

const checks = (findings: Array<{ check: string }>) => findings.map((f) => f.check);

describe('checkManifest', () => {
    it('needs a manifest with a name; suggests a version', () => {
        expect(checks(checkManifest(undefined))).toEqual(['manifest/missing']);
        expect(checks(checkManifest('{'))).toEqual(['manifest/json']);
        expect(checks(checkManifest('{"version":"1.0.0"}'))).toEqual(['manifest/name']);
        expect(checks(checkManifest('{"name":"m"}'))).toEqual(['manifest/version']);
        expect(checkManifest('{"name":"m","version":"1.0.0"}')).toEqual([]);
    });

    it('flags a bare plugin-kit dependency and notes the allowlist otherwise', () => {
        expect(checks(checkDependencies(['plugin-kit']))).toEqual(['deps/bare-kit']);
        expect(checks(checkDependencies([{ name: 'plugin-kit', marketplace: 'aeriondyseti-plugins' }]))).toEqual(['deps/allowlist']);
        expect(checks(checkDependencies(['plugin-kit@aeriondyseti-plugins', 'other']))).toEqual(['deps/allowlist']);
    });
});

describe('hooks.json', () => {
    it('reads modules and command hooks', () => {
        const parsed = parseHooksJson(JSON.stringify({
            modules: ['./register.tsx'],
            hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'node a.js' }, { type: 'prompt', prompt: 'x' }] }] },
        }));
        expect(parsed).toEqual({ modules: ['./register.tsx'], commands: ['node a.js'], findings: [] });
        expect(checks(parseHooksJson('nope').findings)).toEqual(['hooks/json']);
        expect(commandsIn({ Stop: [{ hooks: [{ type: 'command', command: 'x' }] }] })).toEqual(['x']);
    });
});

describe('checkModSource', () => {
    it('refuses dynamic and npm imports, allowing type-only ones', () => {
        const src = [
            "import type { Register } from 'claude-code'",
            "import { atom } from 'claude-code'",
            "import { hydrate } from './hydrate.ts'",
            "import type { X } from '@aeriondyseti/plugin-kit'",
            "import { type Y, type Z as W } from 'lib'",
            "import { describeWidgets } from '@aeriondyseti/plugin-kit/widgets'",
            "const later = await import('./x.ts')",
        ].join('\n');
        const found = checkModSource('hooks/register.tsx', src);
        expect(found.map((f) => [f.check, f.line])).toEqual([['mod/dynamic-import', 7], ['mod/npm-import', 6]]);
        expect(found[1]?.fix).toMatch(/plugin-kit vendor/);
    });

    it('refuses a noun of $ used as a value, but not $ itself or a call on a noun', () => {
        const src = [
            "on('x', async ($, e, next) => {",
            '  helper($, e)',
            '  $.ui.toast("hi")',
            '  await $.kit?.render({})',
            '  const ui = $.ui',
            '  show($.state, 1)',
            '  if (typeof $.kit) {}',
            '})',
        ].join('\n');
        expect(checkModSource('a.ts', src).map((f) => [f.check, f.line])).toEqual([
            ['mod/noun-as-value', 5],
            ['mod/noun-as-value', 6],
            ['mod/noun-as-value', 7],
        ]);
    });

    it('finds a Button without onPress, in JSX or h(), ignoring comments', () => {
        const src = [
            '<Button key="a" label="A" onPress={() => go()} />',
            '<Button key="b" label={x > 1 ? "B" : "b"} />',
            "h('Button', { key: 'c', label: 'C' })",
            "h('Button', { key: 'd', onPress: () => {} })",
            '<Button {...props} />',
            '// <Button key="e" />',
        ].join('\n');
        expect(checkModSource('a.tsx', src).map((f) => [f.check, f.line])).toEqual([['mod/button-onpress', 2], ['mod/button-onpress', 3]]);
    });
});

describe('checkTsconfig', () => {
    it('wants allowImportingTsExtensions when sources import .ts by name', () => {
        expect(checkTsconfig('{"extends":"./.claude-plugin/types/tsconfig.json"}', true).map((f) => f.check)).toEqual(['ts/ts-extensions']);
        expect(checkTsconfig('{"compilerOptions":{"allowImportingTsExtensions": true}}', true)).toEqual([]);
        expect(checkTsconfig(undefined, true).map((f) => f.check)).toEqual(['ts/no-tsconfig']);
        expect(checkTsconfig(undefined, false)).toEqual([]);
    });
});

describe('checkVendored', () => {
    it('flags a copy that differs, naming the command that refreshes it', () => {
        expect(checkVendored('hooks/kit/types.ts', 'a', 'a', 'kit')).toEqual([]);
        expect(checkVendored('hooks/kit/types.ts', 'a', 'b', 'kit')[0]?.fix).toBe('npx @aeriondyseti/plugin-kit vendor kit');
        expect(checkVendored('hooks/hydrate.ts', 'a', 'b', 'hydrate')[0]?.fix).toBe('npx @aeriondyseti/plugin-kit add-kit');
    });
});

describe('commands', () => {
    it('splits words as a shell would for simple quoting', () => {
        expect(splitCommand('node "$CLAUDE_PROJECT_DIR"/.claude/hooks/a.ts --x \'y z\'')).toEqual(['node', '$CLAUDE_PROJECT_DIR/.claude/hooks/a.ts', '--x', 'y z']);
        expect(splitCommand('  python3  guard.py ')).toEqual(['python3', 'guard.py']);
        expect(splitCommand('echo ""')).toEqual(['echo', '']);
        expect(splitCommand('node "C:\\Users\\me\\a.ts" "say \\"hi\\""')).toEqual(['node', 'C:\\Users\\me\\a.ts', 'say "hi"']);
    });

    it('expands the Claude Code variables it knows', () => {
        expect(expandVars('node ${CLAUDE_PLUGIN_ROOT}/h.js $CLAUDE_PROJECT_DIR $HOME', { CLAUDE_PLUGIN_ROOT: '/p', CLAUDE_PROJECT_DIR: '/q' })).toBe('node /p/h.js /q $HOME');
    });
});
