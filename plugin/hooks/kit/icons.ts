// Generated from src/formatting/icons.ts by scripts/sync-plugin.mjs. Do not edit.

/**
 * Named icons for use in output strings.
 *
 * Drop them in with template literals — no parser, no tag grammar:
 *
 *   builder.appendLine(`${ICONS.check} build passed`);
 *   builder.appendLine(`${ICONS.warn} ${count} files skipped`);
 *
 * To add an icon: put it in `ICONS` and it's instantly available.
 * Typos are compile errors (`ICONS.chek` won't typecheck).
 */

export const ICONS = {
    check: '✓',
    cross: '✗',
    warn: '⚠',
    info: 'ℹ',
    arrow: '▸',
    bullet: '•',
    dot: '·',
    star: '★',
} as const;

export type IconName = keyof typeof ICONS;
