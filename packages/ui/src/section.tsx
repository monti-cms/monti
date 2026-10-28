import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "./cn";

/**
 * One section of a settings screen: the title in a column on the left, the fields beside it, and a hairline under. When the screen is narrow
 * the fields wrap under the title; `stacked` always puts them under it. `id` is the anchor a link can land on.
 */
function Section({
	title,
	children,
	last = false,
	stacked = false,
	className,
	...props
}: Omit<ComponentProps<"section">, "title" | "aria-labelledby"> & {
	title: ReactNode;
	children: ReactNode;
	/** The title over the fields instead of beside them: a section in a column that is already narrow (a collection's basics). */
	stacked?: boolean;
	/** The last section of the page: no hairline under it. */
	last?: boolean;
}) {
	const titleId = useId();
	return (
		<section
			data-slot="section"
			aria-labelledby={titleId}
			className={cn(
				"border-monti-muted py-monti-24",
				stacked ? "flex flex-col gap-monti-16" : "flex flex-wrap gap-x-monti-40 gap-y-monti-8",
				!last && "border-b",
				className,
			)}
			{...props}
		>
			<h2 id={titleId} className={cn("mb-0 text-monti-title", stacked ? "mt-0" : "mt-monti-6 flex-[1_1_180px]")}>
				{title}
			</h2>
			{stacked ? children : <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-monti-16">{children}</div>}
		</section>
	);
}

export { Section };
