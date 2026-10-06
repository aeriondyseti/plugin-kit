# Styled Output

`OutputBuilder` collects lines and renders them to ANSI when you emit. Pass
it wherever an option takes text (`toUser`, `toClaude`):

```ts
import { ICONS, OutputBuilder, PostToolUse } from '@aeriondyseti/plugin-kit';

const toUser = new OutputBuilder()
    .appendBox(`${ICONS.check} ${input.tool_name}`, { title: '● PostToolUse', color: 'green' })
    .appendTable(rows, { headers: ['key', 'value'], color: 'green' });

PostToolUse.emitOutput({ toUser });
```

## Methods

All return the builder, so they chain.

| Method | Draws |
| --- | --- |
| `append(text)` | text with no newline |
| `appendLine(text?)` | a line |
| `appendDivider(char?, { width?, color? })` | a rule across the terminal |
| `appendList(items, { bullet?, indent? })` | a bulleted list |
| `appendBox(content, { title?, color?, padding? })` | content in a unicode box |
| `appendTable(rows, { headers?, color? })` | a bordered table, left-aligned |
| `appendWidgets(widgets, { barWidth?, glyphs? })` | widgets, one row each (see [Widgets](Widgets.md)) |
| `appendWidget(name, widget, opts?)` | one widget |

`render()` (or `toString()`) returns the final string.

## Tags

Any text may carry inline tags:

```ts
builder.appendLine('<color:"red"><bold>boom</bold></color> and <dim>a note</dim>');
```

| Tag | |
| --- | --- |
| `<color:"name">…</color>` | foreground color |
| `<bg:"name">…</bg>` | background color |
| `<bold>`, `<dim>`, `<italic>`, `<underline>` | modifiers |

Colors: `black red green yellow blue magenta cyan white gray`. Unknown tags
pass through as text, so a typo shows. `renderTags`, `stripTags` and
`visualWidth` (cell width, ignoring tags) are exported for your own layout.

Known limit: nesting the same tag (`<color>` inside `<color>`) doesn't
restore the outer color when the inner one closes.

## Icons

Constants, not tags, so a typo is a compile error:

```ts
builder.appendLine(`${ICONS.check} build passed`);
```

`check ✓  cross ✗  warn ⚠  info ℹ  arrow ▸  bullet •  dot ·  star ★`

## Colors on or off

Colors are on by default, even though a hook's stdout isn't a terminal:
Claude Code renders the ANSI. They turn off when `NO_COLOR` is set or
`FORCE_COLOR=0`, and you can force either way with
`setTheme({ colors: false })`. With colors off, tags are stripped and the
text kept.
