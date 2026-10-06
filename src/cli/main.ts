#!/usr/bin/env node
/**
 * The `plugin-kit` command. One subcommand today, in two modes:
 *
 *   npx @aeriondyseti/plugin-kit add-kit [plugin-dir]            depend on the plugin, use $.kit
 *   npx @aeriondyseti/plugin-kit add-kit --vendor [plugin-dir]   copy the widget code in
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addKit, vendorKit } from './addKit.js';

const USAGE = 'usage: npx @aeriondyseti/plugin-kit add-kit [--vendor] [plugin-dir]';

const args = process.argv.slice(2);
const [command, ...rest] = args;
const vendor = rest.includes('--vendor');
const dir = rest.find((arg) => !arg.startsWith('--')) ?? '.';
if (command !== 'add-kit' || rest.some((arg) => arg.startsWith('--') && arg !== '--vendor')) {
    console.error(USAGE);
    process.exit(command === undefined || command === '--help' ? 0 : 1);
}

// Shipped in the package beside dist/, so the copies are always this version's.
const shipped = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const hydrateSource = readFileSync(shipped('src/widgets/hydrate.ts'), 'utf8');

try {
    if (vendor) {
        const kitDir = shipped('plugin/hooks/kit');
        const sources: Record<string, string> = { 'hydrate.ts': hydrateSource };
        for (const name of readdirSync(kitDir)) sources[name] = readFileSync(`${kitDir}/${name}`, 'utf8');
        const result = vendorKit(resolve(dir), sources);
        console.log(`✓ ${result.folder}/: ${result.written} written, ${result.unchanged} unchanged`);
        console.log(`
Then draw, with no dependency on the plugin-kit plugin:
  import { describeWidgets, hydrate } from './kit/index.ts'
  const tree = describeWidgets(widgets, { id: \`my-plugin:\${e.requestId}\` })
  return <Box>{hydrate(tree, h)}</Box>`);
    } else {
        const result = addKit(resolve(dir), hydrateSource);
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
    }
} catch (err) {
    console.error(`add-kit: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
}
