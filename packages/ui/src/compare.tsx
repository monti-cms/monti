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
				"mb-monti-20 overflow-x-auto whitespace-pre-wrap break-words rounded-monti-lg bg-monti-muted px-monti-16 py-monti-12 font-mono text-monti-caption",
				className,
			)}
			{...props}
		/>
	);
}

/** A run of the entry's text: the words that `changed` are on the highlight, the others are plain. */
function CompareText({ changed = false, children }: { changed?: boolean; children: React.ReactNode }) {
	return changed ? <Highlight>{children}</Highlight> : children;
}

export {
	Compare,
	CompareBody,
	CompareCode,
	CompareHeading,
	CompareParagraph,
	CompareProperty,
	CompareSide,
	CompareText,
	CompareTitle,
};
