import { createSite, SiteProvider } from "@monti-cms/core/client";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../core/test/site";
import { tiptapOf } from "../../test/mdx";
import { buildEditorExtensions } from "../extensions";
import { InlineBubble } from "../inline-bubble";
import { allowedMarkTools, inlineMarkTools } from "../inline-marks";
import { editorMessages } from "../messages";

/**
 * `codeBlock.features` is a setting of the site, so each test builds a site of the active test config with the features it needs (`configure`).
 * Switching a tool off only hides it from the bubble and the toolbar inside code. Marks already on the selection stay so they can be removed.
 */
type Features = NonNullable<NonNullable<typeof testConfig.codeBlock>["features"]>;
let site = testSite;
const configure = (features: Features) => {
	site = createSite({ ...testConfig, codeBlock: { ...testConfig.codeBlock, features } });
};

const renderBubble = (editor: Editor) =>
	render(
		<SiteProvider site={site}>
			<InlineBubble editor={editor} />
		</SiteProvider>,
	);

vi.mock("../../ui/tooltip", () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => children,
	TooltipTrigger: ({
		render,
		children,
	}: {
		render?: React.ReactElement<{ children?: React.ReactNode }>;
		children?: React.ReactNode;
	}) => (render ? React.cloneElement(render, {}, children ?? render.props.children) : children),
	TooltipContent: () => null,
	TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const t = testSite.createTranslator(editorMessages);

const editors: Editor[] = [];
beforeEach(() => {
	site = testSite;
});
afterEach(() => {
	cleanup();
	for (const editor of editors.splice(0)) {
		const element = editor.view.dom.parentElement;
		editor.destroy();
		element?.remove();
	}
});

const createEditor = (source: string) => {
	const element = document.createElement("div");
	document.body.append(element);
	const editor = new Editor({ element, extensions: buildEditorExtensions(site), content: tiptapOf(source) });
	editors.push(editor);
	return editor;
};

const focusAt = (editor: Editor, range: { from: number; to: number }) => {
	editor.commands.setTextSelection(range);
	editor.view.focus();
};

const BOLD = t("inlineMarks.bold");
const ITALIC = t("inlineMarks.italic");
const STRIKE = t("inlineMarks.strike");
const UNDERLINE = t("inlineMarks.underline");
const TOOLTIP = t("inlineBubble.tooltipAdd");
const FOLD = t("inlineBubble.fold");

// Code block "const a" (1-7), then the paragraph "body" (10-14).
const CODE_THEN_BODY = "```ts\nconst a\n```\n\nbody";
const CODE_RANGE = { from: 1, to: 6 };
const BODY_RANGE = { from: 10, to: 14 };

const buttonNames = () =>
	[...screen.getByRole("toolbar", { name: t("inlineBubble.selectionLabel") }).querySelectorAll("button")].map(
		(button) => button.getAttribute("aria-label"),
	);

describe("inline bubble inside code when code block tools are off", () => {
	it("offers text styles, tooltip and fold in code when everything is on", () => {
		const editor = createEditor(CODE_THEN_BODY);
		focusAt(editor, CODE_RANGE);
		renderBubble(editor);
		expect(buttonNames()).toEqual(expect.arrayContaining([BOLD, ITALIC, STRIKE, UNDERLINE, TOOLTIP, FOLD]));
	});

	it("hides bold, italic, strikethrough and underline in code when text styles are off", () => {
		configure({ textStyles: false });
		const editor = createEditor(CODE_THEN_BODY);
		focusAt(editor, CODE_RANGE);
		renderBubble(editor);
		const names = buttonNames();
		for (const name of [BOLD, ITALIC, STRIKE, UNDERLINE]) expect(names).not.toContain(name);
		expect(names).toEqual(expect.arrayContaining([TOOLTIP, FOLD]));
	});

	it("hides the tooltip button in code when tooltip is off, and the fold button when fold is off", () => {
		configure({ tooltip: false, fold: false });
		const editor = createEditor(CODE_THEN_BODY);
		focusAt(editor, CODE_RANGE);
		renderBubble(editor);
		const names = buttonNames();
		expect(names).not.toContain(TOOLTIP);
		expect(names).not.toContain(FOLD);
		expect(names).toEqual(expect.arrayContaining([BOLD, ITALIC, STRIKE, UNDERLINE]));
	});

	it("does not change the bubble outside code", () => {
		configure({ textStyles: false, tooltip: false, fold: false });
		const editor = createEditor(CODE_THEN_BODY);
		focusAt(editor, BODY_RANGE);
		renderBubble(editor);
		expect(buttonNames()).toEqual(expect.arrayContaining([BOLD, ITALIC, STRIKE, UNDERLINE, t("link.add")]));
	});

	it("keeps a mark that is already on the selection so it can be removed", () => {
		configure({ textStyles: false, tooltip: false, fold: false });
		const editor = createEditor('```ts\n// @char strong {0-4}\n// @char Tooltip {6-7} content="x"\nconst a\n```');
		expect(editor.state.doc.firstChild?.attrs.rawMode).toBe(false);
		focusAt(editor, { from: 1, to: 5 });
		renderBubble(editor);
		const names = buttonNames();
		expect(names).toContain(BOLD);
		expect(names).not.toContain(ITALIC);
		act(() => fireEvent.click(screen.getByRole("button", { name: BOLD })));
		expect(editor.isActive("bold")).toBe(false);
	});

	it("lists the effects at the cursor for removal even when their tools are off", () => {
		configure({ textStyles: false });
		const editor = createEditor("```ts\n// @char strong {0-4}\nconst a\n```");
		editor.commands.setTextSelection(3);
		editor.view.focus();
		renderBubble(editor);
		act(() => fireEvent.click(screen.getByRole("button", { name: t("markText.remove", { name: BOLD }) })));
		expect(editor.isActive("bold")).toBe(false);
	});
});

describe("allowedMarkTools and the toolbar", () => {
	const names = (editor: Editor) => allowedMarkTools(site, editor.state).map((tool) => tool.mark);
	const disabled = (editor: Editor, mark: string) =>
		inlineMarkTools(site)
			.find((tool) => tool.mark === mark)
			?.isDisabled?.(editor);

	it("drops the text styles in code only when text styles are off", () => {
		const editor = createEditor(CODE_THEN_BODY);
		editor.commands.setTextSelection(CODE_RANGE);
		expect(names(editor)).toEqual(expect.arrayContaining(["bold", "italic", "strike", "underline"]));
		expect(disabled(editor, "bold")).toBe(false);

		configure({ textStyles: false });
		expect(names(editor)).toEqual([]);
		expect(disabled(editor, "bold")).toBe(true);

		editor.commands.setTextSelection(BODY_RANGE);
		expect(names(editor)).toEqual(expect.arrayContaining(["bold", "italic", "strike", "underline"]));
		expect(disabled(editor, "bold")).toBe(false);
	});
});
