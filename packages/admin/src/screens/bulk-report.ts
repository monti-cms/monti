import type { Site } from "@monti-cms/core/site";
import type { BulkItemResult, BulkSelection } from "../api/entries";
import { commonMessages } from "../lib/common.messages";
import { describeBulkFailure } from "./entries/bulk-bar";
import { screensMessages } from "./messages";
import { deleteMessages } from "./shared/delete.messages";
import type { OptimisticOp } from "./shared/list-cache";

type Failure = Extract<BulkItemResult, { ok: false }>;

/** What a change of several entries tells when it ends: a notification and whether it is a failure. */
export interface BulkReport {
	readonly tone: "success" | "error";
	readonly message: string;
}

/** A change of a relation is told by the box ticked in its menu and the cells, and its menu stays open on the same rows. */
const isRelationChange = (op: OptimisticOp) => op.startsWith("relation.");

/**
 * What to tell when a change of several entries ends, or `null` for nothing. A clean run says how many went through (a move to the trash says it its own
 * way); a change of a relation says nothing then. Failures are always told, with the name and reason of the first three.
 */
export function bulkReport(
	site: Site,
	op: OptimisticOp,
	label: string,
	results: readonly BulkItemResult[],
	items: readonly BulkSelection[],
): BulkReport | null {
	const t = site.createTranslator(screensMessages);
	const tc = site.createTranslator(commonMessages);
	const td = site.createTranslator(deleteMessages);
	const failures = results.filter((result): result is Failure => !result.ok);
	const ok = results.length - failures.length;
	if (failures.length === 0) {
		if (isRelationChange(op)) return null;
		const message =
			op === "trash"
				? ok === 1
					? td("trash.done")
					: td("trash.done.count", { count: ok })
				: t("bulk.success", { count: ok, label });
		return { tone: "success", message };
	}
	const titleOf = (id: string) => items.find((item) => item.id === id)?.title || tc("untitled");
	const lines = failures.slice(0, 3).map((failure) => `${titleOf(failure.id)} — ${describeBulkFailure(site, failure)}`);
	const message = [
		ok > 0 ? t("bulk.partial", { ok, label, failed: failures.length }) : t("bulk.failed", { label }),
		...lines,
	].join("\n");
	return { tone: "error", message };
}

/** The rows left picked when a change ends: the ones that failed, so they can be tried again. `null` keeps the selection as it is (a change of a relation). */
export function selectionAfter(op: OptimisticOp, results: readonly BulkItemResult[]): Set<string> | null {
	if (isRelationChange(op)) return null;
	return new Set(results.filter((result) => !result.ok).map((result) => result.id));
}
