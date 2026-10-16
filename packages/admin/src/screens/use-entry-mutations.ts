"use client";

import {
	type BulkOp,
	canTransition,
	type LifecycleAction,
	type Site,
	useSite,
	useTranslator,
} from "@monti-cms/core/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { useCmsMutation } from "../api/use-cms-mutation";
import { commonMessages } from "../lib/common.messages";
import { describeBulkFailure } from "./entries/bulk-bar";
import type { ListState } from "./list-state";
import { screensMessages } from "./messages";
import { applyOptimistic, type OptimisticOp } from "./shared/list-cache";
import type { TaxonomyOptions } from "./shared/use-taxonomy";

/** Reports bulk results as notifications. Failures list the item name and reason. */
function announce(site: Site, label: string, results: BulkItemResult[], items: BulkSelection[]) {
	const t = site.createTranslator(screensMessages);
	const tc = site.createTranslator(commonMessages);
	const failures = results.filter((result): result is Extract<BulkItemResult, { ok: false }> => !result.ok);
	const ok = results.length - failures.length;
	if (failures.length === 0) {
		toast.success(t("bulk.success", { count: ok, label }));
		return;
	}
	const titleOf = (id: string) => items.find((item) => item.id === id)?.title || tc("untitled");
	toast.error(ok > 0 ? t("bulk.partial", { ok, label, failed: failures.length }) : t("bulk.failed", { label }), {
		description: failures
			.slice(0, 3)
			.map((failure) => `${titleOf(failure.id)} — ${describeBulkFailure(site, failure)}`)
			.join("\n"),
	});
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
	onResults: (results: BulkItemResult[]) => void;
}) {
	const site = useSite();
	const t = useTranslator(screensMessages);
	const tc = useTranslator(commonMessages);
	const queryClient = useQueryClient();

	/** Refetches both the list and the trash badge (leaving the currently visible rows as they are). */
	const invalidateEntries = () => queryClient.invalidateQueries({ queryKey: entriesKeys.all });

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
		invalidate: [entriesKeys.all],
		onSuccess: onResults,
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

	/** Handles the action through the bulk API and reports the result. */
	const bulk = async (op: BulkOp, label: string, targets: BulkSelection[], params: BulkParams = {}) => {
		try {
			announce(site, label, await run(op, targets, params), targets);
		} catch (error) {
			toast.error(errorText(site, error, t("bulk.failed", { label })));
		}
	};

	/** Trash restore. */
	const restore = async (targets: BulkSelection[]) => {
		announce(site, tc("lifecycle.restore"), await run("restore", targets), targets);
	};

	return { run, bulk, restore, invalidateEntries };
}
