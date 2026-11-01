import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../../../core/test/any-site";
import { testSite } from "../../../../../core/test/site";
import { docOf } from "../../../test/mdx";
import { entryPath, publicHref } from "../entry-address";
import { hasUnpublishedChanges } from "../entry-status";

const entry = { collection: contentCollection, workingSlug: "first-post", publishedSlug: "first-post" };

/** A collection of the site that has no public page. */
const withoutPage = testSite.COLLECTIONS.find((name) => testSite.contentPath(name, "x") === null);

describe("entry address", () => {
	it("WRITE-W8 writes the public path of the draft, and leaves the slug as dots for an entry that has none yet", () => {
		const path = entryPath(testSite, entry);
		expect(path).toContain("/first-post");
		expect(entryPath(testSite, { ...entry, workingSlug: null })).toBe(path?.replace("first-post", "…"));
		expect(entryPath(testSite, { ...entry, workingSlug: "renamed" })).toBe(path?.replace("first-post", "renamed"));
	});

	it("WRITE-W8 is nothing for a collection with no public page", () => {
		expect(withoutPage).toBeTypeOf("string");
		expect(entryPath(testSite, { ...entry, collection: withoutPage as string })).toBeNull();
	});

	it("WRITE-W8 opens the published address, and nothing for an entry that was never published", () => {
		expect(publicHref(testSite, { ...entry, workingSlug: "renamed" })).toBe(entryPath(testSite, entry));
		expect(publicHref(testSite, { ...entry, publishedSlug: null })).toBeNull();
	});
});

describe("unpublished changes", () => {
	const doc = docOf("첫 문단");
	const published = {
		status: "published" as const,
		workingSlug: "first-post",
		publishedSlug: "first-post",
		working: { metadata: { title: "글", intro: "소개" }, doc },
		published: { metadata: { intro: "소개", title: "글" }, doc: docOf("첫 문단") },
	};

	it("WRITE-W4 has none while the saved draft is what was published, whatever the order of the keys", () => {
		expect(hasUnpublishedChanges(testSite, published, false)).toBe(false);
	});

	it("WRITE-W4 has some once the body, a property or the address differs, or the editor holds unsaved changes", () => {
		expect(
			hasUnpublishedChanges(testSite, { ...published, working: { ...published.working, doc: docOf("다른") } }, false),
		).toBe(true);
		expect(
			hasUnpublishedChanges(
				testSite,
				{ ...published, working: { ...published.working, metadata: { title: "새 제목" } } },
				false,
			),
		).toBe(true);
		expect(hasUnpublishedChanges(testSite, { ...published, workingSlug: "renamed" }, false)).toBe(true);
		expect(hasUnpublishedChanges(testSite, published, true)).toBe(true);
	});

	it("WRITE-W4 has none for a draft, or without an entry", () => {
		expect(hasUnpublishedChanges(testSite, { ...published, status: "draft" as never }, true)).toBe(false);
		expect(hasUnpublishedChanges(testSite, null, true)).toBe(false);
	});
});
