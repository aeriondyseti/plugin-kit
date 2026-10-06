import { describe, expect, it } from 'vitest';
import { renderWidgetLine, renderWidgetsLine } from './line.js';

describe('renderWidgetLine', () => {
    it('draws each type in one line', () => {
        expect(renderWidgetLine('Weather', { type: 'text', value: 'sleet' })).toBe('Weather sleet');
        expect(renderWidgetLine('Days', { type: 'counter', value: 9 })).toBe('Days 9');
        expect(renderWidgetLine('Health', { type: 'meter', value: 88, max: 100 })).toBe('Health 88/100');
        expect(renderWidgetLine('Suspicion', { type: 'clock', value: 2, of: 6 })).toBe('Suspicion 2/6');
        expect(renderWidgetLine('Powers', { type: 'list', value: ['wheel', 'parry'] })).toBe('Powers: wheel, parry');
        expect(renderWidgetLine('State', { type: 'tags', value: ['wounded', 'hunted'] })).toBe('State: wounded · hunted');
        expect(renderWidgetLine('Clues', { type: 'list', value: [] })).toBe('Clues: (none)');
    });

    it('joins many with a dot', () => {
        expect(
            renderWidgetsLine({ a: { type: 'counter', value: 1 }, b: { type: 'text', value: 'x' } }),
        ).toBe('a 1 · b x');
    });
});
