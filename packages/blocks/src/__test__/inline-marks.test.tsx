import { AdminComponentsProvider } from "@monti-cms/admin";
import { buildEditorExtensions, CmsEditor } from "@monti-cms/admin/editor";
import { analyze, serialize, toDocument } from "@monti-cms/mdx/format";
import { readSamples } from "@monti-cms/mdx/testing";
import { directiveSyntax } from "@monti-cms/syntax-directive";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../core/test/site";
import { codeRefMessages } from "../code-ref/messages";
import { codeRefComponents, codeRefMarkExtension } from "../code-ref/provider";
import { colorMessages } from "../color/messages";
import { colorComponents, colorMarkExtension } from "../color/provider";
import { docOfMdx, mdxToTiptap, tiptapToMdx } from "../test/editor-text";
import { renderSite as site } from "../test/render-config";
import { WithSite } from "../test/site";
import { tooltipMessages } from "../tooltip/messages";
import { tooltipComponents, tooltipMarkExtension } from "../tooltip/provider";

const tTooltip = testSite.createTranslator(tooltipMessages);
const tColor = testSite.createTranslator(colorMessages);
const tCodeRef = testSite.createTranslator(codeRefMessages);

/**
 * Inline marks of the block extensions (tooltip, code ref, text color). The core editor does not know the mark names; it only renders the shapes and tools the extensions register.
 * Checks that the saved text and the format card look the same as when these lived in the core.
 */

beforeAll(() => {
	const empty = () =>
		({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
	const rect = () => new DOMRect(0, 0, 0, 0);
	for (const proto of [Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
		proto.getClientRects ??= empty;
		proto.getBoundingClientRect ??= rect;
	}
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const tooltipExtension = tooltipMarkExtension(site.createTranslator(tooltipMessages));
const MARKS = {
	tooltip: tooltipExtension,
	"code-ref": codeRefMarkExtension(site.createTranslator(codeRefMessages)),
	color: colorMarkExtension(site.createTranslator(colorMessages)),
};

/** Admin UI with all three mark extensions added, like the reference blog setup. */
const WithMarks = ({ children }: { children: ReactNode }) => (
	<WithSite>
		<AdminComponentsProvider components={tooltipComponents(site)}>
			<AdminComponentsProvider components={codeRefComponents(site)}>
				<AdminComponentsProvider components={colorComponents(site)}>{children}</AdminComponentsProvider>
			</AdminComponentsProvider>
		</AdminComponentsProvider>
	</WithSite>
);

const roundTrip = (mdx: string) => tiptapToMdx(mdxToTiptap(mdx));

describe("inline mark saved text", () => {
	it.each([
		'<Tooltip content="설명">라벨</Tooltip> 뒤',
		'함수 <CodeRef to="c1">호출부</CodeRef>를 본다',
		'<Color fg="#dc2626" fgDark="#f87171">빨강</Color> <Color bg="#fee2e2" bgDark="#4a1f1f">바탕</Color>',
		'<Color fg="#2563eb" fgDark="#60a5fa" bg="#dbeafe" bgDark="#172f4d">둘 다</Color>',
		// Nested marks wrap in tooltip → code ref → text color order (same as the former core order).
		'<Tooltip content="설명 &quot;따옴표&quot;"><CodeRef to="c2"><Color fg="#16a34a">겹침</Color></CodeRef></Tooltip>',
		'<Tooltip content="a &amp; b">**굵게** 와 <u>밑줄</u></Tooltip>',
		'<Tooltip content="닫는 괄호">a]b</Tooltip>',
	])("body → editor → body is unchanged: %s", (body) => {
		const mdx = `${body}\n`;
		expect(serialize(site, toDocument(site, analyze(site, mdx)))).toBe(mdx);
		expect(roundTrip(mdx)).toBe(mdx);
	});

	it("sample posts (the blog post set) are unchanged after passing through the editor", () => {
		// The samples are stored with directives, so they are read with the extension and written back as standard MDX first.
		const syntax = [directiveSyntax()];
		const standardOf = (mdx: string, name: string) =>
			serialize(site, toDocument(site, analyze(site, mdx, name, syntax)));
		const samples = readSamples().filter(({ mdx }) => /:(tooltip|code-ref|color)\[/.test(mdx));
		expect(samples.length).toBeGreaterThan(0);
		for (const { name, mdx } of samples) {
			const once = roundTrip(standardOf(mdx, name));
			// After one pass to the editor canonical form it stops changing, and each mark stays in its standard notation.
			expect(roundTrip(once), name).toBe(once);
			for (const directive of mdx.match(/:(?:tooltip|code-ref|color)\[[^\]\n]*\]\{[^}\n]*\}/g) ?? []) {
				expect(once, `${name}: ${directive}`).toContain(standardOf(`${directive}\n`, name).trim());
			}
		}
	});

	it("editor marks render with the shape the extension provides", () => {
		const editor = new Editor({
			extensions: buildEditorExtensions(site, MARKS),
			content: mdxToTiptap(
				'<Tooltip content="설명">가</Tooltip> <CodeRef to="c1">나</CodeRef> <Color fg="#dc2626" fgDark="#f87171">다</Color>\n',
			),
		});
		const html = editor.getHTML();
		expect(html).toMatch(/<span data-monti-mark="tooltip" data-mark-content="설명" class="underline decoration-dotted/);
		expect(html).toMatch(/data-monti-mark="code-ref" data-mark-to="c1" data-code-ref="c1"/);
		expect(html).toMatch(/class="monti-color" style="--monti-fg: #dc2626; --monti-fg-dark: #f87171;?"/);
		expect(html).toContain('data-fg=""');
		editor.destroy();
	});
});

describe("slash menu", () => {
	it("choosing the tooltip selects sample text and asks for its description input", async () => {
		render(
			<WithMarks>
				<CmsEditor doc={docOfMdx("")} onChange={vi.fn()} />
			</WithMarks>,
		);
		const opened = vi.fn();
		window.addEventListener("cms:run-format-item", opened);
		const run = tooltipExtension.insertActions?.[0]?.run;
		const editor = new Editor({ extensions: buildEditorExtensions(site, MARKS), content: "<p>/</p>" });
		act(() => run?.(editor, { from: 1, to: 2 }));
		expect(editor.state.doc.textContent).toBe("툴팁 텍스트");
		expect(editor.state.selection.empty).toBe(false);
		expect(opened).toHaveBeenCalled();
		window.removeEventListener("cms:run-format-item", opened);
		editor.destroy();
	});
});

describe("inline bubble", () => {
	const editors: Editor[] = [];
	afterEach(() => {
		for (const editor of editors.splice(0)) editor.destroy();
	});
	const mount = async (content: string) => {
		let ready: Editor | null = null;
		render(
			<WithMarks>
				<CmsEditor
					doc={docOfMdx(content)}
					onChange={vi.fn()}
					onEditor={(editor) => {
						ready = editor;
					}}
				/>
			</WithMarks>,
		);
		await vi.waitFor(() => expect(ready).not.toBeNull());
		return ready as unknown as Editor;
	};
	const focusAt = (editor: Editor, position: number | { from: number; to: number }) =>
		act(() => {
			editor.commands.setTextSelection(position);
			editor.view.focus();
		});

	it("selecting text shows the footnote and then ⋯, and the site-added formats are the rows under it, in the order they were added", async () => {
		const editor = await mount("가나다\n\n```ts\nconst a = 1;\n```\n");
		focusAt(editor, { from: 1, to: 3 });
		const toolbar = await screen.findByRole("toolbar", { name: "인라인 서식" });
		const labels = [...toolbar.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"));
		// None of the three has a button of its own: they are under the ⋯, which follows the footnote.
		for (const own of ["툴팁 넣기", "코드 연결", "글자색"]) expect(labels).not.toContain(own);
		expect(labels.indexOf("사이트가 더한 서식")).toBe(labels.indexOf("각주") + 1);
		act(() => fireEvent.click(within(toolbar).getByRole("button", { name: "사이트가 더한 서식" })));
		// The code ref row is there because the body has a code block to link to.
		expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
			"툴팁 넣기",
			"코드 연결",
			"글자색",
		]);
	});

	it("leaves the code ref row out when the body has no code block", async () => {
		const editor = await mount("가나다\n");
		focusAt(editor, { from: 1, to: 3 });
		const toolbar = await screen.findByRole("toolbar", { name: "인라인 서식" });
		act(() => fireEvent.click(within(toolbar).getByRole("button", { name: "사이트가 더한 서식" })));
		expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["툴팁 넣기", "글자색"]);
	});

	it("edits and removes the description even with the cursor at the tooltip boundary", async () => {
		const editor = await mount('<Tooltip content="설명">사아</Tooltip> 자\n');
		focusAt(editor, 1);
		act(() => fireEvent.click(screen.getByRole("button", { name: tTooltip("edit") })));
		const input = screen.getByLabelText(tTooltip("content.label")) as HTMLTextAreaElement;
		expect(input.value).toBe("설명");
		act(() => fireEvent.change(input, { target: { value: "새 설명" } }));
		act(() => fireEvent.click(screen.getByRole("button", { name: "적용" })));
		expect(tiptapToMdx(editor.getJSON())).toBe('<Tooltip content="새 설명">사아</Tooltip> 자\n');

		focusAt(editor, 1);
		act(() => fireEvent.click(screen.getByRole("button", { name: tTooltip("remove") })));
		expect(tiptapToMdx(editor.getJSON())).toBe("사아 자\n");
	});

	it("the text color row opens a color picker in the bubble and applies the chosen color", async () => {
		const editor = await mount("가나다\n");
		focusAt(editor, { from: 1, to: 3 });
		const bubble = await screen.findByRole("toolbar", { name: "인라인 서식" });
		act(() => fireEvent.click(within(bubble).getByRole("button", { name: "사이트가 더한 서식" })));
		act(() => fireEvent.click(screen.getByRole("menuitem", { name: tColor("label") })));
		const dialog = screen.getByRole("dialog", { name: tColor("label") });
		act(() => fireEvent.click(within(dialog).getByRole("button", { name: "글자색 빨강" })));
		expect(tiptapToMdx(editor.getJSON())).toBe('<Color fg="#dc2626" fgDark="#f87171">가나</Color>다\n');
	});

	it("a code ref with no linked line is reported in the bubble", async () => {
		const editor = await mount('<CodeRef to="c9">호출</CodeRef> 뒤\n');
		focusAt(editor, 2);
		expect(await screen.findByText(tCodeRef("none"))).toBeInTheDocument();
		expect(screen.getByRole("button", { name: tCodeRef("unlink") })).toBeInTheDocument();
	});
});
