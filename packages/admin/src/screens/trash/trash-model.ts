import {
	fileTypeLabel,
	formatFileSize,
	type Site,
	type TrashTarget,
	type TrashUsage,
	trashDaysLeft,
} from "@monti-cms/core/site";
import type {
	TrashDeleteOutcome,
	TrashEntryJson,
	TrashItemJson,
	TrashReferrer,
	TrashRestoreOutcome,
} from "../../api/trash";
import { commonMessages } from "../../lib/common.messages";
import { bulkBarMessages } from "../entries/bulk-bar.messages";
import { collectionNoun } from "../shared/noun.messages";
import { trashMessages } from "./messages";

/** Days left at or under which a row's number turns warning: the purge is near. */
export const URGENT_DAYS = 3;

/** One row of the screen. A folder and a file may share an id with an entry's table, so the type is part of the key. */
export const itemKey = (item: { type: TrashItemJson["type"]; id: string }): string => `${item.type}:${item.id}`;

/** The unit as a request names it: entries and folders carry the version the screen saw. */
export const targetOf = (item: TrashItemJson): TrashTarget =>
	item.type === "media"
		? { type: "media", id: item.id }
		: { type: item.type, id: item.id, expectedVersion: item.version };

/** The name a row goes by. */
export function titleOf(site: Site, item: TrashItemJson): string {
	const untitled = site.createTranslator(commonMessages)("untitled");
	if (item.type === "folder") return item.name;
	if (item.type === "media") return item.filename;
	return item.title?.trim() ? item.title : untitled;
}

/** The address beside a row's title (an entry's, as the list writes it). */
export function addressOf(item: TrashItemJson): string | undefined {
	if (item.type !== "entry" || !item.slug) return undefined;
	return item.slug.startsWith("/") ? item.slug : `/${item.slug}`;
}

/** Whole days left for a unit, or `null` inside a trashed folder, where the folder holds the date. */
export function daysLeftOf(item: { deletedAt: string; expiresAt: string | null }, now: Date): number | null {
	return item.expiresAt === null ? null : trashDaysLeft(new Date(item.deletedAt), now);
}

export const isUrgent = (days: number): boolean => days <= URGENT_DAYS;

/** What pressing a row's title does: go into the folder, open the editor, or open the read-only panel beside the list. */
export type RowOpen = { kind: "folder" } | { kind: "editor"; href: string } | { kind: "panel" };

export function openOf(site: Site, item: TrashItemJson): RowOpen {
	if (item.type === "folder") return { kind: "folder" };
	if (item.type === "media" || site.isItemCollection(item.collection)) return { kind: "panel" };
	return { kind: "editor", href: site.adminEntryEditHref(item.id) };
}

/**
 * Which button the end of a row has: restore; restore the original for a translation whose original is in the trash (it cannot come back alone); and
 * permanent delete for a unit the last emptying kept because something points at it (the row says so, and restoring is not what is left to do).
 */
export type RowAction = "restore" | "restoreOriginal" | "delete";

export function rowActionOf(item: TrashItemJson, kept: ReadonlyMap<string, number>): RowAction {
	if (kept.has(itemKey(item))) return "delete";
	if (item.type === "entry" && item.sourceTrashed) return "restoreOriginal";
	return "restore";
}

export interface RowMeta {
	text: string;
	tone: "default" | "warning";
}

/**
 * The second line of a row: what it is, in the kind and languages of the board ("Post · KO · EN", "Post · English translation", "Tag", "Post folder · 2
 * entries", "Media · Image · 2.4MB · Blog Assets"). In a search it starts with the folder the thing was in; a unit the last emptying kept ends with why.
 */
export function metaOf(site: Site, item: TrashItemJson, options: { searching: boolean; kept?: number }): RowMeta {
	const t = site.createTranslator(trashMessages);
	const pathText = item.path.join(" / ");
	let text: string;
	let tone: RowMeta["tone"] = "default";
	if (item.type === "entry") {
		const kind = collectionNoun(site, item.collection);
		if (item.sourceTrashed) {
			text = t("row.sourceTrashed", {
				title: item.sourceTitle || site.createTranslator(commonMessages)("untitled"),
			});
			tone = "warning";
		} else if (site.isItemCollection(item.collection)) {
			text = kind;
		} else if (!item.isSource) {
			text = t("meta.translation", { kind, language: site.localeLabel(item.locale) });
		} else {
			const locales = item.locales.length > 0 ? item.locales : [item.locale];
			text = site.ADMIN_TRANSLATIONS ? [kind, ...locales.map((locale) => locale.toUpperCase())].join(" · ") : kind;
		}
	} else if (item.type === "folder") {
		text =
			item.collection === "media"
				? t("meta.folderFiles", { count: item.files, path: pathText })
				: t("meta.folderEntries", { kind: collectionNoun(site, item.collection), count: item.entries });
	} else {
		const type = item.mimeType?.startsWith("image/") ? t("meta.image") : fileTypeLabel(item.filename, item.mimeType);
		text = t("meta.media", { type, size: formatFileSize(item.byteSize ?? 0), path: pathText });
	}
	// A file already names its folder at the end; a search says where an entry or a folder was.
	if (options.searching && item.type !== "media" && item.path.length > 0)
		text = t("meta.inFolder", { path: pathText, meta: text });
	if (options.kept !== undefined) {
		text = t("meta.pointed", { meta: text, count: options.kept });
		tone = "warning";
	}
	return { text, tone };
}

/** The reason a request failed, in words: the bulk bar's for the codes it knows, the trash's own for the rest. */
export function failureReason(site: Site, code: string): string {
	const known = [
		"conflict",
		"not_found",
		"invalid_input",
		"invalid_status",
		"slug_conflict",
		"in_use",
		"invalid_reference",
	];
	if (known.includes(code)) return site.createTranslator(bulkBarMessages)(`failure.${code}` as "failure.conflict");
	const t = site.createTranslator(trashMessages);
	return code === "source_trashed" ? t("failure.source_trashed") : t("failure.unknown");
}

// ---- Restore -------------------------------------------------------------------------------------------------------------------------------------

export interface RestoreSummary {
	/** What the toast says, or `null` when nothing came back. */
	message: string | null;
	/** The entry the toast's "Open" goes to, for one restored document. */
	openId: string | null;
	/** The units that could not come back, with why. */
	failed: { item: TrashItemJson; error: string; sourceId?: string }[];
	restored: number;
}

/**
 * What a restore did, in the toast's words. One restored document says it is a draft again (and offers "Open"), or that its folder was made again when it came
 * back from inside a trashed folder; anything else only says it is restored. `folderName` is the folder looked into, for a unit restored from inside it.
 */
export function summarizeRestore(
	site: Site,
	items: readonly TrashItemJson[],
	results: readonly TrashRestoreOutcome[],
	folderName: string | null,
): RestoreSummary {
	const t = site.createTranslator(trashMessages);
	const byKey = new Map(items.map((item) => [itemKey(item), item]));
	const failed: RestoreSummary["failed"] = [];
	const restored: { item: TrashItemJson; recreated: boolean }[] = [];
	for (const result of results) {
		const item = byKey.get(itemKey(result));
		if (!item) continue;
		if (result.ok) restored.push({ item, recreated: result.recreated === true });
		else failed.push({ item, error: result.error, ...(result.sourceId ? { sourceId: result.sourceId } : {}) });
	}
	if (restored.length === 0) return { message: null, openId: null, failed, restored: 0 };
	// One restored document says it is a draft again (and offers "Open"), made again from inside a trashed folder it says so; the rest only say "Restored".
	const [{ item, recreated }] = restored as [(typeof restored)[number]];
	const document =
		restored.length === 1 && items.length === 1 && item.type === "entry" && !site.isItemCollection(item.collection);
	if (!document) return { message: t("restore.done"), openId: null, failed, restored: restored.length };
	const folder = folderName ?? item.path.at(-1) ?? "";
	return {
		message: recreated ? t("restore.recreatedDraft", { folder }) : t("restore.draft"),
		openId: item.id,
		failed,
		restored: 1,
	};
}

/**
 * The source a translation needs back first: the source row if the screen holds it, else `null` (the restore asks the server, which answers `source_trashed`
 * with the id).
 */
export function sourceRowOf(item: TrashEntryJson, items: readonly TrashItemJson[]): TrashEntryJson | null {
	return (
		items.find(
			(candidate): candidate is TrashEntryJson =>
				candidate.type === "entry" &&
				candidate.isSource &&
				candidate.translationGroupId === item.translationGroupId &&
				candidate.collection === item.collection,
		) ?? null
	);
}

// ---- Permanent delete ----------------------------------------------------------------------------------------------------------------------------

/** A unit that cannot be deleted for good yet: the entries whose relation fields point at it, those in the trash apart from those that are not. */
export interface Blocker {
	item: TrashItemJson;
	live: TrashUsage[];
	trashed: TrashUsage[];
}

/** The referrers of a unit split into those in use and those in the trash. */
export function groupUsages(usages: readonly TrashUsage[]): { live: TrashUsage[]; trashed: TrashUsage[] } {
	return { live: usages.filter((usage) => !usage.trashed), trashed: usages.filter((usage) => usage.trashed) };
}

/** The blocker of a unit from the usages the server named. */
export function blockerOf(item: TrashItemJson, usages: readonly TrashUsage[]): Blocker {
	return { item, ...groupUsages(usages) };
}

/**
 * The entries that point at `item` through a relation field, from the relations endpoint: one per entry (its draft and its published copy are one), and
 * only the relation fields count. A link inside the body never blocks a delete (it becomes a broken link).
 */
export function usagesFromReferrers(referrers: readonly TrashReferrer[]): TrashUsage[] {
	const byEntry = new Map<string, TrashUsage>();
	for (const referrer of referrers) {
		if (!referrer.occurrences.some((occurrence) => occurrence.type === "metadata")) continue;
		const known = byEntry.get(referrer.sourceId);
		byEntry.set(referrer.sourceId, {
			entryId: referrer.sourceId,
			title: known?.title || referrer.sourceTitle,
			collection: referrer.sourceCollection,
			trashed: referrer.sourceStatus === "trashed",
		});
	}
	return [...byEntry.values()];
}

/** The blockers named by a delete's answer: the units that came back `in_use`. */
export function blockersFromResults(
	items: readonly TrashItemJson[],
	results: readonly TrashDeleteOutcome[],
): Blocker[] {
	const byKey = new Map(items.map((item) => [itemKey(item), item]));
	return results.flatMap((result) => {
		const item = byKey.get(itemKey(result));
		return item && !result.ok && result.error === "in_use" ? [blockerOf(item, result.usages ?? [])] : [];
	});
}

/** What the dialog of a permanent delete is working through: the blockers, and which of their two kinds of referrers the writer has dealt with. */
export interface DeletePlan {
	items: readonly TrashItemJson[];
	blockers: readonly Blocker[];
	/** Units whose live referrers were unlinked. */
	unlinked: ReadonlySet<string>;
	/** Units whose referrers in the trash are deleted together with it. */
	together: ReadonlySet<string>;
}

export const newPlan = (items: readonly TrashItemJson[], blockers: readonly Blocker[]): DeletePlan => ({
	items,
	blockers,
	unlinked: new Set(),
	together: new Set(),
});

/** Whether a blocker's live referrers are dealt with (none, or unlinked). */
export const liveResolved = (plan: DeletePlan, blocker: Blocker): boolean =>
	blocker.live.length === 0 || plan.unlinked.has(itemKey(blocker.item));

/** Whether a blocker's referrers in the trash are dealt with (none, or deleted together). */
export const trashedResolved = (plan: DeletePlan, blocker: Blocker): boolean =>
	blocker.trashed.length === 0 || plan.together.has(itemKey(blocker.item));

/** The delete is allowed once no blocker is left. */
export const canDelete = (plan: DeletePlan): boolean =>
	plan.blockers.every((blocker) => liveResolved(plan, blocker) && trashedResolved(plan, blocker));

/** The units a delete sends, in order: the referrers deleted together first (so nothing points at the unit when its turn comes), then the units asked for. */
export function deleteRequestOf(plan: DeletePlan): TrashTarget[] {
	const together = new Map<string, TrashTarget>();
	for (const blocker of plan.blockers) {
		if (!plan.together.has(itemKey(blocker.item))) continue;
		for (const usage of blocker.trashed) together.set(usage.entryId, { type: "entry", id: usage.entryId });
	}
	return [...together.values(), ...plan.items.map(targetOf)];
}

/** Whether any unit asked for was published at some point, so its address stays reserved. */
export const keepsAddress = (items: readonly TrashItemJson[]): boolean =>
	items.some((item) => item.type === "entry" && item.everPublished);
