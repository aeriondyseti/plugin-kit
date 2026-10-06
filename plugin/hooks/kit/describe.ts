// Generated from src/widgets/describe.ts by scripts/sync-plugin.mjs. Do not edit.

/**
 * Widgets as a UI description: plain JSON shaped like the element trees
 * Claude Code's mods draw (`{ type: 'Text', props, children }`).
 *
 * Plain data, not elements, because it crosses between plugins: the
 * plugin-kit mod returns it from `$.kit.render`, and functions cannot cross.
 * The drawing plugin turns it into elements with `hydrate`, which is also
 * where every Button gets its `onPress`.
 */

import { ICONS } from './icons.ts';
import type { Widget, Widgets } from './types.ts';

export type UiProp = string | number | boolean;
export type UiNode = string | UiElement;
export interface UiElement {
    type: 'Box' | 'Text' | 'Button';
    props?: Record<string, UiProp>;
    children?: UiNode[];
}

/** What a Button in a description does when pressed. */
export type WidgetAction = 'more' | 'less';

/** Which characters draw bars, segments, bullets and separators. */
export type WidgetGlyphs = 'unicode' | 'ascii';

/** The characters each glyph set draws with; shared by every renderer. */
export const GLYPHS: Record<WidgetGlyphs, { full: string; empty: string; on: string; off: string; bullet: string; dot: string }> = {
    unicode: { full: '▰', empty: '▱', on: '◆', off: '◇', bullet: ICONS.bullet, dot: ICONS.dot },
    ascii: { full: '#', empty: '-', on: '*', off: '.', bullet: '-', dot: '|' },
};

export interface DescribeOptions {
    /**
     * Names this drawing: it prefixes every Button key, so presses (and any
     * view state keyed by it) never collide with another drawing's.
     */
    id: string;
    /** Cells in a meter's bar. Default 10. */
    barWidth?: number;
    /** Items a list shows before folding the rest behind a button. Default 5. */
    listLimit?: number;
    /** Names of the lists drawn unfolded. */
    expanded?: readonly string[];
    /** Default `unicode`; `ascii` for surfaces or fonts without the shapes. */
    glyphs?: WidgetGlyphs;
}

const KEY_PREFIX = 'kit:';

/** The Button key for `action` on widget `name` in drawing `id`. */
export function widgetKey(id: string, name: string, action: WidgetAction): string {
    return `${KEY_PREFIX}${encodeURIComponent(id)}:${encodeURIComponent(name)}:${action}`;
}

/** The inverse of `widgetKey`; undefined for any key it did not make. */
export function parseWidgetKey(key: string): { id: string; name: string; action: WidgetAction } | undefined {
    if (!key.startsWith(KEY_PREFIX)) return undefined;
    const [id, name, action, ...rest] = key.slice(KEY_PREFIX.length).split(':');
    if (id === undefined || name === undefined || rest.length > 0) return undefined;
    if (action !== 'more' && action !== 'less') return undefined;
    return { id: decodeURIComponent(id), name: decodeURIComponent(name), action };
}

export function describeWidgets(widgets: Widgets, opts: DescribeOptions): UiElement {
    const children: UiNode[] = [];
    let group: string | undefined;
    for (const [name, widget] of Object.entries(widgets)) {
        if (widget.group && widget.group !== group) {
            children.push(text(widget.group, { dimColor: true }));
        }
        group = widget.group;
        children.push(...describeWidget(name, widget, opts));
    }
    return box(children, { key: `${KEY_PREFIX}${encodeURIComponent(opts.id)}`, flexDirection: 'column' });
}

function describeWidget(name: string, widget: Widget, opts: DescribeOptions): UiNode[] {
    const paint: Record<string, UiProp> = widget.color ? { color: widget.color } : {};
    const label = text(name, { bold: true, ...paint });
    const note = widget.note ? [text(widget.note, { dimColor: true, wrap: 'wrap' })] : [];
    const row = (...rest: UiNode[]) => box([label, ...rest], { flexDirection: 'row', gap: 1 });
    const g = GLYPHS[opts.glyphs ?? 'unicode'];

    switch (widget.type) {
        case 'text':
        case 'counter':
            return [row(text(String(widget.value))), ...note];
        case 'meter': {
            const cells = opts.barWidth ?? 10;
            const filled = Math.round((widget.value / widget.max) * cells);
            const bar = g.full.repeat(filled) + g.empty.repeat(cells - filled);
            return [row(text(bar, paint), text(`${widget.value}/${widget.max}`)), ...note];
        }
        case 'clock': {
            const segments = g.on.repeat(widget.value) + g.off.repeat(widget.of - widget.value);
            return [row(text(segments, paint)), ...note];
        }
        case 'tags':
            return [row(text(widget.value.join(` ${g.dot} `) || '(none)', paint)), ...note];
        case 'list':
            return [label, ...describeItems(name, widget.value, paint, opts), ...note];
    }
}

function describeItems(name: string, items: string[], paint: Record<string, UiProp>, opts: DescribeOptions): UiNode[] {
    const limit = opts.listLimit ?? 5;
    const isOpen = opts.expanded?.includes(name) ?? false;
    const shown = isOpen ? items : items.slice(0, limit);
    const bullet = GLYPHS[opts.glyphs ?? 'unicode'].bullet;
    const lines: UiNode[] = shown.map((item) => text(`  ${bullet} ${item}`, paint));
    if (items.length === 0) lines.push(text('  (none)', { dimColor: true }));
    if (items.length > limit) {
        const action = isOpen ? 'less' : 'more';
        const label = isOpen ? 'less' : `+${items.length - limit} more`;
        lines.push(box([button(widgetKey(opts.id, name, action), label)], { paddingLeft: 2 }));
    }
    return lines;
}

function box(children: UiNode[], props: Record<string, UiProp>): UiElement {
    return { type: 'Box', props, children };
}

function text(value: string, props: Record<string, UiProp> = {}): UiElement {
    return { type: 'Text', props, children: [value] };
}

function button(key: string, label: string): UiElement {
    return { type: 'Button', props: { key, label } };
}
