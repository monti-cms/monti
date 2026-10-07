import { buildEditorExtensions } from "@monti-cms/admin/editor";
import { analyze, serialize, toDocument } from "@monti-cms/mdx/format";
import { directiveSyntax } from "@monti-cms/syntax-directive";
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { mdxToTiptap, tiptapToMdx } from "../../test/editor-text";
import { renderSite as site } from "../../test/render-config";

const JSX = [
	'<CodeExplorer open="a.ts">',
	"",
	'```ts title="a.ts"',
	"export const a = 1;",
	"```",
	"",
	'```ts title="src/b.ts"',
	"",
	"```",
	"",
	'```text title="dir/"',
	"",
	"```",
	"",
	"</CodeExplorer>",
].join("\n");

const DIRECTIVE = [
	':::code-explorer{open="a.ts"}',
	'```ts title="a.ts"',
	"export const a = 1;",
	"```",
	"",
	'```ts title="src/b.ts"',
	"",
	"```",
	"",
	'```text title="dir/"',
	"",
	"```",
	":::",
].join("\n");

/** The same files with the empty fences written without the blank line (how an author types them). */
const TYPED = JSX.replaceAll('"\n\n```', '"\n```');

const syntax = [directiveSyntax()];

/** Loads the source into the editor and saves it again. */
const throughEditor = (source: string) => {
	const editor = new Editor({ extensions: buildEditorExtensions(site), content: mdxToTiptap(source) });
	const saved = tiptapToMdx(editor.getJSON());
	editor.destroy();
	return saved;
};

describe("code explorer round trip", () => {
	it("opens as an editor node holding code blocks, and an untouched save keeps the JSX form unchanged", () => {
		const content = mdxToTiptap(JSX);
		expect(content.content?.[0]?.type).toBe("cmsCodeExplorer");
		expect(content.content?.[0]?.content?.map((child) => child.type)).toEqual(["codeBlock", "codeBlock", "codeBlock"]);
		expect(throughEditor(JSX).trim()).toBe(JSX);
	});

	it("keeps a file with a title and no code, and a folder entry (title ending in `/`), as empty fences", () => {
		const editor = new Editor({ extensions: buildEditorExtensions(site), content: mdxToTiptap(JSX) });
		const files = editor.state.doc.firstChild;
		expect(files?.child(1).textContent).toBe("");
		expect(files?.child(1).attrs.meta).toBe('title="src/b.ts"');
		expect(files?.child(2).attrs.meta).toBe('title="dir/"');
		const saved = tiptapToMdx(editor.getJSON());
		expect(saved).toContain('```ts title="src/b.ts"\n\n```');
		expect(saved).toContain('```text title="dir/"\n\n```');
		editor.destroy();
	});

	it("keeps a paragraph that is not a code block, in place", () => {
		const source = `${JSX.replace("</CodeExplorer>", "아래 설명\n\n</CodeExplorer>")}`;
		const content = mdxToTiptap(source);
		expect(content.content?.[0]?.content?.map((child) => child.type)).toEqual([
			"codeBlock",
			"codeBlock",
			"codeBlock",
			"paragraph",
		]);
		expect(throughEditor(source).trim()).toBe(source);
	});

	it("a block without a body opens with one empty paragraph and is saved without a body again", () => {
		const source = '<CodeExplorer open="a.ts" />';
		const content = mdxToTiptap(source);
		expect(content.content?.[0]?.type).toBe("cmsCodeExplorer");
		expect(content.content?.[0]?.content).toEqual([{ type: "paragraph" }]);
		expect(throughEditor(source).trim()).toBe(serialize(site, toDocument(site, analyze(site, source))).trim());
	});

	it("is stored as a directive and parses back to the same document (and the standard JSX form)", () => {
		const analysis = analyze(site, DIRECTIVE, undefined, syntax);
		expect(analysis.errors).toEqual([]);
		const document = toDocument(site, analysis);
		expect(serialize(site, document, syntax).trim()).toBe(DIRECTIVE);
		expect(toDocument(site, analyze(site, serialize(site, document, syntax), undefined, syntax))).toEqual(document);
		// The same document in the standard notation is the JSX form.
		expect(serialize(site, document).trim()).toBe(JSX);
		expect(toDocument(site, analyze(site, JSX))).toEqual(document);
	});

	it("an empty fence typed without the blank line is the same document, so its title and emptiness are kept", () => {
		// The serializer writes every empty code block as a fence with one blank line (as it does outside this block), and both forms parse to the same document.
		expect(TYPED).not.toBe(JSX);
		expect(toDocument(site, analyze(site, TYPED))).toEqual(toDocument(site, analyze(site, JSX)));
		expect(throughEditor(TYPED).trim()).toBe(JSX);
		const typedDirective = DIRECTIVE.replaceAll('"\n\n```', '"\n```');
		expect(toDocument(site, analyze(site, typedDirective, undefined, syntax))).toEqual(
			toDocument(site, analyze(site, DIRECTIVE, undefined, syntax)),
		);
	});

	it("an explorer with no files at all is stored as an empty container", () => {
		const source = ":::code-explorer\n:::";
		const document = toDocument(site, analyze(site, source, undefined, syntax));
		expect(serialize(site, document, syntax).trim()).toBe(source);
		expect(toDocument(site, analyze(site, serialize(site, document, syntax), undefined, syntax))).toEqual(document);
	});
});
