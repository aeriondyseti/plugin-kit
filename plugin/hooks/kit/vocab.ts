// Generated from src/formatting/vocab.ts by scripts/sync-plugin.mjs. Do not edit.

/**
 * Canonical names for colors and text modifiers.
 *
 * Exported as `as const` tuples so callers can both type-check against the
 * union AND iterate the values (e.g. to build a picker). Adding a new color
 * here forces every code map (FG/BG in tags.ts) to also cover it.
 */

export const COLORS = [
    'black',
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'white',
    'gray',
    'grey',
] as const;
export type ColorName = typeof COLORS[number];

export const MODIFIERS = ['bold', 'dim', 'italic', 'underline'] as const;
export type ModifierName = typeof MODIFIERS[number];
