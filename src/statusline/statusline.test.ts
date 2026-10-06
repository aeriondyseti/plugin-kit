import { describe, expect, it } from 'vitest';
import { stripTags } from '../formatting/tags.js';
import { composeStatusLine, DEFAULT_STATUS_LINE, parseStatusLineConfig, renderStatusItem } from './compose.js';
import { parseStatusLine, type StatusLineInput } from './input.js';
import { SOURCES } from './sources.js';

const NO_COLOR = { colors: false };

const INPUT: StatusLineInput = {
    model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' },
    workspace: { current_dir: '/home/me/plugin-kit', project_dir: '/home/me/plugin-kit' },
    worktree: { name: 'w', branch: 'feature/x' },
    cost: { total_cost_usd: 1.234, total_duration_ms: 3_900_000, total_lines_added: 12, total_lines_removed: 3 },
    context_window: { used_percentage: 45.6, total_input_tokens: 91_000, context_window_size: 200_000 },
    rate_limits: { five_hour: { used_percentage: 92, resets_at: 1 } },
    prompt_cache: { hit_ratio: 0.913, warm: true },
    pr: { number: 12 },
};

describe('sources', () => {
    it('read each value from the input', () => {
        expect(SOURCES.model!.read(INPUT)).toBe('Opus 5.5');
        expect(SOURCES['context.percent']!.read(INPUT)).toBe(46);
        expect(SOURCES['usage.five_hour']!.read(INPUT)).toBe(92);
        expect(SOURCES['cost.usd']!.read(INPUT)).toBe('$1.23');
        expect(SOURCES['session.duration']!.read(INPUT)).toBe('1h 05m');
        expect(SOURCES['lines.changed']!.read(INPUT)).toBe('+12 -3');
        expect(SOURCES['cache.hit']!.read(INPUT)).toBe(91);
        expect(SOURCES.dir!.read(INPUT)).toBe('plugin-kit');
        expect(SOURCES['git.branch']!.read(INPUT)).toBe('feature/x');
        expect(SOURCES.pr!.read(INPUT)).toBe('#12');
    });

    it('compute context use when no percentage is given, and give up on nothing', () => {
        expect(SOURCES['context.percent']!.read({ context_window: { total_input_tokens: 50, context_window_size: 200 } })).toBe(25);
        for (const source of Object.values(SOURCES)) {
            if (source !== SOURCES['git.branch']) expect(source.read({})).toBeUndefined();
        }
    });
});

describe('renderStatusItem', () => {
    const plain = (...args: Parameters<typeof renderStatusItem>) => stripTags(renderStatusItem(...args) ?? '');

    it('draws text, counters and tags', () => {
        expect(plain({ source: 'x' }, 'Opus')).toBe('Opus');
        expect(plain({ source: 'x', label: 'files', suffix: ' open' }, 3)).toBe('files 3 open');
        expect(plain({ source: 'x' }, ['a', 'b'])).toBe('a · b');
    });

    it('draws a meter with or without a bar', () => {
        expect(plain({ source: 'x', type: 'meter', label: 'ctx', width: 10, suffix: '%' }, 46)).toBe('ctx ▰▰▰▰▰▱▱▱▱▱ 46%');
        expect(plain({ source: 'x', type: 'meter', max: 8 }, 3)).toBe('3/8');
        expect(plain({ source: 'x', type: 'meter', width: 4, suffix: '%' }, 46, 'ascii')).toBe('##-- 46%');
    });

    it('turns a meter yellow then red past its thresholds, unless colored', () => {
        const meter = { source: 'x', type: 'meter' as const, suffix: '%', warn: 70, alert: 90 };
        expect(renderStatusItem(meter, 50)).toBe('50%');
        expect(renderStatusItem(meter, 75)).toBe('<color:"yellow">75%</color>');
        expect(renderStatusItem(meter, 95)).toBe('<color:"red">95%</color>');
        expect(renderStatusItem({ ...meter, color: 'blue' }, 95)).toBe('<color:"blue">95%</color>');
    });

    it('skips an item with nothing to show', () => {
        expect(renderStatusItem({ source: 'x' }, undefined)).toBeUndefined();
        expect(renderStatusItem({ source: 'x' }, '')).toBeUndefined();
        expect(renderStatusItem({ source: 'x' }, [])).toBeUndefined();
    });
});

describe('composeStatusLine', () => {
    it('joins items with a dot, one row per line, dropping empty rows', () => {
        const out = composeStatusLine(
            { lines: [[{ source: 'model' }, { source: 'dir' }], [{ source: 'agent' }]] },
            INPUT,
            { theme: NO_COLOR },
        );
        expect(out).toBe('Opus 5.5 · plugin-kit');
    });

    it('draws the default layout', () => {
        const out = composeStatusLine(DEFAULT_STATUS_LINE, INPUT, { theme: NO_COLOR });
        expect(out.split('\n')).toEqual([
            'Opus 5.5 · plugin-kit · feature/x · #12',
            'ctx ▰▰▰▰▰▱▱▱▱▱ 46% · 5h 92% · $1.23 · +12 -3',
        ]);
    });

    it('takes your own sources, and survives one that throws', () => {
        const out = composeStatusLine(
            { lines: [[{ source: 'todo', label: 'todo' }, { source: 'boom' }, { source: 'model' }]], separator: ' | ' },
            INPUT,
            { theme: NO_COLOR, sources: { todo: () => 3, boom: () => { throw new Error('x'); } } },
        );
        expect(out).toBe('todo 3 | Opus 5.5');
    });

    it('colors with ANSI when the theme does', () => {
        expect(composeStatusLine({ lines: [[{ source: 'model', color: 'cyan' }]] }, INPUT, { theme: { colors: true } })).toContain('\x1b[36m');
    });
});

describe('parseStatusLineConfig', () => {
    it('keeps good items and names the fix for bad ones', () => {
        const { config, warnings } = parseStatusLineConfig({
            lines: [[{ source: 'model' }, { source: 'context.pct' }, { source: 'dir', type: 'gauge' }, { source: 'pr', color: 'mauve' }]],
            glyphs: 'ascii',
        });
        expect(config).toEqual({ lines: [[{ source: 'model' }]], glyphs: 'ascii' });
        expect(warnings).toEqual([
            'line 1 item 2: source "context.pct" is unknown; did you mean context.percent, context.tokens?; skipped',
            'line 1 item 3: type must be one of text, counter, meter, tags; skipped',
            expect.stringMatching(/^line 1 item 4: color must be one of black/),
        ]);
    });

    it('falls back to the default rather than draw nothing', () => {
        expect(parseStatusLineConfig({ nope: 1 }).config).toBe(DEFAULT_STATUS_LINE);
        expect(parseStatusLineConfig({ lines: [[{ source: 'bogus' }]] }).config).toBe(DEFAULT_STATUS_LINE);
    });

    it('accepts your own source names', () => {
        expect(parseStatusLineConfig({ lines: [[{ source: 'todo' }]] }, ['todo']).warnings).toEqual([]);
    });
});

describe('parseStatusLine', () => {
    it('never throws', () => {
        expect(parseStatusLine('{"model":{"id":"x"}}')).toEqual({ model: { id: 'x' } });
        expect(parseStatusLine('garbage')).toEqual({});
        expect(parseStatusLine('[1]')).toEqual({});
    });
});
