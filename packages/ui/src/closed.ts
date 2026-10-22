import type { ComponentType } from "react";

/**
 * A component as screens see it: the same component, without `className`, `style` or any other `…ClassName`. Screens shape nothing themselves; they pick a component
 * and its options (variant, tone, size, gap). The open versions stay in `@monti-cms/ui/internal` for the design system's own parts.
 */
type Shaping = "className" | "style" | `${string}ClassName`;

export type Closed<C> = C extends (props: infer P) => infer R
	? (props: Omit<P, Shaping>) => R
	: C extends ComponentType<infer P>
		? ComponentType<Omit<P, Shaping>>
		: C;

/** Types a component as {@link Closed}. Nothing changes at run time. */
export const close = <C>(component: C) => component as unknown as Closed<C>;
