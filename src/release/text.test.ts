import { describe, expect, it } from 'vitest';
import { bumpVersion, cutChangelog, pinMarketplaceEntry, setJsonVersion, setLockVersion } from './text.js';

describe('bumpVersion', () => {
    it('bumps by kind, or takes an explicit version', () => {
        expect(bumpVersion('2.2.0', 'patch')).toBe('2.2.1');
        expect(bumpVersion('2.2.3', 'minor')).toBe('2.3.0');
        expect(bumpVersion('2.2.3', 'major')).toBe('3.0.0');
        expect(bumpVersion('2.2.3', '5.0.0')).toBe('5.0.0');
        expect(() => bumpVersion('2.2.3', 'huge')).toThrow(/not patch, minor, major/);
    });
});

describe('versions in JSON', () => {
    it('sets the first version and keeps formatting', () => {
        expect(setJsonVersion('{\n    "name": "x",\n    "version": "1.0.0"\n}\n', '1.1.0')).toBe('{\n    "name": "x",\n    "version": "1.1.0"\n}\n');
        expect(() => setJsonVersion('{}', '1.0.0')).toThrow(/no "version"/);
    });

    it("sets only the package's own two lockfile versions", () => {
        const lock = '{"version": "1.0.0", "packages": {"": {"version": "1.0.0"}, "node_modules/a": {"version": "9.9.9"}}}';
        expect(setLockVersion(lock, '1.1.0')).toBe('{"version": "1.1.0", "packages": {"": {"version": "1.1.0"}, "node_modules/a": {"version": "9.9.9"}}}');
    });
});

describe('cutChangelog', () => {
    const CHANGELOG = [
        '# Changelog',
        '',
        '## [Unreleased]',
        '',
        '### Added',
        '',
        '- A thing.',
        '',
        '## [1.0.0] - 2026-01-01',
        '',
        '- First.',
        '',
        '[Unreleased]: https://github.com/o/r/compare/v1.0.0...HEAD',
        '[1.0.0]: https://github.com/o/r/releases/tag/v1.0.0',
        '',
    ].join('\n');

    it('moves Unreleased under the new version and moves the links', () => {
        expect(cutChangelog(CHANGELOG, '1.1.0', '2026-10-06')).toBe([
            '# Changelog',
            '',
            '## [Unreleased]',
            '',
            '## [1.1.0] - 2026-10-06',
            '',
            '### Added',
            '',
            '- A thing.',
            '',
            '## [1.0.0] - 2026-01-01',
            '',
            '- First.',
            '',
            '[Unreleased]: https://github.com/o/r/compare/v1.1.0...HEAD',
            '[1.1.0]: https://github.com/o/r/releases/tag/v1.1.0',
            '[1.0.0]: https://github.com/o/r/releases/tag/v1.0.0',
            '',
        ].join('\n'));
    });

    it('refuses an empty release', () => {
        const empty = CHANGELOG.replace('### Added\n\n- A thing.\n\n', '');
        expect(() => cutChangelog(empty, '1.1.0', '2026-10-06')).toThrow(/empty: nothing to release/);
        expect(() => cutChangelog('# Changelog\n', '1.1.0', 'd')).toThrow(/no "## \[Unreleased\]"/);
    });
});

describe('pinMarketplaceEntry', () => {
    const MARKET = `{
  "name": "m",
  "plugins": [
    { "name": "other", "source": { "source": "git-subdir", "url": "u", "ref": "v0", "sha": "aaa" }, "version": "9.0.0" },
    {
      "name": "plugin-kit",
      "source": { "source": "git-subdir", "url": "u", "path": "plugin", "ref": "v1.2.0", "sha": "b3c3" },
      "description": "has a } brace and a \\"quote\\"",
      "version": "0.1.0",
      "tags": ["a", "b"]
    }
  ]
}
`;

    it("pins only that plugin's entry, keeping the file's formatting", () => {
        const out = pinMarketplaceEntry(MARKET, 'plugin-kit', { ref: 'v2.2.0', sha: '7702', version: '0.1.1' });
        expect(out).toBe(
            MARKET.replace('"ref": "v1.2.0", "sha": "b3c3"', '"ref": "v2.2.0", "sha": "7702"').replace('"version": "0.1.0"', '"version": "0.1.1"'),
        );
        expect(out).toContain('"ref": "v0", "sha": "aaa" }, "version": "9.0.0"');
    });

    it('names what it cannot find', () => {
        expect(() => pinMarketplaceEntry(MARKET, 'nope', { ref: 'x' })).toThrow(/no plugin named "nope"/);
        expect(() => pinMarketplaceEntry('{"plugins":[{"name":"p","source":"./p"}]}', 'p', { ref: 'x' })).toThrow(/has no "ref"/);
    });
});
