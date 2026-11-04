"use client";

import type { ComponentProps, ReactNode } from "react";
import { Caret } from "./caret";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";
import { TextButton } from "./text-button";

/** What the admin asked, quoted under the title of the review page. */
function ReviewQuote({ className, ...props }: ComponentProps<"p">) {
	return (
		<p
			data-slot="review-quote"
			className={cn("mt-monti-16 font-normal text-monti-muted text-monti-title", className)}
			{...props}
		/>
	);
}

/**
 * A group of changes on the review page: its name in bold, what and how much in mono ("2 entries · can be undone"), and at the end what applies to the whole
 * group (the "One line / Side by side" tabs, "Leave out all 11"). The group's rows follow it.
 */
function ReviewGroup({
	title,
	meta,
	actions,
	className,
	children,
	...props
}: Omit<ComponentProps<"section">, "title"> & { title: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
	return (
		<section data-slot="review-group" className={cn("mt-monti-32", className)} {...props}>
			<h2 className="flex items-baseline gap-monti-12 border-monti-default border-b pb-monti-12 font-bold text-monti-body">
				{title}
				{meta !== undefined && <span className="font-normal text-monti-meta text-monti-subtle">{meta}</span>}
				{actions !== undefined && (
					<span className="ml-auto flex items-baseline gap-monti-16 font-normal text-monti-note">{actions}</span>
				)}
			</h2>
			{children}
		</section>
	);
}

/** The check that puts a change in or leaves it out. */
function IncludeCheck({
	included,
	onIncludedChange,
	label,
	readOnly = false,
}: {
	included: boolean;
	onIncludedChange?: (included: boolean) => void;
	label: string;
	/** Kept as it was (an applied proposal, a change that can no longer be applied): the read-only check, which cannot be changed. */
	readOnly?: boolean;
}) {
	return (
		<Checkbox
			checked={included}
			onCheckedChange={(checked) => onIncludedChange?.(checked === true)}
			aria-label={label}
			readOnly={readOnly}
			className="mt-[3px]"
		/>
	);
}

/**
 * One change on the review page: the check that puts it in or leaves it out, what it is about (an entry's title in bold and its address in mono), at the end
 * its field or how it went ("Summary", "changed meanwhile · Make again", "✓ moved to 2024"), and under it the change itself ("empty → …"). A row whose change
 * cannot be applied any more is `muted`.
 */
function ReviewItem({
	included,
	onIncludedChange,
	includeLabel,
	readOnly,
	title,
	path,
	end,
	muted = false,
	className,
	children,
	...props
}: Omit<ComponentProps<"div">, "title"> & {
	included: boolean;
	onIncludedChange?: (included: boolean) => void;
	/** The name of the check for a screen reader ("Include"). */
	includeLabel: string;
	/** The check can no longer change: the proposal was applied, or this change cannot be applied any more. */
	readOnly?: boolean;
	title: ReactNode;
	path?: ReactNode;
	end?: ReactNode;
	muted?: boolean;
}) {
	return (
		<div
			data-slot="review-item"
			className={cn(
				"-mx-monti-12 grid grid-cols-[14px_minmax(0,1fr)] items-start gap-x-monti-16 border-monti-muted border-b px-monti-12 py-monti-10 hover:bg-monti-muted",
				className,
			)}
			{...props}
		>
			<IncludeCheck included={included} onIncludedChange={onIncludedChange} label={includeLabel} readOnly={readOnly} />
			<div className="flex min-w-0 flex-col gap-monti-6">
				<div className="flex min-w-0 items-baseline gap-monti-8 whitespace-nowrap">
					<span className="truncate font-semibold">{title}</span>
					{path !== undefined && <span className="truncate font-mono text-monti-faint text-monti-meta">{path}</span>}
					<span className="grow" />
					{end !== undefined && <span className="flex shrink-0 items-baseline gap-monti-8">{end}</span>}
				</div>
				{children !== undefined && (
					<div className={cn(muted && "text-monti-subtle [&_ins]:opacity-60")}>{children}</div>
				)}
			</div>
		</div>
	);
}

/** The column names over side-by-side changes ("Now", "Proposed"). */
function ReviewCompareHead({ before, after }: { before: ReactNode; after: ReactNode }) {
	return (
		<div
			data-slot="review-compare-head"
			className="-mx-monti-12 grid grid-cols-[104px_repeat(2,minmax(0,1fr))] px-monti-12 pt-monti-12 pb-monti-4 text-monti-micro text-monti-subtle"
		>
			<span />
			<span className="px-monti-20">{before}</span>
			<span className="px-monti-20">{after}</span>
		</div>
	);
}

type ReviewBlockProps = {
	included: boolean;
	onIncludedChange?: (included: boolean) => void;
	includeLabel: string;
	readOnly?: boolean;
	/** The block's name ("요약", "문단 1"). */
	label: ReactNode;
	/** A word under the block's name ("mostly rewritten"), in the warning tone. */
	note?: ReactNode;
};

/** The gutter of a change to one block: the check, then the block's name with its note under it. */
function ReviewGutter({ included, onIncludedChange, includeLabel, readOnly, label, note }: ReviewBlockProps) {
	return (
		<span className="flex items-start gap-[10px] py-[15px] pr-monti-12 text-monti-micro text-monti-subtle">
			<IncludeCheck included={included} onIncludedChange={onIncludedChange} label={includeLabel} readOnly={readOnly} />
			<span className="flex flex-col">
				{label}
				{note !== undefined && <b className="font-mono font-normal text-monti-meta text-monti-warning">{note}</b>}
			</span>
		</span>
	);
}

/**
 * One change to a block of an entry, on one line (the "한 줄" view of a group like 다듬기): the check and the block's name in the gutter, as in
 * `ReviewCompare`, then the block's text with the words taken out (`Del`) and put in (`Ins`) where they are.
 */
function ReviewLine({ className, children, ...props }: ReviewBlockProps & { className?: string; children: ReactNode }) {
	return (
		<div
			data-slot="review-line"
			className={cn(
				"-mx-monti-12 grid grid-cols-[104px_minmax(0,1fr)] items-stretch border-monti-muted border-b px-monti-12 hover:bg-monti-muted",
				className,
			)}
		>
			<ReviewGutter {...props} />
			<div className="min-w-0 py-monti-12 text-monti-reading">{children}</div>
		</div>
	);
}

/** One change side by side: the check and the field's name in the gutter, the text as it is now (on the tool ground), and as proposed. */
function ReviewCompare({
	included,
	onIncludedChange,
	includeLabel,
	readOnly,
	label,
	note,
	before,
	after,
}: ReviewBlockProps & {
	before: ReactNode;
	after: ReactNode;
}) {
	return (
		<div
			data-slot="review-compare"
			className="-mx-monti-12 grid grid-cols-[104px_repeat(2,minmax(0,1fr))] items-stretch border-monti-muted border-b px-monti-12"
		>
			<ReviewGutter
				included={included}
				onIncludedChange={onIncludedChange}
				includeLabel={includeLabel}
				readOnly={readOnly}
				label={label}
				note={note}
			/>
			<div className="min-w-0 bg-monti-tool px-monti-20 py-monti-12 text-monti-muted text-monti-reading">{before}</div>
			<div className="min-w-0 border-monti-default border-l px-monti-20 py-monti-12 text-monti-reading">{after}</div>
		</div>
	);
}

/**
 * The way to the rest of a long group, 12px under its rows and on the line of their titles: "6 more ⌄" while folded, "Show fewer ⌃" once open (the same place, the caret turned over).
 */
function ReviewMore({
	open,
	onOpenChange,
	moreLabel,
	lessLabel,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** "6 more". */
	moreLabel: string;
	/** "Show fewer". */
	lessLabel: string;
}) {
	return (
		// The same columns as a row, so it starts on the line of the rows' titles.
		<div data-slot="review-more" className="mt-monti-12 grid grid-cols-[14px_minmax(0,1fr)] gap-x-monti-16">
			<span />
			<span>
				<TextButton variant="quiet" aria-expanded={open} onClick={() => onOpenChange(!open)}>
					{open ? lessLabel : moreLabel}
					<Caret className={cn("transition-transform", open && "rotate-180")} />
				</TextButton>
			</span>
		</div>
	);
}

export { ReviewCompare, ReviewCompareHead, ReviewGroup, ReviewItem, ReviewLine, ReviewMore, ReviewQuote };
