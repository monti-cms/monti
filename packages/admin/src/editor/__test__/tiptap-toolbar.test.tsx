import { createTranslator } from "@monti-cms/core/client";
import type { StoredDocument } from "@monti-cms/core/document";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { docOf } from "../../test/mdx";
import { editorMessages } from "../messages";
import { CmsEditor } from "../tiptap-editor";

const t = createTranslator(editorMessages);

// jsdom has no coordinates for text ranges. ProseMirror uses them to measure the cursor position after formatting is applied.
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

const renderEditor = async () => {
	const onChange = vi.fn();
	render(<CmsEditor doc={docOf("안녕하세요")} onChange={onChange} />);
	await screen.findByRole("toolbar", { name: t("toolbar.format") });
	return onChange;
};
const toolbarButtonNames = (toolbar: HTMLElement) =>
	within(toolbar)
		.getAllByRole("button")
		.map((button) => button.getAttribute("aria-label") || button.textContent);
const savedText = (onChange: ReturnType<typeof vi.fn>) => {
	const doc: StoredDocument | undefined = onChange.mock.lastCall?.[0];
	return doc ? JSON.stringify(doc) : "";
};

describe("formatting toolbar group", () => {
	it("alignment and script are single-icon dropdowns with no individual buttons", async () => {
		await renderEditor();
		const toolbar = screen.getByRole("toolbar", { name: t("toolbar.format") });

		expect(within(toolbar).getByRole("button", { name: t("toolbar.align") })).toBeTruthy();
		expect(within(toolbar).getByRole("button", { name: t("toolbar.script") })).toBeTruthy();
		expect(within(toolbar).queryByRole("button", { name: t("toolbar.alignLeftTitle") })).toBeNull();
		expect(within(toolbar).queryByRole("button", { name: t("inlineMarks.superscript") })).toBeNull();
		// When width cannot be measured (jsdom), everything shows and the overflow menu is not drawn.
		expect(within(toolbar).queryByRole("button", { name: t("toolbarRow.more") })).toBeNull();
	});

	it("the footnote button inserts a reference and a definition, and is disabled in a code block", async () => {
		let editor: Editor | null = null;
		render(
			<CmsEditor
				doc={docOf("안녕하세요\n\n```ts\nconst a = 1;\n```")}
				onChange={vi.fn()}
				onEditor={(ready) => {
					editor = ready;
				}}
			/>,
		);
		const toolbar = await screen.findByRole("toolbar", { name: t("toolbar.format") });
		await waitFor(() => expect(editor).not.toBeNull());
		const ready = editor as unknown as Editor;
		const button = () => within(toolbar).getByRole("button", { name: t("toolbar.footnote") });

		act(() => {
			ready.commands.setTextSelection(3);
		});
		await waitFor(() => expect((button() as HTMLButtonElement).disabled).toBe(false));
		fireEvent.click(button());

		const types: string[] = [];
		ready.state.doc.descendants((node) => {
			types.push(node.type.name);
		});
		expect(types).toContain("footnoteReference");
		expect(types).toContain("footnoteDefinition");

		let insideCode = 0;
		ready.state.doc.descendants((node, pos) => {
			if (node.type.name === "codeBlock") insideCode = pos + 1;
		});
		act(() => {
			ready.commands.setTextSelection(insideCode + 2);
		});
		await waitFor(() => expect((button() as HTMLButtonElement).disabled).toBe(true));
	});

	it("the link button is pressed when the cursor is inside a link", async () => {
		let editor: Editor | null = null;
		render(
			<CmsEditor
				doc={docOf("[주소](https://example.com) 뒤")}
				onChange={vi.fn()}
				onEditor={(ready) => {
					editor = ready;
				}}
			/>,
		);
		const toolbar = await screen.findByRole("toolbar", { name: t("toolbar.format") });
		await waitFor(() => expect(editor).not.toBeNull());
		// After the link, in the text that follows it.
		act(() => {
			(editor as unknown as Editor).commands.setTextSelection(5);
		});
		await waitFor(() =>
			expect(
				within(toolbar)
					.getByRole("button", { name: t("toolbar.link") })
					.getAttribute("aria-pressed"),
			).toBe("false"),
		);
		act(() => {
			(editor as unknown as Editor).commands.setTextSelection(2);
		});
		await waitFor(() =>
			expect(
				within(toolbar)
					.getByRole("button", { name: t("toolbar.link") })
					.getAttribute("aria-pressed"),
			).toBe("true"),
		);
	});

	it("choosing center in the alignment menu centers the paragraph", async () => {
		const onChange = await renderEditor();

		fireEvent.click(screen.getByRole("button", { name: t("toolbar.align") }));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("toolbar.alignCenterTitle") }));

		await waitFor(() => expect(savedText(onChange)).toContain("center"));
	});

	it("the script menu has superscript and subscript", async () => {
		await renderEditor();

		fireEvent.click(screen.getByRole("button", { name: t("toolbar.script") }));

		expect(await screen.findByRole("menuitem", { name: t("inlineMarks.superscript") })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: t("inlineMarks.subscript") })).toBeTruthy();
	});

	it("when narrow, folds the least-used tools into the overflow menu first and they still work from the menu", async () => {
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
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
		const onChange = await renderEditor();
		const toolbar = screen.getByRole("toolbar", { name: t("toolbar.format") });

		const more = await within(toolbar).findByRole("button", { name: t("toolbarRow.more") });
		// Pinned tools stay; alignment, the lowest priority, is folded.
		expect(within(toolbar).getByRole("button", { name: t("inlineMarks.bold") })).toBeTruthy();
		expect(within(toolbar).getByRole("button", { name: t("toolbar.link") })).toBeTruthy();
		expect(within(toolbar).queryByRole("button", { name: t("toolbar.align") })).toBeNull();

		fireEvent.click(more);
		fireEvent.click(await screen.findByRole("menuitem", { name: t("toolbar.alignCenterTitle") }));
		await waitFor(() => expect(savedText(onChange)).toContain("center"));
	});

	it("tool groups keep their relative order", async () => {
		await renderEditor();
		const toolbar = screen.getByRole("toolbar", { name: t("toolbar.format") });

		// Groups: paragraph style → text styling → attach to text (link, footnote) → lists and alignment → insert block.
		// Only the relative placement is asserted, so unrelated buttons can be added without touching this test.
		// Text color and tooltip are added by block extensions (see the formatting toolbar test in `@monti-cms/blocks`).
		const names = toolbarButtonNames(toolbar);
		const at = (key: Parameters<typeof t>[0]) => {
			const index = names.indexOf(t(key));
			expect(index, `${key} is in the toolbar`).toBeGreaterThanOrEqual(0);
			return index;
		};
		const lastMark = Math.max(
			at("inlineMarks.bold"),
			at("inlineMarks.italic"),
			at("inlineMarks.underline"),
			at("inlineMarks.strike"),
			at("inlineMarks.code"),
			at("toolbar.script"),
		);

		expect(at("toolbar.paragraph")).toBeLessThan(at("inlineMarks.bold"));
		expect(lastMark).toBeLessThan(at("toolbar.link"));
		expect(at("toolbar.footnote")).toBe(at("toolbar.link") + 1);
		expect(at("toolbar.footnote")).toBeLessThan(at("toolbar.list"));
		expect(at("toolbar.list")).toBeLessThan(at("toolbar.align"));
		expect(at("toolbar.align")).toBeLessThan(at("toolbar.quote"));
		expect(at("toolbar.quote")).toBeLessThan(at("toolbar.codeBlock"));
	});

	it("the block shape menu is paragraph and headings 2-4", async () => {
		await renderEditor();

		fireEvent.click(screen.getByRole("button", { name: t("toolbar.paragraph") }));

		expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
			t("toolbar.paragraph"),
			t("toolbar.heading", { level: 2 }),
			t("toolbar.heading", { level: 3 }),
			t("toolbar.heading", { level: 4 }),
		]);
	});

	it("the list menu is bullet, numbered, and task lists", async () => {
		await renderEditor();

		fireEvent.click(screen.getByRole("button", { name: t("toolbar.list") }));

		expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
			t("toolbar.bullet"),
			t("toolbar.ordered"),
			t("toolbar.todo"),
		]);
	});

	it.each([
		// This is the case without the block extensions' text color and tooltip (with them, see the formatting toolbar test in `@monti-cms/blocks`).
		[
			400,
			[
				t("toolbar.paragraph"),
				t("inlineMarks.bold"),
				t("inlineMarks.italic"),
				t("toolbar.link"),
				t("toolbar.list"),
				t("toolbar.codeBlock"),
				t("toolbarRow.more"),
				t("editorWidth.label"),
			],
		],
		[
			500,
			[
				t("toolbar.paragraph"),
				t("inlineMarks.bold"),
				t("inlineMarks.italic"),
				t("inlineMarks.code"),
				t("toolbar.link"),
				t("toolbar.list"),
				t("toolbar.codeBlock"),
				t("toolbar.upload"),
				t("customBlockMenu.label"),
				t("toolbarRow.more"),
				t("editorWidth.label"),
			],
		],
	])("at %ipx wide, it keeps the tools in the set priority order", async (width, visible) => {
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
		await renderEditor();
		const toolbar = screen.getByRole("toolbar", { name: t("toolbar.format") });

		await within(toolbar).findByRole("button", { name: t("toolbarRow.more") });
		expect(toolbarButtonNames(toolbar)).toEqual(visible);
	});
});
