/**
 * The text edits a release makes, as pure functions: a version bump, the
 * CHANGELOG's `[Unreleased]` moved under the new version, and a
 * marketplace entry pinned to the release. Each edits only what it must, so
 * a file's own formatting survives.
 */

export type BumpKind = 'patch' | 'minor' | 'major';

/** `1.2.3` bumped by kind; an explicit `x.y.z` is taken as given. */
export function bumpVersion(current: string, to: BumpKind | string): string {
    if (/^\d+\.\d+\.\d+$/.test(to)) return to;
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(current);
    if (!match) throw new Error(`can't bump "${current}": not a x.y.z version`);
    const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number];
    if (to === 'major') return `${major + 1}.0.0`;
    if (to === 'minor') return `${major}.${minor + 1}.0`;
    if (to === 'patch') return `${major}.${minor}.${patch + 1}`;
    throw new Error(`"${to}" is not patch, minor, major or a x.y.z version`);
}

/** Sets the first `"version": "..."` in a JSON file's text (package.json, plugin.json). */
export function setJsonVersion(text: string, version: string): string {
    if (!/"version"\s*:\s*"[^"]*"/.test(text)) throw new Error('no "version" field');
    return text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
}

/** Sets the package's own version in package-lock.json (its first two). */
export function setLockVersion(text: string, version: string): string {
    let n = 0;
    return text.replace(/("version"\s*:\s*")[^"]*(")/g, (all, a: string, b: string) => (n++ < 2 ? `${a}${version}${b}` : all));
}

/**
 * Moves what's under `## [Unreleased]` into `## [version] - date`, leaving
 * Unreleased empty, and moves the compare links along if the file has them.
 * Throws when there's nothing to release.
 */
export function cutChangelog(text: string, version: string, date: string): string {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => /^## \[Unreleased\]/i.test(l));
    if (start === -1) throw new Error('CHANGELOG has no "## [Unreleased]" section');
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((l) => l.startsWith('## [') || /^\[[^\]]+\]: /.test(l));
    const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
    if (!body) throw new Error('CHANGELOG\'s [Unreleased] section is empty: nothing to release');
    const after = end === -1 ? [] : rest.slice(end);
    let out = [...lines.slice(0, start), '## [Unreleased]', '', `## [${version}] - ${date}`, '', body, '', ...after].join('\n');

    // [Unreleased]: <base>/compare/vOLD...HEAD  →  vNEW, plus a link for vNEW.
    out = out.replace(/^\[Unreleased\]: (\S+)\/compare\/(v?)[^.\s]+\.[^.\s]+\.[^.\s]+\.\.\.HEAD$/im, (_, base: string, v: string) =>
        `[Unreleased]: ${base}/compare/${v}${version}...HEAD\n[${version}]: ${base}/releases/tag/${v}${version}`,
    );
    return out;
}

/**
 * Pins a plugin's entry in a marketplace.json to a release: a git source's
 * `ref` and `sha`, and the entry's `version` when given. Edits the text in
 * place, so the file's formatting is kept.
 */
export function pinMarketplaceEntry(text: string, plugin: string, pin: { ref?: string; sha?: string; version?: string }): string {
    const name = text.search(new RegExp(`"name"\\s*:\\s*"${plugin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
    if (name === -1) throw new Error(`marketplace has no plugin named "${plugin}"`);
    const open = text.lastIndexOf('{', name);
    const close = matchingBrace(text, open);
    let entry = text.slice(open, close + 1);
    const set = (field: string, value: string | undefined) => {
        if (value === undefined) return;
        const re = new RegExp(`("${field}"\\s*:\\s*")[^"]*(")`);
        if (!re.test(entry)) throw new Error(`"${plugin}" has no "${field}" to pin`);
        entry = entry.replace(re, `$1${value}$2`);
    };
    set('ref', pin.ref);
    set('sha', pin.sha);
    set('version', pin.version);
    return text.slice(0, open) + entry + text.slice(close + 1);
}

function matchingBrace(text: string, open: number): number {
    let depth = 0;
    let inString = false;
    for (let i = open; i < text.length; i++) {
        const c = text[i];
        if (inString) {
            if (c === '\\') i++;
            else if (c === '"') inString = false;
        } else if (c === '"') inString = true;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) return i;
    }
    throw new Error('unbalanced braces in marketplace.json');
}
