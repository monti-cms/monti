import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const changeVariants = cva(
	"grid grid-cols-[48px_minmax(0,1fr)] items-baseline gap-monti-12 border-monti-muted border-b py-monti-16 *:data-[slot=change-body]:col-start-2 [&_[data-slot=radio-group]]:gap-monti-10 [&_:is([data-slot=option],[data-slot=radio-item])]:text-monti-note [&_:is([data-slot=option],[data-slot=radio-item])]:text-monti-muted [&_:is([data-slot=option],[data-slot=radio-item]):has([data-checked])]:text-monti-default",
	{
		variants: {
			/** What the change is: a new field (green), an edit (yellow), a removal (red). */
			kind: {
				new: "*:data-[slot=change-tag]:text-monti-success",
				edit: "*:data-[slot=change-tag]:text-monti-warning",
				drop: "*:data-[slot=change-tag]:text-monti-danger",
			},
		},
	},
);

/**
 * One change in the review that opens before a schema is saved: a tag for the kind, the name in bold with its key at the end of the line, and under
 * them, from the same left edge, what to do with the data already saved (radio choices, a result line, a list of what is affected). `tag` is the app's word
 * ("New", "Edit", "Removed"). Choices are `Option` rows with a radio or a check; their text is 13px, one step under the name.
 */
function ChangeGroup({
	kind,
	tag,
	title,
	identifier,
	className,
	children,
	...props
}: Omit<ComponentProps<"section">, "title"> &
	VariantProps<typeof changeVariants> & {
		kind: "new" | "edit" | "drop";
		tag: string;
		title: ReactNode;
		/** The key as written in the schema ("summary → excerpt"). */
		identifier?: string;
	}) {
	return (
		<section data-slot="change-group" data-kind={kind} className={cn(changeVariants({ kind }), className)} {...props}>
			<span data-slot="change-tag" className="whitespace-nowrap font-mono text-monti-micro">
				{tag}
			</span>
			<span className="flex min-w-0 items-baseline gap-monti-12 text-monti-body">
				<b className="truncate font-semibold">{title}</b>
				{identifier && (
					<span className="ml-auto whitespace-nowrap font-mono text-monti-meta text-monti-subtle">{identifier}</span>
				)}
			</span>
			<div data-slot="change-body" className="flex min-w-0 flex-col gap-monti-10">
				{children}
			</div>
		</section>
	);
}

/** The result of the choice, in one line. `danger` when it cannot be undone. */
function ChangeNote({ danger = false, className, ...props }: ComponentProps<"p"> & { danger?: boolean }) {
	return (
		<p
			data-slot="change-note"
			className={cn("m-0 text-monti-note", danger ? "text-monti-danger" : "text-monti-subtle", className)}
			{...props}
		/>
	);
}

/** The name of a part of a change ("what goes", "keep a copy"), over the `ChangeLines` it labels: mono, small, in the subtle ink. */
function ChangeLabel({ className, ...props }: ComponentProps<"span">) {
	return (
		<span
			data-slot="change-label"
			className={cn("not-first:mt-monti-6 font-mono text-monti-micro text-monti-subtle first:mt-0", className)}
			{...props}
		/>
	);
}

/** What the change touches: `ChangeLine`s, the thing on the left and what happens to it on the right. */
function ChangeLines({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="change-lines"
			className={cn("m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-monti-16 gap-y-monti-6 text-monti-note", className)}
			{...props}
		/>
	);
}

/**
 * One line of `ChangeLines`. `then` is what happens: plain, `danger` for what is deleted, `warning` for what blocks the change (put the button that
 * clears it there).
 */
function ChangeLine({
	what,
	then,
	tone = "default",
}: {
	what: ReactNode;
	then: ReactNode;
	tone?: "default" | "danger" | "warning";
}) {
	return (
		<>
			<span className="min-w-0 text-monti-muted">{what}</span>
			<span
				className={cn(
					"whitespace-nowrap text-right",
					tone === "default" && "text-monti-default",
					tone === "danger" && "text-monti-danger",
					tone === "warning" && "text-monti-warning",
				)}
			>
				{then}
			</span>
		</>
	);
}

/** The buttons a change ends with, in one row. */
function ChangeActions({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="change-actions"
			className={cn("flex items-center gap-monti-16 text-monti-note", className)}
			{...props}
		/>
	);
}

export { ChangeActions, ChangeGroup, ChangeLabel, ChangeLine, ChangeLines, ChangeNote };
