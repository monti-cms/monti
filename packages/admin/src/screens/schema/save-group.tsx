"use client";

import { useTranslator } from "@monti-cms/core/site";
import { Button, Caret, Count, Inline, TextButton } from "@monti-cms/ui";
import { schemaMessages } from "./messages";

/**
 * The save group on the right of the Settings title row while the draft differs from the saved file: how many things changed (a button that opens the
 * review), Discard all, and Save and apply (the one primary pill). Review and Save and apply both open the review dialog, which is where the edit is
 * checked and written; Discard all throws the draft away (the screen asks first).
 */
export function SaveGroup({
	count,
	onReview,
	onSave,
	onDiscard,
	disabled,
}: {
	count: number;
	onReview: () => void;
	onSave: () => void;
	onDiscard: () => void;
	/** Saving is not possible (the file has no version to save against). */
	disabled?: boolean;
}) {
	const t = useTranslator(schemaMessages);
	return (
		<Inline as="section" aria-label={t("bar.label")} data-testid="save-bar" gap={16}>
			<TextButton type="button" disabled={disabled} onClick={onReview}>
				{t("bar.review")}{" "}
				<Count tone="warning" aria-label={t("bar.count", { count })}>
					{count}
				</Count>
				<Caret />
			</TextButton>
			<TextButton type="button" onClick={onDiscard}>
				{t("bar.discard")}
			</TextButton>
			<Button type="button" disabled={disabled} onClick={onSave}>
				{t("bar.save")}
			</Button>
		</Inline>
	);
}
