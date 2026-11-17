import type * as React from "react";
import { cn } from "./cn";

/** A list of short lines: `bullet` marks each with a dot (what a step will do, what a folder holds); `none` is a plain column. */
function List({
	className,
	marker = "bullet",
	ordered = false,
	...props
}: React.ComponentProps<"ul"> & { marker?: "bullet" | "none"; ordered?: boolean }) {
	const Tag = (ordered ? "ol" : "ul") as React.ElementType;
	return (
		<Tag
			data-slot="list"
			className={cn(
				"flex flex-col gap-monti-4 text-monti-label",
				marker === "bullet" && (ordered ? "list-decimal pl-monti-16" : "list-disc pl-monti-16"),
				className,
			)}
			{...props}
		/>
	);
}

function ListItem({ className, ...props }: React.ComponentProps<"li">) {
	return <li data-slot="list-item" className={cn("marker:text-monti-subtle", className)} {...props} />;
}

export { List, ListItem };
