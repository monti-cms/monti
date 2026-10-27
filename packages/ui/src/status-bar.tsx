"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva } from "class-variance-authority";
import type * as React from "react";
import { cn } from "./cn";
import { StatusBarList } from "./status-bar-list";
import { TextButton } from "./text-button";
import { TodoItem } from "./todo-item";

/**
 * The bar under the editor. It holds only what is not shown anywhere else: the things to fix, the assistant's requests, the character count. It is
 * as tall as the design says, takes the page's tool color, and is not drawn at all while it has no cell. Name it with `aria-label`.
 */
function StatusBar({ className, ...props }: React.ComponentProps<"section">) {
	return (
		<section
			data-slot="status-bar"
			className={cn(
				"hidden h-monti-statusbar items-stretch overflow-hidden border-monti-default border-t bg-monti-tool font-mono text-monti-meta text-monti-subtle has-[[data-slot=status-bar-cell]]:flex",
				className,
			)}
			{...props}
		/>
	);
}

/** The 1px, 14px-tall rule between two cells: a gradient on the cell's edge, so it never stretches with the cell's height. */
const RULE =
	"bg-[linear-gradient(var(--monti-border-default),var(--monti-border-default))] bg-size-[1px_14px] bg-no-repeat";

const cellVariants = cva(
	"flex items-center gap-monti-6 whitespace-nowrap border-0 bg-transparent px-monti-16 font-[inherit] text-[length:inherit] text-inherit [&:not([data-slot=status-bar-cell]~*)]:pl-monti-24 data-popup-open:bg-monti-selected [&:is(a,button):hover]:text-monti-default [&:is(a,button)]:cursor-pointer",
	{
		variants: {
			/** `end` cells sit after the spacer: the rule is on their left, the last one has room at the right edge (the cells are counted, not their neighbors: an open list leaves focus guards beside its trigger), and they hide first on a narrow screen. */
			end: {
				false: cn(RULE, "min-w-0 bg-right-center"),
				true: cn(RULE, "shrink-0 bg-left-center [&:not(:has(~[data-slot=status-bar-cell]))]:pr-monti-24 max-sm:hidden"),
			},
			/** Something needs attention: a 6px dot before the text, in the warning color, or red while it stops publishing. */
			tone: {
				none: "",
				warning: "text-monti-warning",
				danger: "text-monti-danger",
			},
		},
		defaultVariants: { end: false, tone: "none" },
	},
);

/**
 * One cell of the status bar. It is as tall as the bar, so the whole height can be pressed, and the cell whose list is open takes the selected
 * background. A `<button>` by default (it opens a list: `render` it from the list's trigger); give it `render={<span />}` for a cell that only states
 * something, and an `href` (or the app's router link in `render`) for one that goes somewhere. `tone` puts the dot and the color of something to fix.
 */
function StatusBarCell({
	end,
	tone,
	className,
	children,
	render,
	href,
	...props
}: useRender.ComponentProps<"button"> &
	Pick<React.ComponentProps<"a">, "href" | "target" | "rel"> & {
		end?: boolean;
		tone?: "warning" | "danger";
	}) {
	const isButton = render === undefined && href === undefined;
	const cell = (
		<>
			{tone && (
				<span
					aria-hidden
					data-slot="status-bar-dot"
					className={cn(
						"size-1.5 shrink-0 rounded-monti-full",
						tone === "warning" ? "bg-monti-warning-emphasis" : "bg-current",
					)}
				/>
			)}
			{children}
		</>
	);
	return useRender({
		defaultTagName: href === undefined ? "button" : "a",
		props: mergeProps<"button">(
			{
				className: cn(cellVariants({ end: end ?? false, tone: tone ?? "none" }), className),
				...(isButton ? { type: "button" } : {}),
			},
			{ ...props, ...(href === undefined ? {} : { href }) } as React.ComponentProps<"button">,
			// Last, so the bar finds its cells even when a trigger (a popover's) names itself.
			{ "data-slot": "status-bar-cell", children: cell } as React.ComponentProps<"button">,
		),
		render,
	});
}

/** The space between the cells at the left and the ones at the right. */
function StatusBarSpacer() {
	return <span aria-hidden data-slot="status-bar-spacer" className="grow" />;
}

type Finding = {
	id: string;
	title: React.ReactNode;
	/** Where it is, in one line. */
	detail?: React.ReactNode;
	/** Stops publishing: its ring is red. */
	blocking?: boolean;
	/** The one thing to do about it ("Fix"). */
	actionLabel?: string;
	onAction?: () => void;
	/** Goes to its place when the row is pressed. */
	onOpen?: () => void;
};

/**
 * The cell a plugin fills, such as a spell checker's: the plugin brings no UI of its own, only the cell's name, its findings and the two actions
 * for the list. The cell shows the name and the count; its list shows one row per finding (what, then how and where), each with its own action, and
 * under a rule the way to the plugin's settings and "Fix all". Whether the cell is shown at all is the plugin's choice: leave it out where it has
 * nothing to check.
 */
function StatusBarPluginCell({
	label,
	findings,
	settings,
	fixAll,
	end,
	open,
	defaultOpen,
	onOpenChange,
}: {
	/** The plugin's name for what it finds ("Spelling"). */
	label: string;
	findings: readonly Finding[];
	/** Goes to the plugin's settings. */
	settings?: { label: string; onClick: () => void };
	/** Fixes every finding at once. */
	fixAll?: { label: string; onClick: () => void };
	end?: boolean;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	// A cell with nothing in it is not drawn.
	if (findings.length === 0) return null;
	const blocking = findings.some((finding) => finding.blocking);
	return (
		<StatusBarList
			trigger={
				<StatusBarCell end={end} tone={blocking ? "danger" : "warning"}>
					{label} {findings.length}
				</StatusBarCell>
			}
			label={label}
			count={findings.length}
			countTone={blocking ? "danger" : "warning"}
			align={end ? "end" : "start"}
			open={open}
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
			footer={
				(settings || fixAll) && (
					<>
						{settings ? (
							<TextButton variant="underline" onClick={settings.onClick}>
								{settings.label}
							</TextButton>
						) : (
							<span />
						)}
						{fixAll && <TextButton onClick={fixAll.onClick}>{fixAll.label}</TextButton>}
					</>
				)
			}
		>
			{findings.map(({ id, ...finding }) => (
				<TodoItem key={id} {...finding} />
			))}
		</StatusBarList>
	);
}

export { StatusBar, StatusBarCell, StatusBarPluginCell, StatusBarSpacer };
