import type { BulkOp } from "@monti-cms/core/client";
import type { ListEntriesItem } from "@monti-cms/core/runtime";
import type { ListState } from "../list-state";

/** 목록 API 응답 한 페이지. */
export interface EntriesPage {
	items: ListEntriesItem[];
	total: number;
}

/** 목록 캐시 키. 휴지통 배지 등 목록과 함께 다시 받아야 하는 것도 이 접두어 아래에 둔다. */
export const ENTRIES_KEY = ["cms", "entries"] as const;
export const entriesKey = (apiQuery: string) => [...ENTRIES_KEY, "list", apiQuery] as const;
export const TRASH_COUNT_KEY = [...ENTRIES_KEY, "trash-count"] as const;
export const foldersKey = (collection: string) => ["cms", "folders", collection] as const;

export type OptimisticOp = BulkOp | "restore";

export interface OptimisticContext {
	state: Pick<ListState, "statuses" | "folder" | "includeDescendants">;
	params?: { field?: string; ids?: string[]; id?: string | null; folderId?: string | null };
	/** 관계 필드 이름 → 고를 수 있는 항목. 새로 더한 항목의 이름을 미리 보여 줄 때 쓴다. */
	options?: Readonly<Record<string, readonly { id: string; title: string }[]>>;
}

/**
 * 작업 결과를 서버 응답 전에 목록에 미리 반영한다(낙관적 갱신). 확실히 아는 변화만 적용하고,
 * 나머지(보관 해제 뒤 상태 등)는 곧 이어지는 다시 받기에 맡긴다. 지금 필터에서 빠질 줄은 바로 뺀다.
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
