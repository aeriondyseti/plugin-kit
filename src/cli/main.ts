#!/usr/bin/env node
/**
 * The `plugin-kit` command. Each subcommand is a function in COMMANDS; the
 * work itself lives in the modules beside this one, where it's tested.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixturesModule, loadFixture, loadFixtures, recordFixture, type Fixture } from '../fixtures.js';
import { addKit, VENDOR_TARGETS, vendorFiles, type VendorTarget } from './addKit.js';
import { formatResults, runFixtures } from './run.js';

const USAGE = `usage: plugin-kit <command>

  add-kit [--vendor] [plugin-dir]        set a plugin up to draw kit widgets
  vendor <kit|adapter|testing> [plugin-dir]
                                         copy kit code into a plugin (mods can't import npm)
  record [--out <dir>]                   (a command hook) save each payload as a fixture
  run <command> <fixture|dir>... [--event <E>] [--json]
                                         replay fixtures through a hook command
  fixtures <dir> [--out <file.ts>]       fixtures as a TS module, for mod tests`;

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

function vendor(target: VendorTarget, dir = '.'): number {
    const sources: Record<string, string> = {};
    if (target === 'kit') {
        const kitDir = shipped('plugin/hooks/kit');
        for (const name of readdirSync(kitDir)) sources[name] = readFileSync(join(kitDir, name), 'utf8');
        sources['hydrate.ts'] = readFileSync(shipped('src/widgets/hydrate.ts'), 'utf8');
    } else {
        sources['index.ts'] = readFileSync(shipped(target === 'adapter' ? 'src/adapter/index.ts' : 'src/mod-testing/index.ts'), 'utf8');
    }
    const result = vendorFiles(resolve(dir), target, sources);
    console.log(`✓ ${result.folder}/: ${result.written} written, ${result.unchanged} unchanged\n\n${VENDOR_USE[target]}`);
    return 0;
}

class UsageError extends Error {}

function parseArgs(argv: string[]): Args {
    const positional: string[] = [];
    const flags = new Map<string, string | true>();
    const valued = new Set(['out', 'event']);
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
