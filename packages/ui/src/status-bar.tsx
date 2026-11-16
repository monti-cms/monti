"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva } from "class-variance-authority";
import type * as React from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { StatusBarList } from "./status-bar-list";
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
				"hidden h-monti-statusbar items-stretch overflow-hidden border-monti-default border-t bg-monti-tool text-monti-meta text-monti-subtle has-[[data-slot=status-bar-cell]]:flex",
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
	"flex items-center gap-monti-6 whitespace-nowrap border-0 bg-transparent px-monti-16 font-[inherit] text-[length:inherit] text-inherit [&:not(:is([data-slot=status-bar-cell],[data-slot=status-bar-live])~*):not(:is([data-slot=status-bar-cell],[data-slot=status-bar-live])~[data-slot=status-bar-live]>*)]:pl-monti-24 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-monti-contrast/50 [&:is(a,button):hover]:bg-monti-selected data-popup-open:bg-monti-selected data-popup-open:text-monti-default [&:is(a,button):hover]:text-monti-default [&:is(a,button)]:cursor-pointer",
	{
		variants: {
			/** `end` cells sit after the spacer: the rule is on their left, the last one has room at the right edge (the cells are counted, not their neighbors: an open list leaves focus guards beside its trigger), and they hide first on a narrow screen. */
			end: {
				false: cn(RULE, "min-w-0 bg-right"),
				true: cn(RULE, "shrink-0 bg-left [&:not(:has(~[data-slot=status-bar-cell]))]:pr-monti-24 max-sm:hidden"),
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
 * background; a cell that can be pressed takes it too under the pointer, so it reads as pressable (two steps over the tool ground, as a list row's hover is over the page). A `<button>` by default (it opens a list: `render` it from the list's trigger); give it `render={<span />}` for a cell that only states
 * something, and an `href` (or the app's router link in `render`) for one that goes somewhere. `tone` colors the text of something to fix, and `dot` (on by default) puts the 6px dot before it: the dot marks what has to be dealt with before saving or publishing, so a cell that only counts findings turns it off.
 * `detail` is a second, quieter part after a "·" ("Requests 1 · Working 1"): what the first part does not count.
 */
function StatusBarCell({
	end,
	tone,
	dot = true,
	className,
	children,
	render,
	href,
	detail,
	...props
}: useRender.ComponentProps<"button"> &
	Pick<React.ComponentProps<"a">, "href" | "target" | "rel"> & {
		end?: boolean;
		tone?: "warning" | "danger";
		dot?: boolean;
		detail?: React.ReactNode;
	}) {
	const isButton = render === undefined && href === undefined;
	const cell = (
		<>
			{tone && dot && (
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
			{detail !== undefined && (
				<span data-slot="status-bar-detail" className="text-monti-subtle">
					· {detail}
				</span>
			)}
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

/**
 * The place of a cell whose changes are said aloud, politely: the save state, which a person does not look down to read. It wraps the cell
 * and adds no room to it, so the words stand in the page once, seen and said from the same place, and a cell that is not drawn says
 * nothing. The place stays while the cell in it changes (a cell that states turning into one that is pressed), which is what makes the change
 * heard. For the bar's cell rules it counts as the cell it holds.
 */
function StatusBarLive({ children }: { children: React.ReactNode }) {
	return (
		// A box of its own, not `display: contents`: a browser that drops such an element from what it tells a screen reader would drop the
		// region with it. It stretches to the bar's height and shrinks as a cell does, so the cell inside stands as it would alone.
		<span data-slot="status-bar-live" aria-live="polite" aria-atomic="true" className="flex min-w-0 items-stretch">
			{children}
		</span>
	);
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
				<StatusBarCell end={end} tone={blocking ? "danger" : "warning"} dot={blocking}>
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
							<Button variant="ghost" size="sm" onClick={settings.onClick}>
								{settings.label}
							</Button>
						) : (
							<span />
						)}
						{fixAll && (
							<Button variant="ghost" size="sm" onClick={fixAll.onClick}>
								{fixAll.label}
							</Button>
						)}
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

export { StatusBar, StatusBarCell, StatusBarLive, StatusBarPluginCell, StatusBarSpacer };
