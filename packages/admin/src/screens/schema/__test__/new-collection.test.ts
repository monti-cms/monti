import { describe, expect, it } from "vitest";
import { newCollectionForm } from "../new-collection";

const form = (input: Partial<Parameters<typeof newCollectionForm>[0]>) =>
	newCollectionForm({ name: "", typedId: null, kind: "document", typedPath: null, taken: ["post", "memo"], ...input });

describe("the values of the new-collection sheet", () => {
	it("makes the identifier from the name and the address from the identifier", () => {
		expect(form({ name: "Blog posts" })).toMatchObject({
			id: "blog-posts",
			path: "/blog-posts/:slug",
			idIssue: null,
			ready: true,
		});
	});

	it("keeps what the writer typed instead of following the name", () => {
		const typed = form({ name: "Notes", typedId: "note", typedPath: "/n/:slug" });
		expect(typed).toMatchObject({ id: "note", path: "/n/:slug", ready: true });
	});

	it("is not ready without a name, and waits for an identifier when the name has no ASCII letters", () => {
		expect(form({}).ready).toBe(false);
		// A Korean name suggests nothing: no error yet, but it cannot be created either.
		expect(form({ name: "노트" })).toMatchObject({ id: "", idIssue: null, ready: false });
		expect(form({ name: "노트", typedId: "note" })).toMatchObject({ id: "note", ready: true });
		// The writer cleared the identifier they typed: now it is called missing.
		expect(form({ name: "노트", typedId: "" })).toMatchObject({ idIssue: "idEmpty", ready: false });
	});

	it("refuses an identifier that is taken, reserved or malformed with the one reason", () => {
		expect(form({ name: "메모", typedId: "memo" })).toMatchObject({ idIssue: "taken", ready: false });
		expect(form({ name: "x", typedId: "9lives" })).toMatchObject({ idIssue: "pattern", ready: false });
		expect(form({ name: "x", typedId: "note" }).idIssue).toBeNull();
	});

	it("gives an item no public address unless one is typed", () => {
		expect(form({ name: "Tags", kind: "item" })).toMatchObject({ path: "", ready: true });
		expect(form({ name: "Tags", kind: "item", typedPath: "/tags/:slug" }).path).toBe("/tags/:slug");
	});

	it("refuses an address without a slash or without :slug", () => {
		expect(form({ name: "Notes", typedPath: "notes/:slug" })).toMatchObject({ pathIssue: "slash", ready: false });
		expect(form({ name: "Notes", typedPath: "/notes" })).toMatchObject({ pathIssue: "slug", ready: false });
	});
});
