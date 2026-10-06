/**
 * `plugin-kit types`: Claude Code writes a mod's type declarations into
 * `.claude-plugin/types/` only when it loads the mod, so CI (no Claude Code)
 * can't type-check one. This copies them to `.claude-ci/types/`, at the same
 * depth so the paths in their tsconfig still resolve, and writes a
 * `tsconfig.ci.json` that extends them. Commit both; re-run after Claude
 * Code updates.
 */

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const CI_TYPES = '.claude-ci/types';
export const CI_TSCONFIG = 'tsconfig.ci.json';

export interface TypesResult {
    /** "Claude Code 2.1.290", from the declarations' first line. */
    version: string;
    tsconfigWritten: boolean;
}

export function copyEngineTypes(pluginDir: string): TypesResult {
    const laid = join(pluginDir, '.claude-plugin', 'types');
    const api = join(laid, 'claude-code', 'index.d.ts');
    if (!existsSync(api)) {
        throw new Error(`no ${'.claude-plugin/types/claude-code/index.d.ts'}: Claude Code writes it when it loads the plugin; run \`claude --plugin-dir ${pluginDir}\` once`);
    }
    const out = join(pluginDir, CI_TYPES);
    rmSync(out, { recursive: true, force: true });
    cpSync(laid, out, { recursive: true });

    const tsconfig = join(pluginDir, CI_TSCONFIG);
    const tsconfigWritten = !existsSync(tsconfig);
    if (tsconfigWritten) {
        writeFileSync(tsconfig, `${JSON.stringify({ extends: `./${CI_TYPES}/tsconfig.json`, compilerOptions: { allowImportingTsExtensions: true } }, null, 2)}\n`);
    }
    const first = readFileSync(api, 'utf8').split('\n', 1)[0] ?? '';
    return { version: /Claude Code \d+(\.\d+)*/.exec(first)?.[0] ?? 'Claude Code (unknown version)', tsconfigWritten };
}
