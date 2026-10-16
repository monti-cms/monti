import type { BulkOp, ListEntriesItem } from "@monti-cms/core/site";
import type { EntriesPage } from "../../api/entries";
import type { ListState } from "../list-state";

export type OptimisticOp = BulkOp | "restore";

export interface OptimisticContext {
	state: Pick<ListState, "statuses" | "folder" | "includeDescendants">;
	params?: { field?: string; ids?: string[]; id?: string | null; folderId?: string | null };
	/** Relation field name -> selectable items. Used to preview the name of a newly added item. */
	options?: Readonly<Record<string, readonly { id: string; title: string }[]>>;
}

/**
 * Reflects the action result into the list before the server responds (optimistic update). Applies only changes known for certain,
 * and leaves the rest (e.g. state after unarchiving) to the refetch that follows soon. Rows that drop out of the current filter are removed right away.
 */
export function applyOptimistic(
	page: EntriesPage,
	op: OptimisticOp,
	ids: ReadonlySet<string>,
	context: OptimisticContext,
): EntriesPage {
	const { state, params = {} } = context;
	const hidesStatus = (status: ListEntriesItem["status"]) =>
		state.statuses.length > 0 && !(state.statuses as readonly string[]).includes(status);

	const patch = (item: ListEntriesItem): ListEntriesItem | null => {
		switch (op) {
			case "trash":
			case "permanentDelete":
			case "restore":
				return null;
			case "archive":
				return hidesStatus("archived") ? null : { ...item, status: "archived" };
			case "publish":
				return hidesStatus("published") ? null : { ...item, status: "published", hasUnpublishedChanges: false };
			case "folder.move": {
				const folderId = params.folderId ?? null;
				const leaves = state.folder !== "all" && !state.includeDescendants && folderId !== state.folder;
				return leaves ? null : { ...item, folderId };
			}
			case "relation.add":
			case "relation.remove":
			case "relation.set": {
				const field = params.field;
				if (!field) return item;
				const current = item.relations[field] ?? [];
				const titled = (id: string) => ({
					id,
					title: context.options?.[field]?.find((option) => option.id === id)?.title ?? id,
				});
				const ids = params.ids ?? [];
				const next =
					op === "relation.add"
						? [...current, ...ids.filter((id) => !current.some((value) => value.id === id)).map(titled)]
						: op === "relation.remove"
							? current.filter((value) => !ids.includes(value.id))
							: params.id
								? [titled(params.id)]
								: [];
				return { ...item, relations: { ...item.relations, [field]: next } };
			}
			default:
				return item;
		}
	};

	let removed = 0;
	const items: ListEntriesItem[] = [];
	for (const item of page.items) {
		if (!ids.has(item.id)) {
			items.push(item);
			continue;
		}
		const next = patch(item);
		if (next) items.push(next);
		else removed += 1;
	}
	return { items, total: Math.max(0, page.total - removed) };
}
