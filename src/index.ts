/**
 * `plugin-kit` — typed helpers for writing Claude Code hook scripts.
 *
 * Every hook event ships as a class with two static methods:
 *
 *   const input = PreToolUse.parse();          // read + typecheck stdin
 *   PreToolUse.emitOutput({ decision: 'deny' }); // serialize + exit(0)
 *
 * Input fields use snake_case (matching Claude Code's spec verbatim, so
 * what you read in the hook docs is what you type). Emit-option names use
 * camelCase — they're our API, mapped internally to the spec's JSON.
 *
 * Output formatting (colors, modifiers, future boxes/tables) is done
 * through `OutputBuilder`, which you can pass wherever a `toUser` or
 * `toClaude` option accepts a string.
 */

// Event classes + their input/option types.
export { ConfigChange, type ConfigChangeEmitOptions, type ConfigChangeInput } from './events/ConfigChange.js';
export { CwdChanged, type CwdChangedEmitOptions, type CwdChangedInput } from './events/CwdChanged.js';
export { DirectoryAdded, type DirectoryAddedEmitOptions, type DirectoryAddedInput } from './events/DirectoryAdded.js';
export { Elicitation, type ElicitationAction, type ElicitationEmitOptions, type ElicitationInput } from './events/Elicitation.js';
export { ElicitationResult, type ElicitationResultEmitOptions, type ElicitationResultInput } from './events/ElicitationResult.js';
export { FileChanged, type FileChangedEmitOptions, type FileChangedInput } from './events/FileChanged.js';
export { InstructionsLoaded, type InstructionsLoadedEmitOptions, type InstructionsLoadedInput } from './events/InstructionsLoaded.js';
export { MessageDisplay, type MessageDisplayEmitOptions, type MessageDisplayInput } from './events/MessageDisplay.js';
export { Notification, type NotificationEmitOptions, type NotificationInput, type NotificationType } from './events/Notification.js';
export { PermissionDenied, type PermissionDeniedEmitOptions, type PermissionDeniedInput } from './events/PermissionDenied.js';
export { PermissionRequest, type PermissionRequestEmitOptions, type PermissionRequestInput } from './events/PermissionRequest.js';
export { PostCompact, type PostCompactEmitOptions, type PostCompactInput } from './events/PostCompact.js';
export { PostModelSwitch, type PostModelSwitchEmitOptions, type PostModelSwitchInput } from './events/PostModelSwitch.js';
export { PostToolBatch, type PostToolBatchEmitOptions, type PostToolBatchInput, type ToolCallResult } from './events/PostToolBatch.js';
export { PostToolUse, type PostToolUseEmitOptions, type PostToolUseInput } from './events/PostToolUse.js';
export { PostToolUseFailure, type PostToolUseFailureEmitOptions, type PostToolUseFailureInput } from './events/PostToolUseFailure.js';
export { PreCompact, type PreCompactEmitOptions, type PreCompactInput } from './events/PreCompact.js';
export { PreModelSwitch, type ModelSwitchInfo, type PreModelSwitchEmitOptions, type PreModelSwitchInput } from './events/PreModelSwitch.js';
export { PreToolUse, type PreToolUseEmitOptions, type PreToolUseInput } from './events/PreToolUse.js';
export { SessionEnd, type SessionEndEmitOptions, type SessionEndInput } from './events/SessionEnd.js';
export { SessionStart, type SessionStartEmitOptions, type SessionStartInput } from './events/SessionStart.js';
export { Setup, type SetupEmitOptions, type SetupInput } from './events/Setup.js';
export { Stop, type BackgroundTask, type SessionCron, type StopEmitOptions, type StopInput } from './events/Stop.js';
export { StopFailure, type StopFailureEmitOptions, type StopFailureError, type StopFailureInput } from './events/StopFailure.js';
export { SubagentStart, type SubagentStartEmitOptions, type SubagentStartInput } from './events/SubagentStart.js';
export { SubagentStop, type SubagentStopEmitOptions, type SubagentStopInput } from './events/SubagentStop.js';
export { TaskCompleted, type TaskCompletedEmitOptions, type TaskCompletedInput } from './events/TaskCompleted.js';
export { TaskCreated, type TaskCreatedEmitOptions, type TaskCreatedInput, type TaskInfo } from './events/TaskCreated.js';
export { TeammateIdle, type TeammateIdleEmitOptions, type TeammateIdleInput } from './events/TeammateIdle.js';
export { UserPromptExpansion, type UserPromptExpansionEmitOptions, type UserPromptExpansionInput } from './events/UserPromptExpansion.js';
export { UserPromptSubmit, type UserPromptSubmitEmitOptions, type UserPromptSubmitInput } from './events/UserPromptSubmit.js';
export { WorktreeCreate, type WorktreeCreateEmitOptions, type WorktreeCreateInput } from './events/WorktreeCreate.js';
export { WorktreeRemove, type WorktreeRemoveEmitOptions, type WorktreeRemoveInput } from './events/WorktreeRemove.js';

// Formatting primitives.
export {
    OutputBuilder,
    type BoxOptions,
    type DividerOptions,
    type ListOptions,
    type TableOptions,
    type WidgetOptions,
} from './output/OutputBuilder.js';
export { currentTheme, setTheme, type Theme } from './formatting/theme.js';
export { renderTags, stripTags, visualWidth } from './formatting/tags.js';
export { ICONS, type IconName } from './formatting/icons.js';
export { COLORS, MODIFIERS, type ColorName, type ModifierName } from './formatting/vocab.js';

// Shared types.
export {
    HOOK_EVENT_NAMES,
    type CommonHookInput,
    type DecisionType,
    type EffortLevel,
    type HookEventName,
    type McpServerInfo,
    type OpenUnion,
    type PermissionDestination,
    type PermissionMode,
    type PermissionRule,
    type PermissionRuleBehavior,
    type PermissionUpdate,
} from './common.js';
export { HookParseError } from './events/_parse.js';
export { runHook } from './runHook.js';
