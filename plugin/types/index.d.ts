// The contract of `$.kit`, the noun plugin-kit adds to every mod's `$`.
//
// A plugin that lists "plugin-kit" under `dependencies` in its plugin.json
// gets this file laid into its own .claude-plugin/types/ by the engine, so
// `$.kit` is typed with nothing copied. Self-contained by the engine's rule:
// no imports, every exported name led by `Kit`. It restates the widget types
// of src/widgets; scripts/contract-check.ts fails the typecheck if they drift.

export type KitColorName = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray' | 'grey';
export type KitWidgetColor = KitColorName | `#${string}`;

export interface KitWidgetCommon {
    note?: string;
    color?: KitWidgetColor;
    group?: string;
}
export interface KitTextWidget extends KitWidgetCommon { type: 'text'; value: string }
export interface KitCounterWidget extends KitWidgetCommon { type: 'counter'; value: number }
export interface KitMeterWidget extends KitWidgetCommon { type: 'meter'; value: number; max: number }
export interface KitClockWidget extends KitWidgetCommon { type: 'clock'; value: number; of: number }
export interface KitListWidget extends KitWidgetCommon { type: 'list'; value: string[] }
export interface KitTagsWidget extends KitWidgetCommon { type: 'tags'; value: string[] }
export type KitWidget = KitTextWidget | KitCounterWidget | KitMeterWidget | KitClockWidget | KitListWidget | KitTagsWidget;

/** Widgets by name, in draw order. */
export type KitWidgets = { [name: string]: KitWidget };

/**
 * A UI description: plain JSON shaped like a mod's element tree. Turn it into
 * elements with `hydrate` (src/widgets/hydrate.ts, copied into your hooks).
 */
export type KitUiProp = string | number | boolean;
export type KitUiNode = string | KitUiElement;
export interface KitUiElement {
    type: 'Box' | 'Text' | 'Button';
    props?: { [name: string]: KitUiProp };
    children?: KitUiNode[];
}

/** Which characters draw bars, segments, bullets and separators. */
export type KitGlyphs = 'unicode' | 'ascii';

export type KitParseResult = { ok: true; widget: KitWidget } | { ok: false; error: string };

export type KitJson = string | number | boolean | null | KitJson[] | { [key: string]: KitJson };

export interface KitRenderArgs {
    /**
     * Names this drawing, e.g. `${plugin}:${e.requestId}`. It keys the kit's
     * view state (which lists are unfolded) and prefixes its Button keys.
     */
    id: string;
    /**
     * The widgets, in draw order. Unchecked input is fine: an invalid widget
     * draws as text rather than failing the drawing (use `parse` to refuse).
     */
    widgets: { [name: string]: KitJson };
    /**
     * The three below override the user's plugin-kit settings for this
     * drawing; leave them out to draw the way the user chose.
     */
    /** Cells in a meter's bar. The user's default, else 10. */
    barWidth?: number;
    /** Items a list shows before folding the rest behind a button. The user's default, else 5. */
    listLimit?: number;
    /** The user's default, else `unicode`. */
    glyphs?: KitGlyphs;
}

export type Kit = {
    /** The widgets as a UI description. Read inside `ui.render`, it redraws when the kit's view state changes. */
    render(args: KitRenderArgs): Promise<KitUiElement>;
    /** The widgets on one line of plain text, joined with ` · `: for a status line. */
    line(args: { widgets: { [name: string]: KitJson } }): Promise<string>;
    /** Validates one widget; every error names the widget and the fix. */
    parse(args: { name: string; widget: KitJson }): Promise<KitParseResult>;
    /** The catalog for a model: a markdown table, and a JSON Schema for one widget as a tool input. */
    catalog(): Promise<{ table: string; schema: { [key: string]: KitJson } }>;
};

declare module 'claude-code' {
    interface EngineInterface {
        kit: Kit;
    }
    interface PluginState {
        'plugin-kit': {
            /** Per drawing id, the names of its lists drawn unfolded. */
            expanded: { [id: string]: string[] };
        };
    }
}
