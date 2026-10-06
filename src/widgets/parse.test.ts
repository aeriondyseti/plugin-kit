import { describe, expect, it } from 'vitest';
import { loadWidgets, parseWidget } from './parse.js';

describe('parseWidget', () => {
    it('accepts each type with its own fields', () => {
        expect(parseWidget('w', { type: 'text', value: ' sleet ' })).toEqual({ ok: true, widget: { type: 'text', value: 'sleet' } });
        expect(parseWidget('d', { type: 'counter', value: 9 })).toEqual({ ok: true, widget: { type: 'counter', value: 9 } });
        expect(parseWidget('hp', { type: 'meter', value: 88, max: 100 })).toEqual({
            ok: true,
            widget: { type: 'meter', value: 88, max: 100 },
        });
        expect(parseWidget('s', { type: 'clock', value: 2, of: 6 })).toEqual({ ok: true, widget: { type: 'clock', value: 2, of: 6 } });
        expect(parseWidget('p', { type: 'list', value: ['a', ' ', 'b'] })).toEqual({ ok: true, widget: { type: 'list', value: ['a', 'b'] } });
        expect(parseWidget('c', { type: 'tags', value: 'hunted' })).toEqual({ ok: true, widget: { type: 'tags', value: ['hunted'] } });
    });

    it('keeps note, group and color, trimmed', () => {
        const parsed = parseWidget('hp', { type: 'counter', value: 1, note: ' hurt ', group: 'Body', color: 'Red' });
        expect(parsed).toEqual({ ok: true, widget: { type: 'counter', value: 1, note: 'hurt', group: 'Body', color: 'red' } });
        expect(parseWidget('hp', { type: 'counter', value: 1, color: '#C33' })).toMatchObject({ widget: { color: '#C33' } });
    });

    it('names the widget and the fix in every error', () => {
        const error = (raw: unknown) => {
            const parsed = parseWidget('Health', raw);
            return parsed.ok ? '' : parsed.error;
        };
        expect(error(5)).toMatch(/^Health: a widget is an object/);
        expect(error({ value: 1 })).toMatch(/needs a type: one of text, counter/);
        expect(error({ type: 'gauge', value: 1 })).toMatch(/type "gauge" is unknown/);
        expect(error({ type: 'meter', value: 1 })).toMatch(/meter needs max/);
        expect(error({ type: 'meter', value: 120, max: 100 })).toMatch(/outside 0 to 100/);
        expect(error({ type: 'counter', value: 1, max: 3 })).toMatch(/use a meter/);
        expect(error({ type: 'text', value: 'x', of: 3 })).toMatch(/use a clock/);
        expect(error({ type: 'clock', value: 1, of: 13 })).toMatch(/from 1 to 12/);
        expect(error({ type: 'clock', value: 1.5, of: 4 })).toMatch(/segments are filled/);
        expect(error({ type: 'counter', value: 'nine' })).toMatch(/put words in a text widget/);
        expect(error({ type: 'list', value: [{ a: 1 }] })).toMatch(/list of short items/);
        expect(error({ type: 'text', value: 'x', color: 'mauve' })).toMatch(/color must be a hex/);
        expect(error({ type: 'text', value: 'x', note: 3 })).toMatch(/note must be text/);
    });
});

describe('loadWidgets', () => {
    it('never fails: a bad entry shows as text, with a warning', () => {
        const { widgets, warnings } = loadWidgets({
            HP: { type: 'meter', value: 5, max: 10 },
            Broken: { type: 'meter', value: 5, note: 'oops' },
        });
        expect(widgets.HP).toEqual({ type: 'meter', value: 5, max: 10 });
        expect(widgets.Broken).toEqual({ type: 'text', value: '5', note: 'oops' });
        expect(warnings).toEqual(['Broken: meter needs max: the value is drawn as a bar out of it (shown as text until fixed)']);
    });

    it('keeps the given order', () => {
        const { widgets } = loadWidgets({ b: { type: 'counter', value: 1 }, a: { type: 'counter', value: 2 } });
        expect(Object.keys(widgets)).toEqual(['b', 'a']);
    });

    it('treats nothing as no widgets and a non-object as a warning', () => {
        expect(loadWidgets(undefined)).toEqual({ widgets: {}, warnings: [] });
        expect(loadWidgets([1])).toEqual({ widgets: {}, warnings: ['widgets should map each name to a widget; ignored'] });
    });
});
