import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: a plain .mjs script, no types
import { releaseNotes } from '../scripts/release-notes.mjs';

const CHANGELOG = `# Changelog

## [Unreleased]

## [2.0.0] - 2026-10-06

The rename.

### Changed

- New name.

## [1.0.0] - 2026-04-22

- First.

[Unreleased]: https://example.dev/compare
[2.0.0]: https://example.dev/2.0.0
`;

describe('releaseNotes', () => {
    it("returns a version's section, without its heading", () => {
        expect(releaseNotes(CHANGELOG, '2.0.0')).toBe('The rename.\n\n### Changed\n\n- New name.');
    });

    it('stops at the link list after the last version', () => {
        expect(releaseNotes(CHANGELOG, '1.0.0')).toBe('- First.');
    });

    it('is undefined for a version with no section', () => {
        expect(releaseNotes(CHANGELOG, '9.9.9')).toBeUndefined();
    });

    it('finds the current package version in the real CHANGELOG', () => {
        const root = join(__dirname, '..');
        const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
        expect(releaseNotes(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), version)).toBeTruthy();
    });
});
