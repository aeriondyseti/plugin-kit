/**
 * Validation for widgets as a model or a file writes them.
 *
 * A bad widget is an expected outcome here, not an exception: the caller is
 * often a model that reads the error and retries, so `parseWidget` returns a
 * result and every error names the widget and the fix.
 */

import { COLORS } from '../formatting/vocab.js';
import {
    MAX_CLOCK_SEGMENTS,
    WIDGET_TYPE_NAMES,
    type Widget,
    type WidgetColor,
    type WidgetCommon,
    type Widgets,
} from './types.js';

export type WidgetParseResult = { ok: true; widget: Widget } | { ok: false; error: string };

export interface WidgetLoad {
    widgets: Widgets;
    warnings: string[];
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseWidget(name: string, raw: unknown): WidgetParseResult {
    const fail = (message: string): WidgetParseResult => ({ ok: false, error: `${name}: ${message}` });
    if (!isRecord(raw)) return fail('a widget is an object with a type and a value');

    const type = WIDGET_TYPE_NAMES.find((t) => t === raw.type);
    if (!type) {
        const given = raw.type === undefined ? 'needs a type' : `type "${String(raw.type)}" is unknown`;
        return fail(`${given}: one of ${WIDGET_TYPE_NAMES.join(', ')}`);
    }

    const common: WidgetCommon = {};
    for (const key of ['note', 'group'] as const) {
        const v = raw[key];
        if (v === undefined || v === null) continue;
        if (typeof v !== 'string') return fail(`${key} must be text`);
        if (v.trim()) common[key] = v.trim();
    }
    if (raw.color !== undefined && raw.color !== null && raw.color !== '') {
        const color = parseColor(raw.color);
        if (!color) return fail(`color must be a hex like "#c0392b" or one of ${COLORS.join(', ')}`);
        common.color = color;
    }
    if (type !== 'meter' && raw.max !== undefined && raw.max !== null) {
        return fail(`a ${type} takes no max: use a meter for a value out of a maximum`);
    }
    if (type !== 'clock' && raw.of !== undefined && raw.of !== null) {
        return fail(`a ${type} takes no of: use a clock for segments that fill`);
    }

    const value = raw.value;
    switch (type) {
        case 'text':
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                return { ok: true, widget: { type, value: String(value).trim(), ...common } };
            }
            return fail('text needs value: a few words');
        case 'counter':
            if (!isNumber(value)) return fail('counter needs a number value: put words in a text widget');
            return { ok: true, widget: { type, value, ...common } };
        case 'meter': {
            const max = raw.max;
            if (!isNumber(max)) return fail('meter needs max: the value is drawn as a bar out of it');
            if (max <= 0) return fail('meter max must be above 0');
            if (!isNumber(value)) return fail(`meter needs a number value, out of max ${max}`);
            if (value < 0 || value > max) {
                return fail(`meter value ${value} is outside 0 to ${max}: change the value or the max`);
            }
            return { ok: true, widget: { type, value, max, ...common } };
        }
        case 'clock': {
            const of = raw.of;
            if (!isNumber(of)) return fail('clock needs of: the number of segments, usually 4, 6 or 8');
            if (!Number.isInteger(of) || of < 1 || of > MAX_CLOCK_SEGMENTS) {
                return fail(`clock of must be a whole number from 1 to ${MAX_CLOCK_SEGMENTS}`);
            }
            if (!isNumber(value) || !Number.isInteger(value)) {
                return fail(`clock needs value: how many of its ${of} segments are filled`);
            }
            if (value < 0 || value > of) return fail(`clock value ${value} is outside 0 to ${of}`);
            return { ok: true, widget: { type, value, of, ...common } };
        }
        case 'list':
        case 'tags': {
            const items = typeof value === 'string' ? [value] : value;
            if (!Array.isArray(items) || items.some((i) => typeof i === 'object' && i !== null)) {
                return fail(`${type} needs value: a list of short items`);
            }
            const clean = items.map((i) => String(i ?? '').trim()).filter(Boolean);
            return { ok: true, widget: { type, value: clean, ...common } };
        }
    }
}

/**
 * Widgets from somewhere that must not fail to open (a file on disk, a
 * plugin's stored state). An invalid entry becomes a text widget holding its
 * raw value, with a warning saying what to fix.
 */
export function loadWidgets(raw: unknown): WidgetLoad {
    if (raw === undefined || raw === null) return { widgets: {}, warnings: [] };
    if (!isRecord(raw)) return { widgets: {}, warnings: ['widgets should map each name to a widget; ignored'] };

    const widgets: Widgets = {};
    const warnings: string[] = [];
    for (const [name, entry] of Object.entries(raw)) {
        const parsed = parseWidget(name, entry);
        if (parsed.ok) {
            widgets[name] = parsed.widget;
            continue;
        }
        warnings.push(`${parsed.error} (shown as text until fixed)`);
        const value = isRecord(entry) ? entry.value : entry;
        const note = isRecord(entry) && typeof entry.note === 'string' ? entry.note.trim() : '';
        widgets[name] = { type: 'text', value: stringify(value), ...(note ? { note } : {}) };
    }
    return { widgets, warnings };
}

function parseColor(raw: unknown): WidgetColor | undefined {
    if (typeof raw !== 'string') return undefined;
    const color = raw.trim();
    if (HEX.test(color)) return color as `#${string}`;
    return COLORS.find((c) => c === color.toLowerCase());
}

function stringify(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(stringify).join(', ');
    return JSON.stringify(value);
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
