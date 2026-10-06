/**
 * Turns a UI description (what `$.kit.render` returns) into real elements.
 *
 * Self-contained on purpose: a mod cannot import from another plugin, so a
 * plugin that draws kit descriptions copies this one file into its hooks
 * folder. Pass the mod's JSX factory as `create`:
 *
 *   const tree = await $.kit.render({ id: e.requestId, widgets })
 *   return hydrate(tree, h, { save: () => ... })
 *
 * Every Button needs an `onPress` to draw, so each one gets either the
 * handler named by its key or a no-op. A no-op still raises `ui.press`,
 * which is how the kit answers its own buttons (a list's "+3 more").
 */

type Node = string | { type: string; props?: Record<string, unknown>; children?: Node[] };

export type Factory<E> = (tag: string, props: Record<string, unknown> | null, ...children: unknown[]) => E;

export function hydrate<E>(node: Node, create: Factory<E>, handlers: Record<string, () => void> = {}): E | string {
    if (typeof node === 'string') return node;
    const key = node.props?.key;
    const props = node.type === 'Button'
        ? { ...node.props, onPress: (typeof key === 'string' && handlers[key]) || noop }
        : node.props ?? null;
    return create(node.type, props, ...(node.children ?? []).map((child) => hydrate(child, create, handlers)));
}

function noop(): void {}
