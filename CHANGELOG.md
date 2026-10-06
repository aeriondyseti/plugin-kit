# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `@aeriondyseti/hook-kit/widgets`: six widget types (`text`, `counter`,
  `meter`, `clock`, `list`, `tags`) with `note`, `color` (named or hex) and
  `group`; `parseWidget` (errors name the widget and the fix) and lenient
  `loadWidgets`; `WIDGET_CATALOG`, `widgetTable()` and `widgetJsonSchema()`
  for prompts and tool inputs; `renderWidgetLine` / `renderWidgetsLine`;
  `describeWidgets`, a plain-JSON UI description for Claude Code mods; and
  `hydrate`, which turns one into elements. Pure: no Node, no dependencies.
- `plugin/`: **plugin-kit**, a Claude Code plugin that adds `$.kit`
  (`render`, `line`, `parse`, `catalog`) to every mod that lists it under
  `dependencies`, and folds long lists behind a button it answers itself.

## [1.1.0] - 2026-09-27

Synced with the Claude Code 2.1.283 hook schema.

### Added

- 24 new event classes, covering every hook event Claude Code fires:
  `PostToolUseFailure`, `PostToolBatch`, `PermissionRequest`,
  `PermissionDenied`, `UserPromptExpansion`, `SubagentStart`,
  `StopFailure`, `PostCompact`, `Setup`, `PreModelSwitch`,
  `PostModelSwitch`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`,
  `Elicitation`, `ElicitationResult`, `ConfigChange`, `WorktreeCreate`,
  `WorktreeRemove`, `InstructionsLoaded`, `CwdChanged`, `FileChanged`,
  `DirectoryAdded`, `MessageDisplay` — each with a `mockXxx` factory in
  `/testing`. `HOOK_EVENT_NAMES` lists all 33.
- `PermissionRequest.emitOutput` options are a discriminated union on
  `decision`, so allow-only / deny-only fields can't be mixed.
- `WorktreeCreate.emitOutput({ worktreePath })` prints the bare path, as
  command hooks for that event require (the one non-JSON reply).
- `PermissionUpdate` and related permission types.
- `TestHookResult.wasDenied` / `wasAllowed` / `toClaude` understand
  PermissionRequest's `decision.behavior` / `decision.message`.
- README: an events table showing what each event can do.
- Common input fields: `prompt_id`, `agent_id`, `agent_type`, `effort`.
  `permission_mode` is now typed as `PermissionMode`.
- `terminalSequence` emit option on every event (OSC desktop notifications).
- `DecisionType` gains `'defer'`; `TestHookResult` gains `wasDeferred`.
- `PreToolUse` / `PostToolUse` inputs: `mcp_server`; `PostToolUse` also
  gets `duration_ms`.
- `PostToolUse.emitOutput({ updatedToolOutput })` — replaces the output of
  any tool, not just MCP tools.
- `UserPromptSubmit`: `source` / `session_title` inputs;
  `suppressOriginalPrompt` / `sessionTitle` emit options.
- `SessionStart`: `session_title` and resume/fork cache-cost inputs;
  `initialUserMessage`, `sessionTitle`, `watchPaths`, `reloadSkills` emit
  options.
- `Stop` / `SubagentStop`: `last_assistant_message`, `background_tasks`,
  `session_crons` inputs, and a `toClaude` emit option (non-blocking
  feedback that keeps the turn going).
- `Notification`: `toClaude` emit option.
- Exported types: `OpenUnion`, `PermissionMode`, `EffortLevel`,
  `McpServerInfo`, `NotificationType`, `BackgroundTask`, `SessionCron`.

### Changed

- `emitOutput`'s `toUser` option now prepends a newline to the emitted
  `systemMessage`, so multi-line formatted output (a box's top border, a
  table header) no longer renders on the same line as Claude Code's hook
  label.
- `Notification.notification_type` is now an open union (known values
  autocomplete; newer ones still type-check). Claude Code has added eight
  values since 1.0.0.

### Deprecated

- `PostToolUse`'s `updatedMCPToolOutput` — use `updatedToolOutput`.

### Fixed

Input types that didn't match what Claude Code sends. These can surface as
new compile errors in code that relied on the old (wrong) shapes:

- `SessionStartInput.model` is optional; `source` includes `'fork'`.
- `SessionEndInput.reason` includes `'resume'`.
- `SubagentStopInput` includes the always-present `agent_id`,
  `agent_type`, and `agent_transcript_path`.
- `PreCompactInput.custom_instructions` is `string | null` and always
  present.

## [1.0.0] - 2026-04-22

### Added

- Nine event classes (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`,
  `SessionStart`, `SessionEnd`, `Stop`, `SubagentStop`, `Notification`,
  `PreCompact`) with `parse()` / `emitOutput()` static methods.
- `OutputBuilder` with `append`, `appendLine`, `appendDivider`,
  `appendList`, `appendBox`, `appendTable` — all chainable, all
  theme-aware at render time.
- Tag markup renderer (`<color:"red">`, `<bg:"yellow">`, `<bold>`,
  `<dim>`, `<italic>`, `<underline>`) with `renderTags`, `stripTags`,
  `visualWidth` primitives.
- `ICONS` constants: `check cross warn info arrow bullet dot star`.
- `HookParseError` for structured parse failures; `runHook(fn)` opt-in
  helper that catches it and writes to stderr + exits(2) per hook
  protocol.
- `@aeriondyseti/hook-kit/testing` subpath with:
  - `testHook(input, runner)` — drives parse → emit against synthetic
    input, captures the emitted payload.
  - Nine `mockXxx(overrides?)` factories, one per event.
  - Normalized `TestHookResult` fields: `wasDenied`, `wasAllowed`,
    `wasAsked`, `toUser`, `toClaude`.
- `examples/hooks/` — five runnable dogfood hooks with colocated tests
  showing deny / allow / ask / `updatedInput` / context-injection
  patterns.

[Unreleased]: https://github.com/aeriondyseti/hook-kit/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/aeriondyseti/hook-kit/releases/tag/v1.1.0
[1.0.0]: https://github.com/aeriondyseti/hook-kit/releases/tag/v1.0.0
