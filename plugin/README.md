# plugin-kit

A Claude Code plugin that gives every mod a `$.kit`: hand it widgets, draw
what it returns. Plugins that use it look and behave the same, and the kit
owns the small interactions (a long list folds behind `+3 more`).

## Installing

This repository is a marketplace named `plugin-kit`:

```sh
claude plugin marketplace add aeriondyseti/hook-kit
claude plugin install plugin-kit@plugin-kit
```

## Using it from your mod

1. **Depend on it.** In your `.claude-plugin/plugin.json`:

   ```json
   { "name": "my-mod", "dependencies": [{ "name": "plugin-kit", "marketplace": "plugin-kit" }] }
   ```

   A bare `"plugin-kit"` would be looked up in *your* plugin's marketplace,
   so name ours. For installing your plugin to install the kit too, your
   marketplace's `marketplace.json` must allow it:

   ```json
   { "name": "your-marketplace", "allowCrossMarketplaceDependenciesOn": ["plugin-kit"], ... }
   ```

   Without that line, your users install plugin-kit themselves first (the
   allowlist doesn't apply to a dependency that is already installed);
   otherwise your plugin installs but doesn't load, and `claude plugin list`
   says `Dependency "plugin-kit@plugin-kit" is not installed`.

   Claude Code lays the kit's contract into your
   `.claude-plugin/types/plugin-kit/`, so `$.kit` is typed.

   Steps 1 and 2 are one command, run in your plugin's folder:

   ```sh
   npx @aeriondyseti/hook-kit add-kit
   ```

2. **Get `hydrate`.** A mod can't import code from another plugin, and
   functions can't cross between plugins, so `$.kit.render` returns a plain
   JSON description. `add-kit` copies [`hydrate.ts`](../src/widgets/hydrate.ts)
   (one self-contained file) beside your hooks module; run it again after
   upgrading to refresh the copy. It builds the elements and gives every
   Button its `onPress`.

3. **Draw.**

   ```tsx
   import { hydrate } from './hydrate.ts'

   on('ui.render', { component: 'Pane', requestId: 'stats' }, async ($, e, next) => {
     const tree = await $.kit.render({
       id: `my-mod:${e.requestId}`,
       widgets: {
         Health: { type: 'meter', value: 88, max: 100, color: 'red', group: 'Body' },
         Suspicion: { type: 'clock', value: 2, of: 6, note: 'The clerk heard something.' },
         Clues: { type: 'list', value: ['a torn ticket', 'wet boots'] },
       },
     })
     const { Box } = $.ui.resolve(e)
     return <Box>{hydrate(tree, h)}</Box>
   })
   ```

   The drawing redraws by itself when the kit's view state changes (a list
   folded or unfolded). Give `id` something unique to the drawing: it keys
   that state and prefixes the kit's Button keys.

## `$.kit`

| Method | Gives |
| --- | --- |
| `render({ id, widgets, barWidth?, listLimit? })` | A UI description of the widgets, for `hydrate`. Invalid widgets draw as text. |
| `line({ widgets })` | One line of plain text, joined with ` · `: for a status line. |
| `parse({ name, widget })` | `{ ok, widget }` or `{ ok: false, error }`, the error naming the widget and the fix. |
| `catalog()` | `{ table, schema }`: the types as a markdown table for a prompt or skill, and a JSON Schema for one widget as a tool input. |

The widget types are documented in [`types/index.d.ts`](types/index.d.ts).

### Your own buttons

Buttons you add to the tree get their handler by key:
`hydrate(tree, h, { save: () => ... })`. Keys starting `kit:` are the kit's.

### Restyling the kit

Every `$.kit` method is also an event, so a theme plugin can rewrite what
every caller asks for, e.g. `on('kit.render', ($, e, next) => next({ ...e, barWidth: 20 }))`.

## Developing

The widget code lives in [`../src/widgets`](../src/widgets) and is copied
into `hooks/kit/` (a mod imports only its own files). After changing it:

```sh
npm run plugin:sync    # refresh hooks/kit/
npm run plugin:check   # claude plugin validate + claude plugin test
```

`npm test` fails if `hooks/kit/` is stale, and `npm run typecheck` fails if
`types/index.d.ts` drifts from the widget types.
