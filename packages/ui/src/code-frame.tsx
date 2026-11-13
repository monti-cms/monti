import type * as React from "react";
import { cn } from "./cn";

/**
 * A code block in the editor (doc 17): the box (`bg-muted`, `radius-lg`, as the body's other boxes), its head row (the language on the left, the
 * block's tools on the right, a hairline under it), and the code as rows, one per line. `tab` is the file name's tab on the box's top edge.
 */
function CodeFrame({
	tab,
	head,
	children,
	className,
	...props
}: React.ComponentProps<"div"> & { tab?: React.ReactNode; head?: React.ReactNode }) {
	return (
		<div data-slot="code-frame" className={cn("relative flex flex-col", className)} {...props}>
			{tab}
			<div
				className={cn("flex flex-col rounded-monti-lg bg-monti-muted", tab ? "rounded-tl-none" : undefined)}
				data-tabbed={tab ? "" : undefined}
			>
				{head ? (
					<div
						data-slot="code-frame-head"
						contentEditable={false}
						className="flex min-h-monti-control-md items-center justify-between gap-monti-8 border-monti-default border-b px-monti-8"
					>
						{head}
					</div>
				) : null}
				<div data-slot="code-frame-body" className="overflow-x-auto py-monti-8">
					<div className="flex w-max min-w-full flex-col">{children}</div>
				</div>
			</div>
		</div>
	);
}

/** The file name's tab: the box's own ground on its top-left edge, holding the name's field (`Input appearance="inline" mono size="sm"`). */
function CodeFileTab({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="code-file-tab"
			className={cn(
				"inline-flex h-monti-control-sm max-w-full items-center self-start rounded-t-monti-md bg-monti-muted px-monti-12",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * What a line carries: its ground — an effect's (`highlight` the text-emphasis ground, `plus`, `minus`), `picked` by the line numbers (the selection's ground),
 * `lit` while a code link to it is pointed at (the block ground) — its mark, a wavy line under its words.
 */
type CodeLineTone = "highlight" | "plus" | "minus" | "picked" | "lit";

/**
 * One line of code: its number in the gutter (`fold` is the fold's button before it, on the first line of a fold), the line's mark in the code's left
 * margin (`+`, `−`, `›`: no column of its own), and its words. `linked` draws the 2px line a code link's line has on the gutter's edge. `numbersOff`:
 * the site does not show line numbers, so they are fainter.
 */
function CodeLine({
	number,
	fold,
	mark,
	tone,
	wavy,
	linked = false,
	numbersOff = false,
	folds = false,
	readOnly = false,
	children,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	/** Left out on the row that stands for a fold's hidden lines (its "n lines folded" button). */
	number?: number;
	fold?: React.ReactNode;
	mark?: "+" | "−" | "›";
	tone?: CodeLineTone;
	wavy?: "warning" | "error";
	linked?: boolean;
	numbersOff?: boolean;
	/** The block has a fold somewhere: the gutter keeps room for the fold's button on every line, so the numbers stay in a column. */
	folds?: boolean;
	/** Nothing to pick (an archived entry): the numbers are not pressable, so no pointer and no tint under it. */
	readOnly?: boolean;
	children?: React.ReactNode;
}) {
	return (
		<div
			data-slot="code-line"
			data-tone={tone}
			className={cn(
				"group/line flex min-h-5 items-stretch font-mono text-monti-code",
				"data-[tone=highlight]:bg-monti-highlight data-[tone=minus]:bg-monti-danger-muted data-[tone=plus]:bg-monti-success-muted",
				"data-[tone=lit]:bg-monti-block data-[tone=picked]:bg-monti-selection",
				className,
			)}
			{...props}
		>
			<span
				data-slot="code-line-number"
				contentEditable={false}
				className={cn(
					"flex shrink-0 select-none items-center justify-end gap-monti-2 pr-monti-8 pl-monti-8 tabular-nums",
					readOnly ? undefined : "cursor-pointer hover:bg-monti-selected",
					numbersOff ? "text-monti-faint" : "text-monti-subtle",
					tone === "picked" ? "text-monti-default" : undefined,
					linked ? "shadow-[inset_2px_0_0_var(--monti-border-contrast)]" : undefined,
				)}
			>
				{folds ? <span className="flex size-5 shrink-0 items-center justify-center">{fold}</span> : null}
				<span className="min-w-[2ch]">{number}</span>
			</span>
			<span className="relative flex-1 whitespace-pre pr-monti-16 pl-monti-16 text-monti-default">
				{mark ? (
					<span
						aria-hidden
						contentEditable={false}
						className={cn(
							"absolute left-monti-4 select-none",
							mark === "+" ? "text-monti-success" : mark === "−" ? "text-monti-danger" : "text-monti-subtle",
						)}
					>
						{mark}
					</span>
				) : null}
				<span
					className={cn(
						wavy && "underline decoration-1 decoration-wavy underline-offset-4",
						wavy === "warning" && "decoration-(--monti-bg-warning-emphasis)",
						wavy === "error" && "decoration-(--monti-fg-danger)",
					)}
				>
					{children}
				</span>
			</span>
		</div>
	);
}

/** A piece of code in its two theme colours, as the highlighter gives them (`--shiki-light`, `--shiki-dark`): run-time values from the site's themes. */
function CodeToken({ light, dark, children }: { light?: string; dark?: string; children: React.ReactNode }) {
	return (
		<span
			data-slot="code-token"
			className="monti-dark:text-(--shiki-dark) text-(--shiki-light)"
			// design-allow: the site's Shiki themes colour each piece at run time
			style={{ "--shiki-light": light, "--shiki-dark": dark ?? light } as React.CSSProperties}
		>
			{children}
		</span>
	);
}

/**
 * Words of code with a mark of the code's own: `tip` a tooltip (dotted line under them), `fold` folded words (a dashed outline: in the editor they
 * stay open so they can be edited), `picked` words picked with the pointer (the selection's ground), `bold` words a rule makes bold.
 */
function CodeMark({ kind, children }: { kind: "tip" | "fold" | "picked" | "bold"; children: React.ReactNode }) {
	return (
		<span
			data-slot="code-mark"
			data-kind={kind}
			className={cn(
				kind === "tip" && "underline decoration-(--monti-fg-subtle) decoration-dotted underline-offset-4",
				kind === "fold" &&
					"rounded-monti-sm outline-dashed outline-(--monti-border-strong) outline-1 -outline-offset-1",
				kind === "picked" && "bg-monti-selection",
				kind === "bold" && "font-semibold",
			)}
		>
			{children}
		</span>
	);
}

/**
 * Words of the text that point at lines of a code block (doc 17): a dotted line under them, so they read apart from a link's solid one. `broken`: the lines
 * are gone, the dotted line red (a wavy line is the code's "error" effect). `picking`: the words picked first while a link is being made, on the selected
 * ground.
 */
function CodeRefText({
	state = "linked",
	children,
}: {
	state?: "linked" | "broken" | "picking";
	children: React.ReactNode;
}) {
	return (
		<span
			data-slot="code-ref"
			data-state={state}
			className={cn(
				"underline underline-offset-4",
				state === "linked" && "decoration-(--monti-fg-subtle) decoration-dotted",
				state === "broken" && "decoration-(--monti-fg-danger) decoration-dotted",
				state === "picking" && "rounded-monti-sm bg-monti-selected no-underline",
			)}
		>
			{children}
		</span>
	);
}

export { CodeFileTab, CodeFrame, CodeLine, type CodeLineTone, CodeMark, CodeRefText, CodeToken };
