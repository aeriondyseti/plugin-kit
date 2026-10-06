# Widgets

Small, typed pieces of state, drawn the same way wherever they appear: a
status line, hook output, a mod's pane. All of it is in
`@aeriondyseti/plugin-kit/widgets`, which is pure (no Node, no
dependencies).

## Types

| Type | Fields | Drawn | One line |
| --- | --- | --- | --- |
| `text` | `value: string` | `Weather sleet` | `Weather sleet` |
| `counter` | `value: number` | `Days 9` | `Days 9` |
| `meter` | `value`, `max` | `Health ▰▰▰▰▰▰▰▰▱▱ 88/100` | `Health 88/100` |
| `clock` | `value`, `of` (whole, 1–12) | `Suspicion ◆◆◇◇◇◇` | `Suspicion 2/6` |
| `list` | `value: string[]` | the name, then one bullet per item | `Powers: wheel, parry` |
| `tags` | `value: string[]` | `State wounded · hunted` | `State: wounded · hunted` |

Every widget may also carry:

- `note`: one to three short sentences, drawn dim under the row.
- `color`: a named color (`red`, `cyan`, ...) or a hex (`#c0392b`). It paints
  the main part (name, bar, segments, items), never the note. Hook output
  drops hex colors, since tags know named colors only.
- `group`: a heading drawn once above a run of widgets sharing it.

Widgets live in an object keyed by name; key order is draw order:

```ts
import type { Widgets } from '@aeriondyseti/plugin-kit/widgets';

const widgets: Widgets = {
    Health: { type: 'meter', value: 88, max: 100, color: 'red', group: 'Body' },
    Suspicion: { type: 'clock', value: 2, of: 6, note: 'The clerk heard something.' },
    Clues: { type: 'list', value: ['a torn ticket', 'wet boots'] },
};
```

## Validating

Widgets often come from a model or a file, so validation returns rather than
throws, and every error names the widget and the fix:

```ts
import { loadWidgets, parseWidget } from '@aeriondyseti/plugin-kit/widgets';

parseWidget('Health', { type: 'meter', value: 88 });
// { ok: false, error: 'Health: meter needs max: the value is drawn as a bar out of it' }

const { widgets, warnings } = loadWidgets(JSON.parse(file));
```

`loadWidgets` never fails: an invalid entry is kept as a `text` widget
holding its raw value, with a warning saying what to fix. Use it for state
that must always open.

## Telling a model about them

The catalog generates both forms a model needs:

```ts
import { widgetJsonSchema, widgetTable } from '@aeriondyseti/plugin-kit/widgets';

widgetTable();      // markdown: | type | fields | when |, for a prompt or skill
widgetJsonSchema(); // JSON Schema for one widget, for a tool's input
```

The schema's `type` enum is described with when to use each type; pair it
with `parseWidget` so the model gets the fix when it's wrong.
`WIDGET_CATALOG` holds the source text if you want your own format.

## Drawing

| Where | Call |
| --- | --- |
| A status line, a prompt | `renderWidgetLine(name, widget)`, `renderWidgetsLine(widgets)` |
| Hook output | `new OutputBuilder().appendWidgets(widgets, { barWidth?, glyphs? })` |
| A mod | `$.kit.render(...)` or `describeWidgets(...)`, then `hydrate` (see [Widgets in Mods](Widgets-in-Mods.md)) |

In hook output:

```ts
new OutputBuilder().appendWidgets({
    Health: { type: 'meter', value: 7, max: 10, color: 'red' },
    Suspicion: { type: 'clock', value: 2, of: 6 },
});
// Health ▰▰▰▰▰▰▰▱▱▱ 7/10
// Suspicion ◆◆◇◇◇◇
```

Lists never fold in hook output (there's nothing to press).

## Glyphs

`glyphs: 'ascii'` swaps the shapes for terminals or fonts without them:

| | `unicode` (default) | `ascii` |
| --- | --- | --- |
| meter | `▰▰▰▱` | `###-` |
| clock | `◆◆◇◇` | `**..` |
| list bullet | `•` | `-` |
| tags separator | `·` | `\|` |
