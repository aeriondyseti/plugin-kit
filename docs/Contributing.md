# Contributing

[`CLAUDE.md`](https://github.com/aeriondyseti/plugin-kit/blob/main/CLAUDE.md)
is the full guide: the development loop, the simplify analysis, coding
conventions and release steps. This page is the map.

## Layout

| Path | Holds |
| --- | --- |
| `src/events/` | one class per hook event |
| `src/output/`, `src/formatting/` | `OutputBuilder`, tags, icons, theme |
| `src/widgets/` | the widgets subpath (pure: no Node) |
| `src/cli/` | the `plugin-kit` command |
| `src/fixtures.ts` | fixture record and load |
| `src/adapter/` | command hook ↔ mod adapter (pure; vendored) |
| `src/statusline/` | the statusline subpath |
| `src/mod-testing/` | mod test helpers (vendored into tests) |
| `src/scaffold/`, `src/doctor/`, `src/release/` | `plugin-kit new`, `doctor`, `release` |
| `src/testing.ts` | the `/testing` subpath |
| `plugin/` | the plugin-kit Claude Code plugin |
| `plugin/hooks/kit/` | generated copies of the widget code; don't edit |
| `docs/` | these pages, published to the wiki |
| `scripts/` | sync scripts (plugin copies, wiki), release notes |
| `examples/hooks/` | runnable example hooks with tests |

## Checks

```bash
npm test             # unit tests, incl. stale plugin/hooks/kit and broken doc links
npm run typecheck    # source, plus the $.kit contract against src/widgets
npx tsc -p examples/tsconfig.json
npm run plugin:check # claude plugin validate + claude plugin test (needs Claude Code)
npm run hooktypes:check # our hook input types against Claude Code's own
```

## Changing widget code

A mod imports only its own files, so the plugin carries copies of
`src/widgets/` in `plugin/hooks/kit/`, and its contract
(`plugin/types/index.d.ts`) restates the types. After a change:

```bash
npm run plugin:sync
```

`npm test` fails on a stale copy and `npm run typecheck` on a drifted
contract.

## Docs and the wiki

`docs/` is the source; the
[wiki](https://github.com/aeriondyseti/plugin-kit/wiki) is a published copy.
Edit `docs/`, then:

```bash
npm run docs:wiki
```

It copies the pages into the wiki's own git repo, turning `Page.md` links
into wiki links, and pushes. Links between pages are relative (`Page.md`);
links to repository files are full GitHub URLs, so they work in both places.

## Releasing

Follow "Release" in `CLAUDE.md`. The repo releases itself with its own
[`plugin-kit release`](Tooling.md#release-plugin-kit-release) (version bump,
CHANGELOG, commit, annotated tag, and the marketplace pin when `plugin/`
changed); pushing the tag runs the release workflow, which publishes to npm
through trusted publishing and creates the GitHub release from the
CHANGELOG.

## When Claude Code changes its hooks

```bash
npm run hooktypes:check            # against the newest declarations on this machine
npm run hooktypes:check -- <path>  # or a given claude-code.d.ts
```

compares every event's input in `src/events/` with Claude Code's own
declarations and lists events and fields we lack (exit 1). Add them by
hand: the hand-written types keep narrower unions and docs.
