"use client";

import type { ComponentProps, ReactNode } from "react";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";

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
 * A group of changes on the review page: its name in bold, what and how much in mono ("글 2편 · 되돌릴 수 있음"), and at the end what applies to the whole
 * group (the "한 줄 / 나란히" tabs, "11편 모두 빼기"). The group's rows follow it.
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
	disabled,
}: {
	included: boolean;
	onIncludedChange?: (included: boolean) => void;
	label: string;
	disabled?: boolean;
}) {
	return (
		<Checkbox
			checked={included}
			onCheckedChange={(checked) => onIncludedChange?.(checked === true)}
			aria-label={label}
			disabled={disabled}
			className="mt-[3px]"
		/>
	);
}

/**
 * One change on the review page: the check that puts it in or leaves it out, what it is about (an entry's title in bold and its address in mono), at the end
 * its field or how it went ("요약", "이 사이에 고쳐짐 · 다시 만들기", "✓ 2024로 옮김"), and under it the change itself ("비어 있음 → …"). A row whose change
 * cannot be applied any more is `muted`.
 */
function ReviewItem({
	included,
	onIncludedChange,
	includeLabel,
	disabled,
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
	/** The name of the check for a screen reader ("포함"). */
	includeLabel: string;
	disabled?: boolean;
	title: ReactNode;
	path?: ReactNode;
	end?: ReactNode;
	muted?: boolean;
}) {
	return (
		<div
			data-slot="review-item"
			className={cn(
				"grid grid-cols-[14px_minmax(0,1fr)] items-start gap-x-monti-16 border-monti-muted border-b px-monti-12 py-monti-10 hover:bg-monti-muted",
				className,
			)}
			{...props}
		>
			<IncludeCheck included={included} onIncludedChange={onIncludedChange} label={includeLabel} disabled={disabled} />
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

/** The column names over side-by-side changes ("지금", "제안"). */
function ReviewCompareHead({ before, after }: { before: ReactNode; after: ReactNode }) {
	return (
		<div
			data-slot="review-compare-head"
			className="grid grid-cols-[104px_repeat(2,minmax(0,1fr))] px-monti-12 pt-monti-12 pb-monti-4 text-monti-micro text-monti-subtle"
		>
			<span />
			<span className="px-monti-20">{before}</span>
			<span className="px-monti-20">{after}</span>
		</div>
	);
}

/** One change side by side: the check and the field's name in the gutter, the text as it is now (on the tool ground), and as proposed. */
function ReviewCompare({
	included,
	onIncludedChange,
	includeLabel,
	label,
	note,
	before,
	after,
}: {
	included: boolean;
	onIncludedChange?: (included: boolean) => void;
	includeLabel: string;
	label: ReactNode;
	/** A word under the field's name ("거의 다시 씀"), in the warning tone. */
	note?: ReactNode;
	before: ReactNode;
	after: ReactNode;
}) {
	return (
		<div
			data-slot="review-compare"
			className="grid grid-cols-[104px_repeat(2,minmax(0,1fr))] items-stretch border-monti-muted border-b px-monti-12"
		>
			<span className="flex items-start gap-[10px] py-[15px] pr-monti-12 text-monti-micro text-monti-subtle">
				<IncludeCheck included={included} onIncludedChange={onIncludedChange} label={includeLabel} />
				<span className="flex flex-col">
					{label}
					{note !== undefined && <b className="font-mono font-normal text-monti-meta text-monti-warning">{note}</b>}
				</span>
			</span>
			<div className="min-w-0 bg-monti-tool px-monti-20 py-monti-12 text-monti-muted text-monti-reading">{before}</div>
			<div className="min-w-0 border-monti-default border-l px-monti-20 py-monti-12 text-monti-reading">{after}</div>
		</div>
	);
}

export { ReviewCompare, ReviewCompareHead, ReviewGroup, ReviewItem, ReviewQuote };
