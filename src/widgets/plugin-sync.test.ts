import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('plugin/hooks/kit', () => {
    it('matches src (run `npm run plugin:sync` after changing a widget file)', () => {
        expect(() => execFileSync(process.execPath, ['scripts/sync-plugin.mjs', '--check'], { stdio: 'pipe' })).not.toThrow();
    });
});
