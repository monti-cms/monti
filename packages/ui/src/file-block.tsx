"use client";

import type * as React from "react";
import { cn } from "./cn";
import { IconButtonContext } from "./icon-button";
import { Document } from "./icons";

/**
 * A file in the body of an entry: a one-line box with the file icon (16px), the name, and the kind and size in mono at the end ("PDF · 1.2 MB").
 * It holds no field: the block is one thing in the text, and the name it shows is written in its settings (screens/editor.md).
 */
function FileBlock({
	name,
	meta,
	icon,
	selected = false,
	tone = "default",
	action,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children" | "title"> & {
	name: string;
	/** Kind and size, or why the file cannot be shown. */
	meta: React.ReactNode;
	/** Defaults to the file icon. */
	icon?: React.ReactNode;
	/** The block is selected in the text: it is one thing, chosen whole. */
	selected?: boolean;
	/** `danger` when the file cannot be found or did not go up. */
	tone?: "default" | "danger";
	/** A control of the file's own at the end (trying again): 24px, and it does not make the box taller. */
	action?: React.ReactNode;
}) {
	return (
		<div
			data-slot="file-block"
			role="group"
			className={cn(
				"flex items-center gap-monti-12 rounded-monti-lg border bg-monti-page px-monti-16 py-monti-12",
				selected ? "border-monti-contrast" : "border-monti-default",
				// In a picked block's box (`BlockBox selected`) the box's 2px line says it: the block's own border steps aside, so there is one line.
				"group-data-selected/block-box:border-transparent",
				className,
			)}
			{...props}
		>
			<span className="flex flex-none text-monti-subtle [&_svg]:size-4">{icon ?? <Document aria-hidden />}</span>
			<span className="min-w-0 flex-1 truncate text-monti-body">{name}</span>
			<span
				className={cn(
					"flex-none font-mono text-monti-meta",
					tone === "danger" ? "text-monti-danger" : "text-monti-subtle",
				)}
			>
				{meta}
			</span>
			{action && (
				<span className="-my-monti-4 -mr-monti-4 flex flex-none">
					<IconButtonContext value={{ size: "xs" }}>{action}</IconButtonContext>
				</span>
			)}
		</div>
	);
}

export { FileBlock };
