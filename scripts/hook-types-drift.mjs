#!/usr/bin/env node
// Compares our hook input types (src/events) with Claude Code's own, from
// the declarations it writes for mods, so a Claude Code release that adds or
// changes hook fields shows up as a list instead of a hand diff.
//
//   npm run hooktypes:check                        newest declarations on this machine
//   npm run hooktypes:check -- path/to/claude-code.d.ts
//   npm run hooktypes:check -- --verbose           also list field type differences
//
// Exit 1 when Claude Code has an event or a field we don't.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const engine = resolve(args.find((a) => !a.startsWith('--')) ?? findDeclarations() ?? '');
if (!existsSync(engine)) {
    console.error('No claude-code.d.ts found. Pass its path, e.g. a mod\'s .claude-plugin/types/claude-code/index.d.ts');
    process.exit(2);
}

const events = JSON.parse(
    /HOOK_EVENT_NAMES = (\[[\s\S]*?\]) as const/.exec(readFileSync(join(root, 'src/common.ts'), 'utf8'))[1].replace(/'/g, '"').replace(/,\s*\]/, ']'),
);
const probe = join(root, '__hook_types_drift__.ts');
const probeText = [
    "import type { ClassicHookInputs } from 'claude-code';",
    `import type * as Ours from ${JSON.stringify(join(root, 'src/index.ts').replaceAll('\\', '/'))};`,
    'export type EngineEvents = keyof ClassicHookInputs;',
    ...events.flatMap((e) => [`export type Engine_${e} = ClassicHookInputs['${e}'];`, `export type Ours_${e} = Ours.${e}Input;`]),
].join('\n');

const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    types: ['node'],
    typeRoots: [join(root, 'node_modules/@types')],
};
const host = ts.createCompilerHost(options);
const readFile = host.readFile.bind(host);
const getSourceFile = host.getSourceFile.bind(host);
host.readFile = (f) => (resolve(f) === probe ? probeText : readFile(f));
host.fileExists = ((exists) => (f) => resolve(f) === probe || exists(f))(host.fileExists.bind(host));
host.getSourceFile = (f, lang, ...rest) =>
    resolve(f) === probe ? ts.createSourceFile(f, probeText, lang, true) : getSourceFile(f, lang, ...rest);

const program = ts.createProgram([engine, probe], options, host);
const checker = program.getTypeChecker();
const source = program.getSourceFile(probe);
const exported = new Map(checker.getExportsOfModule(checker.getSymbolAtLocation(source)).map((s) => [s.name, s]));

/** name → { optional, type } across every member of a union. */
function fields(name) {
    const symbol = exported.get(name);
    if (!symbol) return undefined;
    const type = checker.getDeclaredTypeOfSymbol(symbol);
    if (type.flags & ts.TypeFlags.Never || type.flags & ts.TypeFlags.Any) return undefined;
    const members = type.isUnion() ? type.types : [type];
    const out = new Map();
    for (const member of members) {
        const props = checker.getPropertiesOfType(member);
        for (const p of props) {
            const prev = out.get(p.name);
            const optional = Boolean(p.flags & ts.SymbolFlags.Optional) || members.length > 1 && !members.every((m) => m.getProperty(p.name));
            const text = checker.typeToString(checker.getTypeOfSymbol(p));
            out.set(p.name, { optional: prev ? prev.optional || optional : optional, type: prev && prev.type !== text ? `${prev.type} | ${text}` : text });
        }
    }
    return out;
}

const engineEvents = (() => {
    const t = checker.getDeclaredTypeOfSymbol(exported.get('EngineEvents'));
    return (t.isUnion() ? t.types : [t]).map((x) => x.value).filter(Boolean).sort();
})();

let drift = 0;
const lines = [];
for (const e of engineEvents.filter((e) => !events.includes(e))) {
    drift++;
    lines.push(`✗ ${e}: a Claude Code event we have no class for`);
}
for (const e of events) {
    const theirs = fields(`Engine_${e}`);
    const ours = fields(`Ours_${e}`);
    if (!theirs) {
        lines.push(`ℹ ${e}: not in this Claude Code's declarations (removed, or newer than them)`);
        continue;
    }
    const out = [];
    for (const [name, f] of theirs) {
        if (!ours.has(name)) {
            drift++;
            out.push(`  ✗ missing ${name}${f.optional ? '?' : ''}: ${f.type}`);
        }
    }
    for (const [name, f] of ours) {
        const t = theirs.get(name);
        if (!t) out.push(`  ℹ extra ${name}: not in Claude Code's type`);
        else if (t.optional !== f.optional) out.push(`  ℹ ${name} is ${f.optional ? 'optional' : 'required'} here, ${t.optional ? 'optional' : 'required'} in Claude Code`);
        else if (verbose && t.type !== f.type) out.push(`  · ${name}: ours ${f.type}; Claude Code ${t.type}`);
    }
    if (out.length) lines.push(`${e}`, ...out);
}

const version = /Claude Code [\d.]+\d/.exec(readFileSync(engine, 'utf8').split('\n', 1)[0])?.[0] ?? 'unknown version';
console.log(`Comparing src/events with ${version} (${engine})\n`);
console.log(lines.length ? lines.join('\n') : 'No differences.');
console.log(`\n${drift} field(s) or event(s) missing from ours.`);
process.exit(drift ? 1 : 0);

function findDeclarations() {
    const base = join(tmpdir(), 'claude', 'bundled-skills');
    if (!existsSync(base)) return undefined;
    const found = [];
    for (const version of readdirSync(base)) {
        for (const hash of readdirSync(join(base, version))) {
            const path = join(base, version, hash, 'plugin-authoring', 'types', 'claude-code.d.ts');
            if (existsSync(path)) found.push({ path, at: statSync(path).mtimeMs });
        }
    }
    return found.sort((a, b) => b.at - a.at)[0]?.path;
}
