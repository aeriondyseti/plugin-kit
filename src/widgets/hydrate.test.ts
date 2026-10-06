import { describe, expect, it, vi } from 'vitest';
import { hydrate } from './hydrate.js';

// Stands in for a mod's `h`: records what it was asked to build.
const create = (type: string, props: Record<string, unknown> | null, ...children: unknown[]) => ({ type, props, children });

function onPressOf(el: unknown): unknown {
    return (el as { props: Record<string, unknown> }).props.onPress;
}

describe('hydrate', () => {
    it('rebuilds the tree through the factory', () => {
        const el = hydrate({ type: 'Box', props: { gap: 1 }, children: [{ type: 'Text', children: ['hi'] }] }, create);
        expect(el).toEqual({ type: 'Box', props: { gap: 1 }, children: [{ type: 'Text', props: null, children: ['hi'] }] });
    });

    it('gives a Button its handler by key', () => {
        const save = vi.fn();
        const el = hydrate({ type: 'Button', props: { key: 'save', label: 'Save' } }, create, { save });
        (onPressOf(el) as () => void)();
        expect(save).toHaveBeenCalledOnce();
    });

    it('gives every other Button a no-op, so it still draws and still raises ui.press', () => {
        const el = hydrate({ type: 'Button', props: { key: 'kit:p:x:more', label: '+1' } }, create);
        expect(typeof onPressOf(el)).toBe('function');
    });
});
