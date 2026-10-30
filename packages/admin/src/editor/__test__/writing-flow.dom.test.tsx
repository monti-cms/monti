import type { CmsNode, StoredDocument } from "@monti-cms/core/document";
import type { BodyAllowed } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { pressOption } from "../../test/base-ui";
import { jsonResponse as json } from "../../test/fetch";
import { renderWithSite } from "../../test/site";
import { para, storedDoc, table, text } from "../../test/stored-doc";
import { editorMessages } from "../messages";
import { CmsEditor } from "../tiptap-editor";

// Flow 1, steps 02 to 05 of the canvas: the "/" menu with the template group, the format card over selected text, and the block handle with its menu
// (turn into another block, align, move, duplicate, delete) and the + that adds a block below. They check what a screenshot cannot: requests, keys, roles
// and names, what is hidden, and what the document holds afterwards.

const t = testSite.createTranslator(editorMessages);
const tc = testSite.createTranslator(commonMessages);

// jsdom has no coordinates for text ranges. ProseMirror uses them to measure the cursor position.
beforeAll(() => {
	const empty = () =>
		({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
	const rect = () => new DOMRect(0, 0, 0, 0);
	for (const proto of [Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
		proto.getClientRects ??= empty;
		proto.getBoundingClientRect ??= rect;
	}
	// The table plugin asks which cell the pointer is over.
	document.elementFromPoint ??= () => null;
});

const heading = (value: string): CmsNode => ({ type: "heading", attrs: { level: 2 }, content: [text(value)] });
const stamp = new Date("2026-10-20T00:00:00Z").toISOString();
const template = (id: string, name: string, ...content: CmsNode[]) => ({
	id,
	name,
	doc: storedDoc(...content),
	version: 1,
	createdAt: stamp,
	updatedAt: stamp,
});
const TEMPLATES = [
	template("basic", "기본 글", heading("서론"), para("이 글에서 다룰 것."), heading("본론"), heading("결론")),
	template("review", "책 리뷰", heading("한 줄 평"), para("줄거리")),
	template("tutorial", "튜토리얼", heading("준비물"), heading("단계")),
];

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
	fetchMock = vi.fn(async () => json({ items: TEMPLATES }));
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

interface Opened {
	editor: Editor;
	onChange: ReturnType<typeof vi.fn>;
}
const open = async (
	body: StoredDocument,
	props: Partial<React.ComponentProps<typeof CmsEditor>> = {},
): Promise<Opened> => {
	let editor: Editor | null = null;
	const onChange = vi.fn();
	renderWithSite(
		<CmsEditor
			doc={body}
			onChange={onChange}
			templates
			onEditor={(ready) => {
				editor = ready ?? editor;
			}}
			{...props}
		/>,
	);
	await waitFor(() => expect(editor).not.toBeNull());
	return { editor: editor as unknown as Editor, onChange };
};
const saved = (onChange: ReturnType<typeof vi.fn>): StoredDocument => onChange.mock.lastCall?.[0];
const typesOf = (doc: StoredDocument) => doc.content.map((node) => node.type);
const textOf = (node: CmsNode): string => (node.text ?? "") + (node.content ?? []).map(textOf).join("");
const blocksText = (doc: StoredDocument) => doc.content.map(textOf);

/** Position of the first empty paragraph, and a "/" typed in it the way the keyboard does. */
const typeSlashInEmpty = (editor: Editor, query = "") => {
	let target = -1;
	editor.state.doc.descendants((node, pos) => {
		if (target < 0 && node.type.name === "paragraph" && node.content.size === 0) target = pos;
	});
	act(() => {
		editor
			.chain()
			.setTextSelection(target + 1)
			.insertContent(`/${query}`)
			.run();
		editor.view.focus();
	});
};
const press = (editor: Editor, key: string, init: KeyboardEventInit = {}) =>
	act(() => {
		fireEvent.keyDown(editor.view.dom, { key, ...init });
	});
const slashMenu = () => screen.findByRole("listbox", { name: t("slashMenu.label") });
const optionNames = (menu: HTMLElement) =>
	within(menu)
		.getAllByRole("option")
		.map((option) => option.textContent ?? "");

describe("flow: write (steps 02–05)", () => {
	describe("step 02: / on a new post, choosing a template", () => {
		const emptyPost = () => storedDoc(para());

		it("opens in place on /, with group titles and the template group, without asking anything", async () => {
			const { editor } = await open(emptyPost());
			typeSlashInEmpty(editor);
			const menu = await slashMenu();
			for (const title of [t("slash.group.text"), t("slash.group.insert"), t("slash.group.components")]) {
				expect(within(menu).getByText(title)).toBeInTheDocument();
			}
			expect(await within(menu).findByText(t("slash.group.templates"))).toBeInTheDocument();
			const names = optionNames(menu);
			for (const template of TEMPLATES) expect(names.some((name) => name.startsWith(template.name))).toBe(true);
			// A template row says its sections.
			expect(within(menu).getByText("서론 · 본론 · 결론")).toBeInTheDocument();
			expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(["/api/monti/v1/templates"]);
		});

		it("puts the chosen template's blocks at the cursor, with new block ids, and leaves the rest of the body alone", async () => {
			const { editor, onChange } = await open(storedDoc(para("앞"), para(), para("뒤")));
			typeSlashInEmpty(editor);
			const menu = await slashMenu();
			fireEvent.click(await within(menu).findByRole("option", { name: /^기본 글/ }));

			await waitFor(() =>
				expect(blocksText(saved(onChange))).toEqual(["앞", "서론", "이 글에서 다룰 것.", "본론", "결론", "뒤"]),
			);
			expect(screen.queryByRole("listbox", { name: t("slashMenu.label") })).toBeNull();
			expect(screen.queryByRole("alertdialog")).toBeNull();
			expect(screen.queryByRole("dialog")).toBeNull();
			const ids = saved(onChange).content.map((node) => node.id);
			const own = TEMPLATES[0]?.doc.content.map((node) => node.id) ?? [];
			expect(new Set(ids).size).toBe(ids.length);
			expect(ids.filter((id) => own.includes(id))).toEqual([]);
		});

		it("typing the group name narrows the list to the templates, and the keyboard alone picks one", async () => {
			const { editor, onChange } = await open(emptyPost());
			typeSlashInEmpty(editor);
			await within(await slashMenu()).findByText(t("slash.group.templates"));
			act(() => {
				editor.commands.insertContent(t("slash.group.templates").slice(0, 2));
			});
			await waitFor(() => {
				const names = optionNames(screen.getByRole("listbox", { name: t("slashMenu.label") }));
				expect(names).toHaveLength(TEMPLATES.length);
			});
			press(editor, "ArrowDown");
			press(editor, "Enter");
			await waitFor(() => expect(blocksText(saved(onChange))).toEqual(["한 줄 평", "줄거리"]));
		});

		it("Escape closes the menu and leaves the typed slash", async () => {
			const { editor } = await open(emptyPost());
			typeSlashInEmpty(editor);
			await slashMenu();
			press(editor, "Escape");
			await waitFor(() => expect(screen.queryByRole("listbox", { name: t("slashMenu.label") })).toBeNull());
		});
	});

	describe("step 03: selecting text shows the format card", () => {
		const selectWords = async (props: Partial<React.ComponentProps<typeof CmsEditor>> = {}) => {
			const opened = await open(storedDoc(para("나머지는 필요할 때 꺼내 본다")), props);
			act(() => {
				opened.editor.commands.setTextSelection({ from: 1, to: 4 });
				opened.editor.view.focus();
			});
			return { ...opened, card: await screen.findByRole("toolbar", { name: t("inlineBubble.selectionLabel") }) };
		};
		const names = (card: HTMLElement) =>
			within(card)
				.getAllByRole("button")
				.map((button) => button.getAttribute("aria-label") ?? button.textContent);

		it("applies a format at once and shows it pressed", async () => {
			const { card, editor, onChange } = await selectWords();
			fireEvent.click(within(card).getByRole("button", { name: t("inlineMarks.bold") }));
			expect(editor.isActive("bold")).toBe(true);
			await waitFor(() => expect(JSON.stringify(saved(onChange))).toContain("bold"));
			expect(
				within(card)
					.getByRole("button", { name: t("inlineMarks.bold") })
					.getAttribute("aria-pressed"),
			).toBe("true");
		});

		it("ends with the request when an extension offers one, and runs it on the selection", async () => {
			const run = vi.fn();
			const { card, editor } = await selectWords({ selectionActions: [{ id: "ask", label: "요청", run }] });
			const list = names(card);
			expect(list.at(-1)).toContain("요청");
			fireEvent.click(within(card).getByRole("button", { name: /요청/ }));
			expect(run).toHaveBeenCalledWith(editor);
		});
	});

	describe("steps 03–05: the block handle", () => {
		const handleOf = async (block: HTMLElement) => {
			fireEvent.mouseMove(block, { clientX: 100, clientY: 20 });
			return screen.findByRole("button", { name: t("blockHandle.label") });
		};
		const blockAt = (editor: Editor, index: number) => editor.view.dom.children[index] as HTMLElement;
		const firstBlock = (editor: Editor) => blockAt(editor, 0);
		const openMenu = async (editor: Editor, index = 0): Promise<HTMLElement> => {
			// A menu that was just used closes on its own; wait for it, so the next one is not the one going away.
			await waitFor(() => expect(screen.queryByRole("menu", { name: t("blockHandle.label") })).toBeNull());
			// Right after a change to the document the handle is drawn again, which closes a menu opened in that moment: open it again then.
			for (let attempt = 0; attempt < 3; attempt++) {
				fireEvent.click(await handleOf(blockAt(editor, index)));
				const menu = await screen.findByRole("menu", { name: t("blockHandle.label") });
				await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
				if (menu.isConnected) return menu;
			}
			throw new Error("the block menu did not stay open");
		};
		const rowNames = (menu: HTMLElement) =>
			within(menu)
				.getAllByRole("menuitem")
				.map((item) => item.textContent ?? "");

		it("turn into another block: the submenu lists the kinds with the current one ticked, and choosing heading 2 changes the block", async () => {
			const { editor, onChange } = await open(storedDoc(para("첫 글"), para("둘째 글")));
			const menu = await openMenu(editor);
			fireEvent.click(within(menu).getByRole("menuitem", { name: new RegExp(t("blockHandle.turnInto")) }));
			const sub = await screen.findByRole("menu", { name: t("blockHandle.turnInto") });
			const kinds = within(sub).getAllByRole("menuitemradio");
			expect(kinds.map((item) => item.textContent)).toEqual([
				expect.stringContaining(t("blockKind.paragraph")),
				expect.stringContaining(t("blockKind.heading", { level: 2 })),
				expect.stringContaining(t("blockKind.heading", { level: 3 })),
				expect.stringContaining(t("blockKind.heading", { level: 4 })),
				expect.stringContaining(t("blockKind.bullet")),
				expect.stringContaining(t("blockKind.ordered")),
				expect.stringContaining(t("blockKind.todo")),
				expect.stringContaining(t("blockKind.quote")),
				expect.stringContaining(t("blockKind.code")),
			]);
			expect(kinds.map((item) => item.getAttribute("aria-checked"))).toEqual([
				"true",
				...Array(kinds.length - 1).fill("false"),
			]);
			fireEvent.click(
				within(sub).getByRole("menuitemradio", { name: new RegExp(t("blockKind.heading", { level: 2 })) }),
			);

			await waitFor(() => expect(saved(onChange).content[0]?.type).toBe("heading"));
			expect(saved(onChange).content[0]?.attrs).toMatchObject({ level: 2 });
			// Only the block the handle points at; the menu closed.
			expect(saved(onChange).content[1]?.type).toBe("paragraph");
			await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
		});

		it("turns a list item into a paragraph, and the list is not left behind", async () => {
			const { editor, onChange } = await open(
				storedDoc({ type: "bulletList", content: [{ type: "listItem", content: [para("항목")] }] }),
			);
			const item = editor.view.dom.querySelector("li") as HTMLElement;
			const openOnItem = async () => {
				fireEvent.click(await handleOf(item));
				return screen.findByRole("menu", { name: t("blockHandle.label") });
			};
			const menu = await openOnItem();
			expect(within(menu).getByText(t("blockKind.bullet"))).toBeInTheDocument();
			fireEvent.click(within(menu).getByRole("menuitem", { name: new RegExp(t("blockHandle.turnInto")) }));
			fireEvent.click(
				within(await screen.findByRole("menu", { name: t("blockHandle.turnInto") })).getByRole("menuitemradio", {
					name: new RegExp(t("blockKind.paragraph")),
				}),
			);
			await waitFor(() => expect(typesOf(saved(onChange))).toEqual(["paragraph"]));
			expect(blocksText(saved(onChange))).toEqual(["항목"]);
		});

		it("align: the submenu has left, center and right with the current ticked, and center is stored", async () => {
			const { editor, onChange } = await open(storedDoc(para("첫 글")));
			const menu = await openMenu(editor);
			fireEvent.click(within(menu).getByRole("menuitem", { name: new RegExp(t("blockHandle.align")) }));
			const sub = await screen.findByRole("menu", { name: t("blockHandle.align") });
			const choices = within(sub).getAllByRole("menuitemradio");
			expect(choices.map((item) => item.textContent)).toEqual([t("align.left"), t("align.center"), t("align.right")]);
			expect(choices.map((item) => item.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
			fireEvent.click(within(sub).getByRole("menuitemradio", { name: t("align.center") }));
			await waitFor(() => expect(saved(onChange).content[0]?.attrs).toMatchObject({ align: "center" }));

			// Reopened, center is the ticked one; left clears the alignment.
			const again = await openMenu(editor);
			fireEvent.click(within(again).getByRole("menuitem", { name: new RegExp(t("blockHandle.align")) }));
			const reopened = within(await screen.findByRole("menu", { name: t("blockHandle.align") }));
			expect(reopened.getByRole("menuitemradio", { name: t("align.center") }).getAttribute("aria-checked")).toBe(
				"true",
			);
			fireEvent.click(reopened.getByRole("menuitemradio", { name: t("align.left") }));
			await waitFor(() => expect(JSON.stringify(saved(onChange))).not.toContain("center"));
		});

		it("hides what the block cannot do: no align on a table, no turn into on a table, no align when the body does not allow it", async () => {
			const withTable = await open(storedDoc(table([[[text("칸")]]])));
			const menu = await openMenu(withTable.editor);
			const rows = rowNames(menu);
			expect(rows.some((row) => row.includes(t("blockHandle.align")))).toBe(false);
			expect(rows.some((row) => row.includes(t("blockHandle.turnInto")))).toBe(false);
			expect(rows.some((row) => row.includes(t("blockHandle.duplicate")))).toBe(true);
			cleanup();

			const limited: BodyAllowed = { blocks: ["image"], marks: ["bold"], headings: [2] };
			const plain = await open(storedDoc(para("글")), { allowed: limited });
			const limitedMenu = await openMenu(plain.editor);
			expect(rowNames(limitedMenu).some((row) => row.includes(t("blockHandle.align")))).toBe(false);
			fireEvent.click(within(limitedMenu).getByRole("menuitem", { name: new RegExp(t("blockHandle.turnInto")) }));
			const kinds = within(await screen.findByRole("menu", { name: t("blockHandle.turnInto") }))
				.getAllByRole("menuitemradio")
				.map((item) => item.textContent ?? "");
			expect(kinds.some((name) => name.startsWith(t("blockKind.heading", { level: 3 })))).toBe(false);
			expect(kinds.some((name) => name.startsWith(t("blockKind.heading", { level: 2 })))).toBe(true);
		});

		it("up and down move the block, duplicate copies it below, delete removes it", async () => {
			let { editor, onChange } = await open(storedDoc(para("가"), para("나"), para("다")));
			let menu = await openMenu(editor);
			pressOption(within(menu).getByRole("menuitem", { name: new RegExp(t("blockHandle.moveDown")) }));
			await waitFor(() => expect(blocksText(saved(onChange))).toEqual(["나", "가", "다"]));

			// "가" is now the second block: it can go up, and the last block ("다") has no "down".
			menu = await openMenu(editor, 1);
			pressOption(within(menu).getByRole("menuitem", { name: new RegExp(t("blockHandle.moveUp")) }));
			await waitFor(() => expect(blocksText(saved(onChange))).toEqual(["가", "나", "다"]));
			cleanup();

			({ editor, onChange } = await open(storedDoc(para("가"), para("나"), para("다"))));
			menu = await openMenu(editor, 2);
			expect(rowNames(menu).some((row) => row.includes(t("blockHandle.moveDown")))).toBe(false);
			fireEvent.keyDown(menu, { key: "Escape" });
			cleanup();

			({ editor, onChange } = await open(storedDoc(para("가"), para("나"), para("다"))));
			menu = await openMenu(editor);
			pressOption(within(menu).getByRole("menuitem", { name: new RegExp(t("blockHandle.duplicate")) }));
			await waitFor(() => expect(blocksText(saved(onChange))).toEqual(["가", "가", "나", "다"]));

			menu = await openMenu(editor);
			pressOption(within(menu).getByRole("menuitem", { name: new RegExp(tc("delete")) }));
			await waitFor(() => expect(blocksText(saved(onChange))).toEqual(["가", "나", "다"]));
		});

		it("the keys do the same from the keyboard: ⌥↓, ⌥↑, ⇧⌘D, ⇧⌘⌫", async () => {
			const { editor, onChange } = await open(storedDoc(para("가"), para("나")));
			act(() => {
				editor.commands.setTextSelection(1);
				editor.view.focus();
			});
			press(editor, "ArrowDown", { altKey: true });
			await waitFor(() => expect(blocksText(saved(onChange))).toEqual(["나", "가"]));
			press(editor, "ArrowUp", { altKey: true });
			await waitFor(() => expect(blocksText(saved(onChange))).toEqual(["가", "나"]));
			press(editor, "d", { ctrlKey: true, metaKey: false, shiftKey: true });
			await waitFor(() => expect(blocksText(saved(onChange))).toEqual(["가", "가", "나"]));
			press(editor, "Backspace", { ctrlKey: true, shiftKey: true });
			await waitFor(() => expect(blocksText(saved(onChange))).toEqual(["가", "나"]));
		});

		it("the + puts an empty line below the block and opens the same list as typing /", async () => {
			const { editor, onChange } = await open(storedDoc(para("첫 글"), para("둘째 글")));
			await handleOf(firstBlock(editor));
			fireEvent.click(screen.getByRole("button", { name: t("blockHandle.add") }));

			const menu = await slashMenu();
			expect(within(menu).getByText(t("slash.group.text"))).toBeInTheDocument();
			await waitFor(() => expect(blocksText(saved(onChange))).toEqual(["첫 글", "/", "둘째 글"]));
			// Choosing a block takes the slash away.
			fireEvent.click(within(menu).getByRole("option", { name: new RegExp(`^${t("slash.h2.title")}`) }));
			await waitFor(() => expect(saved(onChange).content[1]).toMatchObject({ type: "heading" }));
			expect(blocksText(saved(onChange))).toEqual(["첫 글", "", "둘째 글"]);
		});
	});
});
