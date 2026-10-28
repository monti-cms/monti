import type * as React from "react";
import { cn } from "./cn";

/**
 * Label and value rows (an event's details, a file's information). The label column is 76px wide, so values line up; long values wrap. Labels are quiet,
 * values a step darker, both at the regular weight.
 */
function DescriptionList({ className, ...props }: React.ComponentProps<"dl">) {
	return (
		<dl
			data-slot="description-list"
			className={cn("m-0 flex flex-col gap-y-monti-8 text-monti-note", className)}
			{...props}
		/>
	);
}

function DescriptionItem({
	label,
	children,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & { label: React.ReactNode; children: React.ReactNode }) {
	return (
		<div
			data-slot="description-item"
			className={cn("grid grid-cols-[76px_minmax(0,1fr)] gap-x-monti-12", className)}
			{...props}
		>
			<dt className="text-monti-subtle">{label}</dt>
			<dd className="m-0 min-w-0 break-words text-monti-muted">{children}</dd>
		</div>
	);
}

export { DescriptionItem, DescriptionList };
