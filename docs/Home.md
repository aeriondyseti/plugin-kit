# plugin-kit

A typed toolkit for [Claude Code](https://code.claude.com/docs) plugins:

- **Hook scripts**: one typed class per hook event (`parse()` and
  `emitOutput()`), styled output, and a testing kit.
- **Widgets**: meters, clocks, counters, lists and tags, validated with
  errors a model can act on, and drawn the same way in hook output and in
  mods.
- **The plugin-kit plugin**: gives every mod a `$.kit`, so mods that draw
  widgets look and behave the same and follow the user's settings.

The npm package is
[`@aeriondyseti/plugin-kit`](https://www.npmjs.com/package/@aeriondyseti/plugin-kit)
(formerly `@aeriondyseti/hook-kit`); the plugin is
`plugin-kit@aeriondyseti-plugins`.

## Which part do you need?

| You're writing | Use | Read |
| --- | --- | --- |
| A **hook script**: a `command` hook in `settings.json` or a plugin's `hooks.json` | the npm package | [Getting Started](Getting-Started.md), [Hook Scripts](Hook-Scripts.md) |
| Types for hook input and output | the npm package (scripts) or Claude Code's own types (mods) | [Hook Typings](Hook-Typings.md) |
| Styled text a hook shows the user | `OutputBuilder` | [Styled Output](Styled-Output.md) |
| State to show: health, progress, clues, conditions | widgets | [Widgets](Widgets.md) |
| A **mod** that draws widgets | `$.kit` or a vendored copy | [Widgets in Mods](Widgets-in-Mods.md), [The plugin-kit Plugin](The-plugin-kit-Plugin.md) |
| Tests for any of the above | `/testing` and `claude plugin test` | [Testing](Testing.md) |

Working on plugin-kit itself? See [Contributing](Contributing.md).
