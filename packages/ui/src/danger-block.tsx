import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "./cn";
import { Text } from "./text";

/**
 * The step at the bottom of a settings tab that deletes something with its data: a rule in the danger ink above, the title in the danger ink, and the
 * rows under it (`DangerRow`). The design system's `col-blk` with a danger top rule: 24px above and below, 16px between the title and the rows.
 */
function DangerBlock({
	title,
	className,
	children,
	...props
}: Omit<ComponentProps<"section">, "title" | "aria-labelledby"> & { title: ReactNode }) {
	const titleId = useId();
	return (
		<section
			data-slot="danger-block"
			aria-labelledby={titleId}
			className={cn("mt-monti-24 flex flex-col gap-monti-16 border-monti-danger border-t py-monti-24", className)}
			{...props}
		>
			<h2 id={titleId} className="m-0 text-monti-danger text-monti-title">
				{title}
			</h2>
			{children}
		</section>
	);
}

/**
 * One thing the block can delete: its name, a quiet line of what it holds after it, and the button at the end.
 */
function DangerRow({
	name,
	meta,
	action,
	className,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	name: ReactNode;
	/** What it holds ("23 posts · 2 in the trash"); left out when it is not known. */
	meta?: ReactNode;
	action: ReactNode;
}) {
	return (
		<div data-slot="danger-row" className={cn("flex items-center gap-monti-16", className)} {...props}>
			<span className="grow">
				<Text>{name}</Text>
				{meta ? (
					<>
						{" "}
						<Text variant="meta" tone="subtle">{`· ${meta}`}</Text>
					</>
				) : null}
			</span>
			{action}
		</div>
	);
}

export { DangerBlock, DangerRow };
