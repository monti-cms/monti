import { emptyStoredDocument } from "@monti-cms/core/document";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import type { EntryData } from "../../screens/entries/entry-form";
import { type FakeApi, failure, fakeApi } from "../../test/fake-api";
import { docOf } from "../../test/mdx";
import { renderWithSite } from "../../test/site";
import { storedDoc, text } from "../../test/stored-doc";
import { buildEditorExtensions } from "../extensions";
import { InlineBubble } from "../inline-bubble";
import { resetLinkTargets } from "../link-targets";
import { editorMessages } from "../messages";
import { storedToTiptap, tiptapToStored } from "../tiptap-content";

const { LINKABLE_COLLECTIONS, DEFAULT_LOCALE, contentPath, localizePath } = testSite;
const t = testSite.createTranslator(editorMessages);
const tc = testSite.createTranslator(commonMessages);

/** A collection with a public path, whichever site config the tests run with: only such entries can be linked to. */
const COLLECTION = LINKABLE_COLLECTIONS[0] as string;

/** The id of the entry a link points to: the translation group id, which is the source entry's id. */
const TARGET = "6f1c0b0e-3c1d-4a0e-9f5a-0d9c2f1e7a11";

const entryRow = (changes: Partial<EntryData> = {}): EntryData => ({
	id: TARGET,
	collection: COLLECTION,
	status: "published",
	locale: DEFAULT_LOCALE,
	version: 1,
	folderId: null,
	workingSlug: "hello-draft",
	publishedSlug: "hello",
	working: { metadata: { title: "안녕하세요" }, doc: emptyStoredDocument() },
	...changes,
});

let api: FakeApi;

const editors: Editor[] = [];
beforeEach(() => {
	resetLinkTargets(testSite);
	api = fakeApi()
		.on("GET /v1/entries/:id", () => entryRow())
		.install();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	for (const editor of editors.splice(0)) {
		const element = editor.view.dom.parentElement;
		editor.destroy();
		element?.remove();
	}
});

/** An editor opened on a stored document: the link holds the entry's id and nothing else, as it does when loaded from the server. */
const openOnDocument = () => {
	const doc = storedDoc({
		type: "paragraph",
		content: [text("앞 "), text("링크 글", [{ type: "link", attrs: { entryId: TARGET } }]), text(" 뒤")],
	});
	const element = document.createElement("div");
	document.body.append(element);
	const editor = new Editor({
		element,
		extensions: buildEditorExtensions(testSite),
		content: storedToTiptap(testSite, doc),
	});
	editors.push(editor);
	editor.commands.setTextSelection(5);
	editor.view.focus();
	return editor;
};

const renderBubble = (editor: Editor) => renderWithSite(<InlineBubble editor={editor} />);

describe("where an internal link goes, shown in the editor", () => {
	it("EDIT-L3 resolves the id to the entry's title and address, and opens its page on the site when it is published", async () => {
		const editor = openOnDocument();
		renderBubble(editor);

		const link = await screen.findByRole("link", { name: t("link.targetOpenSite", { title: "안녕하세요" }) });
		expect(link.textContent).toContain("안녕하세요");
		// The address readers see is the published one.
		const path = localizePath(DEFAULT_LOCALE, contentPath(COLLECTION, "hello") as string);
		expect(link.textContent).toContain(path);
		expect(link.getAttribute("href")).toBe(path);
		expect(api.requests).toHaveLength(1);
		expect(api.requests[0]?.path).toBe(`/v1/entries/${TARGET}`);
	});

	it("EDIT-L3 says so when the entry is gone, and when it cannot be looked up", async () => {
		api.on("GET /v1/entries/:id", () => failure("not_found"));
		const editor = openOnDocument();
		const { unmount } = renderBubble(editor);
		expect(await screen.findByText(t("link.targetMissing"))).toBeInTheDocument();
		unmount();

		resetLinkTargets(testSite);
		api.on("GET /v1/entries/:id", () => {
			throw new TypeError("Failed to fetch");
		});
		renderBubble(editor);
		expect(await screen.findByText(t("link.targetUnavailable"))).toBeInTheDocument();
	});

	it("EDIT-L3 shows the target in the link form, and leaves the link as it is when nothing is typed", async () => {
		const editor = openOnDocument();
		renderBubble(editor);
		await screen.findByRole("link", { name: t("link.targetOpenSite", { title: "안녕하세요" }) });

		act(() => fireEvent.click(screen.getByRole("button", { name: t("link.edit") })));
		expect(await screen.findByText(t("link.target", { title: "안녕하세요" }))).toBeInTheDocument();
		// The address input is empty: the display address is not what the link holds.
		expect((screen.getByLabelText(t("link.href")) as HTMLInputElement).value).toBe("");
		act(() => fireEvent.click(screen.getByRole("button", { name: tc("apply") })));

		expect(screen.queryByText(t("link.invalid"))).toBeNull();
		const saved = tiptapToStored(testSite, editor.getJSON());
		expect(JSON.stringify(saved)).toContain(TARGET);
	});

	it("EDIT-L3 an address typed in the form replaces the entry the link pointed to", async () => {
		const editor = openOnDocument();
		renderBubble(editor);
		await screen.findByRole("link", { name: t("link.targetOpenSite", { title: "안녕하세요" }) });

		act(() => fireEvent.click(screen.getByRole("button", { name: t("link.edit") })));
		act(() => fireEvent.change(screen.getByLabelText(t("link.href")), { target: { value: "https://example.com" } }));
		act(() => fireEvent.click(screen.getByRole("button", { name: tc("apply") })));

		const saved = JSON.stringify(tiptapToStored(testSite, editor.getJSON()));
		expect(saved).not.toContain(TARGET);
		expect(saved).toContain("https://example.com");
	});

	it("EDIT-L1 an external link still shows its address", async () => {
		const element = document.createElement("div");
		document.body.append(element);
		const editor = new Editor({
			element,
			extensions: buildEditorExtensions(testSite),
			content: storedToTiptap(testSite, docOf("앞 [외부](https://example.com) 뒤")),
		});
		editors.push(editor);
		editor.commands.setTextSelection(5);
		editor.view.focus();
		renderBubble(editor);
		expect(screen.getByRole("link", { name: "https://example.com" }).getAttribute("href")).toBe("https://example.com");
		expect(api.requests).toHaveLength(0);
	});
});
