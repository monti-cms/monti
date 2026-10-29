"use client";

import { useTranslator } from "@monti-cms/core/site";
import { ChangesGroup } from "@monti-cms/ui";
import type { ChangeItem } from "./change-list";
import { schemaChangesMessages } from "./changes.messages";
import { describeChangeItem } from "./describe-change-item";
import { schemaMessages } from "./messages";

/**
 * The save group on the right of the Settings title row while the draft differs from the saved file: "changes N" lists the changes (each with its own
 * undo), then "undo all" and the one primary pill. The pill is off while an error stops saving, and red when applying deletes values.
 */
export function SaveGroup({
	items,
	collectionLabel,
	onRevert,
	onSave,
	onDiscard,
	disabled,
	saveLabel,
	dropping,
}: {
	items: readonly ChangeItem[];
	collectionLabel: (name: string) => string;
	onRevert: (item: ChangeItem) => void;
	onSave: () => void;
	onDiscard: () => void;
	/** Saving is not possible: an error remains, or the file has no version to save against. */
	disabled?: boolean;
	/** The pill's text when it is not the usual one. */
	saveLabel?: string;
	/** Applying deletes values: the pill is red. */
	dropping?: boolean;
}) {
	const t = useTranslator(schemaMessages);
	const tc = useTranslator(schemaChangesMessages);
	return (
		<ChangesGroup
			aria-label={t("bar.label")}
			data-testid="save-bar"
			label={t("bar.review")}
			listLabel={t("bar.list")}
			countLabel={t("bar.count", { count: items.length })}
			items={items.map((item) => ({
				id: item.id,
				...describeChangeItem(item, collectionLabel, tc),
				onUndo: () => onRevert(item),
			}))}
			undoLabel={t("bar.undo")}
			discardLabel={t("bar.discard")}
			onDiscard={onDiscard}
			saveLabel={saveLabel ?? t("bar.save")}
			saveDanger={dropping}
			saveDisabled={disabled}
			onSave={onSave}
		/>
	);
}
