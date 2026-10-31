import { CmsApiError } from "../../api/client";
import type { EntryStatusAction } from "../../api/entries";
import { type EditorResult, editorFailure, toEditorError } from "../../hooks/result";
import type { TranslatorFor } from "../../translator";
import { nounVars } from "../shared/noun.messages";
import type { Recovery } from "./entry-editor-recovery-state";
import { failed, failureOf, keepTranslationGroup } from "./entry-editor-results";
import type { EditorContext, EntrySaveOutcome, FilledField, PublishOutcome, StatusOutcome } from "./entry-editor-types";
import { copyTitle, type EntryData, formTitle, isTranslationEntry } from "./entry-form";
import { backupKey } from "./local-backup";
import type { entriesMessages } from "./messages";

// The entry editor's commands that change an entry's life on the server: publish, archive/trash/restore, duplicate and delete.

const statusFailed = (t: TranslatorFor<typeof entriesMessages>): Record<EntryStatusAction, string> => ({
	archive: t("lifecycle.failed.archive"),
	unarchive: t("lifecycle.failed.unarchive"),
	trash: t("lifecycle.failed.trash"),
	restore: t("lifecycle.failed.restore"),
});

/** The parts of the engine the lifecycle commands lean on. */
export interface LifecycleDeps {
	fillFromBody(): EditorResult<readonly FilledField[]>;
	save(): Promise<EditorResult<EntrySaveOutcome>>;
	fetchAndApply(id: string): Promise<EntryData | null>;
	recovery: Pick<Recovery, "cancelPendingBackup" | "queueBackup" | "safely">;
}

export function createLifecycle(ctx: EditorContext, deps: LifecycleDeps) {
	const { site, adminId, client, recoveryStore, t, tc, callbacks, m, state, commit, unsaved } = ctx;
	const { fillFromBody, save, fetchAndApply, recovery } = deps;

	const publish = async (options: { resetPublishedAt?: boolean } = {}): Promise<EditorResult<PublishOutcome>> => {
		const current = state();
		if (current.readOnly) return editorFailure("read_only", t("editor.readOnly", nounVars(site, current.collection)));
		if (current.busy) return editorFailure("invalid_state", t("editor.busy"));
		if (current.saveStatus === "conflict") return editorFailure("conflict", t("editor.conflict"));
		commit({ busy: "publish", publishIssues: [] });
		try {
			const filled = fillFromBody();
			if (!filled.ok) return filled;
			const saved = await save();
			if (!saved.ok) return saved;
			const id = m.entryId;
			if (!id) return editorFailure("invalid_state", t("editor.unsaved"));
			try {
				const { entry: published, warnings } = await client.publish(id, {
					expectedVersion: m.version,
					...(options.resetPublishedAt ? { resetPublishedAt: true } : {}),
				});
				m.version = published.version;
				const merged: EntryData = { ...published, ...keepTranslationGroup(state().entry, published) };
				commit({ entry: merged, readOnly: merged.status === "trashed", bodyWarnings: warnings });
				callbacks().onSaved?.(merged, { created: false });
				return { ok: true, value: { entry: merged, warnings, filled: filled.value } };
			} catch (caught) {
				if (caught instanceof CmsApiError && caught.code === "conflict") {
					const server = await client.get(id).catch(() => null);
					if (server) commit({ conflict: { server, local: state().form } });
					return failed(toEditorError(caught, t("publishFailed")));
				}
				if (caught instanceof CmsApiError && caught.issues.length > 0) {
					commit({ publishIssues: caught.issues });
					return failed(failureOf(site, caught, t("publishFailed")));
				}
				return failed(failureOf(site, caught, t("publishFailed")));
			}
		} finally {
			commit({ busy: null });
		}
	};

	const changeStatus = async (action: EntryStatusAction): Promise<EditorResult<StatusOutcome>> => {
		const current = state();
		const entry = current.entry;
		if (!entry) return editorFailure("invalid_state", t("editor.notLoaded", nounVars(site, state().collection)));
		if (current.busy) return editorFailure("invalid_state", t("editor.busy"));
		if (action !== "restore" && unsaved()) return editorFailure("invalid_state", t("editor.unsaved"));
		commit({ busy: "status" });
		try {
			const before = m.version;
			await client.changeStatus(entry.id, action, { expectedVersion: before });
			// A translation sent to the trash: the UI opens the original instead, so there is nothing to reload.
			if (action === "trash" && isTranslationEntry(entry) && entry.translationGroupId) {
				return { ok: true, value: { entry: null, openEntryId: entry.translationGroupId, version: before + 1 } };
			}
			const loaded = await fetchAndApply(entry.id);
			if (loaded) callbacks().onSaved?.(loaded, { created: false });
			return { ok: true, value: { entry: loaded, version: loaded?.version ?? before + 1 } };
		} catch (caught) {
			return failed(failureOf(site, caught, statusFailed(t)[action]));
		} finally {
			commit({ busy: null });
		}
	};

	const duplicate = async (): Promise<EditorResult<EntryData>> => {
		const current = state();
		if (current.saveStatus === "conflict") return editorFailure("conflict", t("editor.conflict"));
		const id = m.entryId;
		if (!id || unsaved()) return editorFailure("invalid_state", t("editor.unsaved"));
		try {
			const copy = await client.duplicate(id, {
				title: copyTitle(site, current.collection, formTitle(site, current.collection, current.form)),
			});
			return { ok: true, value: copy.entry };
		} catch (caught) {
			return failed(failureOf(site, caught, t("duplicateFailed")));
		}
	};

	const deletePermanently = async (): Promise<EditorResult> => {
		const entry = state().entry;
		if (!entry) return editorFailure("invalid_state", t("editor.notLoaded", nounVars(site, state().collection)));
		try {
			await client.remove(entry.id, { expectedVersion: m.version });
			recovery.cancelPendingBackup();
			await recovery.queueBackup(() =>
				recovery.safely(() => recoveryStore.delete(backupKey(adminId, entry.id, entry.collection)), undefined),
			);
			return { ok: true, value: undefined };
		} catch (caught) {
			return failed(failureOf(site, caught, tc("deleteFailed")));
		}
	};

	return { publish, changeStatus, duplicate, deletePermanently };
}
