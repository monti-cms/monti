import type { TrashUsage } from "@monti-cms/core/site";
import type {
	TrashDeleteOutcome,
	TrashEmptyOutcome,
	TrashItemJson,
	TrashPage,
	TrashReferrer,
	TrashRestoreOutcome,
} from "../../../api/trash";
import type { FakeApi } from "../../../test/fake-api";
import { kindOf } from "./trash-fixtures";

/** The units a restore or a delete names. */
type Targets = { items: { type: TrashItemJson["type"]; id: string }[] };

/**
 * The trash API as the screens see it, over a list of units: the top of the trash, the inside of a folder, a search, restore, delete, empty and unlink.
 * Tests and stories hand it their units; a test swaps `onRestore` / `onDelete` to make the server refuse something. It keeps the state, so a list read
 * again after a restore no longer holds what came back. `mount` puts its routes on a {@link FakeApi}.
 */
export class TrashBackend {
	/** The units at the top of the trash. */
	top: TrashItemJson[];
	/** The inside of each trashed folder, by the folder's id. */
	children: Record<string, TrashItemJson[]>;
	/** Entries pointing at an entry, by its id: what the relations endpoint and a blocked delete name. */
	referrers: Record<string, TrashUsage[]> = {};
	onRestore: (body: Targets) => TrashRestoreOutcome[] | undefined = () => undefined;
	onDelete: (body: Targets) => TrashDeleteOutcome[] | undefined = () => undefined;

	constructor(top: TrashItemJson[], children: Record<string, TrashItemJson[]> = {}) {
		this.top = top;
		this.children = children;
	}

	/** Answers the trash routes of `api` from this backend. */
	mount(api: FakeApi): FakeApi {
		return api
			.on("GET /v1/trash", ({ query }) => this.list(query))
			.on("POST /v1/trash/restore", ({ body }) => ({ results: this.restore(body) }))
			.on("POST /v1/trash/delete", ({ body }) => ({ results: this.delete(body) }))
			.on("POST /v1/trash/empty", () => this.empty())
			.on("POST /v1/references/unlink", ({ body }) => this.unlink(body))
			.on("GET /v1/entries/:id/relations", ({ params }) => ({ incomingReferences: this.relations(params.id ?? "") }));
	}

	/**
	 * Answers a request of the story frame (`PageFrame`'s `api`), or `undefined` for one that is not the trash's. The stories still use the frame's own
	 * fetch; tests go through {@link mount}.
	 */
	handle(url: URL, method: string, body?: Targets & { targetIds?: string[] }): { body: unknown } | undefined {
		const path = url.pathname.replace("/api/monti/v1", "");
		const answer = (): unknown => {
			if (path === "/trash" && method === "GET") return this.list(url.searchParams);
			if (path === "/trash/restore" && method === "POST") return { results: this.restore(body) };
			if (path === "/trash/delete" && method === "POST") return { results: this.delete(body) };
			if (path === "/trash/empty" && method === "POST") return this.empty();
			if (path === "/references/unlink" && method === "POST") return this.unlink(body);
			const relations = path.match(/^\/entries\/([^/]+)\/relations$/);
			if (relations && method === "GET")
				return { incomingReferences: this.relations(decodeURIComponent(relations[1] ?? "")) };
			return undefined;
		};
		const result = answer();
		return result === undefined ? undefined : { body: result };
	}

	private all(): TrashItemJson[] {
		return [...this.top, ...Object.values(this.children).flat()];
	}

	private kinds(): Record<string, number> {
		const kinds: Record<string, number> = {};
		for (const unit of this.top) kinds[kindOf(unit)] = (kinds[kindOf(unit)] ?? 0) + 1;
		return kinds;
	}

	private list(query: URLSearchParams): TrashPage {
		const folderId = query.get("folder");
		const kinds = query.getAll("kind");
		const text = query.get("q")?.toLowerCase();
		const name = (unit: TrashItemJson) =>
			(unit.type === "entry" ? unit.title : unit.type === "folder" ? unit.name : unit.filename) ?? "";
		let items: TrashItemJson[];
		if (folderId) items = this.children[folderId] ?? [];
		else if (text) items = this.all().filter((unit) => name(unit).toLowerCase().includes(text));
		else items = kinds.length > 0 ? this.top.filter((unit) => kinds.includes(kindOf(unit))) : this.top;
		items = [...items].sort((a, b) =>
			query.get("sort") === "asc" ? a.deletedAt.localeCompare(b.deletedAt) : b.deletedAt.localeCompare(a.deletedAt),
		);
		const open = folderId
			? this.top.find(
					(unit): unit is Extract<TrashItemJson, { type: "folder" }> => unit.id === folderId && unit.type === "folder",
				)
			: undefined;
		return { items, total: items.length, kinds: this.kinds(), ...(open ? { folder: open } : {}) };
	}

	private remove(type: string, id: string) {
		this.top = this.top.filter((unit) => !(unit.type === type && unit.id === id));
		for (const [key, units] of Object.entries(this.children))
			this.children[key] = units.filter((unit) => !(unit.type === type && unit.id === id));
		delete this.children[id];
	}

	private restore(body: Targets | undefined): TrashRestoreOutcome[] {
		const items = body?.items ?? [];
		const results =
			this.onRestore({ items }) ??
			items.map((item): TrashRestoreOutcome => ({ type: item.type, id: item.id, ok: true }));
		for (const result of results) if (result.ok) this.remove(result.type, result.id);
		return results;
	}

	private delete(body: Targets | undefined): TrashDeleteOutcome[] {
		const items = body?.items ?? [];
		const results =
			this.onDelete({ items }) ?? items.map((item): TrashDeleteOutcome => ({ type: item.type, id: item.id, ok: true }));
		for (const result of results) if (result.ok) this.remove(result.type, result.id);
		return results;
	}

	private empty(): TrashEmptyOutcome {
		const kept = this.top.flatMap((unit) => {
			const usages = unit.type === "entry" ? (this.referrers[unit.id] ?? []) : [];
			return usages.length > 0
				? [{ type: unit.type, id: unit.id, title: unit.type === "entry" ? unit.title : null, usages }]
				: [];
		});
		const deleted = this.top.length - kept.length;
		this.top = this.top.filter((unit) => kept.some((k) => k.type === unit.type && k.id === unit.id));
		return { deleted, kept };
	}

	private unlink(body: { targetIds?: string[] } | undefined): { entries: number } {
		for (const id of body?.targetIds ?? [])
			this.referrers[id] = (this.referrers[id] ?? []).filter((usage) => usage.trashed);
		return { entries: 1 };
	}

	private relations(id: string): TrashReferrer[] {
		return (this.referrers[id] ?? []).map((usage) => ({
			state: "working",
			sourceId: usage.entryId,
			sourceCollection: usage.collection,
			sourceTitle: usage.title,
			sourceSlug: null,
			kind: "entry",
			isStale: false,
			occurrences: [{ type: "metadata", path: "tagIds" }],
			sourceStatus: usage.trashed ? "trashed" : "published",
		}));
	}
}
