import { expect, test } from 'claude-code/testing';
import type { Plugin } from 'claude-code/testing';

// A plugin that depends on the kit, the way a real one would: it hands
// `$.kit` its widgets and draws what comes back. Inline plugins close over
// nothing of this file, so it carries its own copy of `hydrate`.
const consumer: Plugin = {
    name: 'consumer',
    register(on) {
        type Node = string | { type: string; props?: Record<string, unknown>; children?: Node[] };
        const hydrate = (node: Node): unknown => {
            if (typeof node === 'string') return node;
            const props = node.type === 'Button' ? { ...node.props, onPress: () => {} } : node.props ?? null;
            return h(node.type, props, ...(node.children ?? []).map(hydrate));
        };

        on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
            const { Box, Text } = $.ui.resolve(e);
            const widgets = {
                HP: { type: 'meter', value: 7, max: 10, color: 'red' },
                Clues: { type: 'list', value: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
                Broken: { type: 'meter', value: 3 },
            };
            const tree = await $.kit.render({ id: 'demo', widgets });
            const line = await $.kit.line({ widgets: { HP: widgets.HP } });
            const parsed = await $.kit.parse({ name: 'Broken', widget: widgets.Broken });
            const { table } = await $.kit.catalog();
            return (
                <Box flexDirection="column">
                    {hydrate(tree) as never}
                    <Text>{`line: ${line}`}</Text>
                    <Text>{`parse: ${parsed.ok ? 'ok' : parsed.error}`}</Text>
                    <Text>{`catalog: ${table.split('\n').length} lines`}</Text>
                </Box>
            );
        });
    },
};

const ABOVE = {
    plugin: 'consumer',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const;

test('another plugin draws kit widgets and the kit folds its lists', { plugins: [consumer] }, async ($) => {
    for (const surface of ['terminal', 'desktop'] as const) {
        const ui = await $.ui.mount({ ...ABOVE, surface });
        const text = async (pattern: RegExp) => (await ui.find({ type: 'Text', text: pattern }))?.text;

        expect(await text(/▰/)).toBe('▰▰▰▰▰▰▰▱▱▱');
        expect(await text(/^line:/)).toBe('line: HP 7/10');
        expect(await text(/^parse:/)).toBe('parse: Broken: meter needs max: the value is drawn as a bar out of it');
        expect(await text(/^catalog:/)).toBe('catalog: 8 lines');
        // An invalid widget draws as text instead of breaking the drawing.
        expect(await text(/^3$/)).toBe('3');

        expect(await text(/• e/)).toBeDefined();
        expect(await text(/• f/)).toBeUndefined();
        await ui.press({ key: 'kit:demo:Clues:more' });
        expect(await text(/• g/)).toBe('  • g');
        await ui.press({ key: 'kit:demo:Clues:less' });
        expect(await text(/• f/)).toBeUndefined();

        await ui.unmount();
    }
});

test(
    "the user's settings restyle every caller's widgets",
    { plugins: [consumer], options: { glyphs: 'ascii', barWidth: 4, listLimit: 2 } },
    async ($) => {
        const ui = await $.ui.mount({ ...ABOVE, surface: 'terminal' });
        const text = async (pattern: RegExp) => (await ui.find({ type: 'Text', text: pattern }))?.text;

        expect(await text(/#/)).toBe('###-');
        expect(await text(/- b/)).toBe('  - b');
        expect(await text(/- c/)).toBeUndefined();
        expect((await ui.find({ type: 'Button', key: 'kit:demo:Clues:more' }))?.text).toMatch(/\+5 more/);
        await ui.unmount();
    },
);
