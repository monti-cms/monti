"use client";

import { useEffect, useRef } from "react";
import { cn } from "./cn";

/**
 * The name of a new folder, or of one being renamed, edited where it stands (no dialog): it opens with the whole name selected, so typing
 * replaces it. Enter and leaving the field keep the name; Escape drops the change. In a folder tile it fills the tile (`fill`); in a row it sits
 * 200px wide with its text on the line of the other names.
 */
function RenameField({
	value,
	onValueChange,
	onCommit,
	onCancel,
	label,
	fill = false,
	className,
}: {
	value: string;
	onValueChange: (value: string) => void;
	/** Enter, or the field loses focus. Called once. */
	onCommit: (value: string) => void;
	/** Escape. */
	onCancel: () => void;
	/** The name of the field, for screen readers. */
	label: string;
	/** Grows to the room it has, with no offset: for a folder tile. */
	fill?: boolean;
	className?: string;
}) {
	const input = useRef<HTMLInputElement>(null);
	const done = useRef(false);
	useEffect(() => {
		input.current?.focus();
		input.current?.select();
	}, []);
	const finish = (action: () => void) => {
		if (done.current) return;
		done.current = true;
		action();
	};
	return (
		<input
			ref={input}
			data-slot="rename-field"
			aria-label={label}
			value={value}
			onChange={(event) => onValueChange(event.target.value)}
			onKeyDown={(event) => {
				if (event.nativeEvent.isComposing) return;
				if (event.key === "Enter") finish(() => onCommit(value));
				if (event.key === "Escape") finish(onCancel);
			}}
			onBlur={() => finish(() => onCommit(value))}
			className={cn(
				"h-7 rounded-monti-md border border-monti-contrast bg-monti-page px-monti-8 text-monti-body text-monti-default outline-none selection:bg-monti-highlight",
				fill ? "min-w-0 grow" : "-ml-[9px] min-w-50",
				className,
			)}
		/>
	);
}

export { RenameField };
