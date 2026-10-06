import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _resetTheme, setTheme } from '../formatting/theme.js';
import { OutputBuilder } from './OutputBuilder.js';
import { toMarkup } from './widgetMarkup.js';

describe('toMarkup', () => {
    it('joins a row with spaces and stacks a column', () => {
        expect(
            toMarkup({
                type: 'Box',
                props: { flexDirection: 'column' },
                children: [
                    { type: 'Box', props: { flexDirection: 'row' }, children: [{ type: 'Text', children: ['a'] }, 'b'] },
                    { type: 'Text', children: ['c'] },
                ],
            }),
        ).toEqual(['a b', 'c']);
    });

    it('styles text with tags, and drops what text output cannot show', () => {
        expect(toMarkup({ type: 'Text', props: { bold: true, color: 'red' }, children: ['x'] })).toEqual(['<bold><color:"red">x</color></bold>']);
        expect(toMarkup({ type: 'Text', props: { dimColor: true, color: '#c33' }, children: ['x'] })).toEqual(['<dim>x</dim>']);
        expect(toMarkup({ type: 'Box', children: [{ type: 'Button', props: { key: 'k', label: 'go' } }] })).toEqual([]);
    });

    it('keeps padding', () => {
        expect(toMarkup({ type: 'Box', props: { paddingLeft: 2 }, children: ['x'] })).toEqual(['  x']);
    });
});

describe('OutputBuilder.appendWidgets', () => {
    beforeEach(() => setTheme({ colors: false }));
    afterEach(() => _resetTheme());

    it('draws widgets as rows, with group headings and notes', () => {
        const out = new OutputBuilder()
            .appendWidgets({
                Health: { type: 'meter', value: 7, max: 10, group: 'Body', note: 'bleeding' },
                Suspicion: { type: 'clock', value: 2, of: 6 },
                State: { type: 'tags', value: ['hurt', 'hunted'] },
            })
            .render();
        expect(out).toBe(['Body', 'Health ▰▰▰▰▰▰▰▱▱▱ 7/10', 'bleeding', 'Suspicion ◆◆◇◇◇◇', 'State hurt · hunted', ''].join('\n'));
    });

    it('never folds a list', () => {
        const items = ['1', '2', '3', '4', '5', '6', '7'];
        const out = new OutputBuilder().appendWidget('Clues', { type: 'list', value: items }).render();
        expect(out.split('\n')).toEqual(['Clues', ...items.map((i) => `  • ${i}`), '']);
    });

    it('takes the bar width and glyphs', () => {
        const out = new OutputBuilder().appendWidget('HP', { type: 'meter', value: 1, max: 2 }, { barWidth: 4, glyphs: 'ascii' }).render();
        expect(out).toBe('HP ##-- 1/2\n');
    });

    it('colors with ANSI when the theme does', () => {
        setTheme({ colors: true });
        const out = new OutputBuilder().appendWidget('HP', { type: 'counter', value: 3, color: 'red' }).render();
        expect(out).toContain('\x1b[1m');
        expect(out).toContain('\x1b[31m');
    });
});
