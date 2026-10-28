"use client";

import { toast } from "@monti-cms/ui";
// The command handlers of the entry editor screen: save, preview, publish, the lifecycle transitions (with their confirmations) and duplicate.

import type { IncomingReferenceItem } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { useState } from "react";
import { errorText } from "../../api/client";
import { type CmsIssue, issueLine } from "../../api/error-message";
import { restoreTrash } from "../../api/trash";
import { commonMessages } from "../../lib/common.messages";
import { useAdminRouter } from "../../router";
import type { TranslatorFor } from "../../translator";
import { useConfirm } from "../shared/confirm-dialog";
import { deleteMessages } from "../shared/delete.messages";
import { nounVars } from "../shared/noun.messages";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";
import type { EntryEditor } from "./entry-editor-types";
import {
	type ConfirmedLifecycleAction,
	type LifecycleAction,
	lifecycleConfirm,
	lifecycleSuccess,
	trashConfirm,
	trashSubjectOfEntry,
} from "./lifecycle-confirm";

/** "Save first" hint. The same words are used wherever on the edit screen an action is blocked. */
const saveFirstMessage = (t: TranslatorFor<typeof entryEditorShellMessages>, purpose: Purpose) =>
	t("saveFirst", { purpose });

/** The action that was attempted, put into the hint when blocked. */
type Purpose = "publish" | "duplicate" | LifecycleAction;

interface EntryLifecycleCommandsInput {
	editor: EntryEditor;
	incomingItems: IncomingReferenceItem[];
	refreshIncoming: (targetId: string) => Promise<void>;
	/** Brings the user to the place a publish warning points at. */
	focusIssue: (issue: CmsIssue) => void;
	/** Whether the translation source changed since the translator last confirmed it. */
	sourceChanged: boolean;
	/** Called with the problems a publish was refused with, so the screen can show them. */
	onPublishBlocked: (issues: readonly CmsIssue[]) => void;
}

export type EntryLifecycleCommands = ReturnType<typeof useEntryLifecycleCommands>;

export function useEntryLifecycleCommands({
	editor,
	incomingItems,
	refreshIncoming,
	focusIssue,
	sourceChanged,
	onPublishBlocked,
}: EntryLifecycleCommandsInput) {
	const site = useSite();
	const t = useTranslator(entryEditorShellMessages);
	const tc = useTranslator(commonMessages);
	const td = useTranslator(deleteMessages);
	const router = useAdminRouter();
	const { confirm, dialog } = useConfirm();
	const { entry, collection, busy } = editor;
	const isReadOnly = editor.readOnly;
	/** Publish saves first. While that save runs, the header buttons are disabled and the label changes like during the publish request itself. */
	const [isPreparingPublish, setIsPreparingPublish] = useState(false);
	const isPublishing = busy === "publish" || isPreparingPublish;
	const isSubmitting = busy !== null || isPreparingPublish;

	/**
	 * Only an explicit publish saves the current input. Other actions ask to save first if there is unsaved input.
	 * The hint shows near where it was pressed. For header buttons and menus it is a toast (default); for dialogs, inside the dialog.
	 */
	const ensureSaved = async (
		purpose: Purpose,
		{ saveChanges = false, report = toast.error }: { saveChanges?: boolean; report?: (message: string) => void } = {},
	) => {
		if (editor.getSnapshot().saveStatus === "conflict") {
			report(t("conflictFirst", { purpose }));
			return null;
		}
		if (saveChanges) {
			const saved = await editor.save();
			if (!saved.ok) {
				report(t("notSaved", { purpose, reason: saved.error.message || t("checkSaveStatus") }));
				return null;
			}
		}
		const { entryId: id, hasUnsavedChanges } = editor.getSnapshot();
		if (!id || (!saveChanges && hasUnsavedChanges)) {
			report(saveFirstMessage(t, purpose));
			return null;
		}
		return id;
	};

	const handleSaveNow = async () => {
		if (isReadOnly) return;
		const saved = await editor.save();
		if (saved.ok) toast(tc("saved"));
		// On failure, always show the reason (a conflict opens its own conflict dialog).
		else if (saved.error.code !== "conflict") toast.error(saved.error.message || tc("saveFailed"));
	};

	/**
	 * Preview renders the server draft. If there are unsaved changes, save first, then open.
	 * To avoid the popup blocker while waiting for the save, the window is opened as soon as the button is pressed.
	 */
	const handlePreview = async (href: string) => {
		const opened = window.open("about:blank", "_blank");
		if (opened) opened.opener = null;
		const saved = isReadOnly ? null : await editor.save();
		if (!saved || saved.ok) {
			if (opened) opened.location.href = href;
			else window.open(href, "_blank", "noopener");
			return;
		}
		opened?.close();
		toast.error(`${t("previewNotOpened")} ${saved.error.message}`.trim());
	};

	const handlePublish = async ({ resetPublishedAt = false }: { resetPublishedAt?: boolean } = {}) => {
		if (isSubmitting || isReadOnly) return;
		// A field filled from the body (`fillFromBody`) that is empty is generated from the body and shown. If there is no body to generate from, it must be entered by hand.
		const filled = editor.fillFromBody();
		if (!filled.ok) {
			toast.error(filled.error.message);
			return;
		}
		for (const { label } of filled.value) toast(t("fillDone", { label }));
		// This does not block. It only warns when leaving with unconfirmed source changes.
		if (sourceChanged) toast(t("sourceUnreviewed"));
		setIsPreparingPublish(true);
		try {
			const id = await ensureSaved("publish", { saveChanges: true });
			if (!id) return;
			const published = await editor.publish({ resetPublishedAt });
			if (!published.ok) {
				// A conflict opens its own conflict dialog.
				if (published.error.code === "conflict") return;
				if (published.error.issues?.length) {
					toast.error(t("publishBlocked"));
					onPublishBlocked(published.error.issues);
				} else toast.error(published.error.message);
				return;
			}
			void refreshIncoming(id);
			const { warnings } = published.value;
			if (warnings.length > 0) {
				const lines = warnings.slice(0, 5).map((issue) => issueLine(issue));
				toast([t("publishedWithWarnings", { count: warnings.length }), ...lines].join("\n"), {
					duration: 10000,
					action: warnings[0]?.position
						? { label: t("go"), onClick: () => focusIssue(warnings[0] as CmsIssue) }
						: undefined,
				});
			} else {
				toast(t("published"));
			}
		} finally {
			setIsPreparingPublish(false);
		}
	};

	/** Archive, unarchive, trash, restore. */
	const runLifecycle = async (action: LifecycleAction) => {
		if (!entry || isSubmitting) return;
		if (action !== "restore" && editor.getSnapshot().hasUnsavedChanges) {
			toast.error(saveFirstMessage(t, action));
			return;
		}
		const changed = await editor.changeStatus(action);
		if (!changed.ok) {
			toast.error(changed.error.message);
			return;
		}
		if (action === "trash") {
			const trashedId = entry.id;
			// The undo puts the entry back at the version the trash made. A translation left the screen (the original opened), so it opens again.
			const undo = async () => {
				try {
					const answer = await restoreTrash(site, [
						{ type: "entry", id: trashedId, expectedVersion: changed.value.version },
					]);
					if (!answer.every((result) => result.ok)) {
						toast.error(td("undoFailed"));
						return;
					}
				} catch (error) {
					toast.error(errorText(site, error, td("undoFailed")));
					return;
				}
				if (changed.value.openEntryId) router.navigate(site.adminEntryEditHref(trashedId));
				else await editor.reload();
			};
			toast(td("trash.done"), { action: { label: td("undo"), onClick: () => void undo() } });
		} else toast(lifecycleSuccess(site)[action]);
		// Sending a translation to the trash returns to the original's edit screen.
		if (changed.value.openEntryId) router.navigate(site.adminEntryEditHref(changed.value.openEntryId));
	};

	/** Archiving a published post takes it down, so it asks. Unarchive and restore happen right away. */
	const confirmLifecycle = async (action: ConfirmedLifecycleAction) => {
		const ok = await confirm(lifecycleConfirm(site, action, entry, incomingItems, collection));
		if (ok) await runLifecycle(action);
	};

	/** Moves the entry to the trash at once, with an undo; a published entry (or one whose translation is published) asks first. */
	const trashEntry = async () => {
		if (!entry) return;
		const ask = trashConfirm(site, collection, [trashSubjectOfEntry(site, entry)]);
		if (ask && !(await confirm(ask))) return;
		await runLifecycle("trash");
	};

	const confirmPermanentDelete = async () => {
		if (!entry) return;
		const ok = await confirm({
			title: tc("lifecycle.deletePermanently"),
			description: t("permanentDeleteAsk", nounVars(site, collection)),
			confirmLabel: tc("lifecycle.deletePermanently"),
			destructive: true,
		});
		if (!ok) return;
		const deleted = await editor.deletePermanently();
		if (!deleted.ok) {
			toast.error(deleted.error.message);
			return;
		}
		router.navigate(site.adminHref("/trash"));
	};

	const handleDuplicate = async () => {
		const id = await ensureSaved("duplicate");
		if (!id) return;
		const copy = await editor.duplicate();
		if (!copy.ok) {
			toast.error(copy.error.message);
			return;
		}
		router.navigate(site.adminEntryEditHref(copy.value.id));
	};

	return {
		isPublishing,
		isSubmitting,
		confirmDialog: dialog,
		handleSaveNow,
		handlePreview,
		handlePublish,
		runLifecycle,
		confirmLifecycle,
		trashEntry,
		confirmPermanentDelete,
		handleDuplicate,
	};
}
