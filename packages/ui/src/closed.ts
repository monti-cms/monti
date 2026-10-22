import type { ComponentType, JSX } from "react";

/**
 * A component as screens see it: the same component, without `className` and `style`. Screens shape nothing themselves; they pick a component
 * and its options (variant, tone, size, gap). The open versions stay in `@monti-cms/ui/internal` for the design system's own parts.
 */
export type Closed<C> = C extends (props: infer P) => infer R
	? (props: Omit<P, "className" | "style">) => R
	: C extends ComponentType<infer P>
		? ComponentType<Omit<P, "className" | "style">>
		: C;

/** Types a component as {@link Closed}. Nothing changes at run time. */
export const close = <C>(component: C) => component as unknown as Closed<C>;

export type { JSX };
