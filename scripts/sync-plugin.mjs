#!/usr/bin/env node
// Copies the pure widget sources into the plugin-kit mod.
//
// A mod may import only files inside its own folder, and imports them by
// their `.ts` names, so the copies are flattened into plugin/hooks/kit/ with
// their relative imports rewritten. The copies are committed (a marketplace
// installs the plugin folder alone); `--check` fails when they are stale.
//
//   node scripts/sync-plugin.mjs           write the copies
//   node scripts/sync-plugin.mjs --check   exit 1 if any copy differs

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'plugin', 'hooks', 'kit');

const SOURCES = [
    'src/formatting/icons.ts',
    'src/formatting/vocab.ts',
    'src/widgets/types.ts',
    'src/widgets/parse.ts',
    'src/widgets/catalog.ts',
    'src/widgets/line.ts',
    'src/widgets/describe.ts',
];

function copyOf(source) {
    const text = readFileSync(join(root, source), 'utf8');
    const flat = text.replace(/from '\.\.?\/(?:[\w-]+\/)*([\w-]+)\.js'/g, "from './$1.ts'");
    return `// Generated from ${source} by scripts/sync-plugin.mjs. Do not edit.\n\n${flat}`;
}

const wanted = new Map(SOURCES.map((s) => [basename(s), copyOf(s)]));

if (process.argv.includes('--check')) {
    let present = [];
    try {
        present = readdirSync(out);
    } catch {}
    const stale = [...wanted].filter(([name, text]) => {
        try {
            return readFileSync(join(out, name), 'utf8') !== text;
        } catch {
            return true;
        }
    }).map(([name]) => name);
    const extra = present.filter((name) => !wanted.has(name));
    if (stale.length || extra.length) {
        console.error(`plugin/hooks/kit is out of date (${[...stale, ...extra].join(', ')}): run npm run plugin:sync`);
        process.exit(1);
    }
} else {
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    for (const [name, text] of wanted) writeFileSync(join(out, name), text);
    console.log(`synced ${wanted.size} files into plugin/hooks/kit`);
}
