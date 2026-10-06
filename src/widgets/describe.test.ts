import { describe, expect, it } from 'vitest';
import { describeWidgets, parseWidgetKey, widgetKey, type UiElement, type UiNode } from './describe.js';

// Every string in the tree, depth first: what a reader would see.
function texts(node: UiNode): string[] {
    if (typeof node === 'string') return [node];
    return (node.children ?? []).flatMap(texts);
}

function buttons(node: UiNode): UiElement[] {
    if (typeof node === 'string') return [];
    return [...(node.type === 'Button' ? [node] : []), ...(node.children ?? []).flatMap(buttons)];
}

describe('describeWidgets', () => {
    it('draws a column of rows under a key named by the id', () => {
        const tree = describeWidgets({ Days: { type: 'counter', value: 9 } }, { id: 'pane' });
        expect(tree).toEqual({
            type: 'Box',
            props: { key: 'kit:pane', flexDirection: 'column' },
            children: [
                {
                    type: 'Box',
                    props: { flexDirection: 'row', gap: 1 },
                    children: [
                        { type: 'Text', props: { bold: true }, children: ['Days'] },
                        { type: 'Text', props: {}, children: ['9'] },
                    ],
                },
            ],
        });
    });

    it('draws meters as bars and clocks as segments', () => {
        const tree = describeWidgets(
            { HP: { type: 'meter', value: 7, max: 10 }, Doom: { type: 'clock', value: 2, of: 4 } },
            { id: 'p', barWidth: 10 },
        );
        expect(texts(tree)).toEqual(['HP', '▰▰▰▰▰▰▰▱▱▱', '7/10', 'Doom', '◆◆◇◇']);
    });

    it('draws with ascii glyphs when asked', () => {
        const tree = describeWidgets(
            {
                HP: { type: 'meter', value: 7, max: 10 },
                Doom: { type: 'clock', value: 2, of: 4 },
                State: { type: 'tags', value: ['hurt', 'hunted'] },
                Clues: { type: 'list', value: ['a'] },
            },
            { id: 'p', glyphs: 'ascii' },
        );
        expect(texts(tree)).toEqual(['HP', '#######---', '7/10', 'Doom', '**..', 'State', 'hurt | hunted', 'Clues', '  - a']);
    });

    it('paints the main part with the color and keeps the note dim', () => {
        const tree = describeWidgets({ HP: { type: 'counter', value: 1, color: 'red', note: 'bleeding' } }, { id: 'p' });
        const [row, note] = tree.children as UiElement[];
        expect((row?.children?.[0] as UiElement).props).toEqual({ bold: true, color: 'red' });
        expect(note).toEqual({ type: 'Text', props: { dimColor: true, wrap: 'wrap' }, children: ['bleeding'] });
    });

    it('heads each run of a group once', () => {
        const tree = describeWidgets(
            {
                a: { type: 'counter', value: 1, group: 'Body' },
                b: { type: 'counter', value: 2, group: 'Body' },
                c: { type: 'counter', value: 3 },
            },
            { id: 'p' },
        );
        expect(texts(tree)).toEqual(['Body', 'a', '1', 'b', '2', 'c', '3']);
    });

    it('folds a long list behind a button, and unfolds it when expanded', () => {
        const widgets = { Clues: { type: 'list' as const, value: ['a', 'b', 'c', 'd'] } };
        const folded = describeWidgets(widgets, { id: 'p', listLimit: 2 });
        expect(texts(folded)).toEqual(['Clues', '  • a', '  • b']);
        expect(buttons(folded)).toEqual([{ type: 'Button', props: { key: 'kit:p:Clues:more', label: '+2 more' } }]);

        const open = describeWidgets(widgets, { id: 'p', listLimit: 2, expanded: ['Clues'] });
        expect(texts(open)).toEqual(['Clues', '  • a', '  • b', '  • c', '  • d']);
        expect(buttons(open)[0]?.props).toEqual({ key: 'kit:p:Clues:less', label: 'less' });
    });

    it('is plain JSON', () => {
        const tree = describeWidgets({ x: { type: 'list', value: ['1', '2', '3', '4', '5', '6'] } }, { id: 'p' });
        expect(JSON.parse(JSON.stringify(tree))).toEqual(tree);
    });
});

describe('widget keys', () => {
    it('round-trip, even with colons in the id or name', () => {
        const key = widgetKey('tool:abc', 'Found: clues', 'more');
        expect(parseWidgetKey(key)).toEqual({ id: 'tool:abc', name: 'Found: clues', action: 'more' });
    });

    it('ignore keys the kit did not make', () => {
        expect(parseWidgetKey('save')).toBeUndefined();
        expect(parseWidgetKey('kit:p:x:explode')).toBeUndefined();
        expect(parseWidgetKey('kit:p')).toBeUndefined();
    });
});
