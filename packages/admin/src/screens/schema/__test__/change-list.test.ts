import { describe, expect, it } from "vitest";
import { changeItems, type DraftState, savedState } from "../change-list";
import {
	addCollection,
	addField,
	newField,
	type Obj,
	recordRename,
	removeField,
	renameField,
	setCollection,
	setSetting,
} from "../schema-model";

const post = {
	label: "Post",
	kind: "document",
	path: "/posts/:slug",
	fields: {
		title: { kind: "text", label: "Title", required: true },
		summary: { kind: "text", label: "Summary" },
		subtitle: { kind: "text", label: "Subtitle" },
		cover: { kind: "media", label: "Cover" },
	},
	layout: [{ fields: ["title", "summary", "subtitle", "cover"] }],
};
const saved: Obj = {
	collections: { post, memo: { label: "Memo", kind: "document", fields: { title: { kind: "text", label: "Title" } } } },
	locales: [
		{ code: "ko", name: "한국어" },
		{ code: "en", name: "English" },
	],
	defaultLocale: "ko",
};

const start = savedState(saved);
const items = (state: DraftState) => changeItems(saved, state);
const edit = (state: DraftState, change: (file: Obj) => Obj): DraftState => ({ ...state, draft: change(state.draft) });

describe("the list of changes", () => {
	it("is empty for the saved file", () => {
		expect(items(start)).toEqual([]);
	});

	it("counts each field: a rename, a removal and a new required field are three changes", () => {
		let state = edit(start, (file) =>
			setCollection(file, "post", (collection) => renameField(collection, {}, "summary", "excerpt")),
		);
		state = {
			...state,
			renames: recordRename(state.renames, { kind: "field", collection: "post", from: "summary", to: "excerpt" }),
		};
		state = edit(state, (file) => setCollection(file, "post", (collection) => removeField(collection, {}, "subtitle")));
		state = edit(state, (file) =>
			setCollection(file, "post", (collection) =>
				addField(collection, {}, "format", { ...newField("select", "Format"), required: true }),
			),
		);
		const list = items(state);
		expect(list.map((item) => [item.tag, item.subject.kind === "field" ? item.subject.name : ""])).toEqual([
			["renamed", "excerpt"],
			["added", "format"],
			["removed", "subtitle"],
		]);
		// The layout that follows the fields is not a change of its own.
		expect(list.some((item) => item.subject.kind === "layout")).toBe(false);
	});

	it("puts each change back on its own", () => {
		let state = edit(start, (file) =>
			setCollection(file, "post", (collection) => renameField(collection, {}, "summary", "excerpt")),
		);
		state = {
			...state,
			renames: recordRename(state.renames, { kind: "field", collection: "post", from: "summary", to: "excerpt" }),
		};
		state = edit(state, (file) => setCollection(file, "post", (collection) => removeField(collection, {}, "subtitle")));
		const removal = items(state).find((item) => item.tag === "removed");
		const back = removal?.revert(state) as DraftState;
		expect(Object.keys((back.draft.collections as Record<string, Obj>).post?.fields as object)).toEqual([
			"title",
			"excerpt",
			"subtitle",
			"cover",
		]);
		const rename = items(back).find((item) => item.tag === "renamed");
		const undone = rename?.revert(back) as DraftState;
		expect(undone.renames).toEqual([]);
		expect(items(undone)).toEqual([]);
		expect(undone.draft).toEqual(saved);
	});

	it("counts a collection that was never saved once, however many fields it has", () => {
		let state = edit(start, (file) => addCollection(file, "note", "document", "/notes/:slug", "Notes"));
		state = edit(state, (file) =>
			setCollection(file, "note", (collection) => addField(collection, {}, "body2", newField("text", "More"))),
		);
		const list = items(state);
		expect(list).toHaveLength(1);
		expect(list[0]?.tag).toBe("added");
		expect(items(list[0]?.revert(state) as DraftState)).toEqual([]);
	});

	it("lists a collection taken out of the list once, and takes it back", () => {
		const state: DraftState = { ...start, removed: ["memo"] };
		const list = items(state);
		expect(list).toHaveLength(1);
		expect(list[0]?.tag).toBe("removed");
		expect((list[0]?.revert(state) as DraftState).removed).toEqual([]);
	});

	it("lists a changed collection setting, a site setting and a language", () => {
		let state = edit(start, (file) =>
			setCollection(file, "post", (collection) => ({ ...collection, path: "/blog/:slug" })),
		);
		state = edit(state, (file) => setSetting(file, "site", "name", "example.dev"));
		state = edit(state, (file) => ({ ...file, locales: [...(file.locales as Obj[]), { code: "ja", name: "日本語" }] }));
		const list = items(state);
		expect(list.map((item) => item.subject.kind)).toEqual(["collectionSetting", "locale", "setting"]);
		let undone = state;
		for (const item of list) undone = item.revert(undone);
		expect(undone.draft).toEqual(saved);
	});

	it("calls a change of the source language one change", () => {
		const state = edit(start, (file) => ({
			...file,
			defaultLocale: "en",
			locales: [
				{ code: "en", name: "English" },
				{ code: "ko", name: "한국어" },
			],
		}));
		const list = items(state);
		expect(list.map((item) => item.subject.kind)).toEqual(["defaultLocale"]);
		expect((list[0]?.revert(state) as DraftState).draft).toEqual(saved);
	});
});
