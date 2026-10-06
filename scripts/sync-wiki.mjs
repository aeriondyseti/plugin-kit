#!/usr/bin/env node
// Publishes docs/ to the GitHub wiki, which is a git repository of its own
// (<repo>.wiki.git). docs/ is the source; the wiki is a copy.
//
// Pages link to each other as `Page.md` so they work on GitHub; the wiki
// wants `Page`, so those links are rewritten. Wiki pages that no longer exist
// in docs/ are removed.
//
//   node scripts/sync-wiki.mjs           clone, copy, commit and push
//   node scripts/sync-wiki.mjs --dry-run show what would change; push nothing

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WIKI = 'https://github.com/aeriondyseti/plugin-kit.wiki.git';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(root, 'docs');
const dryRun = process.argv.includes('--dry-run');

/** `[x](Page.md)` and `[x](Page.md#a)` become `[x](Page)` and `[x](Page#a)`. */
export function toWikiLinks(markdown) {
    return markdown.replace(/\]\(([\w-]+)\.md(#[\w-]*)?\)/g, (_, page, hash = '') => `](${page}${hash})`);
}

function git(cwd, ...args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function main() {
    const work = mkdtempSync(join(tmpdir(), 'plugin-kit-wiki-'));
    try {
        try {
            git(work, 'clone', '--quiet', WIKI, '.');
        } catch {
            console.error(`Couldn't clone ${WIKI}.`);
            console.error('GitHub creates a wiki\'s repository when its first page is saved: open');
            console.error('https://github.com/aeriondyseti/plugin-kit/wiki, create any page, then run this again.');
            process.exit(1);
        }

        const pages = readdirSync(docs).filter((name) => name.endsWith('.md'));
        for (const name of readdirSync(work)) {
            if (name.endsWith('.md') && !pages.includes(name)) rmSync(join(work, name));
        }
        for (const name of pages) {
            writeFileSync(join(work, name), toWikiLinks(readFileSync(join(docs, name), 'utf8')));
        }

        git(work, 'add', '-A');
        const changed = git(work, 'status', '--porcelain').trim();
        if (!changed) {
            console.log('wiki is up to date');
            return;
        }
        console.log(changed);
        if (dryRun) {
            console.log('(dry run: nothing pushed)');
            return;
        }
        const source = git(root, 'rev-parse', '--short', 'HEAD').trim();
        git(work, 'commit', '--quiet', '-m', `Sync from docs/ at ${source}`);
        git(work, 'push', '--quiet', 'origin', 'HEAD');
        console.log(`wiki updated from ${source}`);
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
