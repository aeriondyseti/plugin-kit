/**
 * `plugin-kit run`: feeds fixtures to a real hook command, the way Claude
 * Code would, and reports what it decided. Seconds instead of a session.
 */

import { spawnSync } from 'node:child_process';
import type { Fixture } from '../fixtures.js';
import { summarizeOutput } from '../testing.js';

export interface RunResult {
    fixture: string;
    event: string;
    exitCode: number | null;
    ms: number;
    /** What the hook decided, in plain words. */
    verdict: string;
    toUser?: string;
    toClaude?: string;
    stderr?: string;
    /** Set when the run is a failure: a crash, a timeout, unreadable output. */
    problem?: string;
}

/** Runs `command` (through the shell, like a settings hook) once per fixture. */
export function runFixtures(command: string, fixtures: readonly Fixture[], timeoutMs = 60_000): RunResult[] {
    return fixtures.map((fixture) => runOne(command, fixture, timeoutMs));
}

function runOne(command: string, fixture: Fixture, timeoutMs: number): RunResult {
    const started = Date.now();
    const child = spawnSync(command, {
        shell: true,
        input: JSON.stringify(fixture.input),
        encoding: 'utf8',
        timeout: timeoutMs,
        env: { ...process.env, CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR ?? process.cwd() },
    });
    const base = {
        fixture: fixture.path,
        event: fixture.event,
        exitCode: child.status,
        ms: Date.now() - started,
        ...(child.stderr?.trim() ? { stderr: child.stderr.trim() } : {}),
    };

    if (child.error) return { ...base, verdict: 'did not run', problem: child.error.message };
    if (child.status === null) return { ...base, verdict: 'did not finish', problem: `killed (${child.signal ?? 'timeout'})` };
    // Exit 2 is the protocol's blocking error: stderr goes to Claude.
    if (child.status === 2) return { ...base, verdict: 'blocked (exit 2)' };
    if (child.status !== 0) return { ...base, verdict: 'failed (non-blocking)', problem: `exit ${child.status}` };

    const stdout = child.stdout.trim();
    if (stdout === '') return { ...base, verdict: 'allowed (no output)' };
    let payload: unknown;
    try {
        payload = JSON.parse(stdout);
    } catch {
        // WorktreeCreate answers with a bare path; anything else is a mistake.
        return fixture.event === 'WorktreeCreate'
            ? { ...base, verdict: `worktree at ${stdout}` }
            : { ...base, verdict: 'unreadable output', problem: `stdout is not JSON: ${stdout.slice(0, 80)}` };
    }
    const s = summarizeOutput(payload);
    const verdict = s.wasDenied ? 'denied' : s.wasAsked ? 'asked' : s.wasDeferred ? 'deferred' : 'allowed';
    return {
        ...base,
        verdict,
        ...(s.toUser ? { toUser: s.toUser } : {}),
        ...(s.toClaude ? { toClaude: s.toClaude } : {}),
    };
}

/** The results as aligned lines, one per fixture, with details indented. */
export function formatResults(results: readonly RunResult[]): string {
    const lines: string[] = [];
    for (const r of results) {
        const mark = r.problem ? '✗' : '✓';
        lines.push(`${mark} ${r.fixture}  ${r.event}  ${r.verdict}  ${r.ms}ms`);
        if (r.problem) lines.push(`    problem: ${r.problem}`);
        if (r.toClaude) lines.push(`    to Claude: ${oneLine(r.toClaude)}`);
        if (r.toUser) lines.push(`    to user: ${oneLine(r.toUser)}`);
        if (r.stderr) lines.push(`    stderr: ${oneLine(r.stderr)}`);
    }
    const failed = results.filter((r) => r.problem).length;
    lines.push(`${results.length} run, ${failed} failed`);
    return lines.join('\n');
}

function oneLine(text: string): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > 160 ? `${flat.slice(0, 157)}...` : flat;
}
