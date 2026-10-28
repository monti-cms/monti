"use client";

import { Document } from "@carbon/icons-react";
import type * as React from "react";
import { cn } from "./cn";

/**
 * A file in the body of an entry: a one-line box with the file icon (16px), the name, and the kind and size in mono at the end ("PDF · 1.2 MB").
 * With `onNameChange` the name is a field that reads as text, so the shown name can be changed in place; `name` is then its value, and
 * `placeholder` is what shows while it is empty (the file's own name).
 */
function FileBlock({
	name,
	meta,
	icon,
	placeholder,
	nameLabel,
	onNameChange,
	disabled,
	tone = "default",
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children" | "title"> & {
	name: string;
	/** Kind and size, or why the file cannot be shown. */
	meta: React.ReactNode;
	/** Defaults to the file icon. */
	icon?: React.ReactNode;
	placeholder?: string;
	/** The name of the field, for screen readers. */
	nameLabel?: string;
	onNameChange?: (name: string) => void;
	disabled?: boolean;
	/** `danger` when the file cannot be found. */
	tone?: "default" | "danger";
}) {
	return (
		<div
			data-slot="file-block"
			role="group"
			className={cn(
				"flex items-center gap-monti-12 rounded-monti-lg border border-monti-default bg-monti-page px-monti-16 py-monti-12",
				className,
			)}
			{...props}
		>
			<span className="flex flex-none text-monti-subtle [&_svg]:size-4">{icon ?? <Document aria-hidden />}</span>
			{onNameChange ? (
				<input
					aria-label={nameLabel}
					value={name}
					placeholder={placeholder}
					disabled={disabled}
					// Typed characters stay in the field and out of the document.
					onKeyDown={(event) => event.stopPropagation()}
					onChange={(event) => onNameChange(event.target.value)}
					className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-monti-body text-monti-default outline-none placeholder:text-monti-default"
				/>
			) : (
				<span className="min-w-0 flex-1 truncate text-monti-body">{name || placeholder}</span>
			)}
			<span
				className={cn(
					"flex-none font-mono text-monti-meta",
					tone === "danger" ? "text-monti-danger" : "text-monti-subtle",
				)}
			>
				{meta}
			</span>
		</div>
	);
}

export { FileBlock };
