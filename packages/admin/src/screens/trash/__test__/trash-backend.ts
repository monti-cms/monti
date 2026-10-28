import type { TrashUsage } from "@monti-cms/core/site";
import type { TrashItemJson } from "../../../api/trash";
import { kindOf } from "./trash-fixtures";

/** What the fake trash API answers: a body, or an error answer. */
export type Answer = { status?: number; body: unknown };

/**
 * The trash API as the screens see it, over a list of units: the top of the trash, the inside of a folder, a search, restore, delete, empty and unlink.
 * Tests and stories hand it their units; a test swaps `onRestore` / `onDelete` to make the server refuse something. It keeps the state, so a list read
 * again after a restore no longer holds what came back.
 */
export class TrashBackend {
	/** The units at the top of the trash. */
	top: TrashItemJson[];
	/** The inside of each trashed folder, by the folder's id. */
	children: Record<string, TrashItemJson[]>;
	/** Entries pointing at an entry, by its id: what the relations endpoint and a blocked delete name. */
	referrers: Record<string, TrashUsage[]> = {};
	/** The requests that changed something, in order. */
	writes: { path: string; body: unknown }[] = [];
	onRestore: (body: { items: { type: string; id: string }[] }) => Record<string, unknown>[] | undefined = () =>
		undefined;
	onDelete: (body: { items: { type: string; id: string }[] }) => Record<string, unknown>[] | undefined = () =>
		undefined;

	constructor(top: TrashItemJson[], children: Record<string, TrashItemJson[]> = {}) {
		this.top = top;
		this.children = children;
	}

	private all(): TrashItemJson[] {
		return [...this.top, ...Object.values(this.children).flat()];
	}

	private kinds(): Record<string, number> {
		const kinds: Record<string, number> = {};
		for (const unit of this.top) kinds[kindOf(unit)] = (kinds[kindOf(unit)] ?? 0) + 1;
		return kinds;
	}

	private list(query: URLSearchParams): Answer {
		const folderId = query.get("folder");
		const kind = query.get("kind");
		const text = query.get("q")?.toLowerCase();
		const name = (unit: TrashItemJson) =>
			(unit.type === "entry" ? unit.title : unit.type === "folder" ? unit.name : unit.filename) ?? "";
		let items: TrashItemJson[];
		if (folderId) items = this.children[folderId] ?? [];
		else if (text) items = this.all().filter((unit) => name(unit).toLowerCase().includes(text));
		else items = kind ? this.top.filter((unit) => kindOf(unit) === kind) : this.top;
		items = [...items].sort((a, b) =>
			query.get("sort") === "asc" ? a.deletedAt.localeCompare(b.deletedAt) : b.deletedAt.localeCompare(a.deletedAt),
		);
		const open = folderId ? this.top.find((unit) => unit.id === folderId && unit.type === "folder") : undefined;
		return { body: { items, total: items.length, kinds: this.kinds(), ...(open ? { folder: open } : {}) } };
	}

	private remove(type: string, id: string) {
		this.top = this.top.filter((unit) => !(unit.type === type && unit.id === id));
		for (const [key, units] of Object.entries(this.children))
			this.children[key] = units.filter((unit) => !(unit.type === type && unit.id === id));
		delete this.children[id];
	}

	/** Answers a request of the admin, or `undefined` for one that is not the trash's (the caller answers those). */
	handle(
		url: URL,
		method: string,
		body?: { items?: { type: string; id: string }[]; targetIds?: string[] },
	): Answer | undefined {
		const path = url.pathname.replace("/api/monti/v1", "");
		if (path === "/trash" && method === "GET") return this.list(url.searchParams);
		if (path === "/trash/restore" && method === "POST") {
			this.writes.push({ path, body });
			const items = body?.items ?? [];
			const custom = this.onRestore({ items });
			const results = custom ?? items.map((item) => ({ type: item.type, id: item.id, ok: true }));
			for (const result of results) if (result.ok) this.remove(String(result.type), String(result.id));
			return { body: { results } };
		}
		if (path === "/trash/delete" && method === "POST") {
			this.writes.push({ path, body });
			const items = body?.items ?? [];
			const custom = this.onDelete({ items });
			const results = custom ?? items.map((item) => ({ type: item.type, id: item.id, ok: true }));
			for (const result of results) if (result.ok) this.remove(String(result.type), String(result.id));
			return { body: { results } };
		}
		if (path === "/trash/empty" && method === "POST") {
			this.writes.push({ path, body });
			const kept = this.top.flatMap((unit) => {
				const usages = unit.type === "entry" ? (this.referrers[unit.id] ?? []) : [];
				return usages.length > 0
					? [{ type: unit.type, id: unit.id, title: unit.type === "entry" ? unit.title : null, usages }]
					: [];
			});
			const deleted = this.top.length - kept.length;
			this.top = this.top.filter((unit) => kept.some((k) => k.type === unit.type && k.id === unit.id));
			return { body: { deleted, kept } };
		}
		if (path === "/references/unlink" && method === "POST") {
			this.writes.push({ path, body });
			for (const id of body?.targetIds ?? [])
				this.referrers[id] = (this.referrers[id] ?? []).filter((usage) => usage.trashed);
			return { body: { entries: 1 } };
		}
		const relations = path.match(/^\/entries\/([^/]+)\/relations$/);
		if (relations && method === "GET") {
			const id = decodeURIComponent(relations[1] ?? "");
			return {
				body: {
					incomingReferences: (this.referrers[id] ?? []).map((usage) => ({
						state: "working",
						sourceId: usage.entryId,
						sourceCollection: usage.collection,
						sourceTitle: usage.title,
						sourceSlug: null,
						kind: "entry",
						isStale: false,
						occurrences: [{ type: "metadata", path: "tagIds" }],
						sourceStatus: usage.trashed ? "trashed" : "published",
					})),
				},
			};
		}
		return undefined;
	}
}
