import type { StoredDocument } from "@monti-cms/core/document";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { testSite } from "../../../../../../core/test/site";
import { AdminComponentsProvider } from "../../../../admin-components";
import { chooseSelectOption } from "../../../../test/base-ui";
import { renderWithSite } from "../../../../test/site";
import { para, storedDoc } from "../../../../test/stored-doc";
import { buildEditorExtensions } from "../../../extensions";
import { storedToTiptap, tiptapToStored } from "../../../tiptap-content";
import { BlockIssuesProvider } from "../../block-issues-context";
import { blocksMessages } from "../../messages";
import { BlockFrame, Content, useBlockEditor } from "../../use-block-editor";

const tBlocks = testSite.createTranslator(blocksMessages);

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

const mount = async (doc: StoredDocument, wrap: (node: React.ReactElement) => React.ReactElement = (node) => node) => {
	let editor: Editor | null = null;
	renderWithSite(
		wrap(
			<Harness
				doc={doc}
				onReady={(ready) => {
					editor = ready;
				}}
			/>,
		),
	);
	await waitFor(() => expect(editor).not.toBeNull());
	// Every view of the notice draws its body.
	await waitFor(() => expect(screen.getByText(BODY)).toBeInTheDocument());
	return editor as unknown as Editor;
};

const BODY = "본문";
const NOTICE = storedDoc({ type: "notice", attrs: { level: "info" }, content: [para(BODY)] });

/** The attributes of the saved notice block. */
const savedNotice = (editor: Editor) => tiptapToStored(testSite, editor.getJSON()).content[0];

/** Edit view registered by the site (example): turns the level into a button. */
function NoticeView() {
	const block = useBlockEditor();
	return (
		<BlockFrame>
			<button type="button" contentEditable={false} onClick={() => block.setValue("level", "warn")}>
				단계: {String(block.values.level)}
			</button>
			<Content />
		</BlockFrame>
	);
}

describe("custom block NodeView", () => {
	it("EDIT-B3 without a registered view it shows the name, and attributes are edited and saved from the toolbar settings", async () => {
		const editor = await mount(NOTICE);
		expect(screen.getByText("공지")).toBeInTheDocument();
		expect(screen.queryByLabelText("단계")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: tBlocks("settings.label") }));
		await chooseSelectOption("단계", "주의");
		await waitFor(() => expect(savedNotice(editor)).toMatchObject({ type: "notice", attrs: { level: "warn" } }));
		fireEvent.change(screen.getByLabelText("제목"), { target: { value: "점검" } });
		await waitFor(() => expect(savedNotice(editor)).toMatchObject({ attrs: { title: "점검" } }));
	});

	it("EDIT-B3 hides the settings tool when read-only", async () => {
		const editor = await mount(NOTICE);
		act(() => editor.setEditable(false));
		await waitFor(() => expect(screen.queryByRole("button", { name: tBlocks("settings.label") })).toBeNull());
	});

	it("PLUG-A9 renders with the edit view registered by the site in blockViews", async () => {
		const editor = await mount(NOTICE, (node) => (
			<AdminComponentsProvider components={{ blockViews: { notice: NoticeView } }}>{node}</AdminComponentsProvider>
		));
		fireEvent.click(screen.getByRole("button", { name: "단계: info" }));
		await waitFor(() => expect(savedNotice(editor)).toMatchObject({ type: "notice", attrs: { level: "warn" } }));
		expect(JSON.stringify(savedNotice(editor))).toContain(BODY);
	});

	it("EDIT-B3 shows the warnings of a block next to that block only", async () => {
		const id = NOTICE.content[0]?.id as string;
		await mount(NOTICE, (node) => (
			<BlockIssuesProvider
				issues={
					new Map([
						[id, ["1줄: 문법 오류"]],
						["another-block", ["다른 블록의 경고"]],
					])
				}
			>
				{node}
			</BlockIssuesProvider>
		));
		const list = await screen.findByRole("list", { name: tBlocks("issues.label") });
		expect(list.textContent).toBe("1줄: 문법 오류");
		expect(screen.getAllByRole("list", { name: tBlocks("issues.label") })).toHaveLength(1);
		expect(screen.queryByText("다른 블록의 경고")).toBeNull();
	});
});
