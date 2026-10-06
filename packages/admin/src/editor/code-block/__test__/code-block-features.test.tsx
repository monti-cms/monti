import { createTranslator } from "@monti-cms/core/client";
import { CODE_LINE_EFFECTS, type CodeLineEffect, type CodeRule } from "@monti-cms/core/code-block";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { tiptapOf } from "../../../test/mdx";
import { withoutIds } from "../../../test/stored-doc";
import { buildEditorExtensions } from "../../extensions";
import { tiptapToStored } from "../../tiptap-content";
import { codeBlockMessages } from "../messages";
import { RulesPanel } from "../rules-panel";

/**
 * Site config `codeBlock.omitLineEffects` and `codeBlock.features` cannot be changed per test (the admin tests use one fixed site config),
 * so the resolved values are replaced here and switched per test. Turning a tool off must only hide it from the editor tools.
 */
const mocked = vi.hoisted(() => ({
	features: { rules: true, fold: true, tooltip: true, textStyles: true },
	omitted: [] as string[],
	offered: [] as unknown[],
}));

vi.mock("@monti-cms/core/code-block", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@monti-cms/core/code-block")>();
	return {
		...actual,
		CODE_BLOCK_FEATURES: mocked.features,
		OFFERED_LINE_EFFECTS: mocked.offered,
		offersCharEffect: (name: string) =>
			name === "fold"
				? mocked.features.fold
				: name === "Tooltip"
					? mocked.features.tooltip
					: mocked.features.textStyles,
	};
});

const t = createTranslator(codeBlockMessages);
const labelOf = (name: string) => CODE_LINE_EFFECTS.find((effect) => effect.name === name)?.label ?? "";

/** Turns tools off the way the site config does. `omit` is `codeBlock.omitLineEffects`. */
const configure = (options: { omit?: string[]; features?: Partial<typeof mocked.features> }) => {
	Object.assign(mocked.features, { rules: true, fold: true, tooltip: true, textStyles: true }, options.features);
	mocked.offered.splice(
		0,
		mocked.offered.length,
		...CODE_LINE_EFFECTS.filter((effect) => !(options.omit ?? []).includes(effect.name)),
	);
};

beforeEach(() => configure({}));
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
		extensions: buildEditorExtensions(),
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
		<Harness
			source={source}
			onReady={(ready) => {
				editor = ready;
			}}
		/>,
	);
	await waitFor(() => expect(document.querySelector("[data-code-block-wrapper]")).not.toBeNull());
	return editor as unknown as Editor;
};

const block = (editor: Editor) => editor.state.doc.child(0);
const gutterRow = (line: number) => document.querySelector(`[data-code-gutter] [data-line="${line}"]`) as HTMLElement;

const openLineMenu = async (line = 0) => {
	await waitFor(() => expect(gutterRow(line)).toBeTruthy());
	act(() => {
		fireEvent.contextMenu(gutterRow(line));
	});
	return screen.findByRole("menu");
};

const openRules = () => act(() => fireEvent.click(screen.getByRole("button", { name: t("rulesPanel.title") })));

const CODE = "```ts\nconst a = 1;\nconst b = 2;\nconst c = 3;\n```";
const RULE_CODE = "```ts\n// @document strong {re:/const/g}\nconst a = 1;\nconst b = 2;\n```";

describe("code block tools turned off in the site config", () => {
	describe("line menu", () => {
		it("lists only the offered line effects", async () => {
			configure({ omit: ["highlight", "plus"] });
			await mount(CODE);
			const menu = await openLineMenu(0);
			expect(within(menu).queryByRole("menuitemcheckbox", { name: labelOf("highlight") })).toBeNull();
			expect(within(menu).queryByRole("menuitemcheckbox", { name: labelOf("plus") })).toBeNull();
			expect(within(menu).getByRole("menuitemcheckbox", { name: labelOf("minus") })).toBeTruthy();
		});

		it("keeps an omitted effect that is already on the picked line so it can be turned off", async () => {
			configure({ omit: ["plus"] });
			const editor = await mount("```ts\n// @line plus {0-0}\nconst a = 1;\nconst b = 2;\n```");
			expect((block(editor).attrs.lineEffects as CodeLineEffect[]).map((effect) => effect.name)).toEqual(["plus"]);

			// A line that does not have it does not list it.
			const other = await openLineMenu(1);
			expect(within(other).queryByRole("menuitemcheckbox", { name: labelOf("plus") })).toBeNull();
			fireEvent.keyDown(document, { key: "Escape" });
			await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

			const menu = await openLineMenu(0);
			const item = within(menu).getByRole("menuitemcheckbox", { name: labelOf("plus") });
			expect(item.getAttribute("aria-checked")).toBe("true");
			act(() => fireEvent.click(item));
			expect(block(editor).attrs.lineEffects).toEqual([]);
		});

		it("hides Collapse when fold is off, but an existing fold can still be opened and removed", async () => {
			configure({ features: { fold: false } });
			const editor = await mount("```ts\n// @line collapse {0-1}\nconst a = 1;\nconst b = 2;\nconst c = 3;\n```");
			const withFold = await openLineMenu(0);
			expect(within(withFold).getByRole("menuitem", { name: new RegExp(t("lineMenu.uncollapse")) })).toBeTruthy();
			expect(within(withFold).getByRole("menuitemcheckbox", { name: t("lineMenu.openFromStart") })).toBeTruthy();
			act(() =>
				fireEvent.click(within(withFold).getByRole("menuitem", { name: new RegExp(t("lineMenu.uncollapse")) })),
			);
			expect(block(editor).attrs.lineEffects).toEqual([]);
		});

		it("does not offer Collapse on a line without a fold when fold is off", async () => {
			configure({ features: { fold: false } });
			await mount(CODE);
			const menu = await openLineMenu(0);
			expect(within(menu).queryByRole("menuitem", { name: t("lineMenu.collapse") })).toBeNull();
			expect(within(menu).getByRole("menuitemcheckbox", { name: labelOf("highlight") })).toBeTruthy();
		});

		it("offers Collapse when fold is on", async () => {
			await mount(CODE);
			const menu = await openLineMenu(0);
			expect(within(menu).getByRole("menuitem", { name: t("lineMenu.collapse") })).toBeTruthy();
		});
	});

	describe("block header", () => {
		it("hides the line effects button and the menu when nothing is offered and the block has no effects", async () => {
			configure({ omit: CODE_LINE_EFFECTS.map((effect) => effect.name), features: { fold: false } });
			await mount(CODE);
			const { CODE_ANCHOR_REF } = await import("../../added-marks");
			// Linking a line to body text (when the site has such a text style) keeps the menu useful.
			expect(!!screen.queryByRole("button", { name: t("view.lineEffects") })).toBe(!!CODE_ANCHOR_REF);
			if (!CODE_ANCHOR_REF) {
				act(() => {
					fireEvent.contextMenu(gutterRow(0));
				});
				expect(screen.queryByRole("menu")).toBeNull();
			}
		});

		it("keeps the line effects button when the block already has an effect", async () => {
			configure({ omit: CODE_LINE_EFFECTS.map((effect) => effect.name), features: { fold: false } });
			await mount("```ts\n// @line plus {0-0}\nconst a = 1;\n```");
			expect(screen.getByRole("button", { name: t("view.lineEffects") })).toBeTruthy();
		});

		it("hides the rules panel when rules is off and the block has no rules", async () => {
			configure({ features: { rules: false } });
			await mount(CODE);
			expect(screen.queryByRole("button", { name: t("rulesPanel.title") })).toBeNull();
			expect(screen.getByRole("button", { name: t("view.lineEffects") })).toBeTruthy();
		});

		it("keeps the rules panel for a block that has rules, where they can be removed but not added", async () => {
			configure({ features: { rules: false } });
			const editor = await mount(RULE_CODE);
			expect(block(editor).attrs.rawMode).toBe(false);
			expect(screen.getByRole("button", { name: t("rulesPanel.title") })).toBeTruthy();
			openRules();
			const row = await screen.findByRole("listitem", { name: t("rulesPanel.rule", { pattern: "const" }) });
			expect(screen.queryByRole("button", { name: t("rulesPanel.add") })).toBeNull();
			expect(screen.queryByRole("button", { name: t("rulesPanel.addFromSelection") })).toBeNull();
			act(() => fireEvent.click(within(row).getByRole("button", { name: t("rulesPanel.remove") })));
			expect(block(editor).attrs.rules).toEqual([]);
		});

		it("keeps showing a rule whose effect is turned off (text styles off) and saves it unchanged", async () => {
			configure({ features: { textStyles: false } });
			const editor = await mount(RULE_CODE);
			openRules();
			const row = await screen.findByRole("listitem", { name: t("rulesPanel.rule", { pattern: "const" }) });
			expect(within(row).getByLabelText(t("rulesPanel.pattern"))).toBeTruthy();
			expect((block(editor).attrs.rules as CodeRule[])[0]).toMatchObject({ name: "strong", pattern: "const" });
			expect(withoutIds(tiptapToStored(editor.getJSON()))).toEqual(withoutIds(tiptapToStored(tiptapOf(RULE_CODE))));
		});
	});

	describe("rules panel", () => {
		const renderPanel = (rules: CodeRule[], onChange = vi.fn()) => {
			render(<RulesPanel rules={rules} text="const a" lineCount={1} selection={null} onChange={onChange} />);
			return onChange;
		};
		const trigger = () => screen.getByRole("button", { name: t("rulesPanel.title") });

		it("starts a new rule with the first offered effect instead of fold", async () => {
			configure({ features: { fold: true } });
			const onChange = renderPanel([]);
			act(() => fireEvent.click(trigger()));
			const add = await screen.findByRole("button", { name: t("rulesPanel.add") });
			act(() => fireEvent.click(add));
			expect(onChange.mock.calls[0]?.[0][0]).toMatchObject({ name: "strong" });
		});

		it("starts with fold when it is the only offered effect", async () => {
			configure({ features: { textStyles: false, tooltip: false } });
			const onChange = renderPanel([]);
			act(() => fireEvent.click(trigger()));
			const add = await screen.findByRole("button", { name: t("rulesPanel.add") });
			act(() => fireEvent.click(add));
			expect(onChange.mock.calls[0]?.[0][0]).toMatchObject({ name: "fold" });
		});

		it("starts with the tooltip when only text styles are off", async () => {
			configure({ features: { textStyles: false } });
			const onChange = renderPanel([]);
			act(() => fireEvent.click(trigger()));
			const add = await screen.findByRole("button", { name: t("rulesPanel.add") });
			act(() => fireEvent.click(add));
			expect(onChange.mock.calls[0]?.[0][0]).toMatchObject({ name: "Tooltip" });
		});

		it("does not offer adding a rule when no text effect is offered", async () => {
			configure({ features: { textStyles: false, tooltip: false, fold: false } });
			renderPanel([{ id: "r1", scope: "document", name: "fold", pattern: "const", flags: "g", attrs: {} }]);
			act(() => fireEvent.click(trigger()));
			await screen.findByRole("listitem", { name: t("rulesPanel.rule", { pattern: "const" }) });
			expect(screen.queryByRole("button", { name: t("rulesPanel.add") })).toBeNull();
		});

		it("lists only the offered effects in the effect dropdown, plus the rule's current effect", async () => {
			configure({ features: { textStyles: false, tooltip: false } });
			renderPanel([{ id: "r1", scope: "document", name: "strong", pattern: "const", flags: "g", attrs: {} }]);
			act(() => fireEvent.click(trigger()));
			const effect = await screen.findByRole("combobox", { name: t("rulesPanel.effect") });
			act(() => fireEvent.click(effect));
			const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
			// Bold (the current effect) and fold (offered); italic, tooltip and so on are not.
			expect(options).toHaveLength(2);
		});
	});

	describe("round trip", () => {
		const SOURCE = [
			"```ts",
			"// @line plus {0-0}",
			"// @line collapse {1-2}",
			"// @document strong {re:/const/g}",
			"// @document fold {re:/b/g}",
			'// @char Tooltip {0-5} content="설명"',
			"const a = 1;",
			"const b = 2;",
			"const c = 3;",
			"```",
		].join("\n");

		it("loads, edits and saves a body that uses turned-off tools exactly as before", async () => {
			const before = tiptapToStored(tiptapOf(SOURCE));
			configure({
				omit: ["plus"],
				features: { rules: false, fold: false, tooltip: false, textStyles: false },
			});
			const editor = await mount(SOURCE);
			expect(block(editor).attrs.rawMode).toBe(false);
			expect(withoutIds(tiptapToStored(editor.getJSON()))).toEqual(withoutIds(before));
			expect((block(editor).attrs.lineEffects as CodeLineEffect[]).map((effect) => effect.name)).toEqual([
				"plus",
				"collapse",
			]);
			expect((block(editor).attrs.rules as CodeRule[]).map((rule) => rule.name)).toEqual(["strong", "fold"]);

			// Editing the code keeps the rest.
			act(() => {
				editor.commands.insertContentAt(block(editor).nodeSize - 1, "x");
			});
			const annotations = tiptapToStored(editor.getJSON()).content[0]?.attrs?.annotations as {
				lines?: { name: string }[];
				rules?: { name: string; pattern: string }[];
			};
			expect(annotations.rules).toContainEqual(expect.objectContaining({ name: "strong", pattern: "const" }));
			expect(annotations.lines?.map((line) => line.name)).toContain("plus");
		});
	});

	describe("text style shortcuts", () => {
		const bold = (editor: Editor) => fireEvent.keyDown(editor.view.dom, { key: "b", ctrlKey: true });
		const WITH_PARAGRAPH = `${CODE}\n\nbody`;

		it("do not add a text style inside code when text styles are off", async () => {
			configure({ features: { textStyles: false } });
			const editor = await mount(WITH_PARAGRAPH);
			act(() => {
				editor.commands.setTextSelection({ from: 2, to: 7 });
			});
			act(() => {
				bold(editor);
			});
			expect(editor.isActive("bold")).toBe(false);
		});

		it("still add a text style outside code when text styles are off", async () => {
			configure({ features: { textStyles: false } });
			const editor = await mount(WITH_PARAGRAPH);
			const start = block(editor).nodeSize + 1;
			act(() => {
				editor.commands.setTextSelection({ from: start, to: start + 4 });
			});
			act(() => {
				bold(editor);
			});
			expect(editor.isActive("bold")).toBe(true);
		});

		it("add a text style inside code while text styles are on", async () => {
			const editor = await mount(WITH_PARAGRAPH);
			act(() => {
				editor.commands.setTextSelection({ from: 2, to: 7 });
			});
			act(() => {
				bold(editor);
			});
			expect(editor.isActive("bold")).toBe(true);
		});

		it("still remove a text style that is already on the selection when text styles are off", async () => {
			configure({ features: { textStyles: false } });
			const editor = await mount("```ts\n// @char strong {0-4}\nconst a\n```");
			act(() => {
				editor.commands.setTextSelection({ from: 1, to: 5 });
			});
			expect(editor.isActive("bold")).toBe(true);
			act(() => {
				bold(editor);
			});
			expect(editor.isActive("bold")).toBe(false);
		});
	});
});
