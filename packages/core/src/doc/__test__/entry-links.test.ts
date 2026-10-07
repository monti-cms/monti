import { describe, expect, it } from "vitest";
import { testSite } from "../../../test/site";
import { collectRefs } from "../document-refs";
import { entryIdOfHref, entryLinkIds } from "../entry-links";
import {
	canonicalDocument,
	readStoredDocument,
	STORED_DOCUMENT_VERSION,
	type StoredDocument,
} from "../stored-document";
import type { CmsMark, CmsNode } from "../types";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER = "123e4567-e89b-42d3-a456-426614174001";

const linkMarks = (doc: StoredDocument) => {
	const marks: CmsMark[] = [];
	const visit = (nodes: readonly CmsNode[]) => {
		for (const node of nodes) {
			marks.push(...(node.marks ?? []).filter((mark) => mark.type === "link"));
			visit(node.content ?? []);
		}
	};
	visit(doc.content);
	return marks;
};

const link = (label: string, attrs: Record<string, string>): CmsNode => ({
	type: "text",
	text: label,
	marks: [{ type: "link", attrs }],
});
const plain = (value: string): CmsNode => ({ type: "text", text: value });
const paragraph = (...content: CmsNode[]): CmsNode => ({ type: "paragraph", content });
const doc = (...content: CmsNode[]): StoredDocument => ({ type: "doc", version: STORED_DOCUMENT_VERSION, content });

describe("links in a stored document", () => {
	it("only the form entry:<uuid> names an entry; anything else stays an address", () => {
		expect(entryIdOfHref(`entry:${ID.toUpperCase()}`)).toBe(ID);
		for (const href of ["entry:abc", `entry:${ID}/x`, `/entry:${ID}`, `xentry:${ID}`, ""]) {
			expect(entryIdOfHref(href)).toBeUndefined();
		}
		const stored = canonicalDocument(testSite, doc(paragraph(link("x", { href: "entry:not-an-id" }))));
		expect(linkMarks(stored).map((mark) => mark.attrs)).toEqual([{ href: "entry:not-an-id" }]);
	});

	it("an internal link is { entryId } and an external one { href, title? }: the address of an entry link is dropped", () => {
		const stored = canonicalDocument(
			testSite,
			doc(
				paragraph(
					link("in", { entryId: ID, href: "/posts/a", title: "t" }),
					plain(" and "),
					link("out", { href: "https://example.com/a", title: "Title" }),
				),
			),
		);

		expect(linkMarks(stored).map((mark) => mark.attrs)).toEqual([
			{ entryId: ID },
			{ href: "https://example.com/a", title: "Title" },
		]);
		expect(STORED_DOCUMENT_VERSION).toBeGreaterThanOrEqual(3);
		expect(stored.version).toBe(STORED_DOCUMENT_VERSION);
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
		const document = doc(
			paragraph(
				link("a", { entryId: ID }),
				plain(" "),
				link("b", { entryId: OTHER }),
				plain(" "),
				link("again", { entryId: ID }),
			),
			{
				type: "bulletList",
				content: [
					{
						type: "listItem",
						content: [
							paragraph(
								plain("item "),
								link("c", { entryId: OTHER }),
								plain(" and "),
								link("out", { href: "https://example.com" }),
							),
						],
					},
				],
			},
			{ type: "blockquote", content: [paragraph(plain("quoted "), link("d", { entryId: ID }))] },
		);

		expect(collectRefs(document).links).toEqual([ID, OTHER]);
		expect(entryLinkIds(document.content)).toEqual([ID, OTHER]);
		expect(collectRefs(null).links).toEqual([]);
	});
});
