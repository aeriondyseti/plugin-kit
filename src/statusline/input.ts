/**
 * What Claude Code sends a `statusLine` command on stdin, typed from
 * https://code.claude.com/docs/en/statusline. Nearly everything is optional:
 * fields appear with the features and plans that produce them (rate limits
 * on Pro/Max, `worktree` in a worktree session, `prompt_cache` after the
 * first response), and a status line must draw whatever arrives.
 */

import { readStdinSync } from '../common.js';

export interface StatusLineInput {
    cwd?: string;
    session_id?: string;
    session_name?: string;
    prompt_id?: string;
    transcript_path?: string;
    version?: string;
    model?: { id?: string; display_name?: string };
    workspace?: {
        current_dir?: string;
        project_dir?: string;
        added_dirs?: string[];
        git_worktree?: string;
        repo?: { host?: string; owner?: string; name?: string };
    };
    output_style?: { name?: string };
    cost?: {
        total_cost_usd?: number;
        total_duration_ms?: number;
        total_api_duration_ms?: number;
        total_lines_added?: number;
        total_lines_removed?: number;
    };
    context_window?: {
        total_input_tokens?: number;
        total_output_tokens?: number;
        context_window_size?: number;
        /** 0–100; null before the first response. */
        used_percentage?: number | null;
        remaining_percentage?: number | null;
        current_usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
        } | null;
    };
    exceeds_200k_tokens?: boolean;
    /** Each window may be absent. Percentages are 0–100; `resets_at` is Unix seconds. */
    rate_limits?: {
        five_hour?: { used_percentage?: number; resets_at?: number };
        seven_day?: { used_percentage?: number; resets_at?: number };
        spend_limit?: {
            used_percentage?: number;
            resets_at?: number;
            used_usd?: number;
            limit_usd?: number;
            period?: 'daily' | 'weekly' | 'monthly';
        };
    };
    prompt_cache?: {
        warm?: boolean;
        caching_observed?: boolean;
        ttl?: '5m' | '1h';
        /** Unix seconds; null with no cache. */
        expires_at?: number | null;
        requests?: number;
        misses?: number;
        /** 0–1. */
        hit_ratio?: number | null;
        [field: string]: unknown;
    };
    fast_mode?: boolean;
    effort?: { level?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' };
    thinking?: { enabled?: boolean };
    vim?: { mode?: string };
    agent?: { name?: string };
    pr?: { number?: number; url?: string; review_state?: 'approved' | 'pending' | 'changes_requested' | 'draft'; kind?: string };
    worktree?: { name?: string; path?: string; branch?: string; original_cwd?: string; original_branch?: string };
}

/**
 * Reads the status line's stdin. Never throws: a status line that crashes
 * shows nothing, so bad input reads as an empty object.
 */
export function parseStatusLine(text: string = readStdinSafely()): StatusLineInput {
    try {
        const value: unknown = JSON.parse(text);
        return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as StatusLineInput) : {};
    } catch {
        return {};
    }
}

function readStdinSafely(): string {
    try {
        return readStdinSync();
    } catch {
        return '';
    }
}
