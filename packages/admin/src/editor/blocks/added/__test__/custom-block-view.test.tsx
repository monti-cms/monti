import type { StoredDocument } from "@monti-cms/core/document";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { testSite } from "../../../../../../core/test/site";
import { CmsAdminComponentsProvider } from "../../../../admin-components";
import { chooseSelectOption } from "../../../../test/base-ui";
import { renderWithSite } from "../../../../test/site";
import { para, storedDoc } from "../../../../test/stored-doc";
import { buildEditorExtensions } from "../../../extensions";
import { storedToTiptap, tiptapToStored } from "../../../tiptap-content";
import { BlockFrame, Content, useBlockEditor } from "../../use-block-editor";

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

const mount = async (doc: StoredDocument, wrap: (node: React.ReactNode) => React.ReactNode = (node) => node) => {
	let editor: Editor | null = null;
	renderWithSite(
		<>
			{wrap(
				<Harness
					doc={doc}
					onReady={(ready) => {
						editor = ready;
					}}
				/>,
			)}
		</>,
	);
	await waitFor(() => expect(editor).not.toBeNull());
	await waitFor(() => expect(document.querySelector("[data-cms-custom-block]")).not.toBeNull());
	return editor as unknown as Editor;
};

const NOTICE = storedDoc({ type: "notice", attrs: { level: "info" }, content: [para("본문")] });

/** The attributes of the saved notice block. */
const savedNotice = (editor: Editor) => tiptapToStored(testSite, editor.getJSON()).content[0];

/** Edit view registered by the site (example): turns the level into a button. */
function NoticeView() {
	const block = useBlockEditor();
	return (
		<BlockFrame data-cms-custom-block="notice">
			<button type="button" contentEditable={false} onClick={() => block.setValue("level", "warn")}>
				단계: {String(block.values.level)}
			</button>
			<Content />
		</BlockFrame>
	);
}

describe("custom block NodeView", () => {
	it("without a registered view it shows the name, and attributes are edited and saved from the toolbar settings", async () => {
		const editor = await mount(NOTICE);
		expect(screen.getByText("공지")).toBeTruthy();
		expect(screen.queryByLabelText("단계")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "설정" }));
		await chooseSelectOption("단계", "주의");
		await waitFor(() => expect(savedNotice(editor)).toMatchObject({ type: "notice", attrs: { level: "warn" } }));
		fireEvent.change(screen.getByLabelText("제목"), { target: { value: "점검" } });
		await waitFor(() => expect(savedNotice(editor)).toMatchObject({ attrs: { title: "점검" } }));
	});

	it("hides the settings tool when read-only", async () => {
		const editor = await mount(NOTICE);
		act(() => editor.setEditable(false));
		await waitFor(() => expect(screen.queryByRole("button", { name: "설정" })).toBeNull());
	});

	it("renders with the edit view registered by the site in blockViews", async () => {
		const editor = await mount(NOTICE, (node) => (
			<CmsAdminComponentsProvider components={{ blockViews: { notice: NoticeView } }}>
				{node}
			</CmsAdminComponentsProvider>
		));
		fireEvent.click(screen.getByRole("button", { name: "단계: info" }));
		await waitFor(() => expect(savedNotice(editor)).toMatchObject({ type: "notice", attrs: { level: "warn" } }));
		expect(JSON.stringify(savedNotice(editor))).toContain("본문");
	});
});
