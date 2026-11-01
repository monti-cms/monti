import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { testSite } from "../../../test/site";
import { docOf as docOfText } from "../../../test/stored-content";
import { entryLinkHref, linkMarkAttrs, mapLinkAttrs } from "../../doc/entry-links";
import type { StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { internalLinkAddresses, linkAddressKey, withEntryLinks } from "../link-ids";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const pathOf = (slug: string) => testSite.contentPath(contentCollection, slug) as string;

/** The text read by the test reader, with a link to `entry:<id>` made an entry link, as a format that knows the notation writes it. */
const docOf = (text: string): StoredDocument => {
	const doc = docOfText(text);
	const content = mapLinkAttrs(doc.content, (attrs) =>
		typeof attrs.href === "string"
			? linkMarkAttrs(attrs.href, typeof attrs.title === "string" ? attrs.title : null)
			: undefined,
	);
	return { ...doc, content: content as CmsNode[] };
};

describe("turning links by address into links by id", () => {
	it("SITE-R3 finds the addresses of this site's content, each once, and no others", () => {
		const doc = docOf(
			`[a](${pathOf("a")}) [again](${pathOf("a")}) [b](${pathOf("b")}) [out](https://example.com/a) [id](${entryLinkHref(ID)})`,
		);

		expect(internalLinkAddresses(testSite, doc.content)).toEqual([
			{ collection: contentCollection, slug: "a" },
			{ collection: contentCollection, slug: "b" },
		]);
	});

	it("SITE-R3 changes a link whose address resolves, leaves one that does not, and returns the same document when nothing changes", () => {
		const doc = docOf(`[a](${pathOf("a")}) [b](${pathOf("b")})`);
		const found = new Map([[linkAddressKey(testSite, { collection: contentCollection, slug: "a" }), ID]]);

		const next = withEntryLinks(testSite, doc, found);

		const text = JSON.stringify(next);
		expect(text).toContain(`"entryId":"${ID}"`);
		expect(text).toContain(pathOf("b"));
		expect(text).not.toContain(pathOf("a"));
		expect(withEntryLinks(testSite, doc, new Map())).toBe(doc);
	});
});
