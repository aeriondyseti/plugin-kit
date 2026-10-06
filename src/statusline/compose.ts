/**
 * A status line as data: lines of items, each a source drawn as a widget.
 *
 *   { "lines": [
 *       [{ "source": "model", "color": "cyan" }, { "source": "git.branch" }],
 *       [{ "source": "context.percent", "type": "meter", "label": "ctx", "width": 10, "suffix": "%", "warn": 70, "alert": 90 }]
 *   ] }
 */

import { renderTags } from '../formatting/tags.js';
import { currentTheme, type Theme } from '../formatting/theme.js';
import { COLORS } from '../formatting/vocab.js';
import { GLYPHS, type WidgetGlyphs } from '../widgets/describe.js';
import type { StatusLineInput } from './input.js';
import { SOURCES, type SourceValue, type StatusSource } from './sources.js';

export const STATUS_ITEM_TYPES = ['text', 'counter', 'meter', 'tags'] as const;
export type StatusItemType = typeof STATUS_ITEM_TYPES[number];

export interface StatusItem {
    /** A source name: built in (see `plugin-kit statusline --list`) or your own. */
    source: string;
    /** Default: `counter` for a number, `tags` for a list, `text` otherwise. */
    type?: StatusItemType;
    /** Drawn dim before the value. */
    label?: string;
    /** Meter: the value the bar is out of. Default 100. */
    max?: number;
    /** Meter: cells in the bar; leave out for no bar. */
    width?: number;
    /** After the value, e.g. `%`. A meter without one shows `/max`. */
    suffix?: string;
    /** Named color for the value. Overrides `warn`/`alert`. */
    color?: string;
    /** Meter: at or above this, the value turns yellow. */
    warn?: number;
    /** Meter: at or above this, the value turns red. */
    alert?: number;
}

export interface StatusLineConfig {
    lines: StatusItem[][];
    /** Between items. Default ` · `. */
    separator?: string;
    glyphs?: WidgetGlyphs;
}

/** What `plugin-kit statusline` draws with no config file. */
export const DEFAULT_STATUS_LINE: StatusLineConfig = {
    lines: [
        [{ source: 'model', color: 'cyan' }, { source: 'dir' }, { source: 'git.branch', color: 'magenta' }, { source: 'pr' }],
        [
            { source: 'context.percent', type: 'meter', label: 'ctx', width: 10, suffix: '%', warn: 70, alert: 90 },
            { source: 'usage.five_hour', type: 'meter', label: '5h', suffix: '%', warn: 70, alert: 90 },
            { source: 'usage.seven_day', type: 'meter', label: 'week', suffix: '%', warn: 70, alert: 90 },
            { source: 'cost.usd' },
            { source: 'lines.changed', color: 'gray' },
        ],
    ],
};

/** Your own sources, by name: a full `StatusSource` or just its `read`. */
export type ExtraSources = Record<string, StatusSource | StatusSource['read']>;

export interface ComposeOptions {
    sources?: ExtraSources;
    theme?: Theme;
}

/** The finished status line: one row per non-empty line, with ANSI colors. */
export function composeStatusLine(config: StatusLineConfig, input: StatusLineInput, opts: ComposeOptions = {}): string {
    const glyphs = GLYPHS[config.glyphs ?? 'unicode'];
    const separator = config.separator ?? ` ${glyphs.dot} `;
    const rows = config.lines
        .map((line) =>
            line
                .map((item) => renderStatusItem(item, readSource(item.source, input, opts.sources), config.glyphs ?? 'unicode'))
                .filter((part): part is string => part !== undefined)
                .join(separator),
        )
        .filter((row) => row !== '');
    return renderTags(rows.join('\n'), opts.theme ?? currentTheme());
}

/** One item as tag markup; undefined when its source has nothing to show. */
export function renderStatusItem(item: StatusItem, value: SourceValue, glyphSet: WidgetGlyphs = 'unicode'): string | undefined {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return undefined;
    const g = GLYPHS[glyphSet];
    const type = item.type ?? (typeof value === 'number' ? 'counter' : Array.isArray(value) ? 'tags' : 'text');
    const label = item.label ? `<dim>${item.label}</dim> ` : '';
    const suffix = item.suffix ?? '';

    if (type === 'tags') {
        const list = Array.isArray(value) ? value : [String(value)];
        return `${label}${paint(list.join(` ${g.dot} `), item.color)}`;
    }
    if (type !== 'meter' || typeof value !== 'number') return `${label}${paint(`${String(value)}${suffix}`, item.color)}`;

    const max = item.max ?? 100;
    const color = item.color ?? (item.alert !== undefined && value >= item.alert ? 'red' : item.warn !== undefined && value >= item.warn ? 'yellow' : undefined);
    const shown = item.suffix === undefined ? `${value}/${max}` : `${value}${suffix}`;
    if (!item.width) return `${label}${paint(shown, color)}`;
    const filled = Math.max(0, Math.min(item.width, Math.round((value / max) * item.width)));
    return `${label}${paint(g.full.repeat(filled) + g.empty.repeat(item.width - filled), color)} ${paint(shown, color)}`;
}

function readSource(name: string, input: StatusLineInput, extra: ExtraSources = {}): SourceValue {
    const source = extra[name] ?? SOURCES[name];
    if (!source) return undefined;
    try {
        return typeof source === 'function' ? source(input) : source.read(input);
    } catch {
        return undefined; // one broken source must not blank the whole line
    }
}

function paint(text: string, color: string | undefined): string {
    return color && (COLORS as readonly string[]).includes(color) ? `<color:"${color}">${text}</color>` : text;
}

export interface StatusLineConfigLoad {
    config: StatusLineConfig;
    warnings: string[];
}

/**
 * Checks a config (from JSON). Never throws: a bad item is dropped with a
 * warning saying what to fix, and a config with no usable line falls back
 * to the default, so the status line always draws something.
 */
export function parseStatusLineConfig(raw: unknown, known: readonly string[] = Object.keys(SOURCES)): StatusLineConfigLoad {
    const warnings: string[] = [];
    if (!isRecord(raw) || !Array.isArray(raw.lines)) {
        return { config: DEFAULT_STATUS_LINE, warnings: ['statusline config needs "lines": a list of lines, each a list of items; using the default'] };
    }
    const lines: StatusItem[][] = [];
    raw.lines.forEach((line: unknown, l: number) => {
        if (!Array.isArray(line)) {
            warnings.push(`line ${l + 1} should be a list of items; skipped`);
            return;
        }
        const items: StatusItem[] = [];
        line.forEach((entry: unknown, i: number) => {
            const where = `line ${l + 1} item ${i + 1}`;
            const problem = checkItem(entry, known);
            if (problem) warnings.push(`${where}: ${problem}; skipped`);
            else items.push(entry as StatusItem);
        });
        if (items.length) lines.push(items);
    });
    if (!lines.length) return { config: DEFAULT_STATUS_LINE, warnings: [...warnings, 'no usable lines; using the default'] };
    const config: StatusLineConfig = { lines };
    if (typeof raw.separator === 'string') config.separator = raw.separator;
    if (raw.glyphs === 'ascii' || raw.glyphs === 'unicode') config.glyphs = raw.glyphs;
    return { config, warnings };
}

function checkItem(entry: unknown, known: readonly string[]): string | undefined {
    if (!isRecord(entry)) return 'an item is an object with a "source"';
    const source = entry.source;
    if (typeof source !== 'string') return 'needs "source"';
    if (!known.includes(source)) {
        const near = known.filter((k) => k.split('.')[0] === source.split('.')[0]);
        return `source "${source}" is unknown${near.length ? `; did you mean ${near.join(', ')}?` : ''}`;
    }
    if (entry.type !== undefined && !(STATUS_ITEM_TYPES as readonly unknown[]).includes(entry.type)) {
        return `type must be one of ${STATUS_ITEM_TYPES.join(', ')}`;
    }
    for (const key of ['max', 'width', 'warn', 'alert'] as const) {
        if (entry[key] !== undefined && (typeof entry[key] !== 'number' || !Number.isFinite(entry[key]))) return `${key} must be a number`;
    }
    for (const key of ['label', 'suffix', 'color'] as const) {
        if (entry[key] !== undefined && typeof entry[key] !== 'string') return `${key} must be text`;
    }
    if (typeof entry.color === 'string' && !(COLORS as readonly string[]).includes(entry.color)) {
        return `color must be one of ${COLORS.join(', ')}`;
    }
    return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
