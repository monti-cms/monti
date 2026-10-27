"use client";

import { useTranslator } from "@monti-cms/core/site";
import { Button, Inline, StatusIndicator, Text, TextButton } from "@monti-cms/ui";
import { schemaMessages } from "./messages";

/**
 * The bar at the bottom of the Settings content while the draft differs from the saved file: how many things changed, and the ways on. Review and Save and apply both
 * open the review dialog, which is where the edit is checked and written; Discard all throws the draft away (the screen asks first).
 */
export function SaveBar({
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
		<Inline
			as="section"
			aria-label={t("bar.label")}
			data-testid="save-bar"
			wrap
			gap={12}
			shrink={false}
			border="top"
			background="page"
			paddingX={32}
			paddingY={12}
		>
			<Inline grow gap={8}>
				<StatusIndicator tone="warning" size="xs" />
				<Text>{t("bar.count", { count })}</Text>
			</Inline>
			<TextButton type="button" onClick={onDiscard}>
				{t("bar.discard")}
			</TextButton>
			<Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={onReview}>
				{t("bar.review")}
			</Button>
			<Button type="button" size="sm" disabled={disabled} onClick={onSave}>
				{t("bar.save")}
			</Button>
		</Inline>
	);
}
