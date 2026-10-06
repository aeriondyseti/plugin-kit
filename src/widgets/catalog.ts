/**
 * The widget catalog, written for a model to read: which type fits which
 * job. Both the markdown table (for a skill or prompt) and the JSON Schema
 * (for a tool's input) are generated from it, so they cannot drift apart.
 */

import { COLORS } from '../formatting/vocab.js';
import { MAX_CLOCK_SEGMENTS, WIDGET_TYPE_NAMES, type WidgetType } from './types.js';

export interface WidgetTypeInfo {
    /** The type's own fields, as a model should write them. */
    fields: string;
    /** When to pick it, with examples. */
    use: string;
}

export const WIDGET_CATALOG: Record<WidgetType, WidgetTypeInfo> = {
    text: {
        fields: 'value: a few words',
        use: 'A state in words that changes: the weather, a disguise, the current branch',
    },
    counter: {
        fields: 'value: a number',
        use: 'A number with no ceiling: days to a deadline, coins owed, retries',
    },
    meter: {
        fields: 'value, max: numbers',
        use: 'A number out of a known maximum, drawn as a bar: health, fuel, context used',
    },
    clock: {
        fields: 'value, of: whole numbers',
        use: `Something that happens when it fills, drawn as segments (4, 6 or 8; at most ${MAX_CLOCK_SEGMENTS}): suspicion, a ritual, a countdown`,
    },
    list: {
        fields: 'value: short items',
        use: 'Things gathered or learned, one per line: clues, allies, open todos',
    },
    tags: {
        fields: 'value: one or two words each',
        use: 'Conditions that come and go, on one line: wounded, hunted, blocked',
    },
};

/** The catalog as a markdown table: `| type | fields | when |`. */
export function widgetTable(): string {
    const rows = WIDGET_TYPE_NAMES.map((t) => `| \`${t}\` | ${WIDGET_CATALOG[t].fields} | ${WIDGET_CATALOG[t].use} |`);
    return ['| type | fields | when |', '|---|---|---|', ...rows].join('\n');
}

/**
 * JSON Schema for one widget, as a tool's input property. Flat rather than
 * one branch per type: a model reads the descriptions, and `parseWidget`
 * enforces the per-type rules with errors that name the fix.
 */
export function widgetJsonSchema(): Record<string, unknown> {
    return {
        type: 'object',
        properties: {
            type: {
                type: 'string',
                enum: [...WIDGET_TYPE_NAMES],
                description: WIDGET_TYPE_NAMES.map((t) => `${t}: ${WIDGET_CATALOG[t].use}`).join('. '),
            },
            value: {
                description: 'text: a few words. counter, meter, clock: a number. list, tags: an array of short strings.',
                anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'array', items: { type: 'string' } }],
            },
            max: { type: 'number', description: 'meter only: the value the bar is out of' },
            of: { type: 'integer', minimum: 1, maximum: MAX_CLOCK_SEGMENTS, description: 'clock only: how many segments' },
            note: { type: 'string', description: 'Optional: one to three short sentences shown dim under the row' },
            color: { type: 'string', description: `Optional: a hex like "#c0392b" or one of ${COLORS.join(', ')}` },
            group: { type: 'string', description: 'Optional: a heading shared by neighbouring widgets' },
        },
        required: ['type', 'value'],
        additionalProperties: false,
    };
}
