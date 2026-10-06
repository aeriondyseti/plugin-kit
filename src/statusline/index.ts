/**
 * `@aeriondyseti/plugin-kit/statusline` — build a Claude Code status line
 * from widgets bound to named sources, or run `plugin-kit statusline` with a
 * JSON config and write no code at all.
 *
 *   import { composeStatusLine, parseStatusLine } from '@aeriondyseti/plugin-kit/statusline';
 *   console.log(composeStatusLine(myConfig, parseStatusLine(), { sources: { todo: () => 3 } }));
 */

export { parseStatusLine, type StatusLineInput } from './input.js';
export { SOURCES, type SourceValue, type StatusSource } from './sources.js';
export {
    composeStatusLine,
    DEFAULT_STATUS_LINE,
    parseStatusLineConfig,
    renderStatusItem,
    STATUS_ITEM_TYPES,
    type ComposeOptions,
    type ExtraSources,
    type StatusItem,
    type StatusItemType,
    type StatusLineConfig,
    type StatusLineConfigLoad,
} from './compose.js';
