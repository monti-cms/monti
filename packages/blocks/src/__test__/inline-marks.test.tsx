import { buildEditorExtensions, CmsEditor, mdxToTiptap, tiptapToMdx } from "@monti-cms/admin/editor";
import { analyze, serialize, toDocument } from "@monti-cms/core/mdx";
import { readSamples } from "@monti-cms/core/testing";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CodeRefProvider, codeRefMarkExtension } from "../code-ref/provider";
import { ColorProvider, colorMarkExtension } from "../color/provider";
import { TooltipProvider, tooltipMarkExtension } from "../tooltip/provider";

/**
 * Inline marks of the block extensions (tooltip, code ref, text color). The core editor does not know the mark names; it only renders the shapes and tools the extensions register.
 * Checks that the saved text and the formatting toolbar look the same as when these lived in the core.
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

const MARKS = { tooltip: tooltipMarkExtension, "code-ref": codeRefMarkExtension, color: colorMarkExtension };

/** Admin UI with all three mark extensions added, like the reference blog setup. */
const WithMarks = ({ children }: { children: ReactNode }) => (
	<TooltipProvider>
		<CodeRefProvider>
			<ColorProvider>{children}</ColorProvider>
		</CodeRefProvider>
	</TooltipProvider>
);

const roundTrip = (mdx: string) => tiptapToMdx(mdxToTiptap(mdx));

describe("inline mark saved text", () => {
	it.each([
		':tooltip[라벨]{content="설명"} 뒤',
		'함수 :code-ref[호출부]{to="c1"}를 본다',
		':color[빨강]{fg="#dc2626" fgDark="#f87171"} :color[바탕]{bg="#fee2e2" bgDark="#4a1f1f"}',
		':color[둘 다]{fg="#2563eb" fgDark="#60a5fa" bg="#dbeafe" bgDark="#172f4d"}',
		// Nested marks wrap in tooltip → code ref → text color order (same as the former core order).
		':tooltip[:code-ref[:color[겹침]{fg="#16a34a"}]{to="c2"}]{content="설명 &quot;따옴표&quot;"}',
		':tooltip[**굵게** 와 :u[밑줄]]{content="a &amp; b"}',
		':tooltip[a\\]b]{content="닫는 괄호"}',
	])("body → editor → body is unchanged: %s", (body) => {
		const mdx = `${body}\n`;
		expect(serialize(toDocument(analyze(mdx)))).toBe(mdx);
		expect(roundTrip(mdx)).toBe(mdx);
	});

	it("sample posts (the blog post set) are unchanged after passing through the editor", () => {
		const samples = readSamples().filter(({ mdx }) => /:(tooltip|code-ref|color)\[/.test(mdx));
		expect(samples.length).toBeGreaterThan(0);
		for (const { name, mdx } of samples) {
			const once = roundTrip(mdx);
			// After one pass to the editor canonical form it stops changing, and mark directives stay verbatim.
			expect(roundTrip(once), name).toBe(once);
			for (const directive of mdx.match(/:(?:tooltip|code-ref|color)\[[^\]\n]*\]\{[^}\n]*\}/g) ?? []) {
				expect(once, `${name}: ${directive}`).toContain(directive);
			}
		}
	});

	it("editor marks render with the shape the extension provides", () => {
		const editor = new Editor({
			extensions: buildEditorExtensions(MARKS),
			content: mdxToTiptap(
				':tooltip[가]{content="설명"} :code-ref[나]{to="c1"} :color[다]{fg="#dc2626" fgDark="#f87171"}\n',
			),
		});
		const html = editor.getHTML();
		expect(html).toMatch(/<span data-cms-mark="tooltip" data-mark-content="설명" class="underline decoration-dotted/);
		expect(html).toMatch(/data-cms-mark="code-ref" data-mark-to="c1" data-code-ref="c1"/);
		expect(html).toMatch(/class="cms-color" style="--cms-fg: #dc2626; --cms-fg-dark: #f87171;?"/);
		expect(html).toContain('data-fg=""');
		editor.destroy();
	});
});

describe("formatting toolbar", () => {
	const renderEditor = async () => {
		render(
			<WithMarks>
				<CmsEditor content="안녕하세요" onChange={vi.fn()} />
			</WithMarks>,
		);
		return screen.findByRole("toolbar", { name: "서식 도구" });
	};
	const names = (toolbar: HTMLElement) =>
		within(toolbar)
			.getAllByRole("button")
			.map((button) => button.getAttribute("aria-label") || button.textContent);

	it("text color sits after the inline marks and tooltip after link", async () => {
		const toolbar = await renderEditor();
		const order = names(toolbar);
		const at = (name: string) => {
			const index = order.indexOf(name);
			expect(index, `${name} is in the toolbar`).toBeGreaterThanOrEqual(0);
			return index;
		};
		const lastInlineMark = Math.max(...["굵게", "기울임", "밑줄", "취소선", "인라인 코드"].map(at));

		expect(at("글자색")).toBeGreaterThan(lastInlineMark);
		expect(at("툴팁")).toBeGreaterThan(at("링크"));
	});

	it.each([
		[400, ["문단", "굵게", "기울임", "글자색", "링크", "툴팁", "목록", "더보기", "본문 폭"]],
		[
			500,
			["문단", "굵게", "기울임", "인라인 코드", "글자색", "링크", "툴팁", "목록", "코드 블록", "더보기", "본문 폭"],
		],
	])("tools left at width %ipx are the same as before", async (width, visible) => {
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			width: 32,
			height: 32,
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			right: 32,
			bottom: 32,
			toJSON: () => ({}),
		});
		const toolbar = await renderEditor();
		await within(toolbar).findByRole("button", { name: "더보기" });
		expect(names(toolbar)).toEqual(visible);
	});

	it("the slash menu tooltip comes after the text formatting items, and choosing it selects sample text and opens the description input", async () => {
		render(
			<WithMarks>
				<CmsEditor content="" onChange={vi.fn()} />
			</WithMarks>,
		);
		await screen.findByRole("toolbar", { name: "서식 도구" });
		const opened = vi.fn();
		window.addEventListener("cms:open-tooltip", opened);
		const run = tooltipMarkExtension.insertActions?.[0]?.run;
		const editor = new Editor({ extensions: buildEditorExtensions(MARKS), content: "<p>/</p>" });
		act(() => run?.(editor, { from: 1, to: 2 }));
		expect(editor.state.doc.textContent).toBe("툴팁 텍스트");
		expect(editor.state.selection.empty).toBe(false);
		expect(opened).toHaveBeenCalled();
		window.removeEventListener("cms:open-tooltip", opened);
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
					content={content}
					onChange={vi.fn()}
					onEditor={(editor) => {
						ready = editor;
					}}
				/>
			</WithMarks>,
		);
		await screen.findByRole("toolbar", { name: "서식 도구" });
		await vi.waitFor(() => expect(ready).not.toBeNull());
		return ready as unknown as Editor;
	};
	const focusAt = (editor: Editor, position: number | { from: number; to: number }) =>
		act(() => {
			editor.commands.setTextSelection(position);
			editor.view.focus();
		});

	it("selecting text shows text color (after marks), tooltip (before link) and code ref (after link, when a code block exists)", async () => {
		const editor = await mount("가나다\n\n```ts\nconst a = 1;\n```\n");
		focusAt(editor, { from: 1, to: 3 });
		const toolbar = await screen.findByRole("toolbar", { name: "인라인 서식" });
		const labels = [...toolbar.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"));
		expect(labels.slice(labels.indexOf("인라인 코드"))).toEqual([
			"인라인 코드",
			"위첨자",
			"아래첨자",
			"글자색",
			"툴팁 넣기",
			"링크 넣기",
			"코드 연결",
		]);
	});

	it("edits and removes the description even with the cursor at the tooltip boundary", async () => {
		const editor = await mount(':tooltip[사아]{content="설명"} 자\n');
		focusAt(editor, 1);
		act(() => fireEvent.click(screen.getByRole("button", { name: "툴팁 수정" })));
		const input = screen.getByLabelText("설명") as HTMLTextAreaElement;
		expect(input.value).toBe("설명");
		act(() => fireEvent.change(input, { target: { value: "새 설명" } }));
		act(() => fireEvent.click(screen.getByRole("button", { name: "적용" })));
		expect(tiptapToMdx(editor.getJSON())).toBe(':tooltip[사아]{content="새 설명"} 자\n');

		focusAt(editor, 1);
		act(() => fireEvent.click(screen.getByRole("button", { name: "툴팁 해제" })));
		expect(tiptapToMdx(editor.getJSON())).toBe("사아 자\n");
	});

	it("the text color button opens a color picker in the bubble and applies the chosen color", async () => {
		const editor = await mount("가나다\n");
		focusAt(editor, { from: 1, to: 3 });
		const bubble = await screen.findByRole("toolbar", { name: "인라인 서식" });
		act(() => fireEvent.click(within(bubble).getByRole("button", { name: "글자색" })));
		const dialog = screen.getByRole("dialog", { name: "글자색" });
		act(() => fireEvent.click(within(dialog).getByRole("button", { name: "글자색 빨강" })));
		expect(tiptapToMdx(editor.getJSON())).toBe(':color[가나]{fg="#dc2626" fgDark="#f87171"}다\n');
	});

	it("a code ref with no linked line is reported in the bubble", async () => {
		const editor = await mount(':code-ref[호출]{to="c9"} 뒤\n');
		focusAt(editor, 2);
		expect(await screen.findByText("연결된 코드 줄이 없습니다")).toBeTruthy();
		expect(screen.getByRole("button", { name: "코드 연결 해제" })).toBeTruthy();
	});
});
