import { describe, expect, it } from 'vitest';
import { DEFAULT_PROPS, mountTarget, replay, replayAll, replayPlan, type ReplayEngine } from './index.js';

describe('mountTarget', () => {
    it('fills in default props, letting you override some', () => {
        expect(mountTarget('m', 'Pane', 'desktop', { title: 'Stats' }, 'stats')).toEqual({
            plugin: 'm',
            component: 'Pane',
            surface: 'desktop',
            props: { ...DEFAULT_PROPS.Pane, title: 'Stats' },
            requestId: 'stats',
        });
        expect(mountTarget('m', 'AbovePrompt', 'terminal')).not.toHaveProperty('requestId');
    });
});

describe('replayPlan', () => {
    it('replays PreToolUse as the tool call that raises it', () => {
        expect(replayPlan({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' }, tool_use_id: 'u' })).toEqual({
            kind: 'tool',
            call: { tool: 'Bash', command: 'ls' },
        });
    });

    it('replays other events as classic events, without the name the kit stamps', () => {
        expect(replayPlan({ hook_event_name: 'Stop', session_id: 's', stop_hook_active: false })).toEqual({
            kind: 'classic',
            event: 'Stop',
            fields: { session_id: 's', stop_hook_active: false },
        });
    });
});

describe('replay', () => {
    const calls: unknown[] = [];
    const $: ReplayEngine = {
        classic: { Stop: async (fields) => (calls.push(['Stop', fields]), { block: 'x' }) },
        tool: { call: async (input) => (calls.push(['tool', input]), { result: 'ran' }) },
    };

    it('raises each fixture through the engine and collects the answers', async () => {
        const answers = await replayAll($, {
            'Stop/a.json': { hook_event_name: 'Stop', stop_hook_active: false },
            'PreToolUse/b.json': { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: '/x' } },
        });
        expect(answers).toEqual([
            { name: 'Stop/a.json', event: 'Stop', answer: { block: 'x' } },
            { name: 'PreToolUse/b.json', event: 'PreToolUse', answer: { result: 'ran' } },
        ]);
        expect(calls).toEqual([['Stop', { stop_hook_active: false }], ['tool', { tool: 'Read', file_path: '/x' }]]);
    });

    it('names an event the engine does not have', async () => {
        await expect(replay($, { hook_event_name: 'Nope' })).rejects.toThrow(/no classic event Nope/);
    });
});
