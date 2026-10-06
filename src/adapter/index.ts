/**
 * `@aeriondyseti/plugin-kit/adapter` — run hook logic in a mod.
 *
 * A command hook and a mod's `classic.<Event>` hook answer the same events in
 * different shapes: a script prints JSON (`decision: "block"`,
 * `hookSpecificOutput...`), a mod returns an object (`{ block }`,
 * `{ additionalContext: [...] }`, PreToolUse's `{ allow | ask | deny }`).
 * These functions translate, so a policy written once as
 * `handle(input) => emit options` runs as either:
 *
 *   on('classic.UserPromptSubmit', ($, e, next) =>
 *       toClassic('UserPromptSubmit', handle(e)) ?? next(e))
 *
 * and an existing script can run unchanged from a mod through
 * `$.process.run`, with `toCommandInput` and `fromCommandOutput`.
 *
 * No imports, no Node: `plugin-kit vendor adapter` copies this file into a
 * mod, which can't import npm code.
 */

/** A mod's answer to a classic event, as Claude Code's `ClassicResult` names it. */
export interface ClassicAnswer {
    block?: string;
    preventContinuation?: true;
    stopReason?: string;
    additionalContext?: string[];
    sessionTitle?: string;
    suppressOriginalPrompt?: true;
    initialUserMessage?: string;
    watchPaths?: string[];
    reloadSkills?: true;
    permissionDecision?: 'allow' | 'deny' | 'ask';
    permissionDecisionReason?: string;
    decision?:
        | { behavior: 'allow'; updatedInput?: Record<string, unknown>; updatedPermissions?: unknown[] }
        | { behavior: 'deny'; message?: string; interrupt?: true };
    updatedToolOutput?: unknown;
    updatedMCPToolOutput?: unknown;
    retry?: true;
    displayContent?: string;
    worktreePath?: string;
}

/** A mod's answer to `classic.PreToolUse`: at most one of allow, ask, deny. */
export type PreToolUseAnswer = ({ allow: true } | { ask: string } | { deny: string } | Record<string, never>) & {
    updatedInput?: Record<string, unknown>;
    additionalContext?: string[];
};

/**
 * The emit options of any event, loosely: what a policy written against
 * `@aeriondyseti/plugin-kit`'s `<Event>EmitOptions` returns. Text options may
 * be strings or anything with a `toString()` (an `OutputBuilder` won't load
 * in a mod; pass strings there).
 */
export interface AnyEmitOptions {
    toUser?: unknown;
    toClaude?: unknown;
    continue?: boolean;
    stopReason?: string;
    suppressOutput?: boolean;
    deny?: boolean;
    reason?: string;
    decision?: string;
    updatedInput?: Record<string, unknown>;
    updatedPermissions?: unknown[];
    interrupt?: boolean;
    sessionTitle?: string;
    suppressOriginalPrompt?: boolean;
    initialUserMessage?: string;
    watchPaths?: string[];
    reloadSkills?: boolean;
    retry?: boolean;
    displayContent?: string;
    worktreePath?: string;
    updatedToolOutput?: unknown;
    updatedMCPToolOutput?: unknown;
}

/** The fields each event reads besides `block`, `preventContinuation`, `stopReason`. */
const EVENT_FIELDS: Record<string, readonly (keyof ClassicAnswer)[]> = {
    UserPromptSubmit: ['additionalContext', 'sessionTitle', 'suppressOriginalPrompt'],
    UserPromptExpansion: ['additionalContext', 'suppressOriginalPrompt'],
    SessionStart: ['additionalContext', 'initialUserMessage', 'sessionTitle', 'watchPaths', 'reloadSkills'],
    Setup: ['additionalContext'],
    PreModelSwitch: ['permissionDecision', 'permissionDecisionReason'],
    PostModelSwitch: ['additionalContext'],
    SubagentStart: ['additionalContext'],
    PostToolUse: ['additionalContext', 'updatedToolOutput', 'updatedMCPToolOutput'],
    PostToolUseFailure: ['additionalContext'],
    PostToolBatch: ['additionalContext'],
    Stop: ['additionalContext'],
    SubagentStop: ['additionalContext'],
    PermissionDenied: ['retry'],
    PermissionRequest: ['decision'],
    MessageDisplay: ['displayContent'],
    WorktreeCreate: ['worktreePath'],
};

// Options copied into hookSpecificOutput under the same name.
const PASS_THROUGH = [
    'sessionTitle', 'suppressOriginalPrompt', 'initialUserMessage', 'watchPaths', 'reloadSkills', 'retry',
    'displayContent', 'worktreePath', 'updatedToolOutput', 'updatedMCPToolOutput', 'updatedInput',
] as const;

/**
 * A policy's emit options as a mod's answer. `undefined` when the options say
 * nothing the event reads, so `toClassic(...) ?? next(e)` passes the event on.
 *
 * Dropped, since a mod's classic answer has no place for them: `toUser` (use
 * `$.ui.toast`), `suppressOutput`, and Elicitation's `action`/`content`.
 */
export function toClassic(event: 'PreToolUse', opts: AnyEmitOptions): PreToolUseAnswer | undefined;
export function toClassic(event: string, opts: AnyEmitOptions): ClassicAnswer | undefined;
export function toClassic(event: string, opts: AnyEmitOptions): ClassicAnswer | PreToolUseAnswer | undefined {
    const answer = fromCommandJson(event, toCommandJson(event, opts));
    return Object.keys(answer).length > 0 ? answer : undefined;
}

/**
 * The JSON a command hook would print for these options, built the way
 * `<Event>.emitOutput` builds it (checked against it in the tests).
 */
export function toCommandJson(event: string, opts: AnyEmitOptions): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const hs: Record<string, unknown> = { hookEventName: event };
    if (opts.toUser !== undefined) out.systemMessage = String(opts.toUser);
    if (opts.continue === false) out.continue = false;
    if (opts.stopReason !== undefined) out.stopReason = opts.stopReason;
    if (opts.suppressOutput) out.suppressOutput = true;
    if (opts.toClaude !== undefined) hs.additionalContext = String(opts.toClaude);
    for (const key of PASS_THROUGH) if (opts[key] !== undefined) hs[key] = opts[key];

    if (event === 'PreToolUse' || event === 'PreModelSwitch') {
        if (opts.decision !== undefined) hs.permissionDecision = opts.decision;
        if (opts.reason !== undefined) hs.permissionDecisionReason = opts.reason;
    } else if (event === 'PermissionRequest') {
        if (opts.decision === 'allow') {
            hs.decision = {
                behavior: 'allow',
                ...(opts.updatedInput !== undefined ? { updatedInput: opts.updatedInput } : {}),
                ...(opts.updatedPermissions !== undefined ? { updatedPermissions: opts.updatedPermissions } : {}),
            };
            delete hs.updatedInput;
        } else if (opts.decision === 'deny') {
            hs.decision = {
                behavior: 'deny',
                ...(opts.reason !== undefined ? { message: opts.reason } : {}),
                ...(opts.interrupt ? { interrupt: true } : {}),
            };
        }
    } else {
        if (opts.deny) out.decision = 'block';
        if (opts.reason !== undefined) out.reason = opts.reason;
    }
    if (Object.keys(hs).length > 1) out.hookSpecificOutput = hs;
    return out;
}

/** A command hook's printed JSON as a mod's answer. */
export function fromCommandJson(event: 'PreToolUse', json: unknown): PreToolUseAnswer;
export function fromCommandJson(event: string, json: unknown): ClassicAnswer;
export function fromCommandJson(event: string, json: unknown): ClassicAnswer | PreToolUseAnswer {
    const out = isRecord(json) ? json : {};
    const hs = isRecord(out.hookSpecificOutput) ? out.hookSpecificOutput : {};
    const context = typeof hs.additionalContext === 'string' ? [hs.additionalContext] : undefined;

    if (event === 'PreToolUse') {
        const reason = typeof hs.permissionDecisionReason === 'string' ? hs.permissionDecisionReason : '';
        const verdict =
            hs.permissionDecision === 'allow' ? { allow: true as const }
            : hs.permissionDecision === 'ask' ? { ask: reason }
            : hs.permissionDecision === 'deny' || out.decision === 'block'
                ? { deny: reason || (typeof out.reason === 'string' ? out.reason : '') || 'Denied by a hook' }
            : {};
        return {
            ...verdict,
            ...(isRecord(hs.updatedInput) ? { updatedInput: hs.updatedInput } : {}),
            ...(context ? { additionalContext: context } : {}),
        };
    }

    const all: ClassicAnswer = {};
    if (out.decision === 'block') all.block = typeof out.reason === 'string' && out.reason ? out.reason : 'Blocked by a hook';
    if (out.continue === false) all.preventContinuation = true;
    if (typeof out.stopReason === 'string') all.stopReason = out.stopReason;
    if (context) all.additionalContext = context;
    for (const key of ['sessionTitle', 'initialUserMessage', 'displayContent', 'worktreePath', 'permissionDecisionReason'] as const) {
        if (typeof hs[key] === 'string') all[key] = hs[key];
    }
    for (const key of ['suppressOriginalPrompt', 'reloadSkills', 'retry'] as const) if (hs[key] === true) all[key] = true;
    if (Array.isArray(hs.watchPaths)) all.watchPaths = hs.watchPaths.map(String);
    if (hs.permissionDecision === 'allow' || hs.permissionDecision === 'deny' || hs.permissionDecision === 'ask') {
        all.permissionDecision = hs.permissionDecision;
    }
    if (isRecord(hs.decision) && (hs.decision.behavior === 'allow' || hs.decision.behavior === 'deny')) {
        all.decision = hs.decision as NonNullable<ClassicAnswer['decision']>;
    }
    if ('updatedToolOutput' in hs) all.updatedToolOutput = hs.updatedToolOutput;
    if ('updatedMCPToolOutput' in hs) all.updatedMCPToolOutput = hs.updatedMCPToolOutput;

    // Keep only what this event reads; anything else would fail the mod's hook.
    const allowed = new Set<string>(['block', 'preventContinuation', 'stopReason', ...(EVENT_FIELDS[event] ?? [])]);
    return Object.fromEntries(Object.entries(all).filter(([key]) => allowed.has(key))) as ClassicAnswer;
}

/**
 * What a command hook process ended with, as a mod's answer: exit 2 blocks
 * with stderr (the protocol's blocking error), another non-zero exit changes
 * nothing (a non-blocking error), and exit 0 reads stdout's JSON.
 */
export function fromCommandOutput(event: 'PreToolUse', run: CommandRun): PreToolUseAnswer;
export function fromCommandOutput(event: string, run: CommandRun): ClassicAnswer;
export function fromCommandOutput(event: string, run: CommandRun): ClassicAnswer | PreToolUseAnswer {
    if (run.exitCode === 2) {
        const reason = (run.stderr ?? '').trim() || 'Blocked by a hook';
        return event === 'PreToolUse' ? { deny: reason } : { block: reason };
    }
    if (run.exitCode !== 0) return {};
    const stdout = (run.stdout ?? '').trim();
    if (event === 'WorktreeCreate' && stdout && !stdout.startsWith('{')) return { worktreePath: stdout };
    let json: unknown = {};
    try {
        json = stdout ? JSON.parse(stdout) : {};
    } catch {
        return {};
    }
    return fromCommandJson(event, json);
}

export interface CommandRun {
    exitCode: number | null;
    stdout?: string;
    stderr?: string;
}

/** The fields every command hook gets that a mod's tool call doesn't carry. */
export interface CommandBase {
    session_id?: string;
    transcript_path?: string;
    cwd?: string;
    permission_mode?: string;
}
/** What a PreToolUse command hook reads; assignable to `PreToolUseInput`. */
export interface ToolCallHookInput {
    hook_event_name: 'PreToolUse';
    session_id: string;
    transcript_path: string;
    cwd: string;
    permission_mode?: string;
    tool_name: string;
    tool_input: Record<string, unknown>;
    tool_use_id: string;
}

/**
 * A mod's tool call (`classic.PreToolUse` or `tool.call`'s `e`) as the input
 * a PreToolUse command hook reads: `{ tool, tool_use_id, ...args }` becomes
 * `{ tool_name, tool_input: args, tool_use_id }`. The call carries no
 * session fields; pass them in `base` if the policy reads them.
 */
export function fromToolCall(call: { readonly tool: string; readonly tool_use_id: string }, base: CommandBase = {}): ToolCallHookInput {
    const { tool, tool_use_id, agentId: _agent, ...args } = call as { tool: string; tool_use_id: string; agentId?: unknown };
    return {
        session_id: '',
        transcript_path: '',
        cwd: '',
        ...base,
        hook_event_name: 'PreToolUse',
        tool_name: tool,
        tool_input: args,
        tool_use_id,
    };
}

/**
 * The stdin a command hook gets for this event: a classic event's `e` is that
 * input already (with `hook_event_name` set), PreToolUse's is translated.
 */
export function toCommandInput(event: string, e: object, base: CommandBase = {}): string {
    const input = event === 'PreToolUse'
        ? fromToolCall(e as { tool: string; tool_use_id: string }, base)
        : { ...base, ...e, hook_event_name: event };
    return JSON.stringify(input);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
