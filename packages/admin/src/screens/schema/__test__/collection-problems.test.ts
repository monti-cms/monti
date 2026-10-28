import { describe, expect, it } from "vitest";
import { collectionProblems, placeOfProblem } from "../collection-problems";
import { draftProblems } from "../draft-problems";

const post = (fields: Record<string, unknown>) => ({
	collections: { post: { label: "Post", kind: "document", path: "/posts/:slug", fields } },
});

describe("collectionProblems", () => {
	it("has none for a draft whose fields are complete", () => {
		const file = post({
			title: { kind: "text", label: "Title", required: true },
			slug: { kind: "slug", label: "Address", from: "title" },
			format: { kind: "select", label: "Format", options: { note: "Note" } },
		});
		expect(collectionProblems(file)).toEqual([]);
	});

	it("names a select without options at the path of the field, with the collection and field", () => {
		const file = post({ format: { kind: "select", label: "Format", options: {} } });
		expect(collectionProblems(file)).toEqual([
			{
				area: "collections",
				collection: "post",
				field: "format",
				path: "collections.post.fields.format",
				code: "options",
			},
		]);
	});

	it("names a relation to a collection that does not exist, unless the code defines it", () => {
		const file = post({ author: { kind: "relation", label: "Author", to: "person" } });
		expect(collectionProblems(file).map((problem) => problem.code)).toEqual(["target"]);
		expect(collectionProblems(file, ["person"])).toEqual([]);
	});

	it("finds the problems of fields inside a conditional field, at their own path", () => {
		const file = post({
			kind: {
				kind: "conditional",
				label: "Kind",
				discriminant: { kind: "select", label: "Kind", options: { a: "A" } },
				values: { a: { extra: { kind: "select", label: "Extra", options: {} } } },
			},
		});
		expect(collectionProblems(file)).toEqual([
			{
				area: "collections",
				collection: "post",
				field: "extra",
				path: "collections.post.fields.kind.values.a.extra",
				code: "options",
			},
		]);
	});

	it("does not stop a saved file whose slug has no source (core accepts it)", () => {
		expect(
			collectionProblems(post({ title: { kind: "text", label: "T" }, slug: { kind: "slug", label: "A" } })),
		).toEqual([]);
	});

	it("names a slug made from a field that is not there", () => {
		const file = post({ slug: { kind: "slug", label: "Address", from: "missing" } });
		expect(collectionProblems(file).map((problem) => problem.code)).toEqual(["slugFrom"]);
	});
});

describe("draftProblems", () => {
	it("collects the problems of the site and of the collections", () => {
		const file = { ...post({ format: { kind: "select", label: "Format", options: {} } }), site: { homeLink: "nope" } };
		expect(draftProblems(file).map((problem) => problem.path)).toEqual([
			"site.homeLink",
			"collections.post.fields.format",
		]);
	});
});

describe("placeOfProblem", () => {
	it("opens a top-level field in place and a branch field in its branch", () => {
		expect(
			placeOfProblem({
				area: "collections",
				collection: "post",
				field: "format",
				path: "collections.post.fields.format",
				code: "options",
			}),
		).toEqual({ place: {}, name: "format" });
		expect(
			placeOfProblem({
				area: "collections",
				collection: "post",
				field: "extra",
				path: "collections.post.fields.kind.values.a.extra",
				code: "options",
			}),
		).toEqual({ place: { branch: { field: "kind", option: "a" } }, name: "extra" });
		expect(placeOfProblem({ area: "site", path: "site.homeLink", code: "home-link" })).toBeNull();
	});
});
