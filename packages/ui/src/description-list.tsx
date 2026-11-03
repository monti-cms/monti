"use client";

import * as React from "react";
import { cn } from "./cn";

type DescriptionListVariant = "default" | "summary";

const VariantContext = React.createContext<DescriptionListVariant>("default");

/**
 * Label and value rows (an event's details, a file's information). The label column is 76px wide, so values line up; long values wrap. Labels are quiet,
 * values a step darker, both at the regular weight. `summary` is a count of what something holds (what a backup restores): a 120px label column, values
 * in ink, a quiet note after a value in `Text variant="meta" tone="subtle"`.
 */
function DescriptionList({
	variant = "default",
	className,
	...props
}: React.ComponentProps<"dl"> & { variant?: DescriptionListVariant }) {
	return (
		<VariantContext.Provider value={variant}>
			<dl
				data-slot="description-list"
				data-variant={variant}
				className={cn("m-0 flex flex-col gap-y-monti-8 text-monti-note", className)}
				{...props}
			/>
		</VariantContext.Provider>
	);
}

function DescriptionItem({
	label,
	children,
	mono = false,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	label: React.ReactNode;
	children: React.ReactNode;
	/** The value is an identifier or a model name, in mono. */
	mono?: boolean;
}) {
	const summary = React.useContext(VariantContext) === "summary";
	return (
		<div
			data-slot="description-item"
			className={cn(
				"grid gap-x-monti-12",
				summary ? "grid-cols-[120px_minmax(0,1fr)]" : "grid-cols-[76px_minmax(0,1fr)]",
				className,
			)}
			{...props}
		>
			<dt className="text-monti-subtle">{label}</dt>
			<dd
				className={cn(
					"m-0 min-w-0 break-words",
					summary ? "text-monti-default" : "text-monti-muted",
					mono && "font-mono",
				)}
			>
				{children}
			</dd>
		</div>
	);
}

/**
 * One line of a list of how many of each kind something holds (what an export puts in its archive): the kind on the left, its count in mono at the
 * right end. Each kind is its own line ("글 1", "분류 1"), never two kinds summed on one. Put them in a column under a `Label`.
 */
function CountRow({ label, count }: { label: React.ReactNode; count: React.ReactNode }) {
	return (
		<div
			data-slot="count-row"
			className="flex items-baseline justify-between gap-monti-12 py-monti-6 text-monti-muted text-monti-note"
		>
			<span className="min-w-0">{label}</span>
			<span className="shrink-0 text-monti-meta">{count}</span>
		</div>
	);
}

export { CountRow, DescriptionItem, DescriptionList };
