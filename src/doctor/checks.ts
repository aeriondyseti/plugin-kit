/**
 * `plugin-kit doctor`'s checks, as pure functions over file text: what
 * `claude plugin validate` reports late, opaquely or not at all, learned the
 * hard way. Source checks are heuristics (no parser), so they're worded as
 * likely problems, and `claude plugin validate` stays the authority.
 */

export type Level = 'error' | 'warn' | 'info';

export interface Finding {
    level: Level;
    /** Short, stable name of the check, e.g. `mod/dynamic-import`. */
    check: string;
    /** Where: a file, relative to the plugin. */
    file?: string;
    line?: number;
    message: string;
    fix?: string;
}

/** The plugin's manifest. */
export function checkManifest(text: string | undefined): Finding[] {
    const file = '.claude-plugin/plugin.json';
    if (text === undefined) return [{ level: 'error', check: 'manifest/missing', file, message: 'no manifest: this folder is not a plugin', fix: 'plugin-kit new mod <name>, or add .claude-plugin/plugin.json' }];
    let manifest: Record<string, unknown>;
    try {
        manifest = JSON.parse(text) as Record<string, unknown>;
    } catch {
        return [{ level: 'error', check: 'manifest/json', file, message: 'plugin.json is not valid JSON' }];
    }
    const findings: Finding[] = [];
    if (typeof manifest.name !== 'string' || !manifest.name) findings.push({ level: 'error', check: 'manifest/name', file, message: 'plugin.json has no "name"' });
    if (typeof manifest.version !== 'string') {
        findings.push({ level: 'warn', check: 'manifest/version', file, message: 'no "version": installs can\'t tell an update from what they have', fix: 'add "version": "0.1.0"' });
    }
    findings.push(...checkDependencies(manifest.dependencies));
    return findings;
}

/** Dependencies on plugin-kit: the name that resolves, and the allowlist they need. */
export function checkDependencies(dependencies: unknown): Finding[] {
    if (!Array.isArray(dependencies)) return [];
    const file = '.claude-plugin/plugin.json';
    const findings: Finding[] = [];
    for (const dep of dependencies) {
        const name = typeof dep === 'string' ? dep.split('@')[0] : isRecord(dep) ? dep.name : undefined;
        if (name !== 'plugin-kit') continue;
        const marketplace = typeof dep === 'string' ? dep.split('@')[1] : isRecord(dep) ? dep.marketplace : undefined;
        if (!marketplace) {
            findings.push({
                level: 'warn',
                check: 'deps/bare-kit',
                file,
                message: 'a bare "plugin-kit" dependency is looked up in your own marketplace, which likely doesn\'t list it',
                fix: '{ "name": "plugin-kit", "marketplace": "aeriondyseti-plugins" } (plugin-kit add-kit writes it)',
            });
        } else {
            findings.push({
                level: 'info',
                check: 'deps/allowlist',
                file,
                message: `installing this plugin installs plugin-kit only if your marketplace sets "allowCrossMarketplaceDependenciesOn": ["${String(marketplace)}"]; otherwise users install it first`,
            });
        }
    }
    return findings;
}

/** A hooks.json: valid, and naming modules and commands. */
export function parseHooksJson(text: string): { modules: string[]; commands: string[]; findings: Finding[] } {
    const file = 'hooks/hooks.json';
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        return { modules: [], commands: [], findings: [{ level: 'error', check: 'hooks/json', file, message: 'hooks.json is not valid JSON' }] };
    }
    const modules = isRecord(json) && Array.isArray(json.modules) ? json.modules.filter((m): m is string => typeof m === 'string') : [];
    return { modules, commands: commandsIn(isRecord(json) ? json.hooks : undefined), findings: [] };
}

/** Every `"command"` of a settings-style `hooks` block: `{ Event: [{ hooks: [{ type, command }] }] }`. */
export function commandsIn(hooks: unknown): string[] {
    if (!isRecord(hooks)) return [];
    return Object.values(hooks).flatMap((groups) =>
        (Array.isArray(groups) ? groups : []).flatMap((group) =>
            (isRecord(group) && Array.isArray(group.hooks) ? group.hooks : [])
                .filter((h): h is Record<string, unknown> => isRecord(h) && h.type === 'command' && typeof h.command === 'string')
                .map((h) => h.command as string),
        ),
    );
}

/** One mod source file: the rules a hooks module lives under. */
export function checkModSource(file: string, text: string): Finding[] {
    const findings: Finding[] = [];
    const lineOf = (index: number) => text.slice(0, index).split('\n').length;
    const code = stripComments(text);

    for (const m of code.matchAll(/\bimport\s*\(/g)) {
        findings.push({
            level: 'error', check: 'mod/dynamic-import', file, line: lineOf(m.index),
            message: 'a module holding import() does not load',
            fix: 'use a static import declaration',
        });
    }

    for (const m of code.matchAll(/^\s*import\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/gm)) {
        const [, typeOnly, clause = '', spec = ''] = m;
        if (spec.startsWith('.') || spec === 'claude-code' || spec.startsWith('claude-code/')) continue;
        const allTypes = Boolean(typeOnly) || /^\{\s*(type\s+[\w$]+\s*(as\s+[\w$]+\s*)?,?\s*)+\}$/.test(clause.trim());
        if (allTypes) continue;
        findings.push({
            level: 'error', check: 'mod/npm-import', file, line: lineOf(m.index),
            message: `imports "${spec}": a mod can import only its own files (and \`claude-code\` types)`,
            fix: spec.startsWith('@aeriondyseti/plugin-kit')
                ? 'plugin-kit vendor kit|adapter, or use `import type` for types only'
                : 'copy the code into the plugin, or use `import type` for types only',
        });
    }

    // `$` itself may be passed to helpers; a noun of it may not be bound,
    // passed or read as a value (`const ui = $.ui`, `show($.kit)`).
    for (const m of code.matchAll(/(?<![\w$.])\$\.([A-Za-z_][\w$]*)(?![\w$])(?!\s*(?:\??\.|\())/g)) {
        findings.push({
            level: 'error', check: 'mod/noun-as-value', file, line: lineOf(m.index),
            message: `\`$.${m[1]}\` used as a value: the engine refuses a noun of \`$\` bound, passed or read`,
            fix: `call it where it's used: $.${m[1]}.<method>(...); pass \`$\` itself to helpers instead`,
        });
    }

    for (const button of buttonTags(code)) {
        if (!/\bonPress\b/.test(button.text) && !/\.\.\./.test(button.text)) {
            findings.push({
                level: 'error', check: 'mod/button-onpress', file, line: lineOf(button.index),
                message: 'a Button without onPress fails to draw',
                fix: 'give it onPress (even a no-op), or build kit trees with hydrate(), which does',
            });
        }
    }
    return findings;
}

/** The tsconfig, given whether mod sources import `.ts` files by name. */
export function checkTsconfig(text: string | undefined, importsTs: boolean): Finding[] {
    const file = 'tsconfig.json';
    if (!importsTs) return [];
    if (text === undefined) {
        return [{ level: 'info', check: 'ts/no-tsconfig', file, message: 'no tsconfig.json: the editor and `tsc -p` won\'t type the mod', fix: 'see plugin-kit new mod for one that extends the engine\'s' }];
    }
    if (/"allowImportingTsExtensions"\s*:\s*true/.test(text)) return [];
    return [{
        level: 'warn', check: 'ts/ts-extensions', file,
        message: 'sources import ./x.ts, but tsconfig lacks allowImportingTsExtensions (the engine\'s generated one leaves it out): tsc will fail',
        fix: '"compilerOptions": { "allowImportingTsExtensions": true }',
    }];
}

/** A vendored copy against the one this plugin-kit would write. */
export function checkVendored(file: string, actual: string, expected: string, target: string): Finding[] {
    if (actual === expected) return [];
    return [{
        level: 'warn', check: 'vendor/stale', file,
        message: `differs from this plugin-kit's copy (older, or edited)`,
        fix: target === 'hydrate' ? 'npx @aeriondyseti/plugin-kit add-kit' : `npx @aeriondyseti/plugin-kit vendor ${target}`,
    }];
}

/** `$CLAUDE_X` and `${CLAUDE_X}` → `$X`'s value, for finding the file a command runs. */
export function expandVars(command: string, vars: Record<string, string>): string {
    return command.replace(/\$\{?(CLAUDE_[A-Z_]+)\}?/g, (all, name: string) => vars[name] ?? all);
}

/** A command's words, the way a POSIX shell splits simple quoting (no expansion). */
export function splitCommand(command: string): string[] {
    const words: string[] = [];
    let word = '';
    let quote: '"' | "'" | undefined;
    let started = false;
    for (let i = 0; i < command.length; i++) {
        const c = command[i]!;
        if (quote) {
            if (c === quote) quote = undefined;
            // Inside double quotes a backslash escapes only " \ $ `: a
            // Windows path (C:\Users) keeps its backslashes.
            else if (c === '\\' && quote === '"' && '"\\$`'.includes(command[i + 1] ?? '')) word += command[++i];
            else word += c;
        } else if (c === '"' || c === "'") {
            quote = c;
            started = true;
        } else if (/\s/.test(c)) {
            if (started) words.push(word);
            word = '';
            started = false;
        } else {
            word += c;
            started = true;
        }
    }
    if (started) words.push(word);
    return words;
}

/** Where each `<Button ...>` opens and its attribute text, skipping `>` inside `{...}`. */
function buttonTags(code: string): Array<{ index: number; text: string }> {
    const tags: Array<{ index: number; text: string }> = [];
    for (const m of code.matchAll(/<Button\b|h\(\s*['"]Button['"]\s*,/g)) {
        if (m[0].startsWith('h(')) {
            const end = matchingParen(code, code.indexOf('(', m.index));
            tags.push({ index: m.index, text: code.slice(m.index, end) });
            continue;
        }
        let depth = 0;
        let i = m.index + m[0].length;
        for (; i < code.length; i++) {
            const c = code[i];
            if (c === '{') depth++;
            else if (c === '}') depth--;
            else if (c === '>' && depth === 0) break;
        }
        tags.push({ index: m.index, text: code.slice(m.index, i) });
    }
    return tags;
}

function matchingParen(code: string, open: number): number {
    let depth = 0;
    for (let i = open; i < code.length; i++) {
        if (code[i] === '(') depth++;
        else if (code[i] === ')' && --depth === 0) return i;
    }
    return code.length;
}

// Comments and their text would trip the source checks; strings are kept.
function stripComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, lead: string) => lead + ' '.repeat(m.length - lead.length));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
