import { contentPath, LINKABLE_COLLECTIONS } from "@monti-cms/core/client";
import { Editor, type JSONContent } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { buildEditorExtensions } from "./extensions";
import { type InternalLinkItem, insertInternalLink, internalLinkHref, parseInternalLinkTrigger } from "./internal-link";
import { mdxToTiptap, storedToTiptap, tiptapToMdx, tiptapToStored } from "./tiptap-content";

const ID = "123e4567-e89b-42d3-a456-426614174000";
const collection = LINKABLE_COLLECTIONS[0] as string;

const item = (overrides: Partial<InternalLinkItem> = {}): InternalLinkItem => ({
	id: ID,
	collection,
	title: "Next.js 완전 정복",
	slug: "nextjs-guide",
	...overrides,
});

describe("Internal Link ([[) Trigger Contract", () => {
	it("detects [[ trigger correctly", () => {
		expect(parseInternalLinkTrigger("Hello world [[").active).toBe(true);
		expect(parseInternalLinkTrigger("Hello world [[").query).toBe("");

		expect(parseInternalLinkTrigger("참조할 글: [[리액트").active).toBe(true);
		expect(parseInternalLinkTrigger("참조할 글: [[리액트").query).toBe("리액트");

		expect(parseInternalLinkTrigger("이미 닫힌 링크 [[완료]]").active).toBe(false);
		expect(parseInternalLinkTrigger("일반 텍스트 [단일 대괄호]").active).toBe(false);
	});
});

describe("internal links in the editor", () => {
	let editor: Editor | undefined;
	afterEach(() => editor?.destroy());

	const typed = (text: string) => {
		editor = new Editor({ extensions: buildEditorExtensions(), content: `<p>${text}</p>` });
		return editor;
	};

	const linkMarks = (json: JSONContent) =>
		(json.content ?? []).flatMap((block) =>
			(block.content ?? []).flatMap((node) => (node.marks ?? []).filter((mark) => mark.type === "link")),
		);

	it("inserts a link to the entry, showing the address of its path", () => {
		const current = typed("See [[next");

		insertInternalLink(current, { from: 5, to: 11 }, item());

		expect(linkMarks(current.getJSON())).toEqual([
			{ type: "link", attrs: expect.objectContaining({ entryId: ID, href: internalLinkHref(item()) }) },
		]);
		expect(current.getText()).toContain("Next.js 완전 정복");
	});

	it("saves the id alone: the address shown in the editor is not stored", () => {
		const current = typed("See [[next");
		insertInternalLink(current, { from: 5, to: 11 }, item());

		const stored = tiptapToStored(current.getJSON());

		const marks = JSON.stringify(stored);
		expect(marks).toContain(`"entryId":"${ID}"`);
		expect(marks).not.toContain("href");
		expect(marks).not.toContain(contentPath(collection, "nextjs-guide") ?? "never");
	});

	it("writes the id into the MDX, and the same text opens as the same link", () => {
		const current = typed("See [[next");
		insertInternalLink(current, { from: 5, to: 11 }, item());

		const mdx = tiptapToMdx(current.getJSON());

		expect(mdx).toContain(`(entry:${ID})`);
		const reopened = mdxToTiptap(mdx);
		expect(linkMarks(reopened)[0]?.attrs).toMatchObject({ entryId: ID });
		expect(tiptapToMdx(reopened)).toBe(mdx);
	});

	it("opens a stored document with a link by id and saves it back unchanged", () => {
		const stored = tiptapToStored(mdxToTiptap(`A [post](entry:${ID}) and [site](https://example.com "T").`));
		if (!stored) throw new Error("not a document");

		const again = tiptapToStored(storedToTiptap(stored));

		expect(JSON.stringify(again)).toBe(JSON.stringify(stored));
		expect(JSON.stringify(stored)).toContain(`"entryId":"${ID}"`);
		expect(JSON.stringify(stored)).toContain('"href":"https://example.com"');
	});

	it("inserts only the title for a collection that has no public path", () => {
		const current = typed("See [[x");

		insertInternalLink(current, { from: 5, to: 8 }, item({ collection: "no-such-collection" }));

		expect(linkMarks(current.getJSON())).toEqual([]);
		expect(current.getText()).toContain("Next.js 완전 정복");
	});
});
