/**
 * OutputBuilder — a tiny accumulator for formatted text.
 *
 * Append strings (optionally containing tag markup). Call `render()` (or
 * `toString()`) to get the final ANSI-rendered string. Tags are resolved
 * against the current theme at render time, not at append time — so you can
 * `setTheme()` anywhere before emit and still get the right output.
 *
 * Structural helpers (boxes, tables, lists) will layer on later.
 */

import { ICONS } from '../formatting/icons.js';
import { renderTags, visualWidth } from '../formatting/tags.js';
import { currentTheme, type Theme } from '../formatting/theme.js';
import type { ColorName } from '../formatting/vocab.js';
import { describeWidgets, type WidgetGlyphs } from '../widgets/describe.js';
import type { Widget, Widgets } from '../widgets/types.js';
import { toMarkup } from './widgetMarkup.js';

export interface ListOptions {
    bullet?: string;
    indent?: number;
}

export interface DividerOptions {
    width?: number;
    color?: ColorName;
}

export interface BoxOptions {
    title?: string;
    color?: ColorName;
    padding?: number;
}

export interface TableOptions {
    headers?: readonly string[];
    color?: ColorName;
}

export interface WidgetOptions {
    /** Cells in a meter's bar. Default 10. */
    barWidth?: number;
    glyphs?: WidgetGlyphs;
}

function detectWidth(): number {
    const env = Number(process.env.COLUMNS);
    if (Number.isFinite(env) && env > 20) return env;
    const stderrCols = process.stderr.columns;
    if (stderrCols !== undefined && stderrCols > 20) return stderrCols;
    return 80;
}

export class OutputBuilder {
    private content = '';

    append(text: string): this {
        this.content += text;
        return this;
    }

    appendLine(text = ''): this {
        this.content += text + '\n';
        return this;
    }

    /**
     * Append a divider line — `char` repeated as many complete copies as fit
     * in the terminal width (partial trailing copies are not emitted).
     *
     * Width resolution order: `opts.width` → `$COLUMNS` env var →
     * `process.stderr.columns` → 80. We probe stderr, not stdout: in hook
     * scripts stdout is piped to Claude Code, but stderr usually stays
     * attached to the terminal so its `.columns` is the real TTY width.
     * Values ≤ 20 are treated as garbage and fall through to 80.
     *
     * `char` may be multi-cell (emoji, wide glyphs) or contain tag markup —
     * `visualWidth` is used to count cells, so the math stays honest.
     */
    appendDivider(char = '-', opts: DividerOptions = {}): this {
        const cols = opts.width ?? detectWidth();
        const cellsPerCopy = visualWidth(char);
        const copies = cellsPerCopy > 0 ? Math.floor(cols / cellsPerCopy) : 0;
        const line = char.repeat(copies);
        return this.appendLine(opts.color ? `<color:"${opts.color}">${line}</color>` : line);
    }

    /**
     * Append items as a bulleted list, one per line.
     *
     * Items may contain tag markup — it resolves at render time like any other
     * appended text. Multi-line item strings are not reflowed; the caller owns
     * that.
     */
    appendList(items: readonly string[], opts: ListOptions = {}): this {
        const bullet = opts.bullet ?? ICONS.bullet;
        const pad = ' '.repeat(opts.indent ?? 0);
        for (const item of items) {
            this.appendLine(`${pad}${bullet} ${item}`);
        }
        return this;
    }

    /**
     * Wrap content in a unicode-drawn box.
     *
     *   ┌─ Title ──────┐
     *   │  line one    │
     *   │  line two    │
     *   └──────────────┘
     *
     * Content may be multi-line and may contain tag markup — width math uses
     * `visualWidth`, so ANSI, CJK, and emoji widths are all counted correctly.
     * A single trailing newline on `content` is dropped so `box('hi\n')`
     * doesn't produce an empty bottom row.
     */
    appendBox(content: string, opts: BoxOptions = {}): this {
        const padding = opts.padding ?? 1;
        const title = opts.title ?? '';
        const body = content.endsWith('\n') ? content.slice(0, -1) : content;
        const lines = body.split('\n');

        const contentWidth = Math.max(0, ...lines.map(visualWidth));
        // Top border with title reads `┌─ {title} ` + fill + `┐` — that's
        // 3 frame chars (┌, leading ─, trailing space) plus titleWidth.
        // Require enough inner width so fill ≥ 0 after padding.
        const minForTitle = title ? visualWidth(title) + 3 - padding * 2 : 0;
        const inner = Math.max(contentWidth, minForTitle, 0);
        const totalWidth = inner + padding * 2;
        const hpad = ' '.repeat(padding);

        const paint = (s: string) => (opts.color ? `<color:"${opts.color}">${s}</color>` : s);

        const top = title
            ? paint(`┌─ ${title} ${'─'.repeat(totalWidth - visualWidth(title) - 3)}┐`)
            : paint(`┌${'─'.repeat(totalWidth)}┐`);
        this.appendLine(top);

        for (const line of lines) {
            const rightPad = ' '.repeat(inner - visualWidth(line));
            this.appendLine(`${paint('│')}${hpad}${line}${rightPad}${hpad}${paint('│')}`);
        }

        this.appendLine(paint(`└${'─'.repeat(totalWidth)}┘`));
        return this;
    }

    /**
     * Render a table. Each row is an array of cell strings (may contain tag
     * markup). Column widths auto-size to the widest cell across header + rows.
     *
     *   ┌────┬─────┐
     *   │ H1 │ H2  │
     *   ├────┼─────┤
     *   │ a  │ bb  │
     *   │ cc │ ddd │
     *   └────┴─────┘
     *
     * Ragged rows are OK — missing cells render as empty. If there are no
     * rows and no headers, the call is a no-op.
     */
    appendTable(rows: readonly (readonly string[])[], opts: TableOptions = {}): this {
        const { headers } = opts;
        const allRows = headers ? [headers, ...rows] : rows;
        if (allRows.length === 0) return this;

        const colCount = Math.max(0, ...allRows.map((r) => r.length));
        const widths: number[] = [];
        for (let c = 0; c < colCount; c++) {
            widths[c] = Math.max(0, ...allRows.map((r) => visualWidth(r[c] ?? '')));
        }

        const paint = (s: string) => (opts.color ? `<color:"${opts.color}">${s}</color>` : s);

        const border = (l: string, m: string, r: string): string =>
            paint(l + widths.map((w) => '─'.repeat(w + 2)).join(m) + r);

        const padCell = (text: string, width: number): string =>
            text + ' '.repeat(Math.max(0, width - visualWidth(text)));

        const renderRow = (cells: readonly string[]): string => {
            const bar = paint('│');
            const body = widths.map((w, i) => ` ${padCell(cells[i] ?? '', w)} `).join(bar);
            return `${bar}${body}${bar}`;
        };

        this.appendLine(border('┌', '┬', '┐'));
        if (headers) {
            this.appendLine(renderRow(headers));
            this.appendLine(border('├', '┼', '┤'));
        }
        for (const row of rows) this.appendLine(renderRow(row));
        this.appendLine(border('└', '┴', '┘'));
        return this;
    }

    /**
     * Widgets, one row each, laid out as plugin-kit draws them in a mod:
     *
     *   Health ▰▰▰▰▰▰▰▱▱▱ 7/10
     *   Suspicion ◆◆◇◇◇◇
     *
     * Lists are never folded (there is nothing to press), and a hex color
     * is dropped (tags know the named colors only).
     */
    appendWidgets(widgets: Widgets, opts: WidgetOptions = {}): this {
        const tree = describeWidgets(widgets, { id: 'output', listLimit: Infinity, ...opts });
        for (const line of toMarkup(tree)) this.appendLine(line);
        return this;
    }

    appendWidget(name: string, widget: Widget, opts: WidgetOptions = {}): this {
        return this.appendWidgets({ [name]: widget }, opts);
    }

    render(theme: Theme = currentTheme()): string {
        return renderTags(this.content, theme);
    }

    toString(): string {
        return this.render();
    }

    get isEmpty(): boolean {
        return this.content === '';
    }
}
