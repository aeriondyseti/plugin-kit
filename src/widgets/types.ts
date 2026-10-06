/**
 * Widgets: small, typed pieces of state a plugin (or the model, through a
 * plugin's tool) hands over to be drawn. A widget owns its data, never its
 * placement: the host decides where the rows go.
 *
 * This folder is pure — no Node, no dependencies — because it is copied
 * verbatim into the plugin-kit mod, whose environment has neither.
 */

import type { ColorName } from '../formatting/vocab.js';

export const WIDGET_TYPE_NAMES = ['text', 'counter', 'meter', 'clock', 'list', 'tags'] as const;
export type WidgetType = typeof WIDGET_TYPE_NAMES[number];

/** A named color from the shared vocab, or a hex like `#c0392b` / `#c33`. */
export type WidgetColor = ColorName | `#${string}`;

/**
 * Fields every widget may carry. `color` paints the main part of the row
 * (never the note); `group` draws a dim heading above the first row of a run.
 */
export interface WidgetCommon {
    note?: string;
    color?: WidgetColor;
    group?: string;
}

export interface TextWidget extends WidgetCommon { type: 'text'; value: string }
export interface CounterWidget extends WidgetCommon { type: 'counter'; value: number }
export interface MeterWidget extends WidgetCommon { type: 'meter'; value: number; max: number }
export interface ClockWidget extends WidgetCommon { type: 'clock'; value: number; of: number }
export interface ListWidget extends WidgetCommon { type: 'list'; value: string[] }
export interface TagsWidget extends WidgetCommon { type: 'tags'; value: string[] }

export type Widget = TextWidget | CounterWidget | MeterWidget | ClockWidget | ListWidget | TagsWidget;

/** Widgets by name, in draw order (object key order). */
export type Widgets = Record<string, Widget>;

export const MAX_CLOCK_SEGMENTS = 12;
