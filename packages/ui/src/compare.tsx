import * as React from "react";
import { cn } from "./cn";
import { Highlight } from "./proposal-marks";

/**
 * Two versions of one entry side by side: two columns with no gap, a rule between them, 48px of room inside each. Each side is a `CompareSide` with
 * its name, the properties that differ on top, and the entry below it the way it reads. The words that differ are `Highlight`ed, the same on both sides.
 * It fills the height it is given, so the rule between the columns runs to the status bar.
 */
function Compare({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="compare"
			className={cn(
				"grid min-h-0 grow grid-cols-2 *:min-w-0 *:px-monti-48 [&>*+*]:border-monti-default [&>*+*]:border-l",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * One side of a `Compare`. `label` names it in the small mono line on top ("Your input · not saved") and for screen readers. `properties` are the
 * `CompareProperty` rows of what differs; they are left out when the sides are the same there. `children` are the entry: a `CompareTitle`, then its blocks.
 */
function CompareSide({
	label,
	properties,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"section">, "title"> & { label: string; properties?: React.ReactNode }) {
	return (
		<section data-slot="compare-side" aria-label={label} className={cn("flex flex-col", className)} {...props}>
			<div
				data-slot="compare-label"
				className="border-monti-default border-b pt-monti-16 pb-monti-12 font-mono text-monti-micro text-monti-subtle"
			>
				{label}
			</div>
			{properties && (
				<div
					data-slot="compare-properties"
					className="flex flex-col gap-monti-12 border-monti-muted border-b py-monti-16"
				>
					{properties}
				</div>
			)}
			<article data-slot="compare-entry" className="max-w-[560px] pt-monti-24 pb-monti-40">
				{children}
			</article>
		</section>
	);
}

/** A property that differs: its name in the small mono line, its value under it. An empty value reads as `empty`, faint. */
function CompareProperty({
	label,
	empty,
	children,
}: {
	label: string;
	/** What an empty value is called ("Empty"); shown instead of `children` when there are none. */
	empty: string;
	children?: React.ReactNode;
}) {
	const has = React.Children.count(children) > 0 && children !== "";
	return (
		<div data-slot="compare-property" className="flex flex-col gap-monti-4">
			<span className="font-mono text-monti-micro text-monti-subtle">{label}</span>
			<span className={cn("text-monti-note", !has && "text-monti-faint")}>{has ? children : empty}</span>
		</div>
	);
}

/** The entry's title, at the top of its side: a level-2 heading under the screen's own, set in the page title size. */
function CompareTitle({ className, ...props }: React.ComponentProps<"h2">) {
	return <h2 data-slot="compare-title" className={cn("mb-monti-20 text-monti-page", className)} {...props} />;
}

/** The blocks of the entry, in the reading size. */
function CompareBody({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="compare-body" className={cn("text-monti-reading", className)} {...props} />;
}

/** A heading block of the entry (a level-3 heading here, whatever its own level). */
function CompareHeading({ className, ...props }: React.ComponentProps<"h3">) {
	return (
		<h3
			data-slot="compare-heading"
			className={cn("mt-monti-32 mb-monti-12 text-monti-heading", className)}
			{...props}
		/>
	);
}

/** A paragraph, or a list, quote or any block that reads as text. Line breaks inside it are kept. */
function CompareParagraph({ className, ...props }: React.ComponentProps<"p">) {
	return <p data-slot="compare-paragraph" className={cn("mb-monti-20 whitespace-pre-line", className)} {...props} />;
}

/** A block that is code, or text the screen has no look for: fixed-width, in the inner box. */
function CompareCode({ className, ...props }: React.ComponentProps<"pre">) {
	return (
		<pre
			data-slot="compare-code"
			className={cn(
				"mb-monti-20 overflow-x-auto whitespace-pre-wrap break-words rounded-monti-lg bg-monti-muted px-monti-16 py-monti-12 text-monti-code",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * A block of the source shown beside its translation (the source pane). `current` while the cursor is in the translation's block paired with it: it
 * is on the block ground, a little wider than its words, so one sees which source block is being translated.
 */
function CompareBlock({ current = false, className, ...props }: React.ComponentProps<"div"> & { current?: boolean }) {
	return (
		<div
			data-slot="compare-block"
			data-current={current || undefined}
			className={cn(
				"relative isolate data-current:before:absolute data-current:before:-inset-x-monti-8 data-current:before:-inset-y-monti-4 data-current:before:-z-10 data-current:before:rounded-monti-md data-current:before:bg-monti-block",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * The source and its translation side by side, block by block: one `CompareRow` per block, so each block sits level with its translation. The first row
 * is the head (`head`): each side's last edit date in the small mono line, under the ink rule.
 */
function CompareRows({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="compare-rows" className={cn("flex flex-col", className)} {...props} />;
}

/**
 * One block in `CompareRows`: its kind in the narrow column on the left ("문단", "콜아웃"), with a note under it in the warning tone when the source (cms-allow-korean)
 * moved since the translation ("원문 변경", "원문에 추가"); the source on the tool ground, quieter; the translation on the page. `current` is the block (cms-allow-korean)
 * being written: the translation side is on the block ground. Mark the words of the source that changed with `Highlight`. The row of the entry's
 * title is `title`: the two titles in `Heading variant="page"`, its name set lower to sit by them.
 */
function CompareRow({
	name,
	note,
	head = false,
	title = false,
	current = false,
	source,
	translation,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children" | "title"> & {
	/** The kind of block ("문단"); empty on the head row. (cms-allow-korean: quotes the words) */
	name?: React.ReactNode;
	/** What happened to the source since it was translated ("원문 변경"), in the warning tone. (cms-allow-korean: quotes the words) */
	note?: React.ReactNode;
	/** The head row: each side's last edit date in the small mono line. */
	head?: boolean;
	/** The title row: the two titles at the page heading size. */
	title?: boolean;
	current?: boolean;
	source: React.ReactNode;
	translation: React.ReactNode;
}) {
	return (
		<div
			data-slot="compare-row"
			data-current={current || undefined}
			data-title={title || undefined}
			className={cn(
				"grid grid-cols-[104px_minmax(0,1fr)_minmax(0,1fr)] items-stretch border-monti-muted border-b last:border-b-0",
				head && "border-t border-t-monti-contrast font-mono text-monti-micro text-monti-subtle",
				className,
			)}
			{...props}
		>
			<span
				className={cn(
					"flex flex-col gap-monti-2 py-monti-16 pr-monti-12 text-right font-mono text-monti-micro text-monti-subtle",
					title && "pt-monti-20",
				)}
			>
				{name}
				{note && <span className="text-monti-warning">{note}</span>}
			</span>
			<div
				className={cn(
					"min-w-0 bg-monti-tool px-monti-24 py-monti-16 **:data-[slot=compare-code]:mb-0 **:data-[slot=compare-code]:bg-monti-selected",
					!head && "text-monti-muted",
				)}
			>
				{source}
			</div>
			<div
				className={cn(
					// 40px before the words: the block handle of the translation written here (24px, 4px off the words) stays inside the cell.
					"min-w-0 border-monti-default border-l py-monti-16 pr-monti-24 pl-monti-40 **:data-[slot=compare-code]:mb-0",
					current && "bg-monti-block",
				)}
			>
				{translation}
			</div>
		</div>
	);
}

/**
 * A block the translation shares with its source (a code block): the source's block in faint letters, and under it the one way out, `action` (a
 * `TextButton variant="underline"`, "따로 고치기"), which makes a copy for this language. Goes in the translation side of a `CompareRow`. (cms-allow-korean)
 */
function CompareShared({
	action,
	className,
	children,
	...props
}: React.ComponentProps<"div"> & { action: React.ReactNode }) {
	return (
		<div
			data-slot="compare-shared"
			className={cn("flex min-w-0 flex-col items-start gap-monti-8 text-monti-faint", className)}
			{...props}
		>
			<div className="w-full">{children}</div>
			{action}
		</div>
	);
}

/** The underline of a source's words that changed since its translation: the warning color of "Changed", whatever ground it sits on. */
const SOURCE_CHANGE = "underline decoration-[1.5px] decoration-monti-warning underline-offset-4";
/** The words the source had before and no longer has (the "before" of a changed block): faint and struck through, as `Del` draws them. */
const SOURCE_REMOVED = "line-through text-monti-faint";

/**
 * A run of the entry's text: the words that `changed` are marked, the others are plain. Two versions of one entry mark them on the highlight; a
 * translation's source (`source`) marks the words that changed since it was translated with an underline in the warning color, which shows on the
 * tool ground and on the block being written alike (2026-11-06 owner). `removed` is the source's words before the change: words it no longer has
 * are faint and struck through instead, so "before" and "after" never mark the same way.
 */
function CompareText({
	changed = false,
	source = false,
	removed = false,
	children,
}: {
	changed?: boolean;
	source?: boolean;
	removed?: boolean;
	children: React.ReactNode;
}) {
	if (!changed) return children;
	if (!source) return <Highlight>{children}</Highlight>;
	// The line runs under the words only: the spaces around a changed run stay outside it.
	const [, before = "", words = children, after = ""] =
		typeof children === "string" ? (/^(\s*)([\s\S]*?)(\s*)$/.exec(children) ?? []) : [];
	return (
		<>
			{before}
			<span data-slot="source-change" className={removed ? SOURCE_REMOVED : SOURCE_CHANGE}>
				{words}
			</span>
			{after}
		</>
	);
}

export {
	Compare,
	CompareBlock,
	CompareBody,
	CompareCode,
	CompareHeading,
	CompareParagraph,
	CompareProperty,
	CompareRow,
	CompareRows,
	CompareShared,
	CompareSide,
	CompareText,
	CompareTitle,
};
