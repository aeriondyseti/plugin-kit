/**
 * `@aeriondyseti/hook-kit/widgets` — typed widgets, their validation and
 * catalog, and the renderers: a one-line form and a UI description a mod
 * draws. Pure: no Node, no dependencies.
 */

export {
    MAX_CLOCK_SEGMENTS,
    WIDGET_TYPE_NAMES,
    type ClockWidget,
    type CounterWidget,
    type ListWidget,
    type MeterWidget,
    type TagsWidget,
    type TextWidget,
    type Widget,
    type WidgetColor,
    type WidgetCommon,
    type Widgets,
    type WidgetType,
} from './types.js';
export { loadWidgets, parseWidget, type WidgetLoad, type WidgetParseResult } from './parse.js';
export { WIDGET_CATALOG, widgetJsonSchema, widgetTable, type WidgetTypeInfo } from './catalog.js';
export { renderWidgetLine, renderWidgetsLine } from './line.js';
export {
    describeWidgets,
    parseWidgetKey,
    widgetKey,
    type DescribeOptions,
    type UiElement,
    type UiNode,
    type UiProp,
    type WidgetAction,
} from './describe.js';
export { hydrate, type Factory } from './hydrate.js';
