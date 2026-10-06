// Fails the typecheck when plugin/types/index.d.ts (the `$.kit` contract,
// which may not import) drifts from the widget types in src/widgets.

import type { UiElement, Widget, WidgetParseResult } from '../src/widgets/index.js';
import type { KitParseResult, KitUiElement, KitWidget } from '../plugin/types/index.js';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const contractMatches: [
    Same<Widget, KitWidget>,
    Same<UiElement, KitUiElement>,
    Same<WidgetParseResult, KitParseResult>,
] = [true, true, true];
