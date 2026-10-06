import { describe, expect, it } from 'vitest';
import { HOOK_EVENT_NAMES } from '../common.js';
import { hookFiles, hookSettings, isHookEvent, kebab, modFiles } from './templates.js';

describe('hook templates', () => {
    it('names files after the event', () => {
        expect(kebab('PreToolUse')).toBe('pre-tool-use');
        expect(Object.keys(hookFiles('Stop'))).toEqual(['stop.ts', 'stop.test.ts']);
        expect(isHookEvent('Stop')).toBe(true);
        expect(isHookEvent('Stopp')).toBe(false);
    });

    it('has a template for every event', () => {
        for (const event of HOOK_EVENT_NAMES) expect(hookFiles(event)[`${kebab(event)}.ts`]).toContain(`handle(input: ${event}Input)`);
    });

    it('wires settings with a matcher only for tool events', () => {
        expect(JSON.parse(hookSettings('PreToolUse', 'node h.ts'))).toEqual({
            hooks: { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'node h.ts' }] }] },
        });
        expect(JSON.parse(hookSettings('Stop', 'node h.ts')).hooks.Stop[0]).not.toHaveProperty('matcher');
    });
});

describe('mod templates', () => {
    it('writes a complete mod', () => {
        expect(Object.keys(modFiles('my-mod')).sort()).toEqual([
            '.claude-plugin/plugin.json',
            '.gitignore',
            'README.md',
            'hooks/hooks.json',
            'hooks/register.tsx',
            'tests/my-mod.test.tsx',
            'tsconfig.json',
        ]);
        expect(JSON.parse(modFiles('my-mod')['.claude-plugin/plugin.json']!)).toEqual({
            name: 'my-mod',
            version: '0.1.0',
            description: 'My Mod: a Claude Code mod',
        });
    });

    it('credits the author when known', () => {
        expect(JSON.parse(modFiles('m', 'none', 'Ada')['.claude-plugin/plugin.json']!).author).toEqual({ name: 'Ada' });
    });

    it('draws through $.kit, a vendored kit, or neither', () => {
        expect(modFiles('m', 'kit')['hooks/register.tsx']).toContain('await $.kit.render(');
        expect(modFiles('m', 'kit')['tests/m.test.tsx']).toContain('{ plugins: [kitStub] }');
        expect(modFiles('m', 'vendor')['hooks/register.tsx']).toContain("from './kit/index.ts'");
        expect(modFiles('m')['hooks/register.tsx']).not.toContain('kit');
    });
});
