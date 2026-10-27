"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type * as React from "react";
import { cn } from "./cn";
import { Count } from "./count";

/**
 * What a list or grid shows when it has nothing: a line that says so and, instead of an explanation, the things that can be done, as
 * {@link EmptyStep}s in order. `size="compact"` is the small form for a popover or a dialog: the text alone, centered.
 */
function Empty({
	title,
	description,
	size = "fill",
	className,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	title: React.ReactNode;
	/** One quiet line under the title ("Where do you want to start?"). */
	description?: React.ReactNode;
	size?: "fill" | "compact";
}) {
	const compact = size === "compact";
	return (
		<div
			data-slot="empty"
			data-size={size}
			className={cn(
				"flex w-full min-w-0 flex-col",
				compact ? "px-monti-8 py-monti-12 text-center" : "pt-monti-48",
				className,
			)}
			{...props}
		>
			<p
				data-slot="empty-title"
				className={cn("m-0", compact ? "text-monti-body text-monti-default" : "mb-monti-8 text-monti-heading")}
			>
				{title}
			</p>
			{description && (
				<p
					data-slot="empty-description"
					className={cn(
						"m-0 text-monti-subtle",
						compact ? "text-monti-note" : "mb-monti-32 font-normal text-monti-title",
					)}
				>
					{description}
				</p>
			)}
			{children && (
				<div
					data-slot="empty-steps"
					className={cn(
						"flex flex-col border-monti-muted border-t",
						compact ? "mt-monti-8" : !description && "mt-monti-32",
					)}
				>
					{children}
				</div>
			)}
		</div>
	);
}

/**
 * One thing to do from an empty list: its title at the size of a choice, an arrow at the end, a rule under it. `number` ("01") only when the
 * order really matters. A button by default; with an `href`, or the router's link in `render`, it is a link.
 */
function EmptyStep({
	number,
	className,
	render,
	href,
	children,
	...props
}: useRender.ComponentProps<"button"> &
	Pick<React.ComponentProps<"a">, "href" | "target" | "rel"> & {
		/** The step's place in an order that matters ("01"). */
		number?: string;
	}) {
	const isButton = render === undefined && href === undefined;
	return useRender({
		defaultTagName: href === undefined ? "button" : "a",
		props: mergeProps<"button">(
			{
				className: cn(
					"flex w-full cursor-pointer items-baseline gap-monti-20 border-0 border-monti-muted border-b bg-transparent py-[22px] text-left text-monti-default no-underline outline-none focus-visible:bg-monti-selected",
					className,
				),
				children: (
					<>
						{number && <Count className="w-monti-24 shrink-0">{number}</Count>}
						<span className="grow text-monti-title">{children}</span>
						<span aria-hidden className="text-monti-subtle">
							→
						</span>
					</>
				),
				...(isButton ? { type: "button" } : {}),
			},
			{ ...props, ...(href === undefined ? {} : { href }) } as React.ComponentProps<"button">,
		),
		render,
		state: { slot: "empty-step" },
	});
}

export { Empty, EmptyStep };
