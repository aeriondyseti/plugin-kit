/**
 * `plugin-kit release`: the release steps as one command. It plans every
 * edit first (`--dry-run` stops there), then writes, commits `Release x.y.z`
 * and tags `vx.y.z` (annotated, so `git push --follow-tags` sends it). It
 * never pushes: publishing stays a step you take.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { bumpVersion, cutChangelog, pinMarketplaceEntry, setJsonVersion, setLockVersion, type BumpKind } from './text.js';

export interface ReleaseOptions {
    /** The repository root. */
    root: string;
    /** `patch`, `minor`, `major` or an explicit `x.y.z`. */
    bump: BumpKind | string;
    /**
     * A plugin folder (relative to root) whose `plugin.json` version is
     * bumped too, by the same kind (a patch when `bump` is explicit). A repo
     * with no package.json releases its plugin's version alone.
     */
    plugin?: string;
    /** A marketplace.json to pin the plugin's entry in, to the new tag and commit. */
    marketplace?: string;
    /** The plugin's name in that marketplace; default the plugin.json `name`. */
    marketplaceName?: string;
    /** Release date, `YYYY-MM-DD`; default today. */
    date?: string;
}

export interface FileEdit {
    path: string;
    before: string;
    after: string;
}

export interface ReleasePlan {
    version: string;
    pluginVersion?: string;
    tag: string;
    edits: FileEdit[];
    marketplace?: { path: string; plugin: string };
    branch: string;
}

export type Git = (...args: string[]) => string;

export function gitIn(root: string): Git {
    return (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** Every edit the release would make, computed and checked, nothing written. */
export function planRelease(opts: ReleaseOptions, git: Git = gitIn(opts.root)): ReleasePlan {
    const root = resolve(opts.root);
    if (git('status', '--porcelain') !== '') throw new Error('the working tree has changes; commit or stash them first');
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    if (branch === 'HEAD') throw new Error('not on a branch');

    const read = (path: string) => readFileSync(join(root, path), 'utf8');
    const edits: FileEdit[] = [];
    const edit = (path: string, after: (before: string) => string) => {
        const before = read(path);
        edits.push({ path, before, after: after(before) });
    };

    const pluginManifest = opts.plugin ? join(opts.plugin, '.claude-plugin', 'plugin.json').replaceAll('\\', '/') : undefined;
    if (pluginManifest && !existsSync(join(root, pluginManifest))) throw new Error(`no plugin at ${opts.plugin} (${pluginManifest} missing)`);
    const hasPackage = existsSync(join(root, 'package.json'));
    const source = hasPackage ? 'package.json' : pluginManifest;
    if (!source) throw new Error('no package.json; pass --plugin <dir> to release a plugin');

    const current = JSON.parse(read(source)).version as string;
    const version = bumpVersion(current, opts.bump);
    let pluginVersion: string | undefined;
    if (hasPackage) {
        edit('package.json', (t) => setJsonVersion(t, version));
        if (existsSync(join(root, 'package-lock.json'))) edit('package-lock.json', (t) => setLockVersion(t, version));
    }
    if (pluginManifest) {
        const pluginCurrent = JSON.parse(read(pluginManifest)).version as string | undefined;
        if (!pluginCurrent) throw new Error(`${pluginManifest} has no "version"`);
        const kind = ['patch', 'minor', 'major'].includes(opts.bump) ? opts.bump : 'patch';
        pluginVersion = hasPackage ? bumpVersion(pluginCurrent, kind) : version;
        edit(pluginManifest, (t) => setJsonVersion(t, pluginVersion!));
    }
    if (!existsSync(join(root, 'CHANGELOG.md'))) throw new Error('no CHANGELOG.md to release from');
    edit('CHANGELOG.md', (t) => cutChangelog(t, version, opts.date ?? new Date().toISOString().slice(0, 10)));

    const tag = `v${version}`;
    if (git('tag', '--list', tag) !== '') throw new Error(`tag ${tag} already exists`);

    let marketplace: ReleasePlan['marketplace'];
    if (opts.marketplace) {
        if (!pluginManifest) throw new Error('--marketplace needs --plugin');
        const path = resolve(root, opts.marketplace);
        const plugin = opts.marketplaceName ?? (JSON.parse(read(pluginManifest)).name as string);
        // Checked now, with a placeholder sha, so a bad entry fails before anything is written.
        pinFor(readFileSync(path, 'utf8'), plugin, tag, '0'.repeat(40), pluginVersion);
        marketplace = { path, plugin };
    }
    return { version, ...(pluginVersion ? { pluginVersion } : {}), tag, edits, ...(marketplace ? { marketplace } : {}), branch };
}

/** Writes the edits, commits, tags, and pins the marketplace. Returns what it did. */
export function applyRelease(plan: ReleasePlan, root: string, git: Git = gitIn(root)): string[] {
    const done: string[] = [];
    for (const e of plan.edits) writeFileSync(join(root, e.path), e.after);
    git('add', ...plan.edits.map((e) => e.path));
    git('commit', '-m', `Release ${plan.version}`);
    git('tag', '-a', plan.tag, '-m', `Release ${plan.version}`);
    done.push(`committed "Release ${plan.version}" and tagged ${plan.tag}`);
    if (plan.marketplace) {
        const sha = git('rev-parse', `${plan.tag}^{commit}`);
        const text = readFileSync(plan.marketplace.path, 'utf8');
        writeFileSync(plan.marketplace.path, pinFor(text, plan.marketplace.plugin, plan.tag, sha, plan.pluginVersion));
        done.push(`pinned ${plan.marketplace.plugin} to ${plan.tag} (${sha.slice(0, 7)}) in ${plan.marketplace.path}; commit and push it after the tag is pushed`);
    }
    return done;
}

/** The plan as lines a person can check. */
export function describePlan(plan: ReleasePlan, root: string): string {
    const lines = [`release ${plan.version}${plan.pluginVersion ? ` (plugin ${plan.pluginVersion})` : ''} on ${plan.branch}`];
    for (const e of plan.edits) {
        const changed = e.after.split('\n').filter((line, i) => line !== e.before.split('\n')[i]).length;
        lines.push(`  edit ${e.path} (${changed} line${changed === 1 ? '' : 's'})`);
    }
    lines.push(`  commit "Release ${plan.version}", tag ${plan.tag}`);
    if (plan.marketplace) lines.push(`  pin ${plan.marketplace.plugin} in ${relative(root, plan.marketplace.path) || plan.marketplace.path} to ${plan.tag}`);
    return lines.join('\n');
}

// A git source gets ref and sha; a local-path source has neither, so only
// its version moves.
function pinFor(text: string, plugin: string, ref: string, sha: string, version: string | undefined): string {
    const pin = { ref, sha, ...(version ? { version } : {}) };
    try {
        return pinMarketplaceEntry(text, plugin, pin);
    } catch (err) {
        if (!(err instanceof Error) || !/has no "ref"/.test(err.message) || !version) throw err;
        return pinMarketplaceEntry(text, plugin, { version });
    }
}
