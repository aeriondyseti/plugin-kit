/**
 * `plugin-kit/testing` — drive an event's parse → emit flow against a synthetic
 * input, without touching real stdin/stdout or calling `process.exit`.
 *
 * The harness installs two seams that already exist in the library:
 *
 *   1. `_setTestStdin` overrides `readStdinSync` to return a fixed JSON string.
 *   2. `_setEmitCapture` makes `emitJson` store the payload in a slot and
 *      throw a sentinel instead of writing + exiting.
 *
 * Parse failures surface naturally: `readHookInput` throws `HookParseError`,
 * which propagates out of `testHook` for the caller to inspect. Both seams
 * are cleared in `finally`, so a throwing runner can't leave them dangling.
 *
 * Usage:
 *
 *   const { payload } = testHook(
 *     { hook_event_name: 'PreToolUse', session_id: 's', transcript_path: '/t', cwd: '/', tool_name: 'Bash', tool_input: { command: 'rm -rf /' }, tool_use_id: 'x' },
 *     () => {
 *       const input = PreToolUse.parse();
 *       if (String(input.tool_input.command).includes('rm -rf /')) {
 *         PreToolUse.emitOutput({ decision: 'deny', reason: 'no' });
 *       } else {
 *         PreToolUse.emitOutput({});
 *       }
 *     },
 *   );
 *   expect(payload.hookSpecificOutput?.permissionDecision).toBe('deny');
 */

import { _clearTestStdin, _setTestStdin, type HookEventName } from './common.js';
import {
    _CAPTURED_SENTINEL,
    _clearEmitCapture,
    _setEmitCapture,
} from './events/_emit.js';
import type { ConfigChangeInput } from './events/ConfigChange.js';
import type { CwdChangedInput } from './events/CwdChanged.js';
import type { DirectoryAddedInput } from './events/DirectoryAdded.js';
import type { ElicitationInput } from './events/Elicitation.js';
import type { ElicitationResultInput } from './events/ElicitationResult.js';
import type { FileChangedInput } from './events/FileChanged.js';
import type { InstructionsLoadedInput } from './events/InstructionsLoaded.js';
import type { MessageDisplayInput } from './events/MessageDisplay.js';
import type { NotificationInput } from './events/Notification.js';
import type { PermissionDeniedInput } from './events/PermissionDenied.js';
import type { PermissionRequestInput } from './events/PermissionRequest.js';
import type { PostCompactInput } from './events/PostCompact.js';
import type { PostModelSwitchInput } from './events/PostModelSwitch.js';
import type { PostToolBatchInput } from './events/PostToolBatch.js';
import type { PostToolUseInput } from './events/PostToolUse.js';
import type { PostToolUseFailureInput } from './events/PostToolUseFailure.js';
import type { PreCompactInput } from './events/PreCompact.js';
import type { PreModelSwitchInput } from './events/PreModelSwitch.js';
import type { PreToolUseInput } from './events/PreToolUse.js';
import type { SessionEndInput } from './events/SessionEnd.js';
import type { SessionStartInput } from './events/SessionStart.js';
import type { SetupInput } from './events/Setup.js';
import type { StopInput } from './events/Stop.js';
import type { StopFailureInput } from './events/StopFailure.js';
import type { SubagentStartInput } from './events/SubagentStart.js';
import type { SubagentStopInput } from './events/SubagentStop.js';
import type { TaskCompletedInput } from './events/TaskCompleted.js';
import type { TaskCreatedInput } from './events/TaskCreated.js';
import type { TeammateIdleInput } from './events/TeammateIdle.js';
import type { UserPromptExpansionInput } from './events/UserPromptExpansion.js';
import type { UserPromptSubmitInput } from './events/UserPromptSubmit.js';
import type { WorktreeCreateInput } from './events/WorktreeCreate.js';
import type { WorktreeRemoveInput } from './events/WorktreeRemove.js';

export { HookParseError } from './events/_parse.js';
export { fixturesModule, loadFixture, loadFixtures, type Fixture } from './fixtures.js';

export interface TestHookResult<P = unknown> {
    /** The raw JSON that `emitOutput` would have written to stdout. */
    payload: P;
    /** The exit code the real hook would have used (usually 0). */
    exitCode: number;

    /**
     * True if the hook's emit signaled a deny — a tri-state
     * `permissionDecision: 'deny'` (PreToolUse, PreModelSwitch), a
     * PermissionRequest `decision.behavior: 'deny'`, or a top-level
     * `decision: 'block'` (every event with a `deny` option).
     */
    wasDenied: boolean;
    /**
     * True if the hook's emit signaled allow — an explicit
     * `permissionDecision: 'allow'` / `decision.behavior: 'allow'`, or no
     * blocking/ask/defer signal at all
     * (an empty emit means "let it proceed").
     */
    wasAllowed: boolean;
    /** True if `permissionDecision === 'ask'` (PreToolUse, PreModelSwitch). */
    wasAsked: boolean;
    /** True if `permissionDecision === 'defer'` (PreToolUse only). */
    wasDeferred: boolean;

    /** Shortcut to `payload.systemMessage` — what the user will see. */
    toUser: string | undefined;
    /**
     * Shortcut to whatever the hook told Claude: the first of
     * `hookSpecificOutput.additionalContext`,
     * `hookSpecificOutput.permissionDecisionReason`, PermissionRequest's
     * `hookSpecificOutput.decision.message`, or top-level `reason`.
     */
    toClaude: string | undefined;
}

interface NormalizablePayload {
    systemMessage?: string;
    decision?: string;
    reason?: string;
    hookSpecificOutput?: {
        permissionDecision?: string;
        permissionDecisionReason?: string;
        additionalContext?: string;
        /** PermissionRequest only. */
        decision?: { behavior?: string; message?: string };
    };
}

/**
 * What a hook's JSON output decided, in `TestHookResult`'s terms. Shared by
 * `testHook` and `plugin-kit run`, so both report a decision the same way.
 */
export function summarizeOutput(payload: unknown): Omit<TestHookResult, 'payload' | 'exitCode'> {
    const p = (payload ?? {}) as NormalizablePayload;
    const hs = p.hookSpecificOutput;
    const verdict = hs?.permissionDecision ?? hs?.decision?.behavior;
    const wasDenied = verdict === 'deny' || p.decision === 'block';
    const wasAsked = verdict === 'ask';
    const wasDeferred = verdict === 'defer';
    const wasAllowed = verdict === 'allow' || (!wasDenied && !wasAsked && !wasDeferred);

    return {
        wasDenied,
        wasAllowed,
        wasAsked,
        wasDeferred,
        toUser: p.systemMessage,
        toClaude:
            hs?.additionalContext ??
            hs?.permissionDecisionReason ??
            hs?.decision?.message ??
            p.reason,
    };
}

export function testHook<P = unknown>(
    input: object,
    runner: () => void,
): TestHookResult<P> {
    const slot: { payload?: unknown; exitCode?: number } = {};
    _setTestStdin(JSON.stringify(input));
    _setEmitCapture(slot);

    try {
        try {
            runner();
        } catch (e) {
            // The emit sentinel means the runner successfully emitted and
            // "exited" — swallow it. Anything else (HookParseError, a bug in
            // the hook body, whatever) propagates to the caller.
            if (e !== _CAPTURED_SENTINEL) throw e;
        }
    } finally {
        _clearTestStdin();
        _clearEmitCapture();
    }

    if (slot.payload === undefined) {
        throw new Error('testHook: runner did not call emitOutput');
    }
    return {
        payload: slot.payload as P,
        exitCode: slot.exitCode ?? 0,
        ...summarizeOutput(slot.payload),
    };
}

/**
 * Input factories — each builds a valid, minimally-plausible input for the
 * corresponding event with overrides layered on top.
 *
 *   const input = mockPreToolUse({ tool_name: 'Write', tool_input: { file_path: '/x' } });
 *
 * Overrides are typed as `Partial<Input>`, so typos are compile errors.
 */

function commonDefaults<N extends HookEventName>(name: N) {
    return {
        hook_event_name: name,
        session_id: 'test-session',
        transcript_path: '/tmp/test-transcript.jsonl',
        cwd: '/tmp',
    } as const;
}

const modelSwitchDefaults = {
    from_model: 'claude-sonnet-5',
    to_model: 'claude-opus-5-5',
    requested_model: 'opus',
    context_tokens: 0,
    prompt_cache_warm: false,
    cache_ttl: '5m',
    estimated_cache_write_usd: 0,
    pricing: 'catalog',
} as const;

export function mockConfigChange(overrides: Partial<ConfigChangeInput> = {}): ConfigChangeInput {
    return {
        ...commonDefaults('ConfigChange'),
        source: 'project_settings',
        file_path: '/tmp/.claude/settings.json',
        ...overrides,
    };
}

export function mockCwdChanged(overrides: Partial<CwdChangedInput> = {}): CwdChangedInput {
    return {
        ...commonDefaults('CwdChanged'),
        old_cwd: '/tmp',
        new_cwd: '/tmp/sub',
        ...overrides,
    };
}

export function mockDirectoryAdded(overrides: Partial<DirectoryAddedInput> = {}): DirectoryAddedInput {
    return {
        ...commonDefaults('DirectoryAdded'),
        directory: '/tmp/other',
        source: 'slash_command',
        ...overrides,
    };
}

export function mockElicitation(overrides: Partial<ElicitationInput> = {}): ElicitationInput {
    return {
        ...commonDefaults('Elicitation'),
        mcp_server_name: 'test-server',
        message: 'test elicitation',
        ...overrides,
    };
}

export function mockElicitationResult(overrides: Partial<ElicitationResultInput> = {}): ElicitationResultInput {
    return {
        ...commonDefaults('ElicitationResult'),
        mcp_server_name: 'test-server',
        action: 'accept',
        ...overrides,
    };
}

export function mockFileChanged(overrides: Partial<FileChangedInput> = {}): FileChangedInput {
    return {
        ...commonDefaults('FileChanged'),
        file_path: '/tmp/.env',
        event: 'change',
        ...overrides,
    };
}

export function mockInstructionsLoaded(overrides: Partial<InstructionsLoadedInput> = {}): InstructionsLoadedInput {
    return {
        ...commonDefaults('InstructionsLoaded'),
        file_path: '/tmp/CLAUDE.md',
        memory_type: 'Project',
        load_reason: 'session_start',
        ...overrides,
    };
}

export function mockMessageDisplay(overrides: Partial<MessageDisplayInput> = {}): MessageDisplayInput {
    return {
        ...commonDefaults('MessageDisplay'),
        turn_id: 'test-turn-id',
        message_id: 'test-message-id',
        index: 0,
        final: true,
        delta: 'test line\n',
        ...overrides,
    };
}

export function mockNotification(overrides: Partial<NotificationInput> = {}): NotificationInput {
    return {
        ...commonDefaults('Notification'),
        message: 'test notification',
        notification_type: 'idle_prompt',
        ...overrides,
    };
}

export function mockPermissionDenied(overrides: Partial<PermissionDeniedInput> = {}): PermissionDeniedInput {
    return {
        ...commonDefaults('PermissionDenied'),
        tool_name: 'Bash',
        tool_input: {},
        tool_use_id: 'test-tool-use-id',
        reason: 'test denial',
        ...overrides,
    };
}

export function mockPermissionRequest(overrides: Partial<PermissionRequestInput> = {}): PermissionRequestInput {
    return {
        ...commonDefaults('PermissionRequest'),
        tool_name: 'Bash',
        tool_input: {},
        ...overrides,
    };
}

export function mockPostCompact(overrides: Partial<PostCompactInput> = {}): PostCompactInput {
    return {
        ...commonDefaults('PostCompact'),
        trigger: 'auto',
        compact_summary: 'test summary',
        ...overrides,
    };
}

export function mockPostModelSwitch(overrides: Partial<PostModelSwitchInput> = {}): PostModelSwitchInput {
    return {
        ...commonDefaults('PostModelSwitch'),
        ...modelSwitchDefaults,
        source: 'command',
        ...overrides,
    };
}

export function mockPostToolBatch(overrides: Partial<PostToolBatchInput> = {}): PostToolBatchInput {
    return {
        ...commonDefaults('PostToolBatch'),
        tool_calls: [],
        ...overrides,
    };
}

export function mockPostToolUse(overrides: Partial<PostToolUseInput> = {}): PostToolUseInput {
    return {
        ...commonDefaults('PostToolUse'),
        tool_name: 'Bash',
        tool_input: {},
        tool_response: {},
        tool_use_id: 'test-tool-use-id',
        ...overrides,
    };
}

export function mockPostToolUseFailure(overrides: Partial<PostToolUseFailureInput> = {}): PostToolUseFailureInput {
    return {
        ...commonDefaults('PostToolUseFailure'),
        tool_name: 'Bash',
        tool_input: {},
        tool_use_id: 'test-tool-use-id',
        error: 'test error',
        ...overrides,
    };
}

export function mockPreCompact(overrides: Partial<PreCompactInput> = {}): PreCompactInput {
    return {
        ...commonDefaults('PreCompact'),
        trigger: 'auto',
        custom_instructions: null,
        ...overrides,
    };
}

export function mockPreModelSwitch(overrides: Partial<PreModelSwitchInput> = {}): PreModelSwitchInput {
    return {
        ...commonDefaults('PreModelSwitch'),
        ...modelSwitchDefaults,
        source: 'command',
        ...overrides,
    };
}

export function mockPreToolUse(overrides: Partial<PreToolUseInput> = {}): PreToolUseInput {
    return {
        ...commonDefaults('PreToolUse'),
        tool_name: 'Bash',
        tool_input: {},
        tool_use_id: 'test-tool-use-id',
        ...overrides,
    };
}

export function mockSessionEnd(overrides: Partial<SessionEndInput> = {}): SessionEndInput {
    return {
        ...commonDefaults('SessionEnd'),
        reason: 'other',
        ...overrides,
    };
}

export function mockSessionStart(overrides: Partial<SessionStartInput> = {}): SessionStartInput {
    return {
        ...commonDefaults('SessionStart'),
        source: 'startup',
        model: 'claude-opus-4-7',
        ...overrides,
    };
}

export function mockSetup(overrides: Partial<SetupInput> = {}): SetupInput {
    return {
        ...commonDefaults('Setup'),
        trigger: 'init',
        ...overrides,
    };
}

export function mockStop(overrides: Partial<StopInput> = {}): StopInput {
    return {
        ...commonDefaults('Stop'),
        stop_hook_active: false,
        ...overrides,
    };
}

export function mockStopFailure(overrides: Partial<StopFailureInput> = {}): StopFailureInput {
    return {
        ...commonDefaults('StopFailure'),
        error: 'unknown',
        ...overrides,
    };
}

export function mockSubagentStart(overrides: Partial<SubagentStartInput> = {}): SubagentStartInput {
    return {
        ...commonDefaults('SubagentStart'),
        agent_id: 'test-agent-id',
        agent_type: 'general-purpose',
        ...overrides,
    };
}

export function mockSubagentStop(overrides: Partial<SubagentStopInput> = {}): SubagentStopInput {
    return {
        ...commonDefaults('SubagentStop'),
        stop_hook_active: false,
        agent_id: 'test-agent-id',
        agent_type: 'general-purpose',
        agent_transcript_path: '/tmp/test-agent-transcript.jsonl',
        ...overrides,
    };
}

export function mockTaskCompleted(overrides: Partial<TaskCompletedInput> = {}): TaskCompletedInput {
    return {
        ...commonDefaults('TaskCompleted'),
        task_id: 'test-task-id',
        task_subject: 'test task',
        ...overrides,
    };
}

export function mockTaskCreated(overrides: Partial<TaskCreatedInput> = {}): TaskCreatedInput {
    return {
        ...commonDefaults('TaskCreated'),
        task_id: 'test-task-id',
        task_subject: 'test task',
        ...overrides,
    };
}

export function mockTeammateIdle(overrides: Partial<TeammateIdleInput> = {}): TeammateIdleInput {
    return {
        ...commonDefaults('TeammateIdle'),
        teammate_name: 'test-teammate',
        team_name: 'test-team',
        ...overrides,
    };
}

export function mockUserPromptExpansion(overrides: Partial<UserPromptExpansionInput> = {}): UserPromptExpansionInput {
    return {
        ...commonDefaults('UserPromptExpansion'),
        expansion_type: 'slash_command',
        command_name: 'test',
        command_args: '',
        prompt: 'test expanded prompt',
        ...overrides,
    };
}

export function mockUserPromptSubmit(overrides: Partial<UserPromptSubmitInput> = {}): UserPromptSubmitInput {
    return {
        ...commonDefaults('UserPromptSubmit'),
        prompt: 'test prompt',
        ...overrides,
    };
}

export function mockWorktreeCreate(overrides: Partial<WorktreeCreateInput> = {}): WorktreeCreateInput {
    return {
        ...commonDefaults('WorktreeCreate'),
        name: 'test-worktree',
        ...overrides,
    };
}

export function mockWorktreeRemove(overrides: Partial<WorktreeRemoveInput> = {}): WorktreeRemoveInput {
    return {
        ...commonDefaults('WorktreeRemove'),
        worktree_path: '/tmp/test-worktree',
        ...overrides,
    };
}
