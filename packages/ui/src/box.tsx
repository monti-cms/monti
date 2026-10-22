import type * as React from "react";
import { cn } from "./cn";
import { type LayoutProps, layoutVariants, splitLayout } from "./layout";

type Tag =
	| "div"
	| "section"
	| "article"
	| "aside"
	| "header"
	| "footer"
	| "main"
	| "nav"
	| "ul"
	| "ol"
	| "li"
	| "span"
	| "form"
	| "label";

/**
 * A box with layout options only (padding, surface, border, radius, size, overflow), by token name. For a row or a column of children use
 * `Stack` or `Inline`, which take the same options.
 */
function Box({
	as: Tag = "div",
	className,
	...props
}: React.HTMLAttributes<HTMLElement> & LayoutProps & { as?: Tag; htmlFor?: string }) {
	const [layout, rest] = splitLayout(props);
	return <Tag className={cn(layoutVariants(layout), className)} {...rest} />;
}

export { Box };
export type { Tag as BoxTag };
