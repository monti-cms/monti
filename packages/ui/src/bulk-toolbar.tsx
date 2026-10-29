import type * as React from "react";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";
import { PageToolbar, PageToolbarEnd, type SelectAll, ToolbarDivider } from "./page-header";
import { TextButton } from "./text-button";

/**
 * What takes the place of a grid's filter row once tiles are picked (a grid has no head row to replace, so the bar is a toolbar row: the same 48px and the same
 * line as the filter row it hides). How many are picked in bold, the actions (`children`: text buttons and menu buttons, set apart from the count by a rule) and,
 * at the end, the way to let go. The select-all hangs in the left margin on the line of the tiles' checks and is always shown.
 */
function BulkToolbar({
	label,
	selectAll,
	clearLabel,
	onClear,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	/** How many are picked ("3 selected"). */
	label: string;
	selectAll?: SelectAll;
	/** The text of the button that clears the pick. */
	clearLabel: string;
	onClear: () => void;
	/** The actions: text buttons, menu buttons. */
	children?: React.ReactNode;
}) {
	return (
		<PageToolbar
			inset
			data-slot="bulk-toolbar"
			role="toolbar"
			aria-label={label}
			className={cn("relative text-monti-body text-monti-default", className)}
			{...props}
		>
			{selectAll && (
				<span data-slot="select-all" className="absolute top-1/2 -left-[26px] z-1 flex -translate-y-1/2">
					<Checkbox
						checked={selectAll.state === "all"}
						indeterminate={selectAll.state === "some"}
						onCheckedChange={(next) => selectAll.onChange(next === true)}
						aria-label={selectAll.label}
						className="bg-monti-page"
					/>
				</span>
			)}
			<b className="font-bold">{label}</b>
			{children && <ToolbarDivider />}
			{children}
			<PageToolbarEnd>
				<TextButton variant="quiet" onClick={onClear}>
					{clearLabel}
				</TextButton>
			</PageToolbarEnd>
		</PageToolbar>
	);
}

export { BulkToolbar };
