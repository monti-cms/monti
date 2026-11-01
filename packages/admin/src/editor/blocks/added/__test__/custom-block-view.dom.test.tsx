import { type CmsConfig, defineBlock } from "@monti-cms/core";
import type { StoredDocument } from "@monti-cms/core/document";
import { createSite } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { testConfig } from "../../../../../../core/test/site";
import { AdminComponentsProvider } from "../../../../admin-components";
import { chooseSelectOption } from "../../../../test/base-ui";
import { renderWithSite } from "../../../../test/site";
import { para, storedDoc } from "../../../../test/stored-doc";
import { buildEditorExtensions } from "../../../extensions";
import { storedToTiptap, tiptapToStored } from "../../../tiptap-content";
import { BlockIssuesProvider } from "../../block-issues-context";
import { blocksMessages } from "../../messages";
import { BlockFrame, Content, useBlockEditor } from "../../use-block-editor";

/** A block a site adds with an editor node, defined here so the tests run on any site config. Its labels are the test's data. */
const notice = defineBlock({
	name: "test-notice",
	label: "Notice",
	syntax: { kind: "container", directive: "test-notice" },
	component: "TestNotice",
	attributes: {
		level: { type: "string", label: "Level", options: { info: "Info", warn: "Warning" }, defaultValue: "info" },
		title: { type: "string", label: "Title", translatable: true },
	},
	editor: { view: "node", insertable: true },
});
const site = createSite({ ...testConfig, blocks: [...(testConfig.blocks ?? []), notice] } as CmsConfig);
const tBlocks = site.createTranslator(blocksMessages);

afterEach(cleanup);

function Harness({ doc, onReady }: { doc: StoredDocument; onReady: (editor: Editor) => void }) {
	const editor = useEditor({
		extensions: buildEditorExtensions(site),
		content: storedToTiptap(site, doc),
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
		{ site },
	);
	await waitFor(() => expect(editor).not.toBeNull());
	// Every view of the notice draws its body.
	await waitFor(() => expect(screen.getByText(BODY)).toBeInTheDocument());
	return editor as unknown as Editor;
};

const BODY = "본문";
const NOTICE = storedDoc({ type: notice.name, attrs: { level: "info" }, content: [para(BODY)] });
const LEVEL = notice.attributes.level?.label ?? "";
/** The text of the site's own edit view below: the level, as a button. */
const levelButton = (level: string) => `${LEVEL}: ${level}`;

/** The attributes of the saved notice block. */
const savedNotice = (editor: Editor) => tiptapToStored(site, editor.getJSON()).content[0];

/** Edit view registered by the site (example): turns the level into a button. */
function NoticeView() {
	const block = useBlockEditor();
	return (
		<BlockFrame>
			<button type="button" contentEditable={false} onClick={() => block.setValue("level", "warn")}>
				{levelButton(String(block.values.level))}
			</button>
			<Content />
		</BlockFrame>
	);
}

describe("custom block NodeView", () => {
	it("EDIT-B3 without a registered view it shows the name, and attributes are edited and saved from the toolbar settings", async () => {
		const editor = await mount(NOTICE);
		expect(screen.getByText(notice.label)).toBeInTheDocument();
		expect(screen.queryByLabelText(LEVEL)).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: tBlocks("settings.label") }));
		await chooseSelectOption(LEVEL, "Warning");
		await waitFor(() => expect(savedNotice(editor)).toMatchObject({ type: notice.name, attrs: { level: "warn" } }));
		fireEvent.change(screen.getByLabelText(notice.attributes.title?.label ?? ""), { target: { value: "점검" } });
		await waitFor(() => expect(savedNotice(editor)).toMatchObject({ attrs: { title: "점검" } }));
	});

	it("EDIT-B3 hides the settings tool when read-only", async () => {
		const editor = await mount(NOTICE);
		act(() => editor.setEditable(false));
		await waitFor(() => expect(screen.queryByRole("button", { name: tBlocks("settings.label") })).toBeNull());
	});

	it("PLUG-A9 renders with the edit view registered by the site in blockViews", async () => {
		const editor = await mount(NOTICE, (node) => (
			<AdminComponentsProvider components={{ blockViews: { [notice.name]: NoticeView } }}>
				{node}
			</AdminComponentsProvider>
		));
		fireEvent.click(screen.getByRole("button", { name: levelButton("info") }));
		await waitFor(() => expect(savedNotice(editor)).toMatchObject({ type: notice.name, attrs: { level: "warn" } }));
		expect(JSON.stringify(savedNotice(editor))).toContain(BODY);
	});

	it("EDIT-B3 shows the warnings of a block next to that block only", async () => {
		const id = NOTICE.content[0]?.id as string;
		const otherWarning = "다른 블록의 경고";
		await mount(NOTICE, (node) => (
			<BlockIssuesProvider
				issues={
					new Map([
						[id, ["1줄: 문법 오류"]],
						["another-block", [otherWarning]],
					])
				}
			>
				{node}
			</BlockIssuesProvider>
		));
		const list = await screen.findByRole("list", { name: tBlocks("issues.label") });
		expect(list.textContent).toBe("1줄: 문법 오류");
		expect(screen.getAllByRole("list", { name: tBlocks("issues.label") })).toHaveLength(1);
		expect(screen.queryByText(otherWarning)).toBeNull();
	});
});
