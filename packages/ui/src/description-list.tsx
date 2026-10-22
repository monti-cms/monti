import type * as React from "react";
import { cn } from "./cn";

/**
 * Label and value rows (an event's details, a file's information). The label column has one width, so values line up; long values wrap.
 * `layout="stacked"` puts each label above its value, for a narrow panel.
 */
function DescriptionList({
	className,
	layout = "columns",
	...props
}: React.ComponentProps<"dl"> & { layout?: "columns" | "stacked" }) {
	return <dl data-slot="description-list" data-layout={layout} className={cn("flex flex-col", className)} {...props} />;
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
			className={cn(
				"grid grid-cols-[8rem_minmax(0,1fr)] in-data-[layout=stacked]:grid-cols-1 gap-normal in-data-[layout=stacked]:gap-tight py-condensed text-monti-label",
				className,
			)}
			{...props}
		>
			<dt className="text-monti-muted">{label}</dt>
			<dd className="min-w-0 break-words">{children}</dd>
		</div>
	);
}

export { DescriptionItem, DescriptionList };
