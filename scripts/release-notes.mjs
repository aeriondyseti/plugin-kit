#!/usr/bin/env node
// Prints one version's CHANGELOG section, the body of its GitHub release.
//
//   node scripts/release-notes.mjs 2.1.0 > notes.md

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The text under `## [version]`, up to the next `## [` or the link list; undefined if absent. */
export function releaseNotes(changelog, version) {
    const lines = changelog.split('\n');
    const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
    if (start === -1) return undefined;
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((line) => line.startsWith('## [') || /^\[[^\]]+\]: /.test(line));
    return (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const version = process.argv[2]?.replace(/^v/, '');
    const changelog = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'CHANGELOG.md'), 'utf8');
    const notes = version && releaseNotes(changelog, version);
    if (!notes) {
        console.error(`CHANGELOG.md has no section for ${version ?? '(no version given)'}`);
        process.exit(1);
    }
    console.log(notes);
}
