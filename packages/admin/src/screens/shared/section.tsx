import type { ReactNode } from "react";
import { cn } from "../../lib/utils/cn";
import { Panel } from "../../ui/card";

/**
 * One section of a settings screen: the title and a one-line description in a column on the left, the content in a card on the right (stacked on a narrow
 * screen). A section is page > section > rows: the card holds fields or one list, never another bordered box.
 */
export function Section({
	title,
	description,
	note,
	children,
	wide,
	card = true,
	band,
	className,
	testId,
	id,
}: {
	title: ReactNode;
	description?: ReactNode;
	/** A quieter line under the description (what cannot be changed, a warning about the file). */
	note?: ReactNode;
	children: ReactNode;
	/** The left column is 260px (a page of its own) instead of 220px (inside a collection). */
	wide?: boolean;
	/** `false` when the content is a card of its own (a list of rows with its own header). */
	card?: boolean;
	/** A band instead of a card: the content sits on the page, and a hairline above the section separates it from the one before. */
	band?: boolean;
	className?: string;
	testId?: string;
	/** Anchor of the section, so a link can land on it (`#id`). */
	id?: string;
}) {
	return (
		<section
			id={id}
			data-testid={testId}
			className={cn(
				"grid scroll-mt-6 gap-x-8 gap-y-3 lg:items-start",
				wide ? "lg:grid-cols-[260px_minmax(0,1fr)]" : "lg:grid-cols-[220px_minmax(0,1fr)]",
				band && "border-t pt-8 first:border-t-0 first:pt-0",
				className,
			)}
		>
			<div>
				<h3 className="font-semibold text-base">{title}</h3>
				{description && <p className="mt-1.5 text-monti-muted-foreground text-sm leading-relaxed">{description}</p>}
				{note && <p className="mt-2.5 text-monti-muted-foreground text-xs leading-relaxed">{note}</p>}
			</div>
			{band ? (
				<div className="flex min-w-0 flex-col gap-6">{children}</div>
			) : card ? (
				<Panel className="flex min-w-0 flex-col gap-6 p-5">{children}</Panel>
			) : (
				<div className="min-w-0">{children}</div>
			)}
		</section>
	);
}
