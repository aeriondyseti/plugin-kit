/**
 * `add-kit`: sets a Claude Code plugin up to draw plugin-kit widgets.
 *
 * Two edits, both idempotent:
 * - `.claude-plugin/plugin.json` gains a dependency on plugin-kit (left
 *   alone if one is there in any spelling);
 * - `hydrate.ts` is written beside the plugin's hooks module, since a mod
 *   can't import it from us (rewritten when ours changed).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/** How a dependent plugin names the kit: ours is not in its marketplace. */
export const KIT_DEPENDENCY = { name: 'plugin-kit', marketplace: 'aeriondyseti-plugins' } as const;

export const HYDRATE_HEADER =
    '// Copied by `npx @aeriondyseti/plugin-kit add-kit`; run it again to update. Do not edit.\n\n';

export interface AddKitResult {
    /** False when plugin.json already depended on plugin-kit. */
    dependencyAdded: boolean;
    /** Where hydrate.ts went, relative to the plugin folder. */
    hydratePath: string;
    hydrate: 'created' | 'updated' | 'unchanged';
}

export function addKit(pluginDir: string, hydrateSource: string): AddKitResult {
    const manifestPath = join(pluginDir, '.claude-plugin', 'plugin.json');
    if (!existsSync(manifestPath)) {
        throw new Error(`${pluginDir} is not a plugin: no .claude-plugin/plugin.json`);
    }
    const manifestText = readFileSync(manifestPath, 'utf8');
    const manifest: unknown = JSON.parse(manifestText);
    if (!isRecord(manifest)) throw new Error(`${manifestPath} is not a JSON object`);

    const dependencies = Array.isArray(manifest.dependencies) ? manifest.dependencies : [];
    const dependencyAdded = !dependencies.some(isKitDependency);
    if (dependencyAdded) {
        manifest.dependencies = [...dependencies, KIT_DEPENDENCY];
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, indentOf(manifestText))}\n`);
    }

    const target = join(hooksFolder(pluginDir), 'hydrate.ts');
    const wanted = HYDRATE_HEADER + hydrateSource;
    const current = existsSync(target) ? readFileSync(target, 'utf8') : undefined;
    const hydrate = current === undefined ? 'created' : current === wanted ? 'unchanged' : 'updated';
    if (hydrate !== 'unchanged') {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, wanted);
    }

    return { dependencyAdded, hydratePath: relative(pluginDir, target).replaceAll('\\', '/'), hydrate };
}

export const VENDOR_HEADER =
    '// Copied by `npx @aeriondyseti/plugin-kit add-kit --vendor`; run it again to update. Do not edit.\n';

/** The barrel a vendored kit gets, so a mod imports from one file. */
export const VENDOR_INDEX = [
    "export * from './types.ts';",
    "export * from './parse.ts';",
    "export * from './catalog.ts';",
    "export * from './line.ts';",
    "export * from './describe.ts';",
    "export * from './hydrate.ts';",
    '',
].join('\n');

export interface VendorKitResult {
    /** The kit folder, relative to the plugin folder. */
    folder: string;
    written: number;
    unchanged: number;
}

/**
 * Copies the widget code itself into the plugin, beside its hooks module:
 * no dependency on the plugin-kit plugin, no shared settings or state. Each
 * source's own first-line header is replaced by one that names this command.
 */
export function vendorKit(pluginDir: string, sources: Record<string, string>): VendorKitResult {
    if (!existsSync(join(pluginDir, '.claude-plugin', 'plugin.json'))) {
        throw new Error(`${pluginDir} is not a plugin: no .claude-plugin/plugin.json`);
    }
    const folder = join(hooksFolder(pluginDir), 'kit');
    mkdirSync(folder, { recursive: true });
    let written = 0;
    let unchanged = 0;
    for (const [name, source] of Object.entries({ ...sources, 'index.ts': VENDOR_INDEX })) {
        const wanted = `${VENDOR_HEADER}\n${source.replace(/^\/\/[^\n]*\n\n?/, '')}`;
        const target = join(folder, name);
        if (existsSync(target) && readFileSync(target, 'utf8') === wanted) {
            unchanged++;
            continue;
        }
        writeFileSync(target, wanted);
        written++;
    }
    return { folder: relative(pluginDir, folder).replaceAll('\\', '/'), written, unchanged };
}

function isKitDependency(entry: unknown): boolean {
    if (typeof entry === 'string') return entry === 'plugin-kit' || entry.startsWith('plugin-kit@');
    return isRecord(entry) && entry.name === 'plugin-kit';
}

// The folder of the hooks module named in hooks/hooks.json, else hooks/.
function hooksFolder(pluginDir: string): string {
    const hooksDir = join(pluginDir, 'hooks');
    const hooksJson = join(hooksDir, 'hooks.json');
    if (!existsSync(hooksJson)) return hooksDir;
    const parsed: unknown = JSON.parse(readFileSync(hooksJson, 'utf8'));
    const first = isRecord(parsed) && Array.isArray(parsed.modules) ? parsed.modules[0] : undefined;
    return typeof first === 'string' ? dirname(join(hooksDir, first)) : hooksDir;
}

// Keep the file's own indentation when rewriting it.
function indentOf(text: string): string {
    return /^([ \t]+)"/m.exec(text)?.[1] ?? '  ';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
