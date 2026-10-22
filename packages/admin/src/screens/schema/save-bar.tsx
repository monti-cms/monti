"use client";

import { useTranslator } from "@monti-cms/core/site";
import { Button } from "../../ui/button";
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
		<section
			aria-label={t("bar.label")}
			data-testid="save-bar"
			className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t bg-monti-page px-4 py-3 lg:px-8"
		>
			<span className="mr-auto flex items-center gap-2 text-monti-body">
				<span aria-hidden className="size-1.5 rounded-full bg-monti-accent-emphasis" />
				<span className="tabular">{t("bar.count", { count })}</span>
			</span>
			<Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
				{t("bar.discard")}
			</Button>
			<Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onReview}>
				{t("bar.review")}
			</Button>
			<Button type="button" size="sm" disabled={disabled} onClick={onSave}>
				{t("bar.save")}
			</Button>
		</section>
	);
}
