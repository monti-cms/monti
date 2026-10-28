"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import { toast } from "@monti-cms/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { errorText } from "../../api/client";
import { entriesKeys } from "../../api/entries";
import { foldersKeys } from "../../api/folders";
import { mediaKeys } from "../../api/media";
import {
	deleteTrash,
	emptyTrash,
	getReferrers,
	restoreTrash,
	type TrashEntryJson,
	type TrashItemJson,
	trashKeys,
	unlinkReferences,
} from "../../api/trash";
import { useAdminRouter } from "../../router";
import { trashMessages } from "./messages";
import {
	type Blocker,
	blockerOf,
	blockersFromResults,
	canDelete,
	type DeletePlan,
	deleteRequestOf,
	failureReason,
	itemKey,
	newPlan,
	sourceRowOf,
	summarizeRestore,
	targetOf,
	titleOf,
	usagesFromReferrers,
} from "./trash-model";
import type { TrashView } from "./use-trash";

/**
 * What the trash screen does to the trash: restore (a translation whose original is in the trash restores the original), permanent delete with its
 * dialog (referrers to unlink or delete together), and emptying. Each tells the writer how it went and refetches what it changed.
 */
export function useTrashActions(view: TrashView) {
	const site = useSite();
	const t = useTranslator(trashMessages);
	const router = useAdminRouter();
	const queryClient = useQueryClient();
	const { items, folder, selected, setSelected, closePanel, closeFolder } = view;
	const [plan, setPlan] = useState<DeletePlan | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [emptyOpen, setEmptyOpen] = useState(false);
	/** The units the last emptying kept, with how many entries point at each: their rows say why. */
	const [kept, setKept] = useState<ReadonlyMap<string, number>>(new Map());

	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: trashKeys.all }),
			queryClient.invalidateQueries({ queryKey: entriesKeys.all }),
			queryClient.invalidateQueries({ queryKey: mediaKeys.all }),
			queryClient.invalidateQueries({ queryKey: foldersKeys.all }),
		]);

	const leave = (keys: readonly string[]) => {
		setSelected(new Set([...selected].filter((key) => !keys.includes(key))));
		setKept((current) => new Map([...current].filter(([key]) => !keys.includes(key))));
	};

	/** Tells how a restore went; what could not come back is told with why. */
	const report = (asked: readonly TrashItemJson[], results: Parameters<typeof summarizeRestore>[2]) => {
		const summary = summarizeRestore(site, asked, results, folder?.name ?? null);
		if (summary.message) {
			const openId = summary.openId;
			toast(
				summary.message,
				openId
					? { action: { label: t("restore.open"), onClick: () => router.navigate(site.adminEntryEditHref(openId)) } }
					: {},
			);
		}
		if (summary.failed.length > 0)
			toast.error(
				[
					t("restore.failed"),
					...summary.failed
						.slice(0, 3)
						.map(({ item, error }) => `${titleOf(site, item)} — ${failureReason(site, error)}`),
				].join("\n"),
			);
		leave(results.filter((result) => result.ok).map(itemKey));
		return summary;
	};

	const restore = async (asked: readonly TrashItemJson[]) => {
		try {
			const { results } = await restoreTrash(site, asked.map(targetOf), t("restore.failed"));
			const summary = report(asked, results);
			// The folder that was open is back: nothing of it is left to look into.
			if (folder && summary.restored > 0 && asked.some((item) => itemKey(item) === itemKey(folder))) closeFolder();
			return summary;
		} catch (error) {
			toast.error(errorText(site, error, t("restore.failed")));
			return null;
		} finally {
			await refresh();
		}
	};

	/** A translation cannot come back before its original: restores the original (found in the rows, or named by the server). */
	const restoreOriginal = async (item: TrashEntryJson) => {
		let sourceId = sourceRowOf(item, items)?.id ?? null;
		if (!sourceId) {
			try {
				const { results } = await restoreTrash(site, [targetOf(item)], t("restore.failed"));
				const [result] = results;
				if (result?.ok !== false) {
					report([item], results);
					return await refresh();
				}
				sourceId = result.error === "source_trashed" ? (result.sourceId ?? null) : null;
				if (!sourceId) {
					report([item], results);
					return await refresh();
				}
			} catch (error) {
				toast.error(errorText(site, error, t("restore.failed")));
				return await refresh();
			}
		}
		const source: TrashEntryJson = {
			...item,
			id: sourceId,
			isSource: true,
			title: item.sourceTitle,
			sourceTrashed: false,
			sourceTitle: null,
		};
		await restore([source]);
	};

	/**
	 * Asks before deleting for good. A unit that entries point at opens the dialog with them listed (from the relations endpoint), so the question and the
	 * way out are one dialog.
	 */
	const requestDelete = async (asked: readonly TrashItemJson[]) => {
		try {
			const blockers = await Promise.all(
				asked
					.filter((item): item is TrashEntryJson => item.type === "entry" && item.usages > 0)
					.map(async (item) => {
						const { incomingReferences } = await getReferrers(site, item.id);
						return blockerOf(item, usagesFromReferrers(incomingReferences));
					}),
			);
			setPlan(
				newPlan(
					asked,
					blockers.filter((blocker) => blocker.live.length + blocker.trashed.length > 0),
				),
			);
		} catch (error) {
			toast.error(errorText(site, error, t("delete.failed")));
		}
	};

	const cancelDelete = () => setPlan(null);

	const unlink = async (blocker: Blocker) => {
		try {
			await unlinkReferences(site, [blocker.item.id], t("unlink.failed"));
			setPlan((current) =>
				current ? { ...current, unlinked: new Set(current.unlinked).add(itemKey(blocker.item)) } : current,
			);
			void queryClient.invalidateQueries({ queryKey: entriesKeys.all });
		} catch (error) {
			toast.error(errorText(site, error, t("unlink.failed")));
		}
	};

	const deleteTogether = (blocker: Blocker) =>
		setPlan((current) =>
			current ? { ...current, together: new Set(current.together).add(itemKey(blocker.item)) } : current,
		);

	const confirmDelete = async () => {
		if (!plan || !canDelete(plan) || deleting) return;
		setDeleting(true);
		try {
			const { results } = await deleteTrash(site, deleteRequestOf(plan), t("delete.failed"));
			const asked = new Set(plan.items.map(itemKey));
			const mine = results.filter((result) => asked.has(itemKey(result)));
			const stillBlocked = blockersFromResults(plan.items, mine);
			const failed = results.filter((result) => !result.ok && result.error !== "in_use");
			const gone = results.filter((result) => result.ok).map(itemKey);
			leave(gone);
			if (failed.length > 0)
				toast.error(
					[
						t("delete.failed"),
						...failed.slice(0, 3).map((result) => {
							const item = plan.items.find((candidate) => itemKey(candidate) === itemKey(result));
							return `${item ? titleOf(site, item) : result.id} — ${result.ok ? "" : failureReason(site, result.error)}`;
						}),
					].join("\n"),
				);
			// What is pointed at after all (a referrer came in meanwhile) stays in the dialog, with the referrers the server names.
			setPlan(
				stillBlocked.length > 0
					? newPlan(
							stillBlocked.map((blocker) => blocker.item),
							stillBlocked,
						)
					: null,
			);
			// Looking into a folder that was deleted: back to the top.
			if (folder && gone.includes(itemKey(folder))) closeFolder();
			if (gone.length > 0) closePanel();
		} catch (error) {
			toast.error(errorText(site, error, t("delete.failed")));
		} finally {
			setDeleting(false);
			await refresh();
		}
	};

	const confirmEmpty = async () => {
		setEmptyOpen(false);
		try {
			const outcome = await emptyTrash(site, t("empty.failed"));
			setKept(new Map(outcome.kept.map((unit) => [itemKey(unit), unit.usages.length])));
			setSelected(new Set());
			closePanel();
			toast(
				outcome.kept.length > 0
					? t("empty.doneKept", { count: outcome.deleted, kept: outcome.kept.length })
					: t("empty.done", { count: outcome.deleted }),
			);
		} catch (error) {
			toast.error(errorText(site, error, t("empty.failed")));
		} finally {
			await refresh();
		}
	};

	return {
		kept,
		restore,
		restoreOriginal,
		plan,
		deleting,
		requestDelete,
		cancelDelete,
		unlink,
		deleteTogether,
		confirmDelete,
		emptyOpen,
		openEmpty: () => setEmptyOpen(true),
		closeEmpty: () => setEmptyOpen(false),
		confirmEmpty,
	};
}

export type TrashActions = ReturnType<typeof useTrashActions>;
