"use client";

import type * as React from "react";
import { Text } from "./text";
import { TextButton } from "./text-button";

/**
 * One place that uses a file, in the file's panel: its title goes there, and at the end stands where in it the file is ("Cover · Body"). However long the title, the row stays
 * one line: the title is cut with "…" and the places keep their room.
 */
function FileUseRow({
	title,
	places,
	href,
	onClick,
}: {
	title: string;
	/** Where in it the file is. */
	places: React.ReactNode;
	href: string;
	onClick?: React.MouseEventHandler;
}) {
	return (
		<div data-slot="file-use-row" className="flex min-w-0 items-center justify-between gap-monti-8">
			{/* The words are cut inside the button, so what cuts them does not also cut its pressable room. */}
			<TextButton href={href} title={title} onClick={onClick} className="flex min-w-0">
				<span className="truncate">{title}</span>
			</TextButton>
			<Text variant="micro" tone="subtle" className="shrink-0 whitespace-nowrap">
				{places}
			</Text>
		</div>
	);
}

export { FileUseRow };
