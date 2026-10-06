#!/usr/bin/env node
/**
 * The `hook-kit` command. One subcommand today:
 *
 *   npx @aeriondyseti/hook-kit add-kit [plugin-dir]
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addKit } from './addKit.js';

const USAGE = 'usage: npx @aeriondyseti/hook-kit add-kit [plugin-dir]';

const [command, dir = '.'] = process.argv.slice(2);
if (command !== 'add-kit') {
    console.error(USAGE);
    process.exit(command === undefined || command === '--help' ? 0 : 1);
}

// Shipped in the package beside dist/, so the copy is always this version's.
const hydrateSource = readFileSync(fileURLToPath(new URL('../src/widgets/hydrate.ts', import.meta.url)), 'utf8');

try {
    const result = addKit(resolve(dir), hydrateSource);
    console.log(result.dependencyAdded
        ? '✓ plugin.json now depends on plugin-kit@plugin-kit'
        : '· plugin.json already depends on plugin-kit');
    console.log(`${result.hydrate === 'unchanged' ? '·' : '✓'} ${result.hydratePath} ${result.hydrate}`);
    console.log(`
For installing your plugin to install the kit too, add to your marketplace.json:
  "allowCrossMarketplaceDependenciesOn": ["plugin-kit"]

Then draw:
  const tree = await $.kit.render({ id: \`my-plugin:\${e.requestId}\`, widgets })
  return <Box>{hydrate(tree, h)}</Box>`);
} catch (err) {
    console.error(`add-kit: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
}
