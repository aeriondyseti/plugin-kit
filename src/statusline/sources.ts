/**
 * Sources: named values a status line can show, each read from the input
 * Claude Code sends (or, for git, from the working directory). A source
 * returns undefined when there's nothing to show, and the item is skipped.
 */

import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import type { StatusLineInput } from './input.js';

export type SourceValue = string | number | readonly string[] | undefined;

export interface StatusSource {
    /** One line, for `plugin-kit statusline --list`. */
    describe: string;
    read(input: StatusLineInput): SourceValue;
}

const pct = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : undefined);
const name = (path: string | undefined) => (path ? basename(path) : undefined);

export const SOURCES: Record<string, StatusSource> = {
    model: { describe: 'Model name (Opus 5.5)', read: (i) => i.model?.display_name ?? i.model?.id },
    'context.percent': {
        describe: 'Context window used, 0-100',
        read: (i) => {
            const cw = i.context_window;
            if (typeof cw?.used_percentage === 'number') return pct(cw.used_percentage);
            if (cw?.total_input_tokens && cw.context_window_size) return pct((cw.total_input_tokens / cw.context_window_size) * 100);
            return undefined;
        },
    },
    'context.tokens': { describe: 'Input tokens in the context window', read: (i) => i.context_window?.total_input_tokens },
    'usage.five_hour': { describe: 'Five-hour usage window used, 0-100 (Pro/Max)', read: (i) => pct(i.rate_limits?.five_hour?.used_percentage) },
    'usage.seven_day': { describe: 'Weekly usage window used, 0-100 (Pro/Max)', read: (i) => pct(i.rate_limits?.seven_day?.used_percentage) },
    'spend.percent': { describe: 'Spend limit used, 0-100+', read: (i) => pct(i.rate_limits?.spend_limit?.used_percentage) },
    'cost.usd': {
        describe: 'Session cost in USD ($1.23)',
        read: (i) => (typeof i.cost?.total_cost_usd === 'number' ? `$${i.cost.total_cost_usd.toFixed(2)}` : undefined),
    },
    'session.duration': { describe: 'Session length (1h 05m)', read: (i) => duration(i.cost?.total_duration_ms) },
    'lines.added': { describe: 'Lines added this session', read: (i) => i.cost?.total_lines_added },
    'lines.removed': { describe: 'Lines removed this session', read: (i) => i.cost?.total_lines_removed },
    'lines.changed': {
        describe: 'Lines added and removed (+12 -3)',
        read: (i) => (i.cost?.total_lines_added === undefined && i.cost?.total_lines_removed === undefined
            ? undefined
            : `+${i.cost.total_lines_added ?? 0} -${i.cost.total_lines_removed ?? 0}`),
    },
    'cache.hit': { describe: 'Prompt cache hit ratio, 0-100', read: (i) => pct(typeof i.prompt_cache?.hit_ratio === 'number' ? i.prompt_cache.hit_ratio * 100 : undefined) },
    'cache.warm': { describe: '"warm" or "cold"', read: (i) => (i.prompt_cache?.warm === undefined ? undefined : i.prompt_cache.warm ? 'warm' : 'cold') },
    dir: { describe: 'Current folder name', read: (i) => name(i.workspace?.current_dir ?? i.cwd) },
    project: { describe: 'Project folder name', read: (i) => name(i.workspace?.project_dir) },
    'git.branch': { describe: 'Git branch (worktree branch, else git)', read: (i) => i.worktree?.branch ?? gitBranch(i.workspace?.current_dir ?? i.cwd) },
    worktree: { describe: 'Worktree name, in a worktree session', read: (i) => i.worktree?.name },
    pr: { describe: 'Pull request (#12)', read: (i) => (i.pr?.number === undefined ? undefined : `#${i.pr.number}`) },
    'pr.state': { describe: 'Pull request review state', read: (i) => i.pr?.review_state },
    effort: { describe: 'Effort level', read: (i) => i.effort?.level },
    'output.style': { describe: 'Output style name', read: (i) => i.output_style?.name },
    'vim.mode': { describe: 'Vim mode (INSERT)', read: (i) => i.vim?.mode },
    agent: { describe: 'Agent name, in an --agent session', read: (i) => i.agent?.name },
    session: { describe: 'Session name', read: (i) => i.session_name },
    version: { describe: 'Claude Code version', read: (i) => i.version },
};

function duration(ms: number | undefined): string | undefined {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) return undefined;
    const minutes = Math.floor(ms / 60_000);
    return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

// The status line runs often; a slow or missing git must not stall it.
function gitBranch(cwd: string | undefined): string | undefined {
    if (!cwd) return undefined;
    try {
        const out = execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8', timeout: 500, stdio: ['ignore', 'pipe', 'ignore'] });
        return out.trim() || undefined;
    } catch {
        return undefined;
    }
}
