#!/usr/bin/env node
/**
 * The `plugin-kit` command. Each subcommand is a function in COMMANDS; the
 * work itself lives in the modules beside this one, where it's tested.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixturesModule, loadFixture, loadFixtures, recordFixture, type Fixture } from '../fixtures.js';
import { addKit, VENDOR_TARGETS, vendorFiles, type VendorTarget } from './addKit.js';
import { composeStatusLine, DEFAULT_STATUS_LINE, parseStatusLineConfig } from '../statusline/compose.js';
import { parseStatusLine, type StatusLineInput } from '../statusline/input.js';
import { SOURCES } from '../statusline/sources.js';
import { applyRelease, describePlan, planRelease } from '../release/run.js';
import { hookFiles, hookSettings, isHookEvent, kebab, modFiles, type FileMap, type KitMode } from '../scaffold/templates.js';
import { HOOK_EVENT_NAMES } from '../common.js';
import { formatResults, runFixtures } from './run.js';

const USAGE = `usage: plugin-kit <command>

  add-kit [--vendor] [plugin-dir]        set a plugin up to draw kit widgets
  vendor <kit|adapter|testing> [plugin-dir]
                                         copy kit code into a plugin (mods can't import npm)
  record [--out <dir>]                   (a command hook) save each payload as a fixture
  run <command> <fixture|dir>... [--event <E>] [--json]
                                         replay fixtures through a hook command
  fixtures <dir> [--out <file.ts>]       fixtures as a TS module, for mod tests
  statusline [--config <file>]           a status line command (settings.json "statusLine")
  statusline --check [--config <file>]   preview a config and list its problems
  statusline --list                      the sources a config can use
  new hook <Event> [--dir <dir>] [--force]   a command hook with a test
  new mod <name> [--dir <dir>] [--kit|--vendor-kit] [--force]
                                         a mod with a pane, a test and test helpers
  release <patch|minor|major|x.y.z> [--plugin <dir>] [--marketplace <file>] [--dry-run]
                                         bump, cut the CHANGELOG, commit and tag (never pushes)`;

type Args = { positional: string[]; flags: Map<string, string | true> };

// Shipped in the package beside dist/, so copies are always this version's.
const shipped = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

const COMMANDS: Record<string, (args: Args) => number> = {
    'add-kit': ({ positional, flags }) => {
        if (flags.has('vendor')) return vendor('kit', positional[0]);
        const dir = resolve(positional[0] ?? '.');
        const result = addKit(dir, readFileSync(shipped('src/widgets/hydrate.ts'), 'utf8'));
        console.log(result.dependencyAdded
            ? '✓ plugin.json now depends on plugin-kit@aeriondyseti-plugins'
            : '· plugin.json already depends on plugin-kit');
        console.log(`${result.hydrate === 'unchanged' ? '·' : '✓'} ${result.hydratePath} ${result.hydrate}`);
        console.log(`
For installing your plugin to install the kit too, add to your marketplace.json:
  "allowCrossMarketplaceDependenciesOn": ["aeriondyseti-plugins"]

Then draw:
  const tree = await $.kit.render({ id: \`my-plugin:\${e.requestId}\`, widgets })
  return <Box>{hydrate(tree, h)}</Box>`);
        return 0;
    },

    vendor: ({ positional }) => {
        const [target, dir] = positional;
        if (!VENDOR_TARGETS.includes(target as VendorTarget)) throw new UsageError(`vendor needs one of ${VENDOR_TARGETS.join(', ')}`);
        return vendor(target as VendorTarget, dir);
    },

    // Runs as a command hook: it must never get in Claude Code's way, so it
    // prints nothing to stdout and exits 0 whatever happens.
    record: ({ flags }) => {
        const out = typeof flags.get('out') === 'string'
            ? resolve(flags.get('out') as string)
            : join(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), '.claude', 'fixtures');
        try {
            const path = recordFixture(readFileSync(0, 'utf8'), out);
            process.stderr.write(`plugin-kit: recorded ${path}\n`);
        } catch (err) {
            process.stderr.write(`plugin-kit record: ${err instanceof Error ? err.message : String(err)}\n`);
        }
        return 0;
    },

    run: ({ positional, flags }) => {
        const [command, ...targets] = positional;
        if (!command || targets.length === 0) throw new UsageError('run needs a command and at least one fixture or folder');
        const event = typeof flags.get('event') === 'string' ? (flags.get('event') as string) : undefined;
        const fixtures = targets.flatMap((target): Fixture[] =>
            statSync(target).isDirectory() ? loadFixtures(target, event ? { event } : {}) : [loadFixture(target)],
        );
        if (fixtures.length === 0) throw new Error(`no fixtures found${event ? ` for ${event}` : ''}`);
        const results = runFixtures(command, fixtures);
        console.log(flags.has('json') ? JSON.stringify(results, null, 2) : formatResults(results));
        return results.some((r) => r.problem) ? 1 : 0;
    },

    statusline: ({ flags }) => {
        if (flags.has('list')) {
            const width = Math.max(...Object.keys(SOURCES).map((n) => n.length));
            for (const [name, source] of Object.entries(SOURCES)) console.log(`${name.padEnd(width)}  ${source.describe}`);
            return 0;
        }
        const explicit = typeof flags.get('config') === 'string' ? (flags.get('config') as string) : undefined;
        if (flags.has('check')) return checkStatusLine(explicit);
        // The status line itself: draw something whatever goes wrong.
        try {
            const input = parseStatusLine();
            const { config } = loadStatusLineConfig(explicit, input.workspace?.project_dir ?? input.cwd);
            process.stdout.write(`${composeStatusLine(config.config, input)}\n`);
        } catch (err) {
            process.stdout.write(`plugin-kit statusline: ${err instanceof Error ? err.message : String(err)}\n`);
        }
        return 0;
    },

    new: ({ positional, flags }) => {
        const [kind, name] = positional;
        const force = flags.has('force');
        const dirFlag = typeof flags.get('dir') === 'string' ? (flags.get('dir') as string) : undefined;
        if (kind === 'hook') {
            if (!name || !isHookEvent(name)) throw new UsageError(`new hook needs an event: one of ${HOOK_EVENT_NAMES.join(', ')}`);
            const dir = dirFlag ?? join('.claude', 'hooks');
            const written = writeNew(resolve(dir), hookFiles(name), force);
            for (const file of written) console.log(`✓ ${join(dir, file)}`);
            const script = `${dir.replaceAll('\\', '/')}/${kebab(name)}.ts`;
            console.log(`\nAdd to settings.json (the command needs Node 22.18+ for .ts):\n${hookSettings(name, `node "$CLAUDE_PROJECT_DIR"/${script}`)}`);
            console.log(`\nThen: npm i -D @aeriondyseti/plugin-kit vitest, and record real payloads with \`plugin-kit record\`.`);
            return 0;
        }
        if (kind === 'mod') {
            if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new UsageError('new mod needs a name: lowercase letters, digits and dashes');
            const mode: KitMode = flags.has('kit') ? 'kit' : flags.has('vendor-kit') ? 'vendor' : 'none';
            const root = resolve(dirFlag ?? '.', name);
            for (const file of writeNew(root, modFiles(name, mode, gitUserName()), force)) console.log(`✓ ${name}/${file}`);
            vendorFiles(root, 'testing', vendorSources('testing'));
            console.log(`✓ ${name}/tests/kit-testing/`);
            if (mode === 'vendor') {
                vendorFiles(root, 'kit', vendorSources('kit'));
                console.log(`✓ ${name}/hooks/kit/`);
            }
            if (mode === 'kit') {
                addKit(root, readFileSync(shipped('src/widgets/hydrate.ts'), 'utf8'));
                console.log(`✓ ${name}/hooks/hydrate.ts, and a dependency on plugin-kit@aeriondyseti-plugins`);
            }
            console.log(`\nNext:\n  claude plugin validate ${name}\n  claude plugin test ${name}\n  claude --plugin-dir ${name}    # then /${name}`);
            return 0;
        }
        throw new UsageError('new needs "hook <Event>" or "mod <name>"');
    },

    release: ({ positional, flags }) => {
        const bump = positional[0];
        if (!bump) throw new UsageError('release needs patch, minor, major or a x.y.z version');
        const str = (name: string) => (typeof flags.get(name) === 'string' ? (flags.get(name) as string) : undefined);
        const root = process.cwd();
        const plugin = str('plugin');
        const marketplace = str('marketplace');
        const marketplaceName = str('marketplace-name');
        const date = str('date');
        const plan = planRelease({
            root,
            bump,
            ...(plugin ? { plugin } : {}),
            ...(marketplace ? { marketplace } : {}),
            ...(marketplaceName ? { marketplaceName } : {}),
            ...(date ? { date } : {}),
        });
        console.log(describePlan(plan, root));
        if (flags.has('dry-run')) {
            console.log('\n(dry run: nothing written)');
            return 0;
        }
        for (const line of applyRelease(plan, root)) console.log(`✓ ${line}`);
        console.log(`\nNext: git push origin ${plan.branch} --follow-tags`);
        return 0;
    },

    fixtures: ({ positional, flags }) => {
        const dir = positional[0];
        if (!dir) throw new UsageError('fixtures needs the folder of recorded fixtures');
        const out = typeof flags.get('out') === 'string' ? resolve(flags.get('out') as string) : undefined;
        const source = fixturesModule(loadFixtures(dir), dir);
        if (!out) {
            process.stdout.write(source);
            return 0;
        }
        writeFileSync(out, source);
        console.log(`✓ ${out}`);
        return 0;
    },
};

const VENDOR_USE: Record<VendorTarget, string> = {
    kit: `Then draw, with no dependency on the plugin-kit plugin:
  import { describeWidgets, hydrate } from './kit/index.ts'
  const tree = describeWidgets(widgets, { id: \`my-plugin:\${e.requestId}\` })
  return <Box>{hydrate(tree, h)}</Box>`,
    adapter: `Then run a hook policy in your mod:
  import { toClassic } from './adapter/index.ts'
  on('classic.UserPromptSubmit', ($, e, next) => toClassic('UserPromptSubmit', handle(e)) ?? next(e))`,
    testing: `Then, in a *.test.tsx:
  import { mountTarget, SURFACES } from './kit-testing/index.ts'
  const ui = await $.ui.mount(mountTarget('my-plugin', 'AbovePrompt', surface))`,
};

/** This version's copy of what `vendor <target>` writes, file name → text. */
function vendorSources(target: VendorTarget): Record<string, string> {
    if (target !== 'kit') {
        return { 'index.ts': readFileSync(shipped(target === 'adapter' ? 'src/adapter/index.ts' : 'src/mod-testing/index.ts'), 'utf8') };
    }
    const kitDir = shipped('plugin/hooks/kit');
    const sources: Record<string, string> = { 'hydrate.ts': readFileSync(shipped('src/widgets/hydrate.ts'), 'utf8') };
    for (const name of readdirSync(kitDir)) sources[name] = readFileSync(join(kitDir, name), 'utf8');
    return sources;
}

function vendor(target: VendorTarget, dir = '.'): number {
    const result = vendorFiles(resolve(dir), target, vendorSources(target));
    console.log(`✓ ${result.folder}/: ${result.written} written, ${result.unchanged} unchanged\n\n${VENDOR_USE[target]}`);
    return 0;
}

/** `git config user.name`, for a generated manifest's author; undefined if unset. */
function gitUserName(): string | undefined {
    try {
        return execFileSync('git', ['config', 'user.name'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || undefined;
    } catch {
        return undefined;
    }
}

/** Writes generated files under `dir`; refuses to overwrite one unless `force`. */
function writeNew(dir: string, files: FileMap, force: boolean): string[] {
    const clashes = Object.keys(files).filter((path) => existsSync(join(dir, path)));
    if (clashes.length && !force) throw new Error(`would overwrite ${clashes.join(', ')} in ${dir}; pass --force to replace them`);
    for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text);
    }
    return Object.keys(files);
}

/** The config to use: `--config`, else the project's, else the user's, else the default. */
function loadStatusLineConfig(explicit: string | undefined, projectDir: string | undefined) {
    const candidates = explicit
        ? [resolve(explicit)]
        : [
            ...(projectDir ? [join(projectDir, '.claude', 'statusline.json')] : []),
            join(homedir(), '.claude', 'statusline.json'),
        ];
    const path = candidates.find((p) => existsSync(p));
    if (explicit && !path) throw new Error(`no config at ${explicit}`);
    if (!path) return { path: undefined, config: { config: DEFAULT_STATUS_LINE, warnings: [] } };
    let raw: unknown;
    try {
        raw = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
        return { path, config: { config: DEFAULT_STATUS_LINE, warnings: [`${path} is not valid JSON; using the default`] } };
    }
    return { path, config: parseStatusLineConfig(raw) };
}

const SAMPLE_STATUS_INPUT: StatusLineInput = {
    model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' },
    workspace: { current_dir: process.cwd(), project_dir: process.cwd() },
    cost: { total_cost_usd: 1.23, total_duration_ms: 1_520_000, total_lines_added: 120, total_lines_removed: 34 },
    context_window: { used_percentage: 72, total_input_tokens: 144_000, context_window_size: 200_000 },
    rate_limits: { five_hour: { used_percentage: 38 }, seven_day: { used_percentage: 91 } },
    prompt_cache: { hit_ratio: 0.88, warm: true },
    pr: { number: 42, review_state: 'pending' },
    effort: { level: 'high' },
    session_name: 'sample',
    version: '2.1.290',
};

function checkStatusLine(explicit: string | undefined): number {
    const { path, config } = loadStatusLineConfig(explicit, process.cwd());
    console.log(path ? `config: ${path}` : 'config: none found, using the default');
    for (const warning of config.warnings) console.log(`  ⚠ ${warning}`);
    console.log('\npreview (sample session):\n');
    console.log(composeStatusLine(config.config, SAMPLE_STATUS_INPUT));
    return config.warnings.length ? 1 : 0;
}

class UsageError extends Error {}

function parseArgs(argv: string[]): Args {
    const positional: string[] = [];
    const flags = new Map<string, string | true>();
    const valued = new Set(['out', 'event', 'config', 'plugin', 'marketplace', 'marketplace-name', 'date', 'dir']);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (!arg.startsWith('--')) {
            positional.push(arg);
            continue;
        }
        const name = arg.slice(2);
        if (valued.has(name)) {
            const value = argv[++i];
            if (value === undefined) throw new UsageError(`--${name} needs a value`);
            flags.set(name, value);
        } else {
            flags.set(name, true);
        }
    }
    return { positional, flags };
}

const [name, ...rest] = process.argv.slice(2);
const command = name ? COMMANDS[name] : undefined;
if (!command) {
    console.error(USAGE);
    process.exit(name === undefined || name === '--help' ? 0 : 1);
}
try {
    process.exit(command(parseArgs(rest)));
} catch (err) {
    console.error(`plugin-kit ${name}: ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof UsageError) console.error(USAGE);
    process.exit(1);
}
