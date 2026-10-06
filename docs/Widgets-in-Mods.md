# Widgets in Mods

A mod (a plugin with function hooks) can draw widgets two ways. Both are
set up by one command run in your plugin's folder.

| | `$.kit` (plugin dependency) | Vendored |
| --- | --- | --- |
| Set up | `npx @aeriondyseti/plugin-kit add-kit` | `npx @aeriondyseti/plugin-kit add-kit --vendor` |
| Your users install | plugin-kit (automatic with the allowlist) | nothing |
| Look | the user's kit settings (`glyphs`, `barWidth`, `listLimit`) | whatever you pass |
| Long lists | fold behind `+N more`; the kit answers the press | shown whole unless you track folding |
| Calls | `await $.kit.render(...)` | `describeWidgets(...)`, synchronous |
| Updates | upgrade the plugin | re-run `add-kit --vendor` |

Pick `$.kit` when your mod should look like every other mod using the kit.
Pick vendored when it must stand alone.

## Why `hydrate`

Functions can't cross between plugins, and a Button can't draw without an
`onPress`. So the kit describes widgets as **plain JSON** shaped like an
element tree (`{ type: 'Text', props, children }`), and your mod turns that
into elements with `hydrate`, which gives every Button its `onPress`.

```tsx
return <Box>{hydrate(tree, h)}</Box>;
```

Pass `h` (the mod's JSX factory) and return the result inside one of your
own elements. Your own buttons get their handler by key:

```tsx
hydrate(tree, h, { save: () => $.ui.toast('saved') });
```

Keys starting `kit:` are the kit's; any Button without a handler gets a
no-op, which still raises `ui.press` (that's how the kit answers its own).

## With `$.kit`

```bash
npx @aeriondyseti/plugin-kit add-kit
```

This adds the dependency to `plugin.json` and copies `hydrate.ts` beside
your hooks module:

```json
{ "dependencies": [{ "name": "plugin-kit", "marketplace": "aeriondyseti-plugins" }] }
```

For installing your plugin to install the kit too, your marketplace must
allow it, in `marketplace.json`:

```json
{ "allowCrossMarketplaceDependenciesOn": ["aeriondyseti-plugins"] }
```

Without it, your users install plugin-kit first themselves; otherwise your
plugin installs but doesn't load. Then draw:

```tsx
import type { Register } from 'claude-code';
import { hydrate } from './hydrate.ts';

export const register: Register = (on) => {
    on('ui.render', { component: 'Pane', requestId: 'stats' }, async ($, e, next) => {
        const { Box } = $.ui.resolve(e);
        const tree = await $.kit.render({
            id: `my-mod:${e.requestId}`,
            widgets: {
                Health: { type: 'meter', value: 88, max: 100, color: 'red', group: 'Body' },
                Clues: { type: 'list', value: ['a torn ticket', 'wet boots', 'a key', 'ash', 'a map', 'a ring'] },
            },
        });
        return <Box>{hydrate(tree, h)}</Box>;
    });
};
```

- `id` names the drawing: it keys the kit's view state (which lists are
  open) and prefixes its Button keys. Make it unique per drawing;
  `my-mod:${e.requestId}` is a good default.
- The drawing redraws by itself when a list folds or unfolds.
- Invalid widgets draw as text rather than breaking the pane; validate with
  `$.kit.parse` where you'd rather refuse.
- Each `$.kit` call is an async round trip, so make one `render` per
  drawing, not one per widget.

The full `$.kit` API, the user's settings and restyling are on
[The plugin-kit Plugin](The-plugin-kit-Plugin.md).

## Vendored

```bash
npx @aeriondyseti/plugin-kit add-kit --vendor
```

This copies the widget code and `hydrate` into `hooks/kit/`, with an
`index.ts` to import from, and leaves `plugin.json` alone:

```tsx
import type { Register } from 'claude-code';
import { describeWidgets, hydrate, type Widgets } from './kit/index.ts';

export const register: Register = (on) => {
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
        const { Box } = $.ui.resolve(e);
        const widgets: Widgets = {
            Health: { type: 'meter', value: 7, max: 10, color: 'red' },
            Suspicion: { type: 'clock', value: 2, of: 6 },
        };
        const tree = describeWidgets(widgets, { id: 'my-mod:above', barWidth: 8 });
        return <Box>{hydrate(tree, h)}</Box>;
    });
};
```

`describeWidgets(widgets, options)` takes `id`, `barWidth` (default 10),
`listLimit` (default 5), `glyphs` and `expanded` (the names of lists to
draw unfolded). A folded list draws a `+N more` button keyed
`kit:<id>:<name>:more`; to make it work in a vendored mod, keep the open
names in your own `$.state` and pass them as `expanded`. `parseWidgetKey`
reads a key back.

Everything else in the [Widgets](Widgets.md) subpath is vendored too:
`parseWidget`, `loadWidgets`, `renderWidgetLine`, `widgetTable`,
`widgetJsonSchema`. Re-run the command after upgrading to refresh the copy;
the files say `Do not edit`.
