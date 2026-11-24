import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "./cn";

/**
 * One section of a settings screen: the title in a column on the left, the fields beside it, and a hairline under. When the screen is narrow
 * the fields wrap under the title; `stacked` always puts them under it, and stacked sections are parted by space alone, with no hairline. `dense` is a group of options inside a stacked section's column (a collection's
 * editor options): 20px above and below, its title 12px over them. `id` is the anchor a link can land on.
 */
function Section({
	title,
	children,
	last = false,
	stacked = false,
	dense = false,
	layout = "flow",
	description,
	className,
	...props
}: Omit<ComponentProps<"section">, "title" | "aria-labelledby"> & {
	/**
	 * `flow` (the default): as described above. `grid`: the settings and tools pages of the 2026-11 redesign: a 200px column for the title (14px 600) and
	 * its `description` (12px, faint, wrapping inside 190px), 40px, then the fields 20px apart; 28px above and below, a `border-muted` line under it.
	 */
	layout?: "flow" | "grid";
	/** With `layout="grid"`: a short line under the title, saying what the section is for. */
	description?: ReactNode;
	title: ReactNode;
	children: ReactNode;
	/** The title over the fields instead of beside them: a section in a column that is already narrow (a collection's basics). */
	stacked?: boolean;
	/** The last section of the page: no hairline under it (stacked sections have none anyway). */
	last?: boolean;
	/** A group of options in a stacked column: 20px above and below, the title 12px over them. Always stacked. */
	dense?: boolean;
}) {
	const titleId = useId();
	if (layout === "grid")
		return (
			<section
				data-slot="section"
				data-layout={layout}
				aria-labelledby={titleId}
				className={cn(
					"grid grid-cols-[200px_minmax(0,1fr)] gap-x-monti-40 border-monti-muted py-[28px]",
					!last && "border-b",
					className,
				)}
				{...props}
			>
				<div className="flex min-w-0 flex-col gap-monti-6">
					<h2 id={titleId} className="m-0 font-semibold text-monti-body">
						{title}
					</h2>
					{description && (
						<p className="m-0 max-w-[190px] break-keep text-monti-caption text-monti-faint">{description}</p>
					)}
				</div>
				<div className="flex min-w-0 flex-col gap-monti-20">{children}</div>
			</section>
		);
	return (
		<section
			data-slot="section"
			aria-labelledby={titleId}
			className={cn(
				"border-monti-muted",
				dense ? "flex flex-col gap-monti-12 py-monti-20" : "py-monti-24",
				dense ? undefined : stacked ? "flex flex-col gap-monti-16" : "flex flex-wrap gap-x-monti-40 gap-y-monti-8",
				!last && !stacked && !dense && "border-b",
				className,
			)}
			{...props}
		>
			<h2 id={titleId} className={cn("mb-0 text-monti-title", stacked || dense ? "mt-0" : "mt-0 flex-[1_1_180px]")}>
				{title}
			</h2>
			{stacked || dense ? (
				children
			) : (
				<div className="flex min-w-0 flex-[999_1_420px] flex-col gap-monti-24">{children}</div>
			)}
		</section>
	);
}

export { Section };
