import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CmsAdminComponentsProvider } from "../../../admin-components";
// A custom block view imports only from the public hooks entry point: no Tiptap, no ProseMirror, no admin internals.
import { BlockFrame, type BlockView, useBlockEditor } from "../../../hooks/public";
import { buildEditorExtensions } from "../../extensions";
import { mdxToTiptap, tiptapToMdx } from "../../tiptap-content";

afterEach(cleanup);

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

const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("image, file and math on the blockViews contract", () => {
	function ImageView() {
		const block = useBlockEditor();
		return (
			<BlockFrame data-test-view="image" framed={false}>
				<span data-testid="alt">{String(block.values.alt)}</span>
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
			<BlockFrame data-test-view="math" framed={false}>
				<span data-testid="source">{block.source}</span>
				<button type="button" onClick={() => block.setSource("y^2")}>
					set-source
				</button>
			</BlockFrame>
		);
	}

	it("a site replaces the image view, and the view reads and writes the image through useBlockEditor", async () => {
		const editor = await mount('<Image mediaId="m1" alt="고양이" />', "[data-test-view='image']", { image: ImageView });
		expect(screen.getByTestId("alt").textContent).toBe("고양이");
		expect(document.querySelector("[data-image-block]")).toBeNull();
		click("set-alt");
		await waitFor(() => expect(editor.state.doc.firstChild?.attrs).toMatchObject({ alt: "바뀐 설명", width: "50%" }));
		expect(tiptapToMdx(editor.getJSON())).toContain('alt="바뀐 설명"');
		await waitFor(() => expect(screen.getByTestId("alt").textContent).toBe("바뀐 설명"));
	});

	it("a site replaces the file view", async () => {
		await mount('<File mediaId="m1" label="보고서.pdf" />', "[data-test-view='file']", { file: FileView });
		expect(screen.getByTestId("label").textContent).toBe("보고서.pdf");
		expect(document.querySelector("[data-file-block]")).toBeNull();
	});

	it("a site replaces the math view, and the view writes the source", async () => {
		const editor = await mount("$$\nx^2\n$$", "[data-test-view='math']", { math: MathView });
		expect(screen.getByTestId("source").textContent).toBe("x^2");
		click("set-source");
		await waitFor(() => expect(tiptapToMdx(editor.getJSON()).trim()).toBe("$$\ny^2\n$$"));
	});

	it("without a registration the default views render", async () => {
		await mount("$$\nx^2\n$$\n\n![설명](/images/a.png)", "[data-fence-preview='math']");
		expect(document.querySelector("[data-image-block]")).not.toBeNull();
	});
});
