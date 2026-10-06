/**
 * `plugin-kit doctor [dir]`: runs the checks over a plugin (or a project's
 * `.claude/settings.json` hooks), adds how each command hook would launch,
 * and folds in `claude plugin validate` when Claude Code is installed.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { delimiter, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { hydratePath, HYDRATE_HEADER, VENDOR_TARGETS, vendoredTexts, vendorFolder, type VendorTarget } from '../cli/addKit.js';
import {
    checkManifest,
    checkModSource,
    checkTsconfig,
    checkVendored,
    commandsIn,
    expandVars,
    parseHooksJson,
    splitCommand,
    type Finding,
} from './checks.js';

export interface DoctorOptions {
    /** This plugin-kit's own copies, to compare vendored ones against. */
    vendorSources?: (target: VendorTarget) => Record<string, string>;
    hydrateSource?: string;
    /** Run `claude plugin validate` too (default: when `claude` is on PATH). */
    validate?: boolean;
    /** For tests: the PATH to resolve commands on, and the Node version. */
    path?: string;
    nodeVersion?: string;
}

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
const VENDORED_MARK = '// Copied by `npx @aeriondyseti/plugin-kit ';

export function diagnose(dir: string, opts: DoctorOptions = {}): Finding[] {
    const root = resolve(dir);
    const read = (path: string) => (existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : undefined);
    const isPlugin = existsSync(join(root, '.claude-plugin', 'plugin.json'));
    const findings: Finding[] = [];
    const commands: Array<{ command: string; file: string }> = [];

    if (isPlugin) {
        findings.push(...checkManifest(read('.claude-plugin/plugin.json')));
        const hooksJson = read('hooks/hooks.json');
        if (hooksJson !== undefined) {
            const parsed = parseHooksJson(hooksJson);
            findings.push(...parsed.findings);
            commands.push(...parsed.commands.map((command) => ({ command, file: 'hooks/hooks.json' })));
            for (const module of parsed.modules) {
                const path = join(root, 'hooks', module);
                if (!existsSync(path)) {
                    findings.push({ level: 'error', check: 'hooks/module-missing', file: 'hooks/hooks.json', message: `module ${module} does not exist` });
                    continue;
                }
                // Tests aren't loaded as hooks; their $ is the test kit's.
                const sources = walk(dirname(path)).filter((f) => SOURCE.test(f) && !/\.(test|spec)\./.test(f)).sort();
                let importsTs = false;
                for (const file of sources) {
                    const text = readFileSync(file, 'utf8');
                    importsTs ||= /from\s+['"]\.{1,2}\/[^'"]+\.tsx?['"]/.test(text);
                    findings.push(...checkModSource(rel(root, file), text));
                }
                // The tsconfig tsc would use: the nearest one above the module.
                const tsconfig = nearest(dirname(path), root, 'tsconfig.json');
                findings.push(...checkTsconfig(tsconfig && readFileSync(tsconfig, 'utf8'), importsTs).map((f) => ({ ...f, file: tsconfig ? rel(root, tsconfig) : 'tsconfig.json' })));
            }
        }
        findings.push(...checkVendoredCopies(root, opts));
    } else if (!existsSync(join(root, '.claude'))) {
        findings.push({ level: 'error', check: 'doctor/nothing', message: 'no .claude-plugin/plugin.json and no .claude/ folder: nothing to check here' });
    }

    for (const settings of ['.claude/settings.json', '.claude/settings.local.json']) {
        const text = read(settings);
        if (text === undefined) continue;
        try {
            const json = JSON.parse(text) as { hooks?: unknown };
            commands.push(...commandsIn(json.hooks).map((command) => ({ command, file: settings })));
        } catch {
            findings.push({ level: 'error', check: 'settings/json', file: settings, message: 'not valid JSON' });
        }
    }
    for (const { command, file } of commands) findings.push(...checkCommand(command, file, root, isPlugin, opts));

    if (isPlugin && (opts.validate ?? Boolean(which('claude', opts.path)))) findings.push(...runValidate(root));
    return findings;
}

/** How one command hook would launch, and what would stop it. */
export function checkCommand(command: string, file: string, root: string, isPlugin: boolean, opts: DoctorOptions = {}): Finding[] {
    const vars: Record<string, string> = { CLAUDE_PROJECT_DIR: root };
    if (isPlugin) vars.CLAUDE_PLUGIN_ROOT = root;
    const words = splitCommand(expandVars(command, vars));
    const [program, ...args] = words;
    if (!program) return [{ level: 'error', check: 'command/empty', file, message: 'an empty command' }];
    const findings: Finding[] = [];
    const resolved = program.includes('/') || program.includes('\\') ? (existsSync(resolve(root, program)) ? resolve(root, program) : undefined) : which(program, opts.path);
    if (!resolved) {
        findings.push({ level: 'error', check: 'command/not-found', file, message: `\`${program}\` isn't on PATH here, so \`${command}\` can't start`, fix: 'install it, or use its full path' });
    } else {
        findings.push({ level: 'info', check: 'command/launch', file, message: `\`${command}\` runs ${resolved}${args.length ? ` with ${JSON.stringify(args)}` : ''}` });
    }
    for (const arg of args) {
        const looksLikeScript = /\.(m?[jt]s|cjs|py|sh|ps1|rb)$/.test(arg) && !arg.startsWith('-');
        if (!looksLikeScript || arg.includes('$')) continue;
        const path = isAbsolute(arg) ? arg : resolve(root, arg);
        if (!existsSync(path)) findings.push({ level: 'error', check: 'command/script-missing', file, message: `${arg} doesn't exist (looked at ${path})` });
        if (/^node(\.exe)?$/i.test(program) && /\.[mc]?ts$/.test(arg) && !nodeRunsTs(opts.nodeVersion ?? process.versions.node)) {
            findings.push({ level: 'warn', check: 'command/node-ts', file, message: `node ${opts.nodeVersion ?? process.versions.node} can't run ${arg}: running .ts needs Node 22.18+`, fix: 'upgrade Node, or run it with tsx' });
        }
    }
    if (/\$\{?CLAUDE_[A-Z_]+\}?[^"'\s]*\s/.test(command) && !/["']\$\{?CLAUDE_/.test(command)) {
        findings.push({ level: 'info', check: 'command/quoting', file, message: `quote \`$CLAUDE_...\` in \`${command}\`: a path with spaces splits into words`, fix: 'node "$CLAUDE_PROJECT_DIR"/.claude/hooks/x.ts' });
    }
    return findings;
}

function checkVendoredCopies(root: string, opts: DoctorOptions): Finding[] {
    const findings: Finding[] = [];
    if (opts.vendorSources) {
        for (const target of VENDOR_TARGETS) {
            const folder = vendorFolder(root, target);
            if (!existsSync(folder)) continue;
            for (const [name, expected] of Object.entries(vendoredTexts(target, opts.vendorSources(target)))) {
                const path = join(folder, name);
                if (!existsSync(path)) continue;
                const actual = readFileSync(path, 'utf8');
                // Only copies `vendor` wrote: a folder of the same name may be the plugin's own.
                if (actual.startsWith(VENDORED_MARK)) findings.push(...checkVendored(rel(root, path), actual, expected, target));
            }
        }
    }
    const hydrate = hydratePath(root);
    if (opts.hydrateSource && existsSync(hydrate) && readFileSync(hydrate, 'utf8').startsWith(HYDRATE_HEADER)) {
        findings.push(...checkVendored(rel(root, hydrate), readFileSync(hydrate, 'utf8'), HYDRATE_HEADER + opts.hydrateSource, 'hydrate'));
    }
    return findings;
}

function runValidate(root: string): Finding[] {
    const run = spawnSync('claude', ['plugin', 'validate', root, '--json'], { encoding: 'utf8', shell: process.platform === 'win32', timeout: 60_000 });
    let report: { manifest?: Section; contents?: Section[] };
    try {
        report = JSON.parse(run.stdout) as typeof report;
    } catch {
        return [{ level: 'warn', check: 'validate/unavailable', message: 'couldn\'t read `claude plugin validate`\'s report; run it yourself' }];
    }
    return [report.manifest, ...(report.contents ?? [])].flatMap((section) => {
        if (!section) return [];
        const file = section.file ? rel(root, section.file) : undefined;
        const item = (level: 'error' | 'warn') => (e: string | { path?: string; message?: string }): Finding => ({
            level,
            check: 'validate',
            ...(file ? { file } : {}),
            message: typeof e === 'string' ? e : `${e.path ? `${e.path}: ` : ''}${e.message ?? ''}`,
        });
        return [...(section.errors ?? []).map(item('error')), ...(section.warnings ?? []).map(item('warn'))];
    });
}

type Section = { file?: string; errors?: Array<string | { path?: string; message?: string }>; warnings?: Array<string | { path?: string; message?: string }> };

/** A program's path on PATH (with Windows' PATHEXT), or undefined. */
export function which(program: string, path = process.env.PATH ?? ''): string | undefined {
    const exts = process.platform === 'win32' && !extname(program)
        ? ['', ...(process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').map((e) => e.toLowerCase())]
        : [''];
    for (const dir of path.split(delimiter).filter(Boolean)) {
        for (const ext of exts) {
            const candidate = join(dir, program + ext);
            try {
                if (statSync(candidate).isFile()) return candidate;
            } catch {}
        }
    }
    return undefined;
}

function nodeRunsTs(version: string): boolean {
    const [major = 0, minor = 0] = version.split('.').map(Number);
    return major > 22 || (major === 22 && minor >= 18);
}

/** Findings as lines: errors, then warnings, then notes. */
export function formatFindings(findings: readonly Finding[]): string {
    const order = { error: 0, warn: 1, info: 2 } as const;
    const mark = { error: '✗', warn: '⚠', info: 'ℹ' } as const;
    const sorted = [...findings].sort((a, b) => order[a.level] - order[b.level]);
    const lines = sorted.flatMap((f) => [
        `${mark[f.level]} ${f.file ? `${f.file}${f.line ? `:${f.line}` : ''}: ` : ''}${f.message}`,
        ...(f.fix ? [`    fix: ${f.fix}`] : []),
    ]);
    const count = (level: keyof typeof order) => findings.filter((f) => f.level === level).length;
    lines.push(`${count('error')} error(s), ${count('warn')} warning(s), ${count('info')} note(s)`);
    return lines.join('\n');
}

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        if (name === 'node_modules' || name.startsWith('.')) return [];
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

/** `name` in `dir` or a folder above it, no higher than `root`. */
function nearest(dir: string, root: string, name: string): string | undefined {
    for (let d = dir; ; d = dirname(d)) {
        if (existsSync(join(d, name))) return join(d, name);
        if (d === root || dirname(d) === d || !d.startsWith(root)) return undefined;
    }
}

function rel(root: string, path: string): string {
    return relative(root, path).replaceAll('\\', '/');
}
