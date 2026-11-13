"use client";

import * as React from "react";
import { CutWords } from "./cut-words";
import { Text } from "./text";
import { TextButton } from "./text-button";

/**
 * One place that uses a file, in the file's panel: its title goes there, and at the end stands where in it the file is ("Cover · Body"). However long the title, the row stays
 * one line: the title is cut with "…" and the places keep their room. The title is the panel's own text size (`note`), not larger than the values above it, and
 * the places are words a size under it (`caption`).
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
			<TextButton size="note" href={href} onClick={onClick} className="flex min-w-0">
				<CutWords>{title}</CutWords>
			</TextButton>
			<Text variant="caption" tone="subtle" className="shrink-0 whitespace-nowrap">
				{places}
			</Text>
		</div>
	);
}

/**
 * The use rows under their label: 8px below the label, so it heads them, and 4px between the rows. With no rows, `empty` says so ("Not used") where the first row
 * would stand.
 */
function FileUseList({ empty, children }: { empty?: string; children?: React.ReactNode }) {
	return (
		<div data-slot="file-use-list" className="flex min-w-0 flex-col gap-monti-4 pt-monti-4">
			{React.Children.count(children) === 0 && empty ? (
				<Text variant="note" tone="faint">
					{empty}
				</Text>
			) : (
				children
			)}
		</div>
	);
}

export { FileUseList, FileUseRow };
