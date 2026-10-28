"use client";

import { useTranslator } from "@monti-cms/core/site";
import { RenameField } from "@monti-cms/ui";
import { useState } from "react";
import { sharedMessages } from "./messages";
import type { FolderActions, FolderNaming } from "./use-folder-actions";

/**
 * The name of a folder being made or renamed, edited where its row or tile stands (no dialog). It opens with the whole name selected: "New folder" for a
 * new one, the current name for a rename. Enter and leaving the field send it, Escape drops it (see `useFolderActions`).
 */
export function FolderNameField({
	naming,
	actions,
	fill = false,
}: {
	naming: FolderNaming;
	actions: Pick<FolderActions, "commitName" | "cancelName">;
	/** Fills a folder tile instead of sitting in a row. */
	fill?: boolean;
}) {
	const t = useTranslator(sharedMessages);
	const [name, setName] = useState(naming.mode === "create" ? t("folder.newName") : naming.folder.name);
	return (
		<RenameField
			value={name}
			onValueChange={setName}
			onCommit={actions.commitName}
			onCancel={actions.cancelName}
			label={t("folder.nameLabel")}
			fill={fill}
		/>
	);
}
