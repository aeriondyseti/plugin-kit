/**
 * The short form of a widget: one line of plain text, as a status line or a
 * prompt shows it. `Health 88/100`, `Suspicion 2/6`, `Powers: wheel, parry`.
 */

import { ICONS } from '../formatting/icons.js';
import type { Widget, Widgets } from './types.js';

export function renderWidgetLine(name: string, widget: Widget): string {
    switch (widget.type) {
        case 'text':
        case 'counter':
            return `${name} ${widget.value}`;
        case 'meter':
            return `${name} ${widget.value}/${widget.max}`;
        case 'clock':
            return `${name} ${widget.value}/${widget.of}`;
        case 'list':
            return `${name}: ${widget.value.join(', ') || '(none)'}`;
        case 'tags':
            return `${name}: ${widget.value.join(` ${ICONS.dot} `) || '(none)'}`;
    }
}

/** Every widget's line, joined with ` · `. */
export function renderWidgetsLine(widgets: Widgets): string {
    return Object.entries(widgets)
        .map(([name, widget]) => renderWidgetLine(name, widget))
        .join(` ${ICONS.dot} `);
}
