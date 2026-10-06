import { describe, expect, it } from 'vitest';
import * as Events from '../index.js';
import { testHook } from '../testing.js';
import * as Mocks from '../testing.js';
import { fromCommandJson, fromCommandOutput, fromToolCall, toClassic, toCommandInput, toCommandJson, type AnyEmitOptions } from './index.js';

// Options to try on each event: everything it accepts, so the comparison
// below covers every field.
const CASES: Record<string, AnyEmitOptions[]> = {
    PreToolUse: [{ decision: 'deny', reason: 'no' }, { decision: 'allow', updatedInput: { command: 'ls' }, toClaude: 'c' }, { decision: 'ask', reason: 'sure?' }, { decision: 'defer' }, {}],
    PermissionRequest: [{ decision: 'allow', updatedInput: { a: 1 } }, { decision: 'deny', reason: 'no', interrupt: true }, {}],
    PermissionDenied: [{ retry: true }],
    PostToolUse: [{ deny: true, reason: 'r', toClaude: 'c', updatedToolOutput: 'x' }],
    PostToolUseFailure: [{ toClaude: 'c' }],
    PostToolBatch: [{ toClaude: 'c' }],
    UserPromptSubmit: [{ deny: true, reason: 'r', suppressOriginalPrompt: true }, { toClaude: 'c', sessionTitle: 't' }],
    UserPromptExpansion: [{ deny: true, reason: 'r', toClaude: 'c', suppressOriginalPrompt: true }],
    SessionStart: [{ toClaude: 'c', initialUserMessage: 'hi', sessionTitle: 't', watchPaths: ['a'], reloadSkills: true }],
    SessionEnd: [{}],
    Setup: [{ toClaude: 'c' }],
    Stop: [{ deny: true, reason: 'keep going', toClaude: 'c' }, { continue: false, stopReason: 'done' }],
    StopFailure: [{}],
    SubagentStart: [{ toClaude: 'c' }],
    SubagentStop: [{ deny: true, reason: 'r', toClaude: 'c' }],
    TeammateIdle: [{ deny: true, reason: 'r' }],
    TaskCreated: [{ deny: true, reason: 'r' }],
    TaskCompleted: [{ deny: true, reason: 'r' }],
    PreCompact: [{ deny: true, reason: 'r' }],
    PostCompact: [{}],
    PreModelSwitch: [{ decision: 'ask', reason: 'pricey' }],
    PostModelSwitch: [{ toClaude: 'c' }],
    Notification: [{ toClaude: 'c' }],
    MessageDisplay: [{ displayContent: 'x' }],
    ConfigChange: [{ deny: true, reason: 'r' }],
    InstructionsLoaded: [{}],
    CwdChanged: [{ watchPaths: ['a'] }],
    FileChanged: [{ watchPaths: ['a'] }],
    DirectoryAdded: [{}],
    WorktreeRemove: [{}],
};

// What the real event class prints for these options.
function realJson(event: string, opts: AnyEmitOptions): unknown {
    const klass = (Events as unknown as Record<string, { parse(): unknown; emitOutput(o: unknown): never }>)[event]!;
    const mock = (Mocks as unknown as Record<string, () => object>)[`mock${event}`]!;
    return testHook(mock(), () => {
        klass.parse();
        klass.emitOutput(opts);
    }).payload;
}

describe('toClassic', () => {
    for (const [event, cases] of Object.entries(CASES)) {
        it(`matches what ${event}.emitOutput prints`, () => {
            for (const opts of cases) {
                expect(toCommandJson(event, opts)).toEqual(realJson(event, opts));
                expect(toClassic(event, opts) ?? {}).toEqual(fromCommandJson(event, realJson(event, opts)));
            }
        });
    }

    it('answers PreToolUse with one of allow, ask, deny', () => {
        expect(toClassic('PreToolUse', { decision: 'deny', reason: 'no' })).toEqual({ deny: 'no' });
        expect(toClassic('PreToolUse', { decision: 'allow', updatedInput: { a: 1 } })).toEqual({ allow: true, updatedInput: { a: 1 } });
        expect(toClassic('PreToolUse', { decision: 'ask', reason: 'sure?' })).toEqual({ ask: 'sure?' });
        expect(toClassic('PreToolUse', { decision: 'deny' })).toEqual({ deny: 'Denied by a hook' });
    });

    it('maps the shared options', () => {
        expect(toClassic('UserPromptSubmit', { deny: true, reason: 'no', toClaude: 'ctx', sessionTitle: 't' })).toEqual({
            block: 'no',
            additionalContext: ['ctx'],
            sessionTitle: 't',
        });
        expect(toClassic('Stop', { continue: false, stopReason: 'done' })).toEqual({ preventContinuation: true, stopReason: 'done' });
    });

    it('is undefined when nothing the event reads was set, so ?? next(e) passes it on', () => {
        expect(toClassic('UserPromptSubmit', {})).toBeUndefined();
        expect(toClassic('PreToolUse', { decision: 'defer' })).toBeUndefined();
        expect(toClassic('Notification', { toUser: 'only for scripts' })).toBeUndefined();
    });

    it('drops fields the event does not read', () => {
        expect(toClassic('PreCompact', { deny: true, reason: 'r', toClaude: 'ignored' })).toEqual({ block: 'r' });
    });
});

describe('fromCommandOutput', () => {
    it('blocks on exit 2 with stderr', () => {
        expect(fromCommandOutput('Stop', { exitCode: 2, stderr: 'not yet\n' })).toEqual({ block: 'not yet' });
        expect(fromCommandOutput('PreToolUse', { exitCode: 2, stderr: 'no' })).toEqual({ deny: 'no' });
    });

    it('changes nothing on another failure, or on output that is not JSON', () => {
        expect(fromCommandOutput('Stop', { exitCode: 1, stdout: '{"decision":"block"}' })).toEqual({});
        expect(fromCommandOutput('Stop', { exitCode: 0, stdout: 'hello' })).toEqual({});
    });

    it('reads JSON on exit 0, and a bare path from WorktreeCreate', () => {
        expect(fromCommandOutput('UserPromptSubmit', { exitCode: 0, stdout: '{"decision":"block","reason":"r"}' })).toEqual({ block: 'r' });
        expect(fromCommandOutput('WorktreeCreate', { exitCode: 0, stdout: '/tmp/wt\n' })).toEqual({ worktreePath: '/tmp/wt' });
    });
});

describe('inputs', () => {
    it("turns a mod's tool call into a PreToolUse command input", () => {
        const call = { tool: 'Bash', tool_use_id: 'u1', agentId: 'a', command: 'ls' };
        expect(fromToolCall(call, { cwd: '/p' })).toEqual({
            session_id: '',
            transcript_path: '',
            cwd: '/p',
            hook_event_name: 'PreToolUse',
            tool_name: 'Bash',
            tool_input: { command: 'ls' },
            tool_use_id: 'u1',
        });
    });

    it("passes a classic event's input through, naming the event", () => {
        expect(JSON.parse(toCommandInput('Stop', { session_id: 's', stop_hook_active: false }))).toEqual({
            session_id: 's',
            stop_hook_active: false,
            hook_event_name: 'Stop',
        });
    });
});
