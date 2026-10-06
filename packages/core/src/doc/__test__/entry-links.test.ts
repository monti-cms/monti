import { describe, expect, it } from "vitest";
import { withoutBlockIds } from "../block-ids";
import { collectRefs } from "../document-refs";
import { entryIdOfHref, entryLinkHref, entryLinkIds } from "../entry-links";
import { serialize } from "../serialize";
import {
	bodyFromMdx,
	canonicalDocument,
	fromStoredDocument,
	readStoredDocument,
	STORED_DOCUMENT_VERSION,
	type StoredDocument,
} from "../stored-document";
import type { CmsNode } from "../types";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER = "123e4567-e89b-42d3-a456-426614174001";

const linkMarks = (doc: StoredDocument) => {
	const marks: { type: string; attrs?: Record<string, unknown> }[] = [];
	const visit = (nodes: readonly CmsNode[]) => {
		for (const node of nodes) {
			marks.push(...(node.marks ?? []).filter((mark) => mark.type === "link"));
			visit(node.content ?? []);
		}
	};
	visit(doc.content);
	return marks;
};

const docOf = (mdx: string): StoredDocument => {
	const { doc } = bodyFromMdx(mdx);
	if (!doc) throw new Error("not a document");
	return doc;
};

describe("links in a stored document", () => {
	it("an internal link is { entryId } and an external one { href, title? }", () => {
		const doc = docOf(`[in](${entryLinkHref(ID)}) and [out](https://example.com/a "Title")`);

		expect(linkMarks(doc).map((mark) => mark.attrs)).toEqual([
			{ entryId: ID },
			{ href: "https://example.com/a", title: "Title" },
		]);
		expect(STORED_DOCUMENT_VERSION).toBeGreaterThanOrEqual(3);
		expect(doc.version).toBe(STORED_DOCUMENT_VERSION);
	});

	it("an entry link is written to MDX with the id, and reads back as the same document", () => {
		const body = bodyFromMdx(`See [the post](${entryLinkHref(ID)}).`);

		expect(body.mdx).toContain(`(entry:${ID})`);
		expect(body.doc).not.toBeNull();
		expect(withoutBlockIds(bodyFromMdx(body.mdx).doc?.content ?? [])).toEqual(withoutBlockIds(body.doc?.content ?? []));
	});

	it("only the form entry:<uuid> names an entry; anything else stays an address", () => {
		expect(entryIdOfHref(`entry:${ID.toUpperCase()}`)).toBe(ID);
		for (const href of ["entry:abc", `entry:${ID}/x`, `/entry:${ID}`, `xentry:${ID}`, ""]) {
			expect(entryIdOfHref(href)).toBeUndefined();
		}
		const doc = docOf("[x](entry:not-an-id)");
		expect(linkMarks(doc).map((mark) => mark.attrs)).toEqual([{ href: "entry:not-an-id" }]);
	});

	it("the editor can give an entry link an address to show in the source, and the id is still what is stored", () => {
		const doc = docOf(`[x](${entryLinkHref(ID)})`);
		const working = fromStoredDocument(doc);
		for (const node of working.content?.[0]?.content ?? []) {
			for (const mark of node.marks ?? []) if (mark.type === "link") mark.attrs = { entryId: ID, href: "/posts/a" };
		}

		expect(serialize(working)).toContain("[x](/posts/a)");
		// Core's canonical form drops the address an entry link carries.
		const given: StoredDocument = {
			type: "doc",
			version: STORED_DOCUMENT_VERSION,
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "text",
							text: "x",
							marks: [{ type: "link", attrs: { entryId: ID, href: "/posts/a", title: "t" } }],
						},
					],
				},
			],
		};
		expect(linkMarks(canonicalDocument(given)).map((mark) => mark.attrs)).toEqual([{ entryId: ID }]);
	});

	it("a version 2 document reads as the current version with its content untouched", () => {
		const v2 = {
			type: "doc",
			version: 2,
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "/posts/a" } }] }],
				},
			],
		};

		const read = readStoredDocument(v2);

		expect(read?.version).toBe(STORED_DOCUMENT_VERSION);
		expect(read?.content).toEqual(v2.content);
		expect(readStoredDocument({ ...v2, version: STORED_DOCUMENT_VERSION + 1 })).toBeUndefined();
	});

	it("collectRefs lists the entries a document links to, each once, in order, wherever the link sits", () => {
		const doc = docOf(
			[
				`[a](${entryLinkHref(ID)}) [b](${entryLinkHref(OTHER)}) [again](${entryLinkHref(ID)})`,
				`- item [c](${entryLinkHref(OTHER)}) and [out](https://example.com)`,
				`> quoted [d](${entryLinkHref(ID)})`,
			].join("\n\n"),
		);

		expect(collectRefs(doc).links).toEqual([ID, OTHER]);
		expect(entryLinkIds(doc.content)).toEqual([ID, OTHER]);
		expect(collectRefs(null).links).toEqual([]);
	});
});
