import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain .mjs script, no types
import { toWikiLinks } from '../scripts/sync-wiki.mjs';

const docs = join(__dirname, '..', 'docs');
const pages = readdirSync(docs).filter((name) => name.endsWith('.md'));

// GitHub's heading slug: lowercase, punctuation dropped, spaces to dashes.
function anchors(markdown: string): Set<string> {
    const slugs = [...markdown.matchAll(/^#+ (.+)$/gm)].map(([, heading]) =>
        heading!.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s/g, '-'),
    );
    return new Set(slugs);
}

describe('docs/', () => {
    it('links only to pages and headings that exist', () => {
        const broken: string[] = [];
        for (const page of pages) {
            const text = readFileSync(join(docs, page), 'utf8');
            for (const [, target, hash] of text.matchAll(/\]\(([\w-]+\.md)(?:#([\w-]+))?\)/g)) {
                if (!pages.includes(target!)) {
                    broken.push(`${page} → ${target}`);
                } else if (hash && !anchors(readFileSync(join(docs, target!), 'utf8')).has(hash)) {
                    broken.push(`${page} → ${target}#${hash}`);
                }
            }
            // Repo files must be full URLs: a relative path breaks in the wiki.
            for (const [, target] of text.matchAll(/\]\((\.\.?\/[^)]*)\)/g)) broken.push(`${page} → ${target}`);
        }
        expect(broken).toEqual([]);
    });

    it('has a sidebar entry for every page', () => {
        const sidebar = readFileSync(join(docs, '_Sidebar.md'), 'utf8');
        const missing = pages.filter((p) => !p.startsWith('_') && !sidebar.includes(`(${p})`));
        expect(missing).toEqual([]);
    });
});

describe('toWikiLinks', () => {
    it('drops .md from page links, keeping anchors and leaving URLs alone', () => {
        expect(toWikiLinks('[a](Home.md) [b](Widgets.md#glyphs) [c](https://x.dev/a.md)')).toBe(
            '[a](Home) [b](Widgets#glyphs) [c](https://x.dev/a.md)',
        );
    });
});
