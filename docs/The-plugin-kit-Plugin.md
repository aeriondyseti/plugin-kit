# The plugin-kit Plugin

A Claude Code plugin that adds `$.kit` to every mod that depends on it. It
lives in [`plugin/`](https://github.com/aeriondyseti/plugin-kit/tree/main/plugin)
and is listed in the `aeriondyseti-plugins` marketplace.

## Installing

```bash
claude plugin marketplace add aeriondyseti/aeriondyseti-plugins
claude plugin install plugin-kit@aeriondyseti-plugins
```

Or in a session: `/plugin install plugin-kit@aeriondyseti-plugins`. Users of
a mod that depends on it usually get it automatically (see
[Widgets in Mods](Widgets-in-Mods.md#with-kit)).

## `$.kit`

Every method takes and returns plain JSON.

| Method | Returns |
| --- | --- |
| `render({ id, widgets, barWidth?, listLimit?, glyphs? })` | a UI description of the widgets, for `hydrate` |
| `line({ widgets })` | the widgets on one line of plain text, joined with ` · ` |
| `parse({ name, widget })` | `{ ok: true, widget }` or `{ ok: false, error }` |
| `catalog()` | `{ table, schema }`: the markdown table and the JSON Schema from [Widgets](Widgets.md#telling-a-model-about-them) |

`render`'s `barWidth`, `listLimit` and `glyphs` override the user's settings
for that drawing. Most mods should leave them out.

## Settings

The user sets the kit's look once, for every mod that draws through it, in
`/config` or `claude plugin configure plugin-kit`:

| Setting | Default | |
| --- | --- | --- |
| `glyphs` | `unicode` | `ascii` draws bars as `###---`, clocks as `**..`, bullets as `-` |
| `barWidth` | 10 | cells in a meter's bar |
| `listLimit` | 5 | items a list shows before folding |

## Restyling the kit from another plugin

Every `$.kit` method is also an event, so a plugin can rewrite what every
caller asks for:

```ts
on('kit.render', ($, e, next) => next({ ...e, barWidth: 20 }));
```

## What the kit keeps

One value in `$.state`: per drawing `id`, the names of its unfolded lists.
It's session state, so lists start folded in a new session.

## Types

A plugin that depends on plugin-kit gets its contract in
`.claude-plugin/types/plugin-kit/index.d.ts`: `Kit`, `KitWidget` and the
per-type `Kit*Widget`s, `KitUiElement`, `KitRenderArgs`, `KitParseResult`,
`KitGlyphs`. They mirror the [Widgets](Widgets.md) types.
