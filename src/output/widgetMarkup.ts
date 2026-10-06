/**
 * A widget UI description (see `describeWidgets`) as lines of tag markup, so
 * hook output lays widgets out exactly as a mod draws them: one layout,
 * two renderers.
 *
 * Text output can't do everything a mod can: Buttons are left out (nothing
 * to press), and a hex color is dropped because tags know the 16 named
 * colors only.
 */

import type { UiElement, UiNode } from '../widgets/describe.js';
import { COLORS } from '../formatting/vocab.js';

export function toMarkup(node: UiNode): string[] {
    if (typeof node === 'string') return [node];
    switch (node.type) {
        case 'Button':
            return [];
        case 'Text':
            return [styled((node.children ?? []).join(''), node)];
        case 'Box': {
            const children = (node.children ?? []).map(toMarkup);
            const lines = node.props?.flexDirection === 'row'
                ? [children.map((lines) => lines.join(' ')).filter(Boolean).join(' ')]
                : children.flat();
            const pad = ' '.repeat(Number(node.props?.paddingLeft ?? 0));
            return lines.filter((line) => line !== '').map((line) => pad + line);
        }
    }
}

function styled(text: string, node: UiElement): string {
    let out = text;
    const color = node.props?.color;
    if (typeof color === 'string' && COLORS.some((c) => c === color)) out = `<color:"${color}">${out}</color>`;
    if (node.props?.bold) out = `<bold>${out}</bold>`;
    if (node.props?.dimColor) out = `<dim>${out}</dim>`;
    return out;
}
