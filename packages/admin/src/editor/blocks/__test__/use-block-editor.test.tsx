import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { CmsAdminComponentsProvider } from "../../../admin-components";
// A custom block view imports only from the public hooks entry point: no Tiptap, no ProseMirror, no admin internals.
import { BlockFrame, type BlockView, Content, type EditorResult, useBlockEditor } from "../../../hooks/public";
import { buildEditorExtensions } from "../../extensions";
import { mdxToTiptap, tiptapToMdx } from "../../tiptap-content";

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

function Harness({ source, onReady }: { source: string; onReady: (editor: Editor) => void }) {
	const editor = useEditor({
		extensions: buildEditorExtensions(),
		content: mdxToTiptap(source),
		immediatelyRender: true,
	});
	useEffect(() => {
		if (editor) onReady(editor);
	}, [editor, onReady]);
	return <EditorContent editor={editor} />;
}

const mount = async (source: string, ready: string, views: Record<string, BlockView> = {}) => {
	let editor: Editor | null = null;
	render(
		<CmsAdminComponentsProvider components={{ blockViews: views }}>
			<Harness
				source={source}
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

const TABS =
	'<Tabs defaultValue="둘">\n\n<Tab label="하나">\n\n첫째\n\n</Tab>\n\n<Tab label="둘">\n\n둘째\n\n</Tab>\n\n</Tabs>';

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

const mountTabs = (source = TABS) =>
	mount(source, "[data-cms-container-node='cmsTabs']", { tabs: CustomTabs, tab: CustomTab });

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
		const before = tiptapToMdx(editor.getJSON());
		const transactions = countTransactions(editor);
		fireEvent.click(screen.getAllByRole("tab")[1] as HTMLElement);
		click("rename");
		await waitFor(() => expect(tiptapToMdx(editor.getJSON())).toContain('defaultValue="바뀐 이름"'));
		expect(transactions.count).toBe(1);
		expect(labelsOf(editor)).toEqual(["하나", "바뀐 이름"]);
		act(() => {
			editor.commands.undo();
		});
		expect(tiptapToMdx(editor.getJSON())).toBe(before);
	});

	it("separate commands are separate document changes (what transact groups)", async () => {
		const editor = await mountTabs();
		const transactions = countTransactions(editor);
		click("rename-separately");
		await waitFor(() => expect(tiptapToMdx(editor.getJSON())).toContain('defaultValue="첫 번째"'));
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
		const before = tiptapToMdx(editor.getJSON());
		fireEvent.click(screen.getByRole("button", { name: "probe" }));
		expect(result).toMatchObject({ ok: false, error: { code: "limit" } });
		expect(tiptapToMdx(editor.getJSON())).toBe(before);
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
		expect(() => render(<Outside />)).toThrow(/inside a block view/);
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
		// The editor gives a block its id on the first change of the document.
		expect(block.id).toBeNull();
		act(() => {
			editor.commands.insertContentAt(editor.state.doc.content.size, "<p>끝</p>");
		});
		await waitFor(() => expect((seen as unknown as ReturnType<typeof useBlockEditor>).id).toMatch(/\S/));
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
	const SOURCE = `앞 문단\n\n${TABS}\n\n뒤 문단`;

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
		expect(tiptapToMdx(editor.getJSON()).trim()).toBe("앞 문단\n\n뒤 문단");
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
