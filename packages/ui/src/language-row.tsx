import type * as React from "react";
import { ChangeDot } from "./change-dot";
import { cn } from "./cn";
import { Grip } from "./grip";
import { ToolbarDivider } from "./page-header";

/**
 * One content language in Settings › Languages. Its name written in itself leads, then the code in mono and, when it differs, the display name in the admin
 * language ("English en · display name"). Names come from the code and are never edited, so a row has no input. At the end of the row sits `children`: the quiet × that
 * takes the language out, or the {@link LanguageSource} mark on the source row. `handle` is the drag handle (a {@link LanguageRowHandle}); a list whose rows can
 * be moved sets `handled` on every row, so a row without a handle (the source) keeps its column. `dot` is the name of the change dot ("new", "source changed").
 */
function LanguageRow({
	name,
	code,
	label,
	dot,
	gone = false,
	handle,
	handled = false,
	drag,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"li">, "children"> & {
	/** The language's name written in itself. */
	name: React.ReactNode;
	code: string;
	/** The display name; shown only when it differs from `name`. */
	label?: string;
	dot?: string;
	/** The language is taken out and the file is not saved yet: the row stays, struck through and faint, with the dot saying so. */
	gone?: boolean;
	handle?: React.ReactNode;
	handled?: boolean;
	/** While the row is dragged: where the drag has moved it (the sortable's transform and transition) and whether it is the row in hand. */
	drag?: { transform?: string; transition?: string; active?: boolean };
	children?: React.ReactNode;
}) {
	return (
		<li
			data-slot="language-row"
			className={cn(
				"grid items-center gap-x-monti-12 border-monti-muted border-b py-monti-10 hover:bg-monti-muted",
				handled ? "grid-cols-[16px_minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]",
				drag?.active && "relative z-10 bg-monti-page opacity-80 shadow-monti-floating",
				className,
			)}
			style={drag ? { transform: drag.transform, transition: drag.transition } : undefined}
			{...props}
		>
			{handled && <span className="flex items-center justify-center">{handle}</span>}
			<span className={cn("min-w-0 truncate whitespace-nowrap", gone && "text-monti-faint line-through")}>
				<span className={cn("text-monti-body", !gone && "text-monti-default")}>{name}</span>{" "}
				<span className="text-monti-faint text-monti-meta">{code}</span>
				{label && label !== name && <span className="text-monti-note text-monti-subtle"> · {label}</span>}
				{dot && <ChangeDot label={dot} className="ml-monti-6 align-middle" />}
			</span>
			<span className="flex items-center justify-end">{children}</span>
		</li>
	);
}

/** The drag handle of a {@link LanguageRow}: six dots, faint until pointed at. Give it the sortable's `ref` and listeners, and a name that says whose row it moves. */
function LanguageRowHandle({ className, ...props }: Omit<React.ComponentProps<"button">, "children" | "type">) {
	return (
		<button
			type="button"
			data-slot="language-row-handle"
			className={cn(
				"flex cursor-grab touch-none items-center justify-center rounded-monti-sm text-monti-faint outline-none hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/20",
				className,
			)}
			{...props}
		>
			<Grip />
		</button>
	);
}

/**
 * The end of the source language's row: the bold flag that says it is the source, a rule, and `children`, the one quiet underlined text button that changes it.
 * The state and the button that changes it stand together at the end, apart from the pale language info at the start. Without `children` (a list that cannot be
 * edited) only the flag shows.
 */
function LanguageSource({ flag, children }: { flag: React.ReactNode; children?: React.ReactNode }) {
	return (
		<span data-slot="language-source" className="inline-flex items-center">
			<span className="font-semibold text-monti-default text-monti-note">{flag}</span>
			{children && (
				<>
					<ToolbarDivider className="mx-monti-12" />
					{children}
				</>
			)}
		</span>
	);
}

export { LanguageRow, LanguageRowHandle, LanguageSource };
