/**
 * Helpers for testing a mod with `claude plugin test` and `claude-code/testing`.
 *
 * Test files run where only the plugin's own files can be imported, so
 * `plugin-kit vendor testing` copies this file into `tests/kit-testing/`.
 * No imports: the types below are local, shaped to fit Claude Code's own.
 *
 *   import { kitStub, mountTarget, replayAll, SURFACES } from './kit-testing/index.ts'
 *   import { fixtures } from './fixtures.ts'   // from `plugin-kit fixtures`
 */

/** The surfaces most mods draw on; loop a test body over them. */
export const SURFACES = ['terminal', 'desktop'] as const;
/** Every surface Claude Code draws on. */
export const ALL_SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const;
export type Surface = (typeof ALL_SURFACES)[number];

type Scroll = { offset: number; bodyRows: number };
type View = { agentId?: string };

export interface AbovePromptProps {
    hasSurvey: boolean;
    isWorking: boolean;
    maxRows: number;
    bodyColumns: number;
    scroll: Scroll;
    view: View;
}

export interface PaneProps {
    title: string;
    isFocused: boolean;
    bodyColumns: number;
    placement: 'dock' | 'inline';
    scroll: Scroll;
    view: View;
}

/** Props that pass the engine's checks, for the components a mod usually draws. */
export const DEFAULT_PROPS = {
    AbovePrompt: { hasSurvey: false, isWorking: false, maxRows: 40, bodyColumns: 80, scroll: { offset: 0, bodyRows: 40 }, view: {} },
    Pane: { title: 'pane', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} satisfies { AbovePrompt: AbovePromptProps; Pane: PaneProps };

type PropsOf = { AbovePrompt: AbovePromptProps; Pane: PaneProps };

/**
 * What `$.ui.mount` takes, with valid default props filled in:
 *
 *   const ui = await $.ui.mount(mountTarget('my-mod', 'Pane', surface, { title: 'Stats' }, 'stats'))
 *
 * `requestId` is the instance: a pane's id, which your `ui.render` matcher
 * may name (`{ component: 'Pane', requestId: 'stats' }`).
 */
export function mountTarget<C extends keyof PropsOf, S extends Surface>(
    plugin: string,
    component: C,
    surface: S,
    props: Partial<PropsOf[C]> = {},
    requestId?: string,
): { plugin: string; component: C; surface: S; props: PropsOf[C]; requestId?: string } {
    return {
        plugin,
        component,
        surface,
        props: { ...DEFAULT_PROPS[component], ...props } as PropsOf[C],
        ...(requestId === undefined ? {} : { requestId }),
    };
}

/** A recorded hook payload: one value of the module `plugin-kit fixtures` writes. */
export type RecordedPayload = { readonly hook_event_name: string; readonly [field: string]: unknown };

/** Payload fields the test kit stamps itself (it refuses `hook_event_name`). */
const STAMPED = ['hook_event_name'];

/**
 * How a recorded payload replays in a test: a classic event's name and its
 * fields, or for PreToolUse the tool call that raises it (`$.tool.call`).
 */
export function replayPlan(payload: RecordedPayload):
    | { kind: 'classic'; event: string; fields: Record<string, unknown> }
    | { kind: 'tool'; call: Record<string, unknown> } {
    if (payload.hook_event_name === 'PreToolUse') {
        const input = (payload.tool_input ?? {}) as Record<string, unknown>;
        return { kind: 'tool', call: { tool: payload.tool_name, ...input } };
    }
    const fields = Object.fromEntries(Object.entries(payload).filter(([key]) => !STAMPED.includes(key)));
    return { kind: 'classic', event: payload.hook_event_name, fields };
}

/** The test's `$`, as far as replaying needs it. */
export interface ReplayEngine {
    classic: Record<string, (fields: never) => Promise<unknown>>;
    tool: { call: (input: never) => Promise<unknown> };
}

/**
 * Raises a recorded payload through the plugins, as the session it was
 * recorded in did, and resolves to what they answered. A PreToolUse needs a
 * test `tool.call` hook answering `{ result }` beneath it.
 */
export async function replay($: ReplayEngine, payload: RecordedPayload): Promise<unknown> {
    const plan = replayPlan(payload);
    if (plan.kind === 'tool') return $.tool.call(plan.call as never);
    const raise = $.classic[plan.event];
    if (!raise) throw new Error(`no classic event ${plan.event} on this engine`);
    return raise(plan.fields as never);
}

/** Every fixture of a `plugin-kit fixtures` module, replayed in order. */
export async function replayAll(
    $: ReplayEngine,
    fixtures: Readonly<Record<string, RecordedPayload>>,
): Promise<Array<{ name: string; event: string; answer: unknown }>> {
    const answers: Array<{ name: string; event: string; answer: unknown }> = [];
    for (const [name, payload] of Object.entries(fixtures)) {
        answers.push({ name, event: payload.hook_event_name, answer: await replay($, payload) });
    }
    return answers;
}

/**
 * A stand-in for the plugin-kit plugin, for testing a mod that draws through
 * `$.kit` (`claude plugin test` doesn't load dependencies):
 *
 *   test('draws stats', { plugins: [kitStub] }, async ($) => { ... })
 *
 * It draws each widget as one Text, `Name value` (`Health 7/10`), so assert
 * on names and values, not the kit's real layout. Self-contained on purpose:
 * an inline plugin can't use anything outside its own `register`.
 */
export const kitStub = {
    name: 'plugin-kit',
    register(on: (event: 'engine.create', hook: (...args: never[]) => unknown) => void) {
        on('engine.create', (async (_$: unknown, e: unknown, next: (e: unknown) => Promise<Record<string, unknown>>) => {
            const built = await next(e);
            const show = (w: Record<string, unknown>): string => {
                const v = Array.isArray(w.value) ? w.value.join(', ') : String(w.value);
                if (w.type === 'meter') return `${v}/${String(w.max)}`;
                if (w.type === 'clock') return `${v}/${String(w.of)}`;
                return v;
            };
            const rows = (widgets: Record<string, Record<string, unknown>>) => Object.entries(widgets).map(([n, w]) => `${n} ${show(w)}`);
            const kit = {
                render: async (a: { id: string; widgets: Record<string, Record<string, unknown>> }) => ({
                    type: 'Box',
                    props: { key: `kit:${a.id}`, flexDirection: 'column' },
                    children: rows(a.widgets).map((text) => ({ type: 'Text', props: {}, children: [text] })),
                }),
                line: async (a: { widgets: Record<string, Record<string, unknown>> }) => rows(a.widgets).join(' · '),
                parse: async (a: { name: string; widget: unknown }) =>
                    typeof a.widget === 'object' && a.widget !== null && 'type' in a.widget
                        ? { ok: true, widget: a.widget }
                        : { ok: false, error: `${a.name}: a widget is an object with a type and a value` },
                catalog: async () => ({ table: '| type | fields | when |', schema: {} }),
            };
            return { ...built, kit };
        }) as never);
    },
};
