import { describe, expect, it } from 'vitest';
import { widgetJsonSchema, widgetTable } from './catalog.js';
import { WIDGET_TYPE_NAMES } from './types.js';

describe('widget catalog', () => {
    it('has one table row per type', () => {
        const lines = widgetTable().split('\n');
        expect(lines[0]).toBe('| type | fields | when |');
        expect(lines).toHaveLength(2 + WIDGET_TYPE_NAMES.length);
        expect(lines[4]).toMatch(/^\| `meter` \| value, max: numbers \|/);
    });

    it('offers every type in the schema enum', () => {
        const schema = widgetJsonSchema() as { properties: { type: { enum: string[] } }; required: string[] };
        expect(schema.properties.type.enum).toEqual([...WIDGET_TYPE_NAMES]);
        expect(schema.required).toEqual(['type', 'value']);
    });

    it('is plain JSON', () => {
        const schema = widgetJsonSchema();
        expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
    });
});
