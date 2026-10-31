import type { StoredDocument } from "@monti-cms/core/document";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { AdminComponentsProvider } from "../../../admin-components";
// A custom block view imports only from the public hooks entry point: no Tiptap, no ProseMirror, no admin internals.
import { BlockFrame, type BlockView, useBlockEditor } from "../../../hooks/public";
import { renderWithSite } from "../../../test/site";
import { storedDoc } from "../../../test/stored-doc";
import { buildEditorExtensions } from "../../extensions";
import { editorMediaMessages } from "../../media.messages";
import { storedToTiptap, tiptapToStored } from "../../tiptap-content";
import { blocksMessages } from "../messages";

const tMedia = testSite.createTranslator(editorMediaMessages);
const tBlocks = testSite.createTranslator(blocksMessages);
/** The default image view's tool row: there only when the core image view is drawn. */
const imageTools = () => screen.queryByRole("toolbar", { name: tMedia("imageNode.toolbar") });

afterEach(cleanup);

function Harness({ doc, onReady }: { doc: StoredDocument; onReady: (editor: Editor) => void }) {
	const editor = useEditor({
		extensions: buildEditorExtensions(testSite),
		content: storedToTiptap(testSite, doc),
		immediatelyRender: true,
	});
	useEffect(() => {
		if (editor) onReady(editor);
	}, [editor, onReady]);
	return <EditorContent editor={editor} />;
}

/** `ready` is a selector or a check that passes once the view is drawn. */
const mount = async (doc: StoredDocument, ready: string | (() => unknown), views: Record<string, BlockView> = {}) => {
	let editor: Editor | null = null;
	renderWithSite(
		<AdminComponentsProvider components={{ blockViews: views }}>
			<Harness
				doc={doc}
				onReady={(next) => {
					editor = next;
				}}
			/>
		</AdminComponentsProvider>,
	);
	await waitFor(() => expect(editor).not.toBeNull());
	await waitFor(() =>
		typeof ready === "string" ? expect(document.querySelector(ready)).toBeInTheDocument() : ready(),
	);
	return editor as unknown as Editor;
};

const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("image, file and math on the blockViews contract", () => {
	function ImageView() {
		const block = useBlockEditor();
		return (
			<BlockFrame framed={false}>
				<output aria-label="alt">{String(block.values.alt)}</output>
				<button type="button" onClick={() => block.setValues({ alt: "바뀐 설명", width: "50%" })}>
					set-alt
				</button>
			</BlockFrame>
		);
	}
	function FileView() {
		const block = useBlockEditor();
		return (
			<BlockFrame data-test-view="file" framed={false}>
				<span data-testid="label">{String(block.values.label)}</span>
			</BlockFrame>
		);
	}
	function MathView() {
		const block = useBlockEditor();
		return (
			<BlockFrame framed={false}>
				<output aria-label="source">{block.source}</output>
				<button type="button" onClick={() => block.setSource("y^2")}>
					set-source
				</button>
			</BlockFrame>
		);
	}

	it("PLUG-A9 a site replaces the image view, and the view reads and writes the image through useBlockEditor", async () => {
		const editor = await mount(
			storedDoc({ type: "image", attrs: { mediaId: "m1", alt: "고양이" } }),
			() => screen.getByRole("button", { name: "set-alt" }),
			{ image: ImageView },
		);
		expect(screen.getByRole("status", { name: "alt" })).toHaveTextContent("고양이");
		expect(imageTools()).toBeNull();
		click("set-alt");
		await waitFor(() => expect(editor.state.doc.firstChild?.attrs).toMatchObject({ alt: "바뀐 설명", width: "50%" }));
		expect(tiptapToStored(testSite, editor.getJSON()).content[0]).toMatchObject({
			type: "image",
			attrs: { alt: "바뀐 설명" },
		});
		await waitFor(() => expect(screen.getByRole("status", { name: "alt" })).toHaveTextContent("바뀐 설명"));
	});

	it("PLUG-A9 a site replaces the math view, and the view writes the source", async () => {
		const editor = await mount(
			storedDoc({ type: "math", attrs: { value: "x^2" } }),
			() => screen.getByRole("button", { name: "set-source" }),
			{ math: MathView },
		);
		expect(screen.getByRole("status", { name: "source" })).toHaveTextContent("x^2");
		click("set-source");
		await waitFor(() =>
			expect(tiptapToStored(testSite, editor.getJSON()).content[0]).toMatchObject({
				type: "math",
				attrs: { value: "y^2" },
			}),
		);
	});

	it("PLUG-A9 without a registration the default views render", async () => {
		await mount(
			storedDoc(
				{ type: "math", attrs: { value: "x^2" } },
				{ type: "image", attrs: { alt: "설명", src: "/images/a.png" } },
			),
			// The math block opens selected (the cursor starts in it), so its source field is drawn.
			() => screen.getByRole("textbox", { name: tBlocks("fence.sourceCode") }),
		);
		expect(imageTools()).toBeInTheDocument();
	});
});
