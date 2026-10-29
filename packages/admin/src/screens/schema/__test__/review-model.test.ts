import { describe, expect, it } from "vitest";
import type { SchemaEditPreview, SuggestedTransform } from "../../../api/schema";
import type { ChangeItem } from "../change-list";
import {
	deletesValues,
	initialPicks,
	type Picks,
	type ReviewBlock,
	requestOf,
	reviewBlocks,
	reviewLabels,
	reviewTarget,
} from "../review-model";

const field = (label: string, extra: object = {}) => ({ kind: "text", label, ...extra });
const post = (fields: Record<string, unknown>) => ({ label: "게시글", kind: "document", fields });

const change = (kind: string, rest: object) => ({ kind, collection: "post", ...rest });
const impact = (key: string, changeOf: object, over: object = {}) => ({
	change: changeOf,
	key,
	entries: 1,
	sample: [],
	consequence: "none",
	checked: true,
	...over,
});
const decision = (key: string, changeOf: object, suggestions: unknown[], over: object = {}) => ({
	key,
	change: changeOf,
	entries: 148,
	sample: [],
	suggestions,
	chosen: null,
	...over,
});
const previewOf = (over: object): SchemaEditPreview =>
	({
		valid: true,
		issues: [],
		changed: true,
		impacts: [],
		decisions: [],
		transforms: [],
		problems: [],
		baseline: "applied",
		bodiesRead: 0,
		...over,
	}) as unknown as SchemaEditPreview;

const rename: SuggestedTransform = { op: "renameField", collection: "post", from: "summary", to: "excerpt" };
const dropSubtitle: SuggestedTransform = { op: "dropField", collection: "post", field: "subtitle" };
const trash: SuggestedTransform = { op: "trashLocale", locale: "en" };

describe("requestOf", () => {
	it("leaves the transforms to the server until a pick is made", () => {
		expect(requestOf({}, [], undefined, [])).toEqual({ schema: {}, transforms: undefined, renames: [] });
	});

	it("sends the picks that are transforms, without the ones that are not picked", () => {
		const picks: Picks = { a: rename, b: null, c: dropSubtitle };
		expect(requestOf({}, [], picks, []).transforms).toEqual([rename, dropSubtitle]);
	});

	it("sends the languages whose translations go to the trash as trashLocales, not as transforms", () => {
		const request = requestOf({}, [], { a: rename, b: trash }, ["memo"]);
		expect(request.trashLocales).toEqual(["en"]);
		expect(request.transforms).toEqual([rename]);
		expect(request.dropCollections).toEqual(["memo"]);
		expect(requestOf({}, [], { b: null }, [])).not.toHaveProperty("trashLocales");
	});
});

describe("deletesValues", () => {
	it("is true for a collection deleted with its entries", () => {
		expect(deletesValues({}, [], 1)).toBe(true);
	});

	it("is true when a dropped field has values in some entry and false when none has", () => {
		const picks: Picks = { subtitle: dropSubtitle };
		expect(deletesValues(picks, [{ key: "subtitle", entries: 132 }], 0)).toBe(true);
		expect(deletesValues(picks, [{ key: "subtitle", entries: 0 }], 0)).toBe(false);
	});

	it("is false for keeping values, moving them, or sending translations to the trash", () => {
		expect(deletesValues({ a: null, b: rename, c: trash }, [{ key: "a", entries: 5 }], 0)).toBe(false);
		expect(deletesValues(undefined, [], 0)).toBe(false);
	});
});

describe("initialPicks", () => {
	it("starts from the pick the server made for each decision", () => {
		expect(initialPicks([decision("a", {}, [], { chosen: rename }), decision("b", {}, [])] as never)).toEqual({
			a: rename,
			b: null,
		});
	});
});

describe("reviewBlocks", () => {
	const draft = {
		collections: {
			post: post({ title: field("제목"), excerpt: field("요약"), lead: field("도입"), status: field("상태") }),
		},
	};
	const decisions = [
		decision(
			"field_removed:post:summary",
			change("field_removed", { field: "summary", fieldKind: "text" }),
			[rename, { op: "dropField", collection: "post", field: "summary" }],
			{ chosen: rename },
		),
		decision("field_removed:post:subtitle", change("field_removed", { field: "subtitle", fieldKind: "text" }), [
			dropSubtitle,
		]),
		decision(
			"field_added:post:format",
			change("field_added", { field: "format", fieldKind: "select", required: true }),
			[{ op: "setDefault", collection: "post", field: "format", value: "note" }],
		),
		decision("option_removed:post:status:old", change("option_removed", { field: "status", option: "old" }), []),
		decision("locale_removed:en", { kind: "locale_removed", locale: "en" }, [trash]),
		decision("collection_removed:memo", { kind: "collection_removed", collection: "memo" }, []),
	];
	const types = (blocks: ReviewBlock[]) => blocks.map((block) => `${block.type}:${block.key}`);

	it("makes one block of a rename: the added field and the removed one are not listed again", () => {
		const blocks = reviewBlocks({
			preview: previewOf({
				decisions: decisions.slice(0, 1),
				impacts: [
					impact("field_renamed:post:summary:excerpt", change("field_renamed", { from: "summary", to: "excerpt" })),
					impact(
						"field_added:post:excerpt",
						change("field_added", { field: "excerpt", fieldKind: "text", required: false }),
					),
					impact("field_removed:post:summary", change("field_removed", { field: "summary", fieldKind: "text" })),
				],
			}),
			draft,
			renames: [{ kind: "field", collection: "post", from: "summary", to: "excerpt" }],
			removals: [],
			settings: [],
		});
		expect(types(blocks)).toEqual(["rename:field_removed:post:summary"]);
	});

	it("is a removal, offering the other fields of its kind but not the title, when the writer did not rename it", () => {
		const blocks = reviewBlocks({
			preview: previewOf({
				decisions: [decisions[1]],
				impacts: [
					impact("field_removed:post:subtitle", change("field_removed", { field: "subtitle", fieldKind: "text" })),
				],
			}),
			draft: {
				collections: {
					post: post({
						title: field("제목", { required: true }),
						excerpt: field("요약"),
						status: { kind: "select", label: "s", options: {} },
					}),
				},
			},
			renames: [],
			removals: [],
			settings: [],
		});
		expect(blocks).toHaveLength(1);
		expect(blocks[0]).toMatchObject({ type: "removed", field: "subtitle", targets: ["excerpt"] });
	});

	it("keeps the order: choices first, then addresses and new collections, deleted collections, settings", () => {
		const blocks = reviewBlocks({
			preview: previewOf({
				decisions,
				impacts: [
					impact("collection_added:note", { kind: "collection_added", collection: "note" }),
					impact(
						"collection_path_changed:post",
						change("collection_path_changed", { from: "/posts/:slug", to: "/blog/:slug" }),
					),
					impact(
						"field_type_changed:post:body",
						change("field_type_changed", { field: "body", from: "text", to: "select" }),
					),
					impact(
						"collection_removed:memo",
						{ kind: "collection_removed", collection: "memo" },
						{
							drop: {
								entries: 23,
								trashed: 2,
								translations: 0,
								folders: 2,
								addresses: 31,
								unlinked: { count: 0, sample: [] },
								bodyLinks: 0,
							},
						},
					),
					impact(
						"field_added:post:format",
						change("field_added", { field: "format", fieldKind: "select", required: true }),
					),
					impact("locale_removed:en", { kind: "locale_removed", locale: "en" }),
				],
			}),
			draft,
			renames: [{ kind: "field", collection: "post", from: "summary", to: "excerpt" }],
			removals: [{ name: "memo", label: "메모", kind: "document" }],
			settings: [{ path: "site.name", from: "a", to: "b" }],
		});
		expect(types(blocks)).toEqual([
			"rename:field_removed:post:summary",
			"removed:field_removed:post:subtitle",
			"required:field_added:post:format",
			"option:option_removed:post:status:old",
			"locale:locale_removed:en",
			"path:collection_path_changed:post",
			"added:collection_added:note",
			"change:field_type_changed:post:body",
			"drop:collection_removed:memo",
			"setting:setting:site.name",
		]);
	});

	it("does not ask again about a collection the writer deleted, and lists a field made required that was there before", () => {
		const blocks = reviewBlocks({
			preview: previewOf({
				decisions: [
					decisions[5],
					decision(
						"field_required_changed:post:title",
						change("field_required_changed", { field: "title", required: true }),
						[{ op: "setDefault", collection: "post", field: "title", value: "" }],
					),
				],
			}),
			draft,
			renames: [],
			removals: [{ name: "memo", label: "메모", kind: "document" }],
			settings: [],
		});
		expect(types(blocks)).toEqual(["required:field_required_changed:post:title"]);
	});

	it("lists no block for a field that stopped being required", () => {
		const blocks = reviewBlocks({
			preview: previewOf({
				impacts: [
					impact(
						"field_required_changed:post:title",
						change("field_required_changed", { field: "title", required: false }),
					),
				],
			}),
			draft,
			renames: [],
			removals: [],
			settings: [],
		});
		expect(types(blocks)).toEqual(["change:field_required_changed:post:title"]);
	});
});

describe("reviewLabels", () => {
	const saved = {
		collections: { memo: { label: "메모", kind: "item", fields: { gone: field("사라진 필드") } } },
		locales: [{ code: "en", name: "English" }],
	};
	const draft = { collections: { post: post({ title: field("제목") }) }, locales: [{ code: "ko", name: "한국어" }] };
	const labels = reviewLabels(draft, saved);

	it("reads names from the draft and falls back to the saved file for what the draft lost", () => {
		expect(labels.collection("post")).toBe("게시글");
		expect(labels.collection("memo")).toBe("메모");
		expect(labels.field("memo", "gone")).toBe("사라진 필드");
		expect(labels.locale("en")).toBe("English");
		expect(labels.locale("ko")).toBe("한국어");
	});

	it("falls back to the identifier and knows the kind of a collection", () => {
		expect(labels.collection("nothing")).toBe("nothing");
		expect(labels.field("post", "nothing")).toBe("nothing");
		expect(labels.locale("fr")).toBe("fr");
		expect(labels.kind("memo")).toBe("item");
		expect(labels.kind("post")).toBe("document");
	});
});

describe("reviewTarget", () => {
	const item = (over: Partial<ChangeItem>): ChangeItem =>
		({
			id: "x",
			area: "collections",
			subject: { kind: "field", name: "a", label: "A" },
			tag: "edited",
			revert: (state: never) => state,
			...over,
		}) as ChangeItem;

	it("names the collection when every change is inside one", () => {
		expect(reviewTarget([item({ collection: "post" }), item({ id: "y", collection: "post" })])).toEqual({
			kind: "collection",
			name: "post",
			count: 2,
		});
	});

	it("names the deleted collections when nothing else changed", () => {
		const removed = item({
			collection: "memo",
			subject: { kind: "collection", name: "memo", label: "메모" },
			tag: "removed",
		});
		expect(reviewTarget([removed])).toEqual({ kind: "removed", names: ["memo"] });
	});

	it("names the area for languages, site or admin changes", () => {
		expect(reviewTarget([item({ area: "locales" })])).toEqual({ kind: "area", area: "locales", count: 1 });
		expect(reviewTarget([item({ area: "site" }), item({ id: "y", area: "site" })])).toEqual({
			kind: "area",
			area: "site",
			count: 2,
		});
	});

	it("is only the number when the changes spread over several places", () => {
		expect(reviewTarget([item({ collection: "post" }), item({ id: "y", area: "locales" })])).toEqual({
			kind: "all",
			count: 2,
		});
		expect(reviewTarget([item({ collection: "post" }), item({ id: "y", collection: "memo" })])).toEqual({
			kind: "area",
			area: "collections",
			count: 2,
		});
	});
});
