import { adminUrl, contentPath, createTranslator, LINKABLE_COLLECTIONS } from "@monti-cms/core/client";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { docOf } from "../../test/mdx";
import { buildEditorExtensions } from "../extensions";
import { InlineBubble } from "../inline-bubble";
import { insertInternalLink } from "../internal-link";
import { requestLinkTarget, resetLinkTargets } from "../link-targets";
import { editorMessages } from "../messages";
import { storedToTiptap, tiptapToStored } from "../tiptap-content";

const t = createTranslator(editorMessages);

vi.mock("../../ui/tooltip", () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => children,
	TooltipTrigger: ({
		render,
		children,
	}: {
		render?: React.ReactElement<{ children?: React.ReactNode }>;
		children?: React.ReactNode;
	}) => (render ? React.cloneElement(render, {}, children ?? render.props.children) : children),
	TooltipContent: () => null,
	TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
}));

/** A collection with a public path, whichever site config the tests run with: only such entries can be linked to. */
const COLLECTION = LINKABLE_COLLECTIONS[0] as string;

/** The id of the entry a link points to: the translation group id, which is the source entry's id. */
const TARGET = "6f1c0b0e-3c1d-4a0e-9f5a-0d9c2f1e7a11";

const entryRow = (changes: Record<string, unknown> = {}) => ({
	id: TARGET,
	collection: COLLECTION,
	status: "published",
	workingSlug: "hello-draft",
	publishedSlug: "hello",
	working: { metadata: { title: "안녕하세요" } },
	...changes,
});

const respond = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
let fetchMock: ReturnType<typeof vi.fn>;

// jsdom has no coordinates for text ranges. ProseMirror uses them to measure the cursor position.
beforeAll(() => {
	const empty = () =>
		({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
	const rect = () => new DOMRect(0, 0, 0, 0);
	for (const proto of [Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
		proto.getClientRects ??= empty;
		proto.getBoundingClientRect ??= rect;
	}
});

const editors: Editor[] = [];
beforeEach(() => {
	resetLinkTargets();
	fetchMock = vi.fn(async () => respond(entryRow()));
	vi.stubGlobal("fetch", fetchMock);
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
	const doc = docOf(`앞 [링크 글](entry:${TARGET}) 뒤`);
	const element = document.createElement("div");
	document.body.append(element);
	const editor = new Editor({ element, extensions: buildEditorExtensions(), content: storedToTiptap(doc) });
	editors.push(editor);
	editor.commands.setTextSelection(5);
	editor.view.focus();
	return editor;
};

const renderBubble = (editor: Editor) => render(<InlineBubble editor={editor} />);

describe("where an internal link goes, shown in the editor", () => {
	it("resolves the id to the entry's title and address, and opens its page on the site when it is published", async () => {
		const editor = openOnDocument();
		renderBubble(editor);

		const link = await screen.findByRole("link", { name: t("link.targetOpenSite", { title: "안녕하세요" }) });
		expect(link.textContent).toContain("안녕하세요");
		// The address readers see is the published one.
		const path = contentPath(COLLECTION, "hello") as string;
		expect(link.textContent).toContain(path);
		expect(link.getAttribute("href")).toBe(path);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(String(fetchMock.mock.calls[0]?.[0])).toContain(`/v1/entries/${TARGET}`);
	});

	it("opens the entry in the admin while it is not published, and says so", async () => {
		fetchMock.mockImplementation(async () => respond(entryRow({ status: "draft", publishedSlug: null })));
		const editor = openOnDocument();
		renderBubble(editor);

		const link = await screen.findByRole("link", { name: t("link.targetOpenAdmin", { title: "안녕하세요" }) });
		expect(link.getAttribute("href")).toBe(adminUrl(`/entries/${TARGET}/edit`));
		expect(link.textContent).toContain(t("link.targetDraft"));
		expect(link.textContent).toContain(contentPath(COLLECTION, "hello-draft") as string);
	});

	it("says so when the entry is gone, and when it cannot be looked up", async () => {
		fetchMock.mockImplementation(async () => respond({ code: "not_found" }, 404));
		const editor = openOnDocument();
		const { unmount } = renderBubble(editor);
		expect(await screen.findByText(t("link.targetMissing"))).toBeTruthy();
		unmount();

		resetLinkTargets();
		fetchMock.mockImplementation(async () => {
			throw new TypeError("Failed to fetch");
		});
		renderBubble(editor);
		expect(await screen.findByText(t("link.targetUnavailable"))).toBeTruthy();
	});

	it("looks an entry up once however many places show it, and not again for a link just inserted", async () => {
		requestLinkTarget(TARGET);
		requestLinkTarget(TARGET);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		resetLinkTargets();
		fetchMock.mockClear();
		const element = document.createElement("div");
		document.body.append(element);
		const editor = new Editor({ element, extensions: buildEditorExtensions(), content: "<p>[[</p>" });
		editors.push(editor);
		insertInternalLink(
			editor,
			{ from: 1, to: 3 },
			{ id: TARGET, collection: COLLECTION, title: "방금 고른 글", slug: "picked", status: "published" },
		);
		editor.commands.setTextSelection(3);
		editor.view.focus();
		renderBubble(editor);
		const link = await screen.findByRole("link", { name: t("link.targetOpenSite", { title: "방금 고른 글" }) });
		expect(link.getAttribute("href")).toBe(contentPath(COLLECTION, "picked"));
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("shows the target in the link form, and leaves the link as it is when nothing is typed", async () => {
		const editor = openOnDocument();
		renderBubble(editor);
		await screen.findByRole("link", { name: t("link.targetOpenSite", { title: "안녕하세요" }) });

		act(() => fireEvent.click(screen.getByRole("button", { name: t("link.edit") })));
		expect(await screen.findByText(t("link.target", { title: "안녕하세요" }))).toBeTruthy();
		// The address input is empty: the display address is not what the link holds.
		expect((screen.getByLabelText(t("link.href")) as HTMLInputElement).value).toBe("");
		act(() => fireEvent.click(screen.getByRole("button", { name: t("popoverForm.apply") })));

		expect(screen.queryByText(t("link.invalid"))).toBeNull();
		const saved = tiptapToStored(editor.getJSON());
		expect(JSON.stringify(saved)).toContain(TARGET);
	});

	it("an address typed in the form replaces the entry the link pointed to", async () => {
		const editor = openOnDocument();
		renderBubble(editor);
		await screen.findByRole("link", { name: t("link.targetOpenSite", { title: "안녕하세요" }) });

		act(() => fireEvent.click(screen.getByRole("button", { name: t("link.edit") })));
		act(() => fireEvent.change(screen.getByLabelText(t("link.href")), { target: { value: "https://example.com" } }));
		act(() => fireEvent.click(screen.getByRole("button", { name: t("popoverForm.apply") })));

		const saved = JSON.stringify(tiptapToStored(editor.getJSON()));
		expect(saved).not.toContain(TARGET);
		expect(saved).toContain("https://example.com");
	});

	it("an external link still shows its address", async () => {
		const element = document.createElement("div");
		document.body.append(element);
		const editor = new Editor({
			element,
			extensions: buildEditorExtensions(),
			content: storedToTiptap(docOf("앞 [외부](https://example.com) 뒤")),
		});
		editors.push(editor);
		editor.commands.setTextSelection(5);
		editor.view.focus();
		renderBubble(editor);
		expect(screen.getByRole("link", { name: "https://example.com" }).getAttribute("href")).toBe("https://example.com");
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
