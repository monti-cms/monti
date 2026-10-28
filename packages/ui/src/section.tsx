import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "./cn";

/**
 * One section of a settings screen: the title in a column on the left, the fields beside it, and a hairline under. When the screen is narrow
 * the fields wrap under the title. `id` is the anchor a link can land on.
 */
function Section({
	title,
	children,
	className,
	...props
}: Omit<ComponentProps<"section">, "title" | "aria-labelledby"> & {
	title: ReactNode;
	children: ReactNode;
}) {
	const titleId = useId();
	return (
		<section
			data-slot="section"
			aria-labelledby={titleId}
			className={cn("flex flex-wrap gap-x-monti-40 gap-y-monti-8 border-monti-muted border-b py-monti-24", className)}
			{...props}
		>
			<h2 id={titleId} className="mt-monti-6 mb-0 flex-[1_1_180px] text-monti-title">
				{title}
			</h2>
			<div className="flex min-w-0 flex-[999_1_420px] flex-col gap-monti-16">{children}</div>
		</section>
	);
}

export { Section };
