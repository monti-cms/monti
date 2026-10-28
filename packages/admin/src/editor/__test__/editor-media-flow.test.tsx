import type { StoredDocument } from "@monti-cms/core/document";
import { formatFileSize } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../core/test/site";
import type { FieldInputProps } from "../../screens/entries/field-inputs";
import { MediaImageInput } from "../../screens/entries/media-image-input";
import { jsonResponse as json } from "../../test/fetch";
import { renderWithSite } from "../../test/site";
import { storedDoc } from "../../test/stored-doc";
import { toast } from "../../test/ui-toast";
import { openMediaPicker } from "../block-inserts";
import { editorMediaMessages } from "../media.messages";
import { CmsEditor } from "../tiptap-editor";

// One test per canvas row of flow 6 that the editor owns: upload in the editor (05–06), pick in the editor (29–30) and files such as PDF (37–38).
// They check what a screenshot cannot: the requests, where the image or file goes, focus and selection, names and roles.

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const t = testSite.createTranslator(editorMediaMessages);

const BLOG = "11111111-1111-4111-8111-111111111111";
const COVERS = "22222222-2222-4222-8222-222222222222";
const WALL = "33333333-3333-4333-8333-333333333333";
const folder = (id: string, name: string, parentId: string | null, position: number, entryCount: number) => ({
	id,
	collection: "media",
	parentId,
	name,
	position,
	version: 1,
	entryCount,
});
const FOLDERS = [
	folder(BLOG, "Blog Assets", null, 0, 3),
	folder(COVERS, "covers", BLOG, 0, 2),
	folder(WALL, "Wallpapers", null, 1, 1),
];

const item = (id: string, filename: string, mimeType: string, folderId: string | null, extra: object = {}) => ({
	id,
	folderId,
	status: "ready",
	filename,
	mimeType,
	byteSize: 1_200_000,
	width: mimeType.startsWith("image/") ? 2400 : null,
	height: mimeType.startsWith("image/") ? 1600 : null,
	publicUrl: mimeType.startsWith("image/") ? `/images/${filename}` : null,
	original: null,
	defaultAlt: "",
	defaultCaption: "",
	createdAt: "2026-10-01T00:00:00.000Z",
	referencesCount: 0,
	references: [],
	...extra,
});
const MEDIA = [
	item("desk", "desk-morning.jpg", "image/jpeg", BLOG, { referencesCount: 1 }),
	item("cover", "cover-react.png", "image/png", COVERS),
	item("winter", "winter-02.jpg", "image/jpeg", WALL),
	item("price", "price-list-2026.pdf", "application/pdf", null),
	item("subs", "subscribers.csv", "text/csv", null, { byteSize: 48_000 }),
];

let fetchMock: ReturnType<typeof vi.fn>;
const requests: { method: string; path: string; search: URLSearchParams; body?: unknown }[] = [];

/** The little server the editor talks to. */
const handle = (url: URL, method: string, body: unknown) => {
	const path = url.pathname.replace("/api/monti/v1", "");
	requests.push({ method, path, search: url.searchParams, body });
	if (method === "GET" && path === "/folders") return json(FOLDERS);
	if (method === "GET" && path === "/media") {
		const kind = url.searchParams.get("kind") ?? "all";
		const folderId = url.searchParams.get("folderId");
		const search = (url.searchParams.get("search") ?? "").toLowerCase();
		const items = MEDIA.filter((m) =>
			kind === "all" ? true : (m.mimeType?.startsWith("image/") ? "image" : "file") === kind,
		)
			.filter((m) => (folderId ? m.folderId === folderId : true))
			.filter((m) => m.filename.toLowerCase().includes(search));
		return json({ items, total: items.length });
	}
	if (method === "GET" && path.startsWith("/media/")) {
		const found = MEDIA.find((m) => m.id === path.slice("/media/".length));
		return found
			? json({ ...found, mediaId: found.id })
			: json({
					id: path,
					filename: "new.png",
					mimeType: "image/png",
					byteSize: 10,
					status: "ready",
					publicUrl: "/images/new.png",
				});
	}
	if (method === "POST" && path === "/media/uploads")
		return json({ mediaId: "new-media", uploadUrl: "https://storage.test/put" });
	if (method === "POST" && path.endsWith("/complete"))
		return json({
			mediaId: "new-media",
			publicUrl: "/images/new.png",
			width: 100,
			height: 80,
			defaultAlt: "",
			defaultCaption: "",
		});
	return json({});
};

/** The storage PUT of an upload: it waits until the test lets it go, so the state in between can be looked at. */
class FakeXhr {
	static all: FakeXhr[] = [];
	status = 200;
	upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number }) => void } = {};
	onload?: () => void;
	onerror?: () => void;
	ontimeout?: () => void;
	open() {}
	setRequestHeader() {}
	send() {
		FakeXhr.all.push(this);
	}
}
const finishStorage = () => {
	act(() => {
		for (const xhr of FakeXhr.all.splice(0)) xhr.onload?.();
	});
};

beforeAll(() => {
	// jsdom has no coordinates for text ranges. ProseMirror uses them to measure the cursor position.
	const empty = () =>
		({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
	const rect = () => new DOMRect(0, 0, 0, 0);
	for (const proto of [Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
		proto.getClientRects ??= empty;
		proto.getBoundingClientRect ??= rect;
	}
});
beforeEach(() => {
	vi.clearAllMocks();
	requests.length = 0;
	FakeXhr.all = [];
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const url = new URL(input, "http://localhost");
		return handle(url, init?.method ?? "GET", init?.body ? JSON.parse(String(init.body)) : undefined);
	});
	vi.stubGlobal("fetch", fetchMock);
	vi.stubGlobal("XMLHttpRequest", FakeXhr);
	// jsdom has no hit testing; ProseMirror asks where a drop landed.
	document.elementFromPoint = () => null;
});
afterEach(async () => {
	// ProseMirror focuses the view a moment after a paste or a drop: let that pass before the editor goes.
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 80));
	});
	cleanup();
	vi.unstubAllGlobals();
});

const para = (value: string) => ({ type: "paragraph", content: value ? [{ type: "text", text: value }] : [] });
const image = (alt: string, mediaId = "desk") => ({ type: "image", attrs: { mediaId, alt, width: "100%" } });

/** Renders the editor on a document and gives back the Tiptap editor once it exists. */
const open = async (doc: StoredDocument) => {
	let editor: Editor | null = null;
	renderWithSite(
		<CmsEditor
			doc={doc}
			onChange={() => {}}
			onEditor={(ready) => {
				editor = ready;
			}}
		/>,
	);
	await waitFor(() => expect(editor).not.toBeNull());
	await act(async () => {
		await Promise.resolve();
	});
	return editor as unknown as Editor;
};
/** The kinds of the body's blocks, with the attributes of the images and files. */
const blocks = (editor: Editor): { type?: string; [attribute: string]: unknown }[] =>
	editor.getJSON().content?.map((node) => ({ type: node.type, ...(node.attrs ?? {}) })) ?? [];
const imageNodes = (editor: Editor) => blocks(editor).filter((node) => node.type === "image");
const uploadsPosted = () => requests.filter((r) => r.method === "POST" && r.path === "/media/uploads");

const pngFile = () => new File(["x"], "pasted.png", { type: "image/png" });
const paste = (file: File) => {
	const box = screen.getByRole("textbox", { name: /./ });
	fireEvent.paste(box, {
		clipboardData: {
			items: [{ kind: "file", type: file.type, getAsFile: () => file }],
			files: [file],
			types: ["Files"],
			getData: () => "",
		},
	});
};
/** The cursor in the empty paragraph between two paragraphs. */
const withCursorBetween = async () => {
	const editor = await open(storedDoc(para("앞 문단"), para(""), para("뒤 문단")));
	const emptyPos = editor.state.doc.child(0).nodeSize + 1;
	act(() => {
		editor.commands.setTextSelection(emptyPos);
	});
	return editor;
};

describe("flow: upload in the editor (05–06)", () => {
	it("puts a pasted image at the cursor at once as an uploading image, with progress in place and no dialog", async () => {
		const editor = await withCursorBetween();
		paste(pngFile());
		// At once: before any request has finished, the image is in the body at the cursor, going up.
		await waitFor(() => expect(imageNodes(editor)).toHaveLength(1));
		expect(screen.queryByRole("dialog")).toBeNull();
		const kinds = blocks(editor).map((node) => node.type);
		expect(kinds.indexOf("image")).toBeGreaterThan(0);
		expect(kinds.indexOf("image")).toBeLessThan(kinds.length - 1);
		expect(imageNodes(editor)[0]?.uploadId).toBeTruthy();
		expect(imageNodes(editor)[0]?.mediaId).toBeFalsy();
		const bar = await screen.findByRole("progressbar");
		expect(bar.getAttribute("aria-label")).toBe(t("imageNode.uploadingPercent", { percent: 0 }));
		// The bytes go to storage; the bar follows.
		await waitFor(() => expect(FakeXhr.all).toHaveLength(1));
		act(() => FakeXhr.all[0]?.upload.onprogress?.({ lengthComputable: true, loaded: 0 }));
		finishStorage();
	});

	it("asks the server for the upload, sends the bytes, confirms, and then the image has its media and nothing of the upload", async () => {
		const editor = await withCursorBetween();
		paste(pngFile());
		await waitFor(() => expect(FakeXhr.all).toHaveLength(1));
		expect(uploadsPosted()).toHaveLength(1);
		expect(uploadsPosted()[0]?.body).toMatchObject({ filename: "pasted.png", mimeType: "image/png" });
		expect(requests.some((r) => r.path.endsWith("/complete"))).toBe(false);
		finishStorage();
		await waitFor(() => expect(imageNodes(editor)[0]?.mediaId).toBe("new-media"));
		expect(requests.some((r) => r.method === "POST" && r.path === "/media/new-media/complete")).toBe(true);
		expect(imageNodes(editor)[0]?.uploadId).toBeNull();
		expect(screen.queryByRole("progressbar")).toBeNull();
		expect(imageNodes(editor)).toHaveLength(1);
	});

	it("takes a dropped image the same way, and takes the image away again with the reason when the upload fails", async () => {
		const editor = await withCursorBetween();
		const file = pngFile();
		fireEvent.drop(screen.getByRole("textbox", { name: /./ }), { dataTransfer: { files: [file], items: [] } });
		await waitFor(() => expect(imageNodes(editor)).toHaveLength(1));
		await waitFor(() => expect(FakeXhr.all).toHaveLength(1));
		act(() => FakeXhr.all[0]?.onerror?.());
		await waitFor(() => expect(imageNodes(editor)).toHaveLength(0));
		expect(toast.error).toHaveBeenCalled();
	});

	it("opens the image card with the alt text focused; typing sets the alt text and decorative clears it", async () => {
		const editor = await open(storedDoc(para("앞"), image("")));
		fireEvent.click(screen.getByRole("button", { name: t("imageNode.settings") }));
		const alt = await screen.findByRole("textbox", { name: t("imageNode.alt") });
		await waitFor(() => expect(document.activeElement).toBe(alt));
		expect(screen.getByRole("alert").textContent).toBe(t("imageNode.altRequired"));
		fireEvent.change(alt, { target: { value: "책상 위 노트북" } });
		expect(imageNodes(editor)[0]?.alt).toBe("책상 위 노트북");
		await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
		fireEvent.click(screen.getByRole("switch", { name: t("imageNode.decorative") }));
		expect(imageNodes(editor)[0]?.decorative).toBe(true);
		expect(imageNodes(editor)[0]?.alt).toBe("");
		await waitFor(() =>
			expect((screen.getByRole("textbox", { name: t("imageNode.alt") }) as HTMLInputElement).disabled).toBe(true),
		);
	});

	it("moves to the next image without alt text with the button or Enter: the image is selected and its card opens on the alt text", async () => {
		const editor = await open(storedDoc(image("", "desk"), image("있는 설명", "cover"), image("", "winter")));
		const settings = () => screen.getAllByRole("button", { name: t("imageNode.settings") });
		fireEvent.click(settings()[0] as HTMLElement);
		const alt = await screen.findByRole("textbox", { name: t("imageNode.alt") });
		fireEvent.change(alt, { target: { value: "첫 이미지" } });
		// The second image has text, the third has none: that one is next.
		const next = await screen.findByRole("button", { name: new RegExp(t("imageNode.next")) });
		fireEvent.click(next);
		await waitFor(() => {
			const selection = editor.state.selection;
			expect(selection instanceof NodeSelection && selection.node.attrs.mediaId).toBe("winter");
		});
		const nextAlt = await screen.findByRole("textbox", { name: t("imageNode.alt") });
		await waitFor(() => expect(document.activeElement).toBe(nextAlt));
		// Nothing is left after this one: no "next image", and Enter closes the card.
		expect(screen.queryByRole("button", { name: new RegExp(t("imageNode.next")) })).toBeNull();
		fireEvent.change(nextAlt, { target: { value: "마지막" } });
		fireEvent.keyDown(nextAlt, { key: "Enter" });
		await waitFor(() => expect(screen.queryByRole("textbox", { name: t("imageNode.alt") })).toBeNull());
		expect(imageNodes(editor).map((node) => node.alt)).toEqual(["첫 이미지", "있는 설명", "마지막"]);
	});
});

describe("flow: pick in the editor (29–30)", () => {
	it("opens the library from / Image: folders at the left, search, the images only, no tabs and no alt text", async () => {
		const editor = await withCursorBetween();
		act(() => openMediaPicker("image"));
		const dialog = await screen.findByRole("dialog", { name: t("picker.imageTitle") });
		expect(within(dialog).getByRole("navigation", { name: t("picker.folders") })).toBeTruthy();
		expect(within(dialog).getByRole("textbox", { name: t("picker.search") })).toBeTruthy();
		expect(within(dialog).queryByRole("tab")).toBeNull();
		expect(within(dialog).queryByLabelText(t("imageNode.alt"))).toBeNull();
		await within(dialog).findByRole("button", { name: /desk-morning/ });
		expect(within(dialog).queryByRole("button", { name: /price-list/ })).toBeNull();
		expect(
			requests
				.filter((r) => r.path === "/media")
				.at(-1)
				?.search.get("kind"),
		).toBe("image");
		expect(imageNodes(editor)).toHaveLength(0);
	});

	it("sends the folder when one is chosen in the list, and lists everything again for all", async () => {
		await withCursorBetween();
		act(() => openMediaPicker("image"));
		const dialog = await screen.findByRole("dialog", { name: t("picker.imageTitle") });
		const nav = within(dialog).getByRole("navigation", { name: t("picker.folders") });
		const lastList = () => requests.filter((r) => r.path === "/media").at(-1);
		fireEvent.click(await within(nav).findByRole("button", { name: /covers/ }));
		await waitFor(() => expect(lastList()?.search.get("folderId")).toBe(COVERS));
		await within(dialog).findByRole("button", { name: /cover-react/ });
		expect(within(dialog).queryByRole("button", { name: /desk-morning/ })).toBeNull();
		expect(
			within(nav)
				.getByRole("button", { name: /covers/ })
				.getAttribute("aria-current"),
		).toBe("true");
		fireEvent.click(within(nav).getByRole("button", { name: t("picker.allImages") }));
		await waitFor(() => expect(lastList()?.search.has("folderId")).toBe(false));
		await within(dialog).findByRole("button", { name: /desk-morning/ });
	});

	it("searches by file name after a pause", async () => {
		await withCursorBetween();
		act(() => openMediaPicker("image"));
		const dialog = await screen.findByRole("dialog", { name: t("picker.imageTitle") });
		fireEvent.change(within(dialog).getByRole("textbox", { name: t("picker.search") }), {
			target: { value: "winter" },
		});
		await waitFor(() =>
			expect(
				requests
					.filter((r) => r.path === "/media")
					.at(-1)
					?.search.get("search"),
			).toBe("winter"),
		);
		await within(dialog).findByRole("button", { name: /winter-02/ });
		expect(within(dialog).queryByRole("button", { name: /desk-morning/ })).toBeNull();
	});

	it("puts the picked image in at the cursor at once, with no alt or caption step and no upload", async () => {
		const editor = await withCursorBetween();
		act(() => openMediaPicker("image"));
		const dialog = await screen.findByRole("dialog", { name: t("picker.imageTitle") });
		const insert = within(dialog).getByRole("button", { name: t("picker.insert") });
		expect((insert as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(await within(dialog).findByRole("button", { name: /winter-02/ }));
		fireEvent.click(insert);
		await waitFor(() => expect(imageNodes(editor)).toHaveLength(1));
		expect(imageNodes(editor)[0]).toMatchObject({ mediaId: "winter" });
		await waitFor(() => expect(screen.queryByRole("dialog", { name: t("picker.imageTitle") })).toBeNull());
		const kinds = blocks(editor).map((node) => node.type);
		expect(kinds.indexOf("image")).toBeGreaterThan(0);
		expect(uploadsPosted()).toHaveLength(0);
	});

	it("takes the file chosen with Upload to the page as an uploading image and closes the picker", async () => {
		const editor = await withCursorBetween();
		act(() => openMediaPicker("image"));
		const dialog = await screen.findByRole("dialog", { name: t("picker.imageTitle") });
		fireEvent.change(screen.getByLabelText(t("picker.fileInput")), { target: { files: [pngFile()] } });
		await waitFor(() => expect(screen.queryByRole("dialog", { name: t("picker.imageTitle") })).toBeNull());
		expect(dialog.isConnected).toBe(false);
		await waitFor(() => expect(imageNodes(editor)).toHaveLength(1));
		await waitFor(() => expect(FakeXhr.all).toHaveLength(1));
		finishStorage();
		await waitFor(() => expect(imageNodes(editor)[0]?.mediaId).toBe("new-media"));
	});

	const coverProps = (onChange: (value: string) => void, value = "") =>
		({
			collection: "posts",
			name: "cover",
			field: { kind: "media", label: "대표 이미지" },
			id: "cover",
			value,
			invalid: false,
			context: { disabled: false },
			form: {},
			onChange,
		}) as unknown as FieldInputProps;

	it("opens the same library from the cover image field, picks with the pick button, and sends the media as the value", async () => {
		const onChange = vi.fn();
		renderWithSite(<MediaImageInput {...coverProps(onChange)} />);
		fireEvent.click(screen.getByRole("button", { name: /./ }));
		const dialog = await screen.findByRole("dialog", { name: "대표 이미지" });
		expect(within(dialog).queryByRole("button", { name: t("picker.insert") })).toBeNull();
		fireEvent.click(await within(dialog).findByRole("button", { name: /cover-react/ }));
		fireEvent.click(within(dialog).getByRole("button", { name: t("picker.pick") }));
		expect(onChange).toHaveBeenCalledWith("cover");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});
});

describe("flow: files such as PDF (37–38)", () => {
	it("opens the library with files only from / File, not the system file picker", async () => {
		await withCursorBetween();
		const click = vi.spyOn(HTMLInputElement.prototype, "click");
		act(() => openMediaPicker("file"));
		const dialog = await screen.findByRole("dialog", { name: t("picker.fileTitle") });
		await within(dialog).findByRole("button", { name: /price-list-2026/ });
		expect(within(dialog).getByRole("button", { name: /subscribers\.csv/ })).toBeTruthy();
		expect(within(dialog).queryByRole("button", { name: /desk-morning/ })).toBeNull();
		expect(
			requests
				.filter((r) => r.path === "/media")
				.at(-1)
				?.search.get("kind"),
		).toBe("file");
		expect(within(dialog).getByRole("button", { name: t("picker.allFiles") })).toBeTruthy();
		expect(click).not.toHaveBeenCalled();
	});

	it("makes a file block of the picked file at the cursor, with its name, type and size", async () => {
		const editor = await withCursorBetween();
		act(() => openMediaPicker("file"));
		const dialog = await screen.findByRole("dialog", { name: t("picker.fileTitle") });
		fireEvent.click(await within(dialog).findByRole("button", { name: /price-list-2026/ }));
		fireEvent.click(within(dialog).getByRole("button", { name: t("picker.insert") }));
		await waitFor(() => expect(blocks(editor).some((node) => node.type === "cmsFile")).toBe(true));
		expect(blocks(editor).find((node) => node.type === "cmsFile")).toMatchObject({ mediaId: "price" });
		const block = await screen.findByRole("group", { name: /price-list-2026\.pdf/ });
		expect(block.textContent).toContain(`PDF · ${formatFileSize(1_200_000)}`);
		expect(uploadsPosted()).toHaveLength(0);
	});
});
