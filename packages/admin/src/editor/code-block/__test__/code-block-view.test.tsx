import { SiteProvider } from "@monti-cms/core/client";
import type { CodeLineEffect, CodeRule } from "@monti-cms/core/code-block";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { tiptapOf } from "../../../test/mdx";
import { findBlockDOM, refineBlock } from "../../drag";
import { buildEditorExtensions } from "../../extensions";
import { inlineBubbleTarget } from "../../inline-marks";
import { tiptapToStored } from "../../tiptap-content";
import { codeBlockMessages } from "../messages";

const t = testSite.createTranslator(codeBlockMessages);
/** Highlight effect names (taken from the effect definitions). */
const HIGHLIGHT_LABEL = testSite.CODE_LINE_EFFECTS.find((effect) => effect.name === "highlight")?.label ?? "";

afterEach(cleanup);

// jsdom has no coordinates for text ranges. ProseMirror uses them to measure position after the cursor moves.
beforeAll(() => {
	const empty = () =>
		({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
	const rect = () => new DOMRect(0, 0, 0, 0);
	for (const proto of [Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
		proto.getClientRects ??= empty;
		proto.getBoundingClientRect ??= rect;
	}
});

function Harness({ source, onReady }: { source: string; onReady: (editor: Editor) => void }) {
	const editor = useEditor({
		extensions: buildEditorExtensions(testSite),
		content: tiptapOf(source),
		immediatelyRender: true,
	});
	useEffect(() => {
		if (editor) onReady(editor);
	}, [editor, onReady]);
	return <EditorContent editor={editor} />;
}

const mount = async (source: string) => {
	let editor: Editor | null = null;
	render(
		<SiteProvider site={testSite}>
			<Harness
				source={source}
				onReady={(ready) => {
					editor = ready;
				}}
			/>
		</SiteProvider>,
	);
	await waitFor(() => expect(document.querySelector("[data-code-block-wrapper]")).not.toBeNull());
	return editor as unknown as Editor;
};

const block = (editor: Editor) => editor.state.doc.child(0);
/** The annotations the first code block is saved with. */
const savedAnnotations = (editor: Editor) =>
	(tiptapToStored(testSite, editor.getJSON()).content[0]?.attrs?.annotations ?? {}) as {
		lines?: { name: string; start: number; end: number }[];
		rules?: { scope: string; name: string; pattern: string; flags: string }[];
	};
const gutterRow = (line: number) => document.querySelector(`[data-code-gutter] [data-line="${line}"]`) as HTMLElement;
const gutterLines = () =>
	[...document.querySelectorAll("[data-code-gutter] [data-line]")].map((row) => Number(row.getAttribute("data-line")));

/** Selects lines by clicking (dragging) line numbers. */
const pickLines = (from: number, to = from) => {
	fireEvent.mouseDown(gutterRow(from), { button: 0 });
	if (to !== from) fireEvent.mouseEnter(gutterRow(to));
	fireEvent.mouseUp(window);
};

/** Right-clicks a line number to open the line effect menu. */
const openLineMenu = async (line = 0) => {
	await waitFor(() => expect(gutterRow(line)).toBeTruthy());
	act(() => {
		fireEvent.contextMenu(gutterRow(line));
	});
};

const CODE = "```ts\nconst a = 1;\nconst b = 2;\nconst c = 3;\n```";

describe("code block edit view", () => {
	it("has language, file path, line effects, regex rules, line numbers, and copy in the header tools", async () => {
		await mount(CODE);
		expect(screen.getByLabelText(t("view.language"))).toBeTruthy();
		expect(screen.getByLabelText(t("view.filePath"))).toBeTruthy();
		expect(screen.getByRole("button", { name: t("view.lineEffects") })).toBeTruthy();
		expect(screen.getByRole("button", { name: t("rulesPanel.title") })).toBeTruthy();
		expect(screen.getByRole("button", { name: t("view.lineNumbers") })).toBeTruthy();
		expect(screen.getByRole("button", { name: t("view.copy") })).toBeTruthy();
	});

	it("hides language, file path, and effect tools and does not select lines when read-only", async () => {
		const editor = await mount('```ts title="src/a.ts"\nconst a = 1;\n```');
		act(() => editor.setEditable(false));
		await waitFor(() => expect(screen.queryByLabelText(t("view.language"))).toBeNull());
		expect(screen.queryByLabelText(t("view.filePath"))).toBeNull();
		expect(screen.queryByRole("button", { name: t("view.lineEffects") })).toBeNull();
		expect(screen.queryByRole("button", { name: t("rulesPanel.title") })).toBeNull();
		expect(screen.queryByRole("button", { name: t("view.lineNumbers") })).toBeNull();
		expect(screen.getByText("src/a.ts")).toBeTruthy();
		expect(screen.getByRole("button", { name: t("view.copy") })).toBeTruthy();
		await openLineMenu(0);
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("stores the file path and line number display in meta", async () => {
		const editor = await mount(CODE);
		fireEvent.change(screen.getByLabelText(t("view.filePath")), { target: { value: "src/a.ts" } });
		await waitFor(() => expect((screen.getByLabelText(t("view.filePath")) as HTMLInputElement).value).toBe("src/a.ts"));
		act(() => fireEvent.click(screen.getByRole("button", { name: t("view.lineNumbers") })));
		await waitFor(() => expect(block(editor).attrs.meta).toBe('title="src/a.ts" lnum'));
	});

	it("selects only the line on a line number click, and turning on highlight from the right-click menu is reflected in the saved format", async () => {
		const editor = await mount(CODE);
		act(() => pickLines(1));
		expect(screen.queryByRole("menu")).toBeNull();
		// No text is selected (the cursor sits at the start of the line); the line shows as a background.
		expect(editor.state.selection.empty).toBe(true);
		expect(editor.state.selection.from).toBe(1 + "const a = 1;\n".length);
		await waitFor(() =>
			expect(document.querySelectorAll("[data-code-block-wrapper] .bg-cms-primary\\/15")).toHaveLength(1),
		);
		await openLineMenu(1);
		const menu = await screen.findByRole("menu", { name: t("lineMenu.lineEffects", { line: 2 }) });
		act(() => fireEvent.click(within(menu).getByRole("menuitemcheckbox", { name: HIGHLIGHT_LABEL })));

		const effects = block(editor).attrs.lineEffects as CodeLineEffect[];
		expect(effects.map(({ name, start, end }) => [name, start, end])).toEqual([["highlight", 1, 2]]);
		await waitFor(() =>
			expect(within(menu).getByRole("menuitemcheckbox", { name: HIGHLIGHT_LABEL }).getAttribute("aria-checked")).toBe(
				"true",
			),
		);
		expect(savedAnnotations(editor).lines).toMatchObject([{ name: "highlight", start: 1, end: 2 }]);
		// Changing the effect keeps the selected lines (another effect can be turned on next).
		await waitFor(() =>
			expect(document.querySelectorAll("[data-code-block-wrapper] .bg-cms-primary\\/15")).toHaveLength(1),
		);
	});

	it("dragging to select lines and folding leaves only the first line, and the arrow toggles it even while editing", async () => {
		const editor = await mount(CODE);
		act(() => pickLines(0, 2));
		// Right-clicking inside the selected lines targets all of them.
		await openLineMenu(1);
		const menu = await screen.findByRole("menu", { name: t("lineMenu.rangeEffects", { start: 1, end: 3 }) });
		act(() => fireEvent.click(within(menu).getByRole("menuitem", { name: t("lineMenu.collapse") })));

		expect((block(editor).attrs.lineEffects as CodeLineEffect[])[0]).toMatchObject({
			name: "collapse",
			start: 0,
			end: 3,
		});
		expect(savedAnnotations(editor).lines).toMatchObject([{ name: "collapse", start: 0, end: 3 }]);
		// After creating a fold, if the cursor is on a folded line it stays expanded. Fold with the arrow.
		const toggle = await screen.findByRole("button", {
			name: new RegExp(`^(${t("view.collapseFrom", { line: 1 })}|${t("view.expandFrom", { line: 1 })})$`),
		});
		if (toggle.getAttribute("aria-expanded") === "true") act(() => fireEvent.mouseDown(toggle));
		await waitFor(() => expect(gutterLines()).toEqual([0]));
		const expand = await screen.findByRole("button", { name: t("view.expandFrom", { line: 1 }) });
		act(() => fireEvent.mouseDown(expand));
		await waitFor(() => expect(gutterLines()).toEqual([0, 1, 2]));
	});

	it("adding a regex rule shows the match count and saves the rule as is", async () => {
		const editor = await mount(CODE);
		act(() => fireEvent.click(screen.getByRole("button", { name: t("rulesPanel.title") })));
		const add = await screen.findByRole("button", { name: t("rulesPanel.add") });
		act(() => fireEvent.click(add));
		fireEvent.change(await screen.findByLabelText(t("rulesPanel.pattern")), { target: { value: "const" } });
		expect(await screen.findByText(t("rulesPanel.matches", { count: 3 }))).toBeTruthy();

		const rules = block(editor).attrs.rules as CodeRule[];
		// A new rule starts with the first offered text effect (bold by default).
		expect(rules[0]).toMatchObject({ scope: "document", name: "strong", pattern: "const", flags: "g" });
		expect(savedAnnotations(editor).rules).toMatchObject([
			{ scope: "document", name: "strong", pattern: "const", flags: "g" },
		]);
	});

	it("points to source editing when there are annotations the editor cannot display", async () => {
		await mount('```ts\n// @char Tooltip {0-3} content="하나"\n// @char Tooltip {2-5} content="둘"\nabcdef\n```');
		expect(screen.getByText(t("view.rawMode"))).toBeTruthy();
		expect(screen.queryByRole("button", { name: t("rulesPanel.title") })).toBeNull();
	});

	it("copy button copies the code without annotation lines", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
		await mount("```ts\n// @line plus\nconst a = 1;\n```");
		await act(async () => fireEvent.click(screen.getByRole("button", { name: t("view.copy") })));
		expect(writeText).toHaveBeenCalledWith("const a = 1;");
	});

	it("Shift-clicking a line number extends the selected lines", async () => {
		const editor = await mount(CODE);
		act(() => pickLines(0));
		act(() => {
			fireEvent.mouseDown(gutterRow(2), { button: 0, shiftKey: true });
			fireEvent.mouseUp(window);
		});
		await openLineMenu(2);
		expect(await screen.findByRole("menu", { name: t("lineMenu.rangeEffects", { start: 1, end: 3 }) })).toBeTruthy();
		expect(editor.state.selection.from).toBe(1);
	});

	it("selecting only the first line of a fold (the › line) still offers unfold and expand-from-start", async () => {
		const editor = await mount("```ts\n// @line collapse {0-2}\na\nb\nc\nd\n```");
		// The right-clicked line is the target even if no line was selected first.
		await openLineMenu(0);
		const menu = await screen.findByRole("menu", { name: t("lineMenu.lineEffects", { line: 1 }) });
		expect(within(menu).getByRole("menuitemcheckbox", { name: t("lineMenu.openFromStart") })).toBeTruthy();
		act(() => fireEvent.click(within(menu).getByRole("menuitem", { name: new RegExp(t("lineMenu.uncollapse")) })));
		await waitFor(() => expect(block(editor).attrs.lineEffects).toEqual([]));
	});

	it("hovering a code line still attaches only one drag handle for the whole code block", async () => {
		const editor = await mount(`문단\n\n${CODE}`);
		const text = document.querySelector("[data-code-block-wrapper] pre code") as HTMLElement;
		const inner = (text.querySelector("span") ?? text) as HTMLElement;
		const found = findBlockDOM(editor.view.dom, inner);
		expect(found?.classList.contains("node-codeBlock")).toBe(true);
		expect(found && refineBlock(found, 0, 0)).toBe(found);
	});

	it("does not show the text effect bubble while selecting lines by line number", async () => {
		const editor = await mount(CODE);
		act(() => pickLines(0, 1));
		expect(inlineBubbleTarget(editor.state)).toBeNull();
		// It shows again when text is selected directly.
		act(() => {
			editor.commands.setTextSelection({ from: 2, to: 5 });
		});
		expect(inlineBubbleTarget(editor.state)).toMatchObject({ kind: "selection" });
	});

	it("draws the warning underline text once across the whole line, and it stays after picking lines by line number", async () => {
		await mount("```ts\n// @line warning\nconst a = 1;\nconst b = 2;\n```");
		// The decoration overlay is aria-hidden and holds only the text of lines that carry a wavy underline.
		const overlayText = () =>
			[...document.querySelectorAll("[data-code-block-wrapper] [aria-hidden='true'][contenteditable='false']")]
				.map((element) => element.textContent)
				.join("");
		expect(overlayText()).toBe("const a = 1;");

		act(() => pickLines(1));
		await waitFor(() => expect(overlayText()).toBe("const a = 1;"));
	});
});
