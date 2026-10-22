"use client";

import { useTranslator } from "@monti-cms/core/site";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@monti-cms/ui";
import { ExportButton, ExportFields, ExportProgressLine } from "./export-fields";
import { exportMessages } from "./messages";
import { useExportForm } from "./use-export-form";

export interface ExportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The entries to export. Their translations come along, and the dialog says so. */
	ids: readonly string[];
	/** The label of the collection of these entries, for the counts ("3 post entries"). */
	noun?: string;
	/** Which question the dialog asks: about the selected entries, or about the one entry that is open. */
	kind: "selected" | "entry";
	/** The entry being edited has changes that are not saved: the archive holds what is saved, and the dialog says so. */
	unsaved?: boolean;
}

function ExportDialogBody({
	ids,
	noun = "",
	kind,
	unsaved,
	onClose,
}: Omit<ExportDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
	const t = useTranslator(exportMessages);
	const form = useExportForm({ ids });
	return (
		<>
			<DialogHeader>
				<DialogTitle>
					{kind === "entry" ? t("dialog.title.entry") : t("dialog.title.selected", { count: ids.length, noun })}
				</DialogTitle>
				<DialogDescription>{t("dialog.description")}</DialogDescription>
			</DialogHeader>
			<ExportFields form={form} selection noun={noun} />
			{unsaved && (
				<p className="text-monti-caption text-monti-muted" data-testid="export-unsaved">
					{t("note.unsaved")}
				</p>
			)}
			<ExportProgressLine phase={form.phase} />
			<DialogFooter>
				<Button type="button" variant="outline" onClick={onClose}>
					{t("action.cancel")}
				</Button>
				<ExportButton form={form} selection label={t("action.selected")} onDone={onClose} />
			</DialogFooter>
		</>
	);
}

/**
 * The export of selected entries, and of the one that is open in the editor: it states what goes in (the entries, the translations that come with them, the
 * folders, addresses and media records they use), offers the scope and the files, and downloads. The form lives only while the dialog is open, so it counts again each time.
 */
export function ExportDialog({ open, onOpenChange, ...body }: ExportDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
				<ExportDialogBody {...body} onClose={() => onOpenChange(false)} />
			</DialogContent>
		</Dialog>
	);
}
