import type { CmsNode, StoredDocument } from "@monti-cms/core/document";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { CmsAdminComponentsProvider } from "../../../admin-components";
// A custom block view imports only from the public hooks entry point: no Tiptap, no ProseMirror, no admin internals.
import { BlockFrame, type BlockView, Content, type EditorResult, useBlockEditor } from "../../../hooks/public";
import { renderWithSite } from "../../../test/site";
import { para, storedDoc, withoutIds } from "../../../test/stored-doc";
import { type EditorAllowance, editorAllowance } from "../../allowed";
import { buildEditorExtensions } from "../../extensions";
import { storedToTiptap, tiptapToStored } from "../../tiptap-content";

afterEach(cleanup);

// jsdom has no coordinates for text ranges. ProseMirror uses them to measure the scroll position after the cursor moves.
beforeAll(() => {
	const empty = () =>
		({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
	const rect = () => new DOMRect(0, 0, 0, 0);
	for (const proto of [Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
		proto.getClientRects ??= empty;
		proto.getBoundingClientRect ??= rect;
	}
});

function Harness({
	doc,
	onReady,
	allowance,
}: {
	doc: StoredDocument;
	onReady: (editor: Editor) => void;
	allowance?: EditorAllowance;
}) {
	const editor = useEditor({
		extensions: buildEditorExtensions(testSite, {}, allowance),
		content: storedToTiptap(testSite, doc),
		immediatelyRender: true,
	});
	useEffect(() => {
		if (editor) onReady(editor);
	}, [editor, onReady]);
	return <EditorContent editor={editor} />;
}

const mount = async (
	doc: StoredDocument,
	ready: string,
	views: Record<string, BlockView> = {},
	allowance?: EditorAllowance,
) => {
	let editor: Editor | null = null;
	renderWithSite(
		<CmsAdminComponentsProvider components={{ blockViews: views }}>
			<Harness
				doc={doc}
				allowance={allowance}
				onReady={(next) => {
					editor = next;
				}}
			/>
		</CmsAdminComponentsProvider>,
	);
	await waitFor(() => expect(editor).not.toBeNull());
	await waitFor(() => expect(document.querySelector(ready)).not.toBeNull());
	return editor as unknown as Editor;
};

/** The doc-changing transactions an editor dispatches (a plugin's appended transactions are part of the one that caused them). */
const countTransactions = (editor: Editor) => {
	const counter = { count: 0 };
	editor.on("transaction", ({ transaction }) => {
		if (transaction.docChanged) counter.count += 1;
	});
	return counter;
};

const tabsNode = (): CmsNode => ({
	type: "tabs",
	attrs: { defaultValue: "둘" },
	content: [
		{ type: "tab", attrs: { label: "하나" }, content: [para("첫째")] },
		{ type: "tab", attrs: { label: "둘" }, content: [para("둘째")] },
	],
});
const TABS = storedDoc(tabsNode());

/** The stored document the editor content is saved as. */
const savedDoc = (editor: Editor) => tiptapToStored(testSite, editor.getJSON());
/** The default tab the saved tabs block names. */
const savedDefault = (editor: Editor) => savedDoc(editor).content[0]?.attrs?.defaultValue;

const labelsOf = (editor: Editor) =>
	Array.from({ length: editor.state.doc.firstChild?.childCount ?? 0 }, (_, index) =>
		String(editor.state.doc.firstChild?.child(index).attrs.values.label ?? ""),
	);

const labelsOfAt = (editor: Editor, at: number) => {
	const block = editor.state.doc.child(at);
	return Array.from({ length: block.childCount }, (_, index) => String(block.child(index).attrs.values.label ?? ""));
};

/** Tabs drawn with nothing but `useBlockEditor`, `Content` and `BlockFrame`: add, move, remove (with the definition's min and max) and rename. */
function CustomTabs() {
	const block = useBlockEditor<{ defaultValue: string }>();
	const [active, setActive] = useState(0);
	const [failure, setFailure] = useState("");
	const current = Math.min(active, block.children.length - 1);
	const report = (result: EditorResult<unknown>) => setFailure(result.ok ? "" : result.error.code);

	return (
		<BlockFrame>
			<div role="tablist" contentEditable={false}>
				{block.children.map((child) => (
					<button
						key={child.index}
						type="button"
						role="tab"
						aria-selected={child.index === current}
						onClick={() => setActive(child.index)}
					>
						{String(child.values.label ?? "")}
					</button>
				))}
			</div>
			<Content visibleChild={current} />
			<div contentEditable={false}>
				<button
					type="button"
					onClick={() => report(block.addChild({ values: { label: `새 탭 ${block.children.length + 1}` } }))}
				>
					add
				</button>
				<button type="button" onClick={() => report(block.removeChild(current))}>
					remove
				</button>
				<button type="button" onClick={() => report(block.moveChild(current, current - 1))}>
					left
				</button>
				<button
					type="button"
					onClick={() =>
						report(
							block.transact((tx) => {
								const previous = String(tx.child(current).values.label ?? "");
								tx.child(current).setValue("label", "바뀐 이름");
								if (tx.values.defaultValue === previous) tx.setValue("defaultValue", "바뀐 이름");
							}),
						)
					}
				>
					rename
				</button>
				<button
					type="button"
					onClick={() => {
						block.setChildValue(0, "label", "첫 번째");
						block.setValue("defaultValue", "첫 번째");
					}}
				>
					rename-separately
				</button>
				<output aria-label="failure">{failure}</output>
				<output aria-label="flags">
					{String(block.canAddChild)}/{String(block.canRemoveChild(current))}/{String(block.editable)}
				</output>
			</div>
		</BlockFrame>
	);
}

function CustomTab() {
	return (
		<BlockFrame framed={false} selectedRing={false}>
			<Content />
		</BlockFrame>
	);
}

const mountTabs = (doc = TABS) =>
	mount(doc, "[data-cms-container-node='cmsTabs']", { tabs: CustomTabs, tab: CustomTab });

const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const failure = () => screen.getByLabelText("failure").textContent;

describe("a custom block view built on useBlockEditor and Content", () => {
	it("reads the children and values, and renders the nested body", async () => {
		await mountTabs();
		expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["하나", "둘"]);
		expect(screen.getByText("첫째")).toBeDefined();
		expect(document.querySelector("[data-cms-block-content]")).not.toBeNull();
	});

	it("shows only the visible child", async () => {
		await mountTabs();
		const rule = () => document.querySelector("[data-cms-container-node='cmsTabs'] > style")?.textContent ?? "";
		expect(rule()).toContain(":nth-child(1)");
		fireEvent.click(screen.getAllByRole("tab")[1] as HTMLElement);
		await waitFor(() => expect(rule()).toContain(":nth-child(2)"));
		const bodies = Array.from(
			document.querySelectorAll<HTMLElement>("[data-cms-container-node='cmsTabs'] > [data-cms-block-content] > * > *"),
		);
		expect(bodies).toHaveLength(2);
		expect(getComputedStyle(bodies[0] as HTMLElement).display).toBe("none");
		expect(getComputedStyle(bodies[1] as HTMLElement).display).not.toBe("none");
	});

	it("adds a child up to definition.children.max, then returns a limit error", async () => {
		const editor = await mountTabs();
		expect(screen.getByLabelText("flags").textContent).toBe("true/false/true");
		for (let added = 2; added < 8; added += 1) click("add");
		await waitFor(() => expect(editor.state.doc.firstChild?.childCount).toBe(8));
		expect(failure()).toBe("");
		expect(screen.getByLabelText("flags").textContent).toBe("false/true/true");
		click("add");
		expect(failure()).toBe("limit");
		expect(editor.state.doc.firstChild?.childCount).toBe(8);
	});

	it("removes a child down to definition.children.min, then returns a limit error", async () => {
		const editor = await mountTabs();
		click("remove");
		expect(failure()).toBe("limit");
		expect(editor.state.doc.firstChild?.childCount).toBe(2);
		click("add");
		await waitFor(() => expect(editor.state.doc.firstChild?.childCount).toBe(3));
		fireEvent.click(screen.getAllByRole("tab")[2] as HTMLElement);
		click("remove");
		await waitFor(() => expect(editor.state.doc.firstChild?.childCount).toBe(2));
		expect(failure()).toBe("");
		expect(labelsOf(editor)).toEqual(["하나", "둘"]);
	});

	it("moves a child, keeping its body", async () => {
		const editor = await mountTabs();
		fireEvent.click(screen.getAllByRole("tab")[1] as HTMLElement);
		click("left");
		await waitFor(() => expect(labelsOf(editor)).toEqual(["둘", "하나"]));
		expect(editor.state.doc.firstChild?.child(0).textContent).toBe("둘째");
		// Moving past the first child is an out-of-range request, not a throw.
		fireEvent.click(screen.getAllByRole("tab")[0] as HTMLElement);
		click("left");
		expect(failure()).toBe("invalid_state");
		expect(labelsOf(editor)).toEqual(["둘", "하나"]);
	});

	it("transact writes a child and the parent in one document change and one undo step", async () => {
		const editor = await mountTabs();
		const before = savedDoc(editor);
		const transactions = countTransactions(editor);
		fireEvent.click(screen.getAllByRole("tab")[1] as HTMLElement);
		click("rename");
		await waitFor(() => expect(savedDefault(editor)).toBe("바뀐 이름"));
		expect(transactions.count).toBe(1);
		expect(labelsOf(editor)).toEqual(["하나", "바뀐 이름"]);
		act(() => {
			editor.commands.undo();
		});
		// The editor gives the ids of the blocks inside a block as they are first needed, so the comparison leaves ids out.
		expect(withoutIds(savedDoc(editor))).toEqual(withoutIds(before));
	});

	it("separate commands are separate document changes (what transact groups)", async () => {
		const editor = await mountTabs();
		const transactions = countTransactions(editor);
		click("rename-separately");
		await waitFor(() => expect(savedDefault(editor)).toBe("첫 번째"));
		expect(transactions.count).toBe(2);
	});

	it("a rule broken inside transact writes nothing and returns the failure", async () => {
		let result: EditorResult<unknown> | null = null;
		function Probe() {
			const block = useBlockEditor();
			return (
				<button
					type="button"
					onClick={() => {
						result = block.transact((tx) => {
							tx.child(0).setValue("label", "바뀜");
							tx.removeChild(0);
						});
					}}
				>
					probe
				</button>
			);
		}
		const editor = await mount(TABS, "[data-cms-container-node='cmsTabs']", {
			tabs: () => (
				<BlockFrame>
					<Probe />
					<Content />
				</BlockFrame>
			),
			tab: CustomTab,
		});
		const before = savedDoc(editor);
		fireEvent.click(screen.getByRole("button", { name: "probe" }));
		expect(result).toMatchObject({ ok: false, error: { code: "limit" } });
		expect(savedDoc(editor)).toEqual(before);
	});

	it("fails with read_only while the editor is locked", async () => {
		const editor = await mountTabs();
		act(() => editor.setEditable(false));
		await waitFor(() => expect(screen.getByLabelText("flags").textContent).toBe("false/false/false"));
		click("add");
		expect(failure()).toBe("read_only");
		click("rename");
		expect(failure()).toBe("read_only");
		expect(labelsOf(editor)).toEqual(["하나", "둘"]);
	});
});

describe("useBlockEditor", () => {
	it("throws a clear error outside a block view", () => {
		function Outside() {
			useBlockEditor();
			return null;
		}
		expect(() => renderWithSite(<Outside />)).toThrow(/inside a block view/);
	});

	it("gives a view its name, definition, id, selection state and an escape hatch", async () => {
		let seen: ReturnType<typeof useBlockEditor> | null = null;
		function Spy() {
			const block = useBlockEditor();
			seen = block;
			return (
				<BlockFrame>
					<Content />
				</BlockFrame>
			);
		}
		const editor = await mount(TABS, "[data-cms-container-node='cmsTabs']", { tabs: Spy, tab: CustomTab });
		let block = seen as unknown as ReturnType<typeof useBlockEditor>;
		expect(block.name).toBe("tabs");
		expect(block.definition.label).toBeTruthy();
		// A block has the id its document gave it, and keeps it through a change of the document.
		const id = block.id;
		expect(id).toMatch(/\S/);
		act(() => {
			editor.commands.insertContentAt(editor.state.doc.content.size, "<p>끝</p>");
		});
		await waitFor(() => expect((seen as unknown as ReturnType<typeof useBlockEditor>).id).toBe(id));
		block = seen as unknown as ReturnType<typeof useBlockEditor>;
		expect(block.selected).toBe(false);
		expect(block.focusedChild).toBeNull();
		expect(block.raw.editor).toBe(editor);
		expect(block.raw.node.type.name).toBe("cmsTabs");
		expect(block.children.map((child) => [child.index, child.name, child.values.label])).toEqual([
			[0, "tab", "하나"],
			[1, "tab", "둘"],
		]);
	});
});

describe("useBlockEditor commands", () => {
	const SOURCE = storedDoc(para("앞 문단"), tabsNode(), para("뒤 문단"));

	const mountSpy = async () => {
		let seen: ReturnType<typeof useBlockEditor> | null = null;
		function Spy() {
			seen = useBlockEditor();
			return (
				<BlockFrame>
					<Content />
				</BlockFrame>
			);
		}
		const editor = await mount(SOURCE, "[data-cms-container-node='cmsTabs']", { tabs: Spy, tab: CustomTab });
		return { editor, block: () => seen as unknown as ReturnType<typeof useBlockEditor> };
	};

	it("selects the block, moves the cursor into a child and reads the text around it", async () => {
		const { editor, block } = await mountSpy();
		expect(block().textAround(100, "[탭]")).toBe("앞 문단\n[탭]\n뒤 문단");
		act(() => block().select());
		expect(editor.state.selection.constructor.name).toBe("NodeSelection");
		await waitFor(() => expect(block().selected).toBe(true));
		act(() => block().focus({ child: 1 }));
		expect(editor.state.selection.$from.parent.textContent).toBe("둘째");
		act(() => block().focus({ child: 0, at: "end" }));
		expect(editor.state.selection.$from.parent.textContent).toBe("첫째");
		expect(editor.state.selection.$from.parentOffset).toBe(2);
	});

	it("removes the block", async () => {
		const { editor, block } = await mountSpy();
		let result: EditorResult | null = null;
		act(() => {
			result = block().remove();
		});
		expect(result).toMatchObject({ ok: true });
		expect(savedDoc(editor).content.map((node) => node.type)).toEqual(["paragraph", "paragraph"]);
		expect(savedDoc(editor).content.map((node) => node.content?.[0]?.text)).toEqual(["앞 문단", "뒤 문단"]);
	});

	it("moves a child together with the cursor inside it", async () => {
		const { editor, block } = await mountSpy();
		act(() => block().focus({ child: 1 }));
		act(() => {
			block().moveChild(1, 0);
		});
		expect(labelsOfAt(editor, 1)).toEqual(["둘", "하나"]);
		expect(editor.state.selection.$from.parent.textContent).toBe("둘째");
	});
});

/** A callout view with one button that adds a code block to the callout's body. */
function CalloutWithCode() {
	const block = useBlockEditor();
	const [code, setCode] = useState("");
	return (
		<BlockFrame>
			<Content />
			<button
				type="button"
				onClick={() => {
					const result = block.addChild({ name: "codeBlock" });
					setCode(result.ok ? "added" : result.error.code);
				}}
			>
				add code
			</button>
			<output aria-label="code-result">{code}</output>
		</BlockFrame>
	);
}

describe("a block view adding body content the body's allowed list does not allow", () => {
	const callout = storedDoc({ type: "callout", content: [para("안")] });
	const mountCallout = (allowance?: EditorAllowance) =>
		mount(callout, "[data-cms-block-content]", { callout: CalloutWithCode }, allowance);
	const codeBlocks = (editor: Editor) => {
		let count = 0;
		editor.state.doc.descendants((node) => {
			if (node.type.name === "codeBlock") count += 1;
		});
		return count;
	};

	it("adds a code block when the list allows it, or when the body has no list", async () => {
		const editor = await mountCallout(editorAllowance(testSite, { blocks: ["callout", "codeBlock"] }));
		click("add code");
		await waitFor(() => expect(screen.getByLabelText("code-result").textContent).toBe("added"));
		expect(codeBlocks(editor)).toBe(1);
	});

	it("fails with invalid_state and writes nothing when the list does not allow code blocks", async () => {
		const editor = await mountCallout(editorAllowance(testSite, { blocks: ["callout"] }));
		click("add code");
		await waitFor(() => expect(screen.getByLabelText("code-result").textContent).toBe("invalid_state"));
		expect(codeBlocks(editor)).toBe(0);
	});
});
