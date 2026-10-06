// plugin-kit: adds `$.kit` to every mod's `$`, so plugins that list
// "plugin-kit" under `dependencies` draw widgets the same way.
//
// Everything crossing `$.kit` is plain JSON (functions cannot cross between
// plugins), so `render` returns a UI description, not elements; the caller
// turns it into elements with `hydrate`. The kit still owns its own buttons:
// every Button gets an `onPress`, a press raises `ui.press`, and the hook
// below answers the presses on keys the kit made.

import { atom, update } from 'claude-code';
import type { Register } from 'claude-code';
import type { Kit, KitJson } from '../types';
import { widgetJsonSchema, widgetTable } from './kit/catalog.ts';
import { describeWidgets, parseWidgetKey } from './kit/describe.ts';
import { renderWidgetsLine } from './kit/line.ts';
import { loadWidgets, parseWidget } from './kit/parse.ts';

const expanded = atom({ plugin: 'plugin-kit', key: 'expanded' } as const, {});

export const register: Register = (on) => {
    on('engine.create', async ($, e, next) => {
        // At engine.create `$` is empty; the methods reach the engine through
        // what `next` built, always spelled `built.<noun>.<method>(...)`.
        const built = await next(e);
        const kit: Kit = {
            render: async ({ id, widgets, barWidth, listLimit }) => {
                const state = await built.state.get({ plugin: 'plugin-kit', key: 'expanded' } as const);
                return describeWidgets(loadWidgets(widgets).widgets, {
                    id,
                    expanded: state.value?.[id] ?? [],
                    ...(barWidth === undefined ? {} : { barWidth }),
                    ...(listLimit === undefined ? {} : { listLimit }),
                });
            },
            line: async ({ widgets }) => renderWidgetsLine(loadWidgets(widgets).widgets),
            parse: async ({ name, widget }) => parseWidget(name, widget),
            catalog: async () => ({
                table: widgetTable(),
                schema: widgetJsonSchema() as { [key: string]: KitJson },
            }),
        };
        return { ...built, kit };
    });

    // Fold and unfold lists. A press on any other key goes on untouched.
    on('ui.press', async ($, e, next) => {
        const hit = parseWidgetKey(e.element);
        if (!hit) return next(e);
        await update($, expanded, (all) => {
            const open = (all[hit.id] ?? []).filter((name) => name !== hit.name);
            return { ...all, [hit.id]: hit.action === 'more' ? [...open, hit.name] : open };
        });
        return { element: e.element };
    });
};
