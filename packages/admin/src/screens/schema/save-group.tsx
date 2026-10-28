"use client";

import { useTranslator } from "@monti-cms/core/site";
import {
	Button,
	Caret,
	Count,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	Inline,
	MenuShortcut,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { useState } from "react";
import { schemaMessages } from "./messages";

/** A collection the draft took out of the list: its name, and what brings it back. */
export interface RemovedCollection {
	readonly name: string;
	readonly label: string;
	readonly onRestore: () => void;
}

/**
 * The save group on the right of the Settings title row while the draft differs from the saved file: how many things changed, Discard all, and Save and
 * apply (the one primary pill). Save and apply opens the review dialog, which is where the edit is checked and written; Discard all throws the draft away
 * (the screen asks first). The count is a button that opens the review; while the draft has collections taken out of the list it opens a menu of them instead,
 * each with the button that brings it back.
 */
export function SaveGroup({
	count,
	removed = [],
	onReview,
	onSave,
	onDiscard,
	disabled,
}: {
	count: number;
	removed?: readonly RemovedCollection[];
	onReview: () => void;
	onSave: () => void;
	onDiscard: () => void;
	/** Saving is not possible (the file has no version to save against). */
	disabled?: boolean;
}) {
	const t = useTranslator(schemaMessages);
	// The menu hangs from the whole group, its right edge on the group's.
	const [group, setGroup] = useState<HTMLElement | null>(null);
	const label = (
		<>
			{t("bar.review")}{" "}
			<Count tone="warning" aria-label={t("bar.count", { count })}>
				{count}
			</Count>
			<Caret />
		</>
	);
	return (
		<Inline ref={setGroup} as="section" aria-label={t("bar.label")} data-testid="save-bar" gap={16}>
			{removed.length > 0 ? (
				<DropdownMenu>
					<DropdownMenuTrigger render={<TextButton disabled={disabled} aria-label={t("bar.list")} />}>
						{label}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" anchor={group ?? undefined} width="panel">
						{removed.map((item) => (
							<DropdownMenuItem key={item.name} onClick={item.onRestore}>
								<Inline as="span" gap={4}>
									{item.label}{" "}
									<Text variant="meta" tone="danger">
										{t("bar.removed")}
									</Text>
								</Inline>
								<MenuShortcut>{t("bar.undo")}</MenuShortcut>
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			) : (
				<TextButton type="button" disabled={disabled} onClick={onReview}>
					{label}
				</TextButton>
			)}
			<TextButton type="button" onClick={onDiscard}>
				{t("bar.discard")}
			</TextButton>
			<Button type="button" disabled={disabled} onClick={onSave}>
				{t("bar.save")}
			</Button>
		</Inline>
	);
}
