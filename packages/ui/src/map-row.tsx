import { ArrowRight } from "@carbon/icons-react";
import type * as React from "react";
import { cn } from "./cn";

/**
 * A row of "match the fields" in an import: the key from the file (mono) on the left, an arrow, and what it goes into on the right (a `Select`),
 * with one line under it: an example value, or a note in the warning color. A key that is not imported is `off`: its name dims.
 * Give the select `proposal` when the assistant matched it.
 */
function MapRow({
	name,
	example,
	warning,
	off = false,
	children,
}: {
	/** The key as it is in the file. */
	name: string;
	/** An example value from the file. */
	example?: string;
	/** Something to look at before importing, in the warning color. It replaces the example. */
	warning?: string;
	/** This key is not imported. */
	off?: boolean;
	/** The select that picks the field it goes into. */
	children: React.ReactNode;
}) {
	return (
		<div
			data-slot="map-row"
			data-off={off || undefined}
			className="grid grid-cols-[120px_14px_minmax(0,1fr)] items-center gap-x-monti-12 gap-y-monti-2 border-monti-muted border-b py-monti-8 data-off:*:data-[slot=select-trigger]:text-monti-subtle *:data-[slot=select-trigger]:py-monti-4"
		>
			<span className={cn("truncate font-mono text-monti-default text-monti-note", off && "text-monti-faint")}>
				{name}
			</span>
			<ArrowRight aria-hidden className="size-3 justify-self-center text-monti-faint" />
			{children}
			{(warning ?? example) && (
				<span
					className={cn("col-start-3 truncate text-monti-caption", warning ? "text-monti-warning" : "text-monti-faint")}
				>
					{warning ?? example}
				</span>
			)}
		</div>
	);
}

export { MapRow };
