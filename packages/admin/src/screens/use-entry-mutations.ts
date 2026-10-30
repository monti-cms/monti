"use client";

import {
	type BulkOp,
	canTransition,
	type LifecycleAction,
	type Site,
	useSite,
	useTranslator,
} from "@monti-cms/core/site";
import { toast } from "@monti-cms/ui";
import { useQueryClient } from "@tanstack/react-query";
import { CmsApiError, errorText } from "../api/client";
import {
	type BulkItemResult,
	type BulkParams,
	type BulkSelection,
	bulkEntries,
	changeEntryStatus,
	type EntriesPage,
	entriesKeys,
} from "../api/entries";
import { foldersKeys } from "../api/folders";
import { restoreTrash } from "../api/trash";
import { useCmsMutation } from "../api/use-cms-mutation";
import { commonMessages } from "../lib/common.messages";
import { type BulkReport, bulkReport } from "./bulk-report";
import type { ListState } from "./list-state";
import { screensMessages } from "./messages";
import { deleteMessages } from "./shared/delete.messages";
import { applyOptimistic, type OptimisticOp } from "./shared/list-cache";
import type { TaxonomyOptions } from "./shared/use-taxonomy";

type OkResult = Extract<BulkItemResult, { ok: true }>;

/** Shows the report of a bulk change as a notification. `undo` takes back what went through: the toast carries it as its action. */
function announce(site: Site, report: BulkReport | null, undo?: () => void) {
	if (!report) return;
	const td = site.createTranslator(deleteMessages);
	const action = undo ? { action: { label: td("undo"), onClick: undo } } : undefined;
	if (report.tone === "error") {
		if (action) toast.error(report.message, action);
		else toast.error(report.message);
	} else if (action) toast(report.message, action);
	else toast(report.message);
}

const LIFECYCLE_ACTIONS: readonly string[] = ["archive", "unarchive", "trash", "restore"] satisfies LifecycleAction[];
const isLifecycleAction = (op: string): op is LifecycleAction => LIFECYCLE_ACTIONS.includes(op);

/**
 * An action that changes the list. Applies the change to the list first, then sends the request. If the request itself fails it is rolled back,
 * and when it ends the list is synced to server values. Per-item results go to `onResults` (used to keep failed items selected).
 */
export function useEntryMutations({
	listKey,
	state,
	options,
	onResults,
}: {
	listKey: ReturnType<typeof entriesKeys.list>;
	state: ListState;
	options: TaxonomyOptions;
	/** Per-item results of a change, with the operation that made them. */
	onResults: (results: BulkItemResult[], op: OptimisticOp) => void;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const queryClient = useQueryClient();

	/** Refetches the list, the trash badge and the folders with their counts (leaving the currently visible rows as they are). */
	const invalidateEntries = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: entriesKeys.all }),
			queryClient.invalidateQueries({ queryKey: foldersKeys.all }),
		]);

	/**
	 * Applies the change to the list first, then sends the request; a failed request rolls the list back, and the list is synced to server
	 * values once it ends. Restoring is not in the bulk API, so it requests per item. A failure is thrown to the caller (`inline`).
	 */
	const mutation = useCmsMutation<
		{ op: OptimisticOp; targets: BulkSelection[]; params?: BulkParams },
		BulkItemResult[],
		EntriesPage
	>({
		fn: async ({ op, targets, params }, { site }) => {
			if (op !== "restore") return bulkEntries(site, op, targets, params);
			const out: BulkItemResult[] = [];
			for (const target of targets) {
				try {
					await changeEntryStatus(site, target.id, "restore", { expectedVersion: target.expectedVersion });
					out.push({ id: target.id, ok: true, version: target.expectedVersion + 1 });
				} catch (error) {
					out.push({ id: target.id, ok: false, error: (error instanceof CmsApiError && error.code) || "internal" });
				}
			}
			return out;
		},
		failure: ({ op }) => t("bulk.failed", { label: op }),
		inline: true,
		optimistic: {
			queryKey: listKey,
			update: (page, { op, targets, params }) =>
				applyOptimistic(page, op, new Set(targets.map((target) => target.id)), { state, params, options }),
		},
		invalidate: [entriesKeys.all, foldersKeys.all],
		onSuccess: (results, { op }) => onResults(results, op),
	});

	// A lifecycle change goes only to the rows that can take it (the store's own rule): archiving a selection that holds archived rows archives the
	// others, instead of reporting the archived ones as failures.
	const run = (op: OptimisticOp, targets: BulkSelection[], params?: BulkParams) =>
		mutation.mutateAsync({
			op,
			targets: isLifecycleAction(op)
				? targets.filter((target) => target.status === undefined || canTransition(op, target.status))
				: targets,
			params,
		});

	const td = useTranslator(deleteMessages);

	/** Takes the toast's undo: asks the server for `request`, tells it if that failed, and reads the list again either way. */
	const undoWith = (request: () => Promise<boolean>) => async () => {
		try {
			if (!(await request())) toast.error(td("undoFailed"));
		} catch (error) {
			toast.error(errorText(site, error, td("undoFailed")));
		}
		await invalidateEntries();
	};

	/** The undo of what the trash just moved: restores each entry at the version the trash made. */
	const undoTrash = (done: OkResult[]) =>
		undoWith(async () => {
			const answer = await restoreTrash(
				site,
				done.map(({ id, version }) => ({ type: "entry", id, expectedVersion: version })),
			);
			return answer.every((result) => result.ok);
		});

	/** The undo of a folder move: each entry goes back to the folder it was in, one request per folder. Unknown where from: no undo. */
	const undoMove = (targets: BulkSelection[], done: OkResult[], to: BulkParams["folderId"]) => {
		const moved = done.flatMap(({ id, version }) => {
			const from = targets.find((target) => target.id === id)?.folderId;
			return from === undefined || from === to ? [] : [{ id, version, from }];
		});
		if (moved.length === 0 || moved.length < done.length) return undefined;
		return undoWith(async () => {
			const folders = [...new Set(moved.map((entry) => entry.from))];
			const answers = await Promise.all(
				folders.map((folderId) =>
					bulkEntries(
						site,
						"folder.move",
						moved
							.filter((entry) => entry.from === folderId)
							.map(({ id, version }) => ({ id, expectedVersion: version })),
						{ folderId },
					),
				),
			);
			return answers.every((results) => results.every((result) => result.ok));
		});
	};

	/** Handles the action through the bulk API and reports the result. A move to the trash or to a folder carries its undo. */
	const bulk = async (op: BulkOp, label: string, targets: BulkSelection[], params: BulkParams = {}) => {
		try {
			const results = await run(op, targets, params);
			const done = results.filter((result): result is OkResult => result.ok);
			announce(
				site,
				bulkReport(site, op, label, results, targets),
				done.length === 0
					? undefined
					: op === "trash"
						? undoTrash(done)
						: op === "folder.move"
							? undoMove(targets, done, params.folderId)
							: undefined,
			);
		} catch (error) {
			toast.error(errorText(site, error, t("bulk.failed", { label })));
		}
	};

	/** Trash restore. */
	const restore = async (targets: BulkSelection[]) => {
		announce(site, bulkReport(site, "restore", tc("lifecycle.restore"), await run("restore", targets), targets));
	};

	return { run, bulk, restore, invalidateEntries };
}
