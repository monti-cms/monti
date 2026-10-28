import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { NoticeError } from "../../../api/client";
import { commonMessages } from "../../../lib/common.messages";
import { writePreference } from "../../../lib/utils/site-storage";
import { jsonResponse as json } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { deleteMessages } from "../../shared/delete.messages";
import { ENTRY_DRAG_TYPE } from "../../shared/entry-drag";
import { sharedMessages } from "../../shared/messages";
import { AdminQueryProvider } from "../../shared/query-provider";
import { MediaLibrary } from "../media-library";
import { MediaNotConfigured } from "../media-not-configured";
import { acceptedKinds } from "../media-upload";
import { mediaMessages } from "../messages";
import { folderItem, image, MediaBackend, pdf } from "./media-backend";

// One test per row of flow 6 of the canvas (the Media board): uploading, looking around, replacing a file, moving many, filling alt text, filtering by kind, files
// that are not pictures, deleting, and the exception with no storage. They check what a screenshot cannot: the requests a press sends, where a drop goes,
// what is enabled, the names of the parts and the keys.

const ui = vi.hoisted(() => {
	const toast = Object.assign(vi.fn(), {
		error: vi.fn(),
		dropHint: vi.fn((_message: unknown, _options?: unknown) => "hint"),
		dismiss: vi.fn(),
	});
	return { toast };
});
vi.mock("@monti-cms/ui", async (importOriginal) => ({
	...(await importOriginal<typeof import("@monti-cms/ui")>()),
	toast: ui.toast,
}));
const upload = vi.hoisted(() => ({
	prepareUpload: vi.fn(),
	uploadImageFile: vi.fn(),
	uploadAttachment: vi.fn(),
	shrinkForUpload: vi.fn(),
}));
vi.mock("../../../editor/upload-helper", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../../editor/upload-helper")>()),
	...upload,
}));
const { toast } = ui;

const t = testSite.createTranslator(mediaMessages);
const tc = testSite.createTranslator(commonMessages);
const ts = testSite.createTranslator(sharedMessages);
const td = testSite.createTranslator(deleteMessages);

let nav: ReturnType<typeof createTestRouter>;
let backend: MediaBackend;
let fetchMock: ReturnType<typeof vi.fn>;

const blog = folderItem("blog", "Blog Assets", null, 4);
const covers = folderItem("covers", "covers", "blog", 2);
const wall = folderItem("wall", "Wallpapers", null, 1);
const used = (n: number) => ({
	referencesCount: n,
	references: Array.from({ length: n }, (_, i) => ({
		entryId: `e${i}`,
		title: `Post ${i}`,
		collection: "post",
		state: "published" as const,
	})),
});
const desk = image("desk-morning", { folderId: "blog", ...used(2) });
const cafe = image("cafe-window", { folderId: "blog", defaultAlt: "" });
const seoul = image("seoul-night", { folderId: "blog", defaultAlt: "" });
const notes = pdf("notes-scan", { folderId: "blog" });
const react = image("cover-react", { folderId: "covers", ...used(1) });
const cache = image("cover-cache", { folderId: "covers", defaultAlt: "" });
const old = image("old-cover", { folderId: null });

beforeEach(() => {
	nav = createTestRouter({ pathname: "/admin/media" });
	nav.setSearch("folder=blog");
	vi.clearAllMocks();
	window.localStorage.clear();
	writePreference(testSite, "media-view", "grid");
	backend = new MediaBackend([desk, cafe, seoul, notes, react, cache, old], [blog, covers, wall]);
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const url = new URL(input, "http://localhost");
		const body = init?.body ? JSON.parse(String(init.body)) : undefined;
		const answer = backend.handle(url, init?.method ?? "GET", body);
		return answer ? json(answer.body, answer.status) : json({ items: [], total: 0 });
	});
	vi.stubGlobal("fetch", fetchMock);
	upload.prepareUpload.mockImplementation(async (_site: unknown, file: File) => ({ file, optimized: false }));
	upload.uploadImageFile.mockResolvedValue({ mediaId: "up-1" });
	upload.uploadAttachment.mockResolvedValue({ mediaId: "up-1" });
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderLibrary = async (ready: RegExp | string = /^desk-morning\.jpg/) => {
	nav.render(
		<AdminQueryProvider>
			<MediaLibrary />
		</AdminQueryProvider>,
	);
	await screen.findByRole("button", { name: ready });
};
const lastList = () => backend.lists.filter((q) => q.get("pageSize") !== "1").at(-1) as URLSearchParams;
const written = (method: string, path: string) =>
	backend.writes.filter((w) => w.method === method && w.path === path).map((w) => w.body);
const tile = (name: RegExp | string) =>
	screen.getByRole("button", { name: typeof name === "string" ? new RegExp(`^${name}`) : name });
const openMenu = async (target: HTMLElement) => {
	await act(async () => {
		fireEvent.contextMenu(target);
	});
	return screen.findAllByRole("menuitem");
};
const names = (items: HTMLElement[]) => items.map((item) => item.textContent);
const file = (name: string, type: string, size = 100) => {
	const made = new File(["x"], name, { type });
	Object.defineProperty(made, "size", { value: size });
	return made;
};
/** A folder tile of the grid (the sidebar lists the folders too). */
const folderTile = (name: string) => within(dropArea()).getByRole("button", { name: new RegExp(`^${name}`) });
const dropArea = () => document.querySelector("[data-slot=drop-area]") as HTMLElement;
const dragOf = (...files: File[]) => ({
	dataTransfer: { types: ["Files"], files, items: files.map(() => ({ kind: "file" })) },
});
/** The panel's ⋯, named "More: <what it holds>". */
const moreButton = (panel: HTMLElement) => within(panel).getByRole("button", { name: /^(More|더보기):/ });
const pick = (name: string) => fireEvent.click(screen.getByRole("checkbox", { name: t("tile.select", { name }) }));

describe("flow: upload (올리기)", () => {
	it("draws the drop hint while files are over the library, and a folder tile alone while they are over it", async () => {
		await renderLibrary();
		fireEvent.dragEnter(dropArea(), dragOf(file("a.png", "image/png")));
		expect(dropArea().getAttribute("data-over")).toBe("true");
		expect(toast.dropHint).toHaveBeenCalled();
		const here = toast.dropHint.mock.calls.at(-1)?.[0] as unknown;
		expect(JSON.stringify(here)).toContain(t("drop.here"));

		const folder = folderTile("covers");
		fireEvent.dragEnter(folder, dragOf(file("a.png", "image/png")));
		expect(folder.getAttribute("data-drop-target")).toBe("true");
		expect(dropArea().getAttribute("data-over")).toBeNull();
		expect(JSON.stringify(toast.dropHint.mock.calls.at(-1)?.[0])).toContain("covers");

		fireEvent.dragLeave(folder, dragOf());
		fireEvent.drop(dropArea(), dragOf());
		expect(toast.dismiss).toHaveBeenCalled();
	});

	it("does not take a file tile dragged inside the library for files from outside", async () => {
		await renderLibrary();
		fireEvent.dragEnter(dropArea(), { dataTransfer: { types: [ENTRY_DRAG_TYPE], files: [] } });
		expect(dropArea().getAttribute("data-over")).toBeNull();
		expect(toast.dropHint).not.toHaveBeenCalled();
	});

	it("uploads a drop on the library into the open folder, one at a time, with a progress tile by name and the next one waiting", async () => {
		const finish: (() => void)[] = [];
		let report: (percent: number) => void = () => {};
		upload.uploadImageFile.mockImplementation(
			(_site: unknown, _prepared: unknown, onProgress: (percent: number) => void) =>
				new Promise((resolve) => {
					report = onProgress;
					finish.push(() => resolve({ mediaId: "up" }));
				}),
		);
		await renderLibrary();
		fireEvent.drop(dropArea(), dragOf(file("hero.png", "image/png"), file("hero-dark.png", "image/png")));
		const hero = await screen.findByRole("button", { name: /^hero\.png/ });
		act(() => report(64));
		await waitFor(() => expect(hero.textContent).toContain(t("upload.progress", { percent: 64 })));
		expect(screen.getByRole("button", { name: /^hero-dark\.png/ }).textContent).toContain(t("upload.waiting"));
		expect(upload.uploadImageFile).toHaveBeenCalledTimes(1);
		expect(upload.uploadImageFile.mock.calls[0]?.[3]).toEqual({ folderId: "blog" });

		const listsBefore = backend.lists.length;
		act(() => finish[0]?.());
		await waitFor(() => expect(upload.uploadImageFile).toHaveBeenCalledTimes(2));
		act(() => finish[1]?.());
		await waitFor(() => expect(screen.queryByRole("button", { name: /^hero/ })).toBeNull());
		expect(backend.lists.length).toBeGreaterThan(listsBefore);
	});

	it("uploads a drop on a folder tile into that folder", async () => {
		await renderLibrary();
		fireEvent.drop(folderTile("covers"), dragOf(file("a.png", "image/png")));
		await waitFor(() => expect(upload.uploadImageFile).toHaveBeenCalled());
		expect(upload.uploadImageFile.mock.calls[0]?.[3]).toEqual({ folderId: "covers" });
	});

	it("shrinks to WebP by default: there is no switch for it, and the picture goes through the converter without an option", async () => {
		await renderLibrary();
		expect(screen.queryByRole("switch")).toBeNull();
		expect(screen.queryByRole("checkbox", { name: /WebP/ })).toBeNull();
		fireEvent.drop(dropArea(), dragOf(file("a.png", "image/png")));
		await waitFor(() => expect(upload.prepareUpload).toHaveBeenCalled());
		expect(upload.prepareUpload.mock.calls[0]).toHaveLength(2);
	});

	it("takes the files of the upload button and of the file picker the same way", async () => {
		await renderLibrary();
		const input = document.querySelector("input[type=file]") as HTMLInputElement;
		fireEvent.change(input, { target: { files: [file("a.pdf", "application/pdf")] } });
		await waitFor(() => expect(upload.uploadAttachment).toHaveBeenCalled());
		expect(upload.uploadAttachment.mock.calls[0]?.[3]).toEqual({ folderId: "blog" });
	});

	it("keeps a file that failed in its place with the reason, and the button takes it out", async () => {
		upload.uploadImageFile.mockRejectedValue(new NoticeError("The storage said no"));
		await renderLibrary();
		fireEvent.drop(dropArea(), dragOf(file("hero.png", "image/png")));
		const failed = await screen.findByRole("button", { name: /^hero\.png/ });
		await waitFor(() => expect(failed.textContent).toContain("The storage said no"));
		fireEvent.click(screen.getByRole("button", { name: t("upload.remove") }));
		expect(screen.queryByRole("button", { name: /^hero\.png/ })).toBeNull();
	});

	it("keeps a format the site does not take as a tile that says so, with the remove button and nothing sent", async () => {
		await renderLibrary();
		fireEvent.drop(
			dropArea(),
			dragOf(file("IMG_2041.HEIC", "image/heic"), file("setup.exe", "application/x-msdownload")),
		);
		const heic = await screen.findByRole("button", { name: /^IMG_2041\.HEIC/ });
		expect(heic.textContent).toContain(t("upload.unsupported"));
		const exe = screen.getByRole("button", { name: /^setup\.exe/ });
		const kinds = acceptedKinds(testSite)
			.map((kind) => t(`upload.kind.${kind}` as "upload.kind.image"))
			.join(" · ");
		expect(exe.textContent).toContain(t("upload.acceptedKinds", { kinds }));
		const removes = screen.getAllByRole("button", { name: t("upload.remove") });
		expect(removes).toHaveLength(2);
		expect(screen.queryByRole("button", { name: t("upload.shrink") })).toBeNull();
		expect(upload.uploadImageFile).not.toHaveBeenCalled();
		expect(upload.uploadAttachment).not.toHaveBeenCalled();
		fireEvent.click(removes[0] as HTMLElement);
		expect(screen.queryByRole("button", { name: /^IMG_2041\.HEIC/ })).toBeNull();
	});

	it("offers to shrink a picture over the size limit and tries again with the smaller one, which goes up without an original", async () => {
		const big = file("panorama.jpg", "image/jpeg", testSite.api.MAX_MEDIA_BYTES + 4_000_000);
		const small = new File(["y"], "panorama.webp", { type: "image/webp" });
		upload.shrinkForUpload.mockResolvedValue({ file: small, optimized: true });
		await renderLibrary();
		fireEvent.drop(dropArea(), dragOf(big));
		const failed = await screen.findByRole("button", { name: /^panorama\.jpg/ });
		expect(upload.uploadImageFile).not.toHaveBeenCalled();
		expect(failed.textContent).toMatch(/MB/);
		fireEvent.click(screen.getByRole("button", { name: t("upload.shrink") }));
		await waitFor(() => expect(upload.uploadImageFile).toHaveBeenCalled());
		expect(upload.shrinkForUpload.mock.calls[0]?.[1]).toBe(big);
		expect(upload.uploadImageFile.mock.calls[0]?.[1]).toEqual({ file: small, optimized: true });
	});

	it("says it when even the smallest version does not fit, and keeps the tile", async () => {
		upload.shrinkForUpload.mockResolvedValue(null);
		await renderLibrary();
		fireEvent.drop(dropArea(), dragOf(file("panorama.jpg", "image/jpeg", testSite.api.MAX_MEDIA_BYTES + 1)));
		await screen.findByRole("button", { name: /^panorama\.jpg/ });
		fireEvent.click(screen.getByRole("button", { name: t("upload.shrink") }));
		await waitFor(() =>
			expect(screen.getByRole("button", { name: /^panorama\.jpg/ }).textContent).toContain(t("upload.shrinkFailed")),
		);
		expect(upload.uploadImageFile).not.toHaveBeenCalled();
	});

	it("shows a PDF being uploaded as a file tile with its extension, like a picture", async () => {
		upload.uploadAttachment.mockReturnValue(new Promise(() => {}));
		await renderLibrary();
		fireEvent.drop(dropArea(), dragOf(file("price-list-2026.pdf", "application/pdf")));
		const tileOf = await screen.findByRole("button", { name: /^price-list-2026\.pdf/ });
		expect(tileOf.textContent).toContain("PDF");
		expect(tileOf.textContent).toContain(t("upload.progress", { percent: 0 }));
	});
});

describe("flow: browsing (둘러보기)", () => {
	it("shows the open folder: the path above the title, the way up, its folders and its files", async () => {
		await renderLibrary();
		expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Blog Assets");
		const trail = screen.getByRole("navigation", { name: t("trail.label") });
		expect(within(trail).getByRole("button", { name: t("title") })).toBeTruthy();
		expect(screen.getByRole("button", { name: t("folder.up") })).toBeTruthy();
		expect(folderTile("covers")).toBeTruthy();
		expect(lastList().get("folderId")).toBe("blog");
		// The way up goes to the top, which asks for the files in no folder.
		fireEvent.click(screen.getByRole("button", { name: t("folder.up") }));
		await screen.findByRole("button", { name: /^old-cover\.jpg/ });
		expect(lastList().get("folderId")).toBe("null");
		expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(t("title"));
	});

	it("+ 폴더 makes the folder in place with its name selected: no dialog, Enter sends the name, and Escape sends nothing", async () => {
		await renderLibrary();
		fireEvent.click(screen.getByRole("button", { name: t("head.folder") }));
		expect(screen.queryByRole("dialog")).toBeNull();
		const field = (await screen.findByRole("textbox", { name: t("folder.nameLabel") })) as HTMLInputElement;
		expect(document.activeElement).toBe(field);
		expect(field.value).toBe(ts("folder.newName"));
		expect(field.selectionStart).toBe(0);
		expect(field.selectionEnd).toBe(field.value.length);
		fireEvent.keyDown(field, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("textbox", { name: t("folder.nameLabel") })).toBeNull());
		expect(written("POST", "/folders")).toHaveLength(0);

		fireEvent.click(screen.getByRole("button", { name: t("head.folder") }));
		const again = await screen.findByRole("textbox", { name: t("folder.nameLabel") });
		fireEvent.change(again, { target: { value: "diagrams" } });
		fireEvent.keyDown(again, { key: "Enter" });
		await waitFor(() => expect(written("POST", "/folders")).toHaveLength(1));
		expect(written("POST", "/folders")[0]).toEqual({ collection: "media", name: "diagrams", parentId: "blog" });
		await within(dropArea()).findByRole("button", { name: /^diagrams/ });
	});

	it("opens the folder menu with open, rename, move and delete in that order; rename is in place, and delete sends the request", async () => {
		await renderLibrary();
		const items = await openMenu(folderTile("covers"));
		expect(names(items)).toEqual([
			tc("open"),
			td("folder.menu.rename"),
			td("folder.menu.move"),
			td("folder.menu.delete"),
		]);
		fireEvent.click(items[1] as HTMLElement);
		const field = await screen.findByRole("textbox", { name: t("folder.nameLabel") });
		expect((field as HTMLInputElement).value).toBe("covers");
		fireEvent.change(field, { target: { value: "thumbnails" } });
		fireEvent.keyDown(field, { key: "Enter" });
		await waitFor(() => expect(written("PATCH", "/folders/covers")).toHaveLength(1));
		expect(written("PATCH", "/folders/covers")[0]).toEqual({ name: "thumbnails", expectedVersion: 2 });

		const again = await openMenu(await within(dropArea()).findByRole("button", { name: /^thumbnails/ }));
		fireEvent.click(again[3] as HTMLElement);
		await waitFor(() => expect(written("DELETE", "/folders/covers")).toHaveLength(1));
	});

	it("opens the file menu with open, used in, to folder and the trash, and the empty-space menu with upload and new folder", async () => {
		await renderLibrary();
		const items = await openMenu(tile("desk-morning.jpg"));
		expect(names(items)).toEqual([tc("open"), t("menu.usedIn"), t("menu.toFolder"), `${tc("lifecycle.trash")}Del`]);
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
		await waitFor(() => expect(screen.queryAllByRole("menuitem")).toHaveLength(0));

		const blank = await openMenu(document.querySelector("[data-slot=blank-space]") as HTMLElement);
		expect(names(blank)).toEqual([t("menu.upload"), t("menu.newFolder")]);
		fireEvent.click(blank[1] as HTMLElement);
		await screen.findByRole("textbox", { name: t("folder.nameLabel") });
	});

	it("searches the open folder and what is inside it, shows each result's folder path, and widens to all folders with the toggle", async () => {
		await renderLibrary();
		fireEvent.click(screen.getByRole("button", { name: t("head.search") }));
		fireEvent.change(screen.getByRole("searchbox", { name: t("head.searchLabel") }), { target: { value: "cover" } });
		await waitFor(() => expect(lastList().get("search")).toBe("cover"), { timeout: 3000 });
		expect(lastList().get("folderId")).toBe("blog");
		expect(lastList().get("includeDescendants")).toBe("true");
		const found = await screen.findByRole("button", { name: /^cover-react\.jpg/ });
		expect(found.textContent).toContain("Blog Assets / covers");
		expect(screen.queryByRole("button", { name: /^old-cover/ })).toBeNull();
		// The place to look: this folder and all folders.
		const scope = screen.getByRole("group", { name: t("scope.label") });
		expect(within(scope).getByRole("button", { name: "Blog Assets" }).getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(within(scope).getByRole("button", { name: t("scope.all") }));
		await waitFor(() => expect(lastList().has("folderId")).toBe(false));
		const wider = await screen.findByRole("button", { name: /^old-cover\.jpg/ });
		expect(wider.textContent).toContain(t("result.noFolder"));
	});

	it("opens a file in a panel named by it, with its name, folder, descriptions, type, size and where it is used", async () => {
		await renderLibrary();
		fireEvent.click(tile("desk-morning.jpg"));
		const panel = await screen.findByRole("complementary", { name: "desk-morning.jpg" });
		expect((within(panel).getByRole("textbox", { name: t("panel.filename") }) as HTMLInputElement).value).toBe(
			"desk-morning",
		);
		expect(within(panel).getByRole("textbox", { name: t("panel.alt") })).toBeTruthy();
		expect(within(panel).getByRole("textbox", { name: t("panel.caption") })).toBeTruthy();
		expect(within(panel).getByText(t("panel.usedIn", { count: 2 }))).toBeTruthy();
		expect(within(panel).getByRole("link", { name: "Post 0" })).toBeTruthy();
		expect(within(panel).getByRole("button", { name: t("panel.copyUrl") })).toBeTruthy();
		expect(
			within(panel)
				.getByRole("link", { name: t("panel.openTab") })
				.getAttribute("target"),
		).toBe("_blank");
	});

	it("saves the name, folder and descriptions together from the panel's one button", async () => {
		await renderLibrary();
		fireEvent.click(tile("desk-morning.jpg"));
		const panel = await screen.findByRole("complementary", { name: "desk-morning.jpg" });
		const save = within(panel).getByRole("button", { name: tc("save") });
		expect((save as HTMLButtonElement).disabled).toBe(true);
		fireEvent.change(within(panel).getByRole("textbox", { name: t("panel.filename") }), { target: { value: "desk" } });
		fireEvent.change(within(panel).getByRole("textbox", { name: t("panel.alt") }), {
			target: { value: "A tidy desk" },
		});
		expect((save as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(save);
		await waitFor(() => expect(written("PATCH", "/media/desk-morning")).toHaveLength(1));
		expect(written("PATCH", "/media/desk-morning")[0]).toMatchObject({
			filename: "desk.jpg",
			defaultAlt: "A tidy desk",
		});
	});

	it("sorts with the filter-style menu: newest upload first, oldest first, by name and biggest first, one at a time, sent with the request", async () => {
		await renderLibrary();
		expect(lastList().has("sort")).toBe(false);
		const button = screen.getByRole("button", { name: t("sort.uploaded") });
		fireEvent.click(button);
		const items = await screen.findAllByRole("menuitemradio");
		expect(names(items)).toEqual([t("sort.uploaded"), t("sort.uploadedAsc"), t("sort.name"), t("sort.size")]);
		expect(items[0]?.getAttribute("aria-checked")).toBe("true");
		fireEvent.click(items[3] as HTMLElement);
		await waitFor(() => expect(lastList().get("sort")).toBe("size"));
		expect(await screen.findByRole("button", { name: t("sort.size") })).toBeTruthy();
		// The counts of the menus do not follow the order.
		expect(backend.lists.filter((q) => q.get("pageSize") === "1").every((q) => !q.has("sort"))).toBe(true);
	});

	it("lists the files in the list view with their use, type, size, dimensions and day, and a path while searching", async () => {
		writePreference(testSite, "media-view", "list");
		nav.render(
			<AdminQueryProvider>
				<MediaLibrary />
			</AdminQueryProvider>,
		);
		await screen.findByRole("row", { name: /desk-morning\.jpg/ });
		const heads = screen.getAllByRole("columnheader").map((head) => head.textContent);
		expect(heads).toEqual(
			expect.arrayContaining([
				t("table.name"),
				t("table.usage"),
				t("table.type"),
				t("table.size"),
				t("table.dimensions"),
				t("table.uploadedAt"),
			]),
		);
		expect(screen.getByRole("row", { name: /desk-morning\.jpg/ })).toBeTruthy();
	});
});

describe("flow: replacing a file (파일 바꾸기)", () => {
	const openPanel = async (name = "desk-morning.jpg") => {
		fireEvent.click(tile(name));
		return screen.findByRole("complementary", { name });
	};

	it("opens the panel's menu with replace, copy ID and the trash, named in the button; the address and the new tab are in the body", async () => {
		await renderLibrary();
		const panel = await openPanel();
		expect(moreButton(panel).getAttribute("aria-label")).toBe(
			t("panel.more", { items: [t("panel.replace"), t("panel.copyId"), tc("lifecycle.trash")].join(", ") }),
		);
		fireEvent.click(moreButton(panel));
		const items = await screen.findAllByRole("menuitem");
		expect(names(items)).toEqual([t("panel.replace"), t("panel.copyId"), tc("lifecycle.trash")]);
		expect(within(panel).getByRole("button", { name: t("panel.copyUrl") })).toBeTruthy();
		expect(within(panel).getByRole("link", { name: t("panel.openTab") })).toBeTruthy();
	});

	it("asks with the number of places that use the file, then uploads the new file, replaces it in the same id and tells so", async () => {
		upload.uploadImageFile.mockResolvedValue({ mediaId: "new-file" });
		await renderLibrary();
		const panel = await openPanel();
		fireEvent.click(moreButton(panel));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("panel.replace") }));
		const input = document.querySelector("input[type=file][data-slot=replace-input]") as HTMLInputElement;
		fireEvent.change(input, { target: { files: [file("desk-morning-v2.jpg", "image/jpeg")] } });
		const dialog = await screen.findByRole("alertdialog", { name: t("replace.title") });
		expect(within(dialog).getByText(t("replace.body", { count: 2 }))).toBeTruthy();
		expect(within(dialog).getByText("desk-morning-v2.jpg")).toBeTruthy();
		expect(upload.uploadImageFile).not.toHaveBeenCalled();
		fireEvent.click(within(dialog).getByRole("button", { name: t("replace.confirm") }));
		await waitFor(() => expect(written("POST", "/media/desk-morning/replace")).toHaveLength(1));
		expect(written("POST", "/media/desk-morning/replace")[0]).toEqual({ fromId: "new-file" });
		expect(upload.uploadImageFile.mock.calls[0]?.[3]).toBeUndefined();
		await waitFor(() => expect(toast).toHaveBeenCalledWith(t("replace.done")));
		// The same file stays open: its id did not change.
		expect(screen.getByRole("complementary", { name: "desk-morning.jpg" })).toBeTruthy();
	});

	it("does not send anything when cancelled", async () => {
		await renderLibrary();
		const panel = await openPanel();
		fireEvent.click(moreButton(panel));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("panel.replace") }));
		fireEvent.change(document.querySelector("input[type=file][data-slot=replace-input]") as HTMLInputElement, {
			target: { files: [file("v2.jpg", "image/jpeg")] },
		});
		const dialog = await screen.findByRole("alertdialog", { name: t("replace.title") });
		fireEvent.click(within(dialog).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(upload.uploadImageFile).not.toHaveBeenCalled();
		expect(written("POST", "/media/desk-morning/replace")).toHaveLength(0);
	});

	it("says a picture can only be replaced by a picture and does not let the replace go on", async () => {
		await renderLibrary();
		const panel = await openPanel();
		fireEvent.click(moreButton(panel));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("panel.replace") }));
		fireEvent.change(document.querySelector("input[type=file][data-slot=replace-input]") as HTMLInputElement, {
			target: { files: [file("guide.pdf", "application/pdf")] },
		});
		const dialog = await screen.findByRole("alertdialog", { name: t("replace.title") });
		expect(within(dialog).getByText(t("replace.kind"))).toBeTruthy();
		expect((within(dialog).getByRole("button", { name: t("replace.confirm") }) as HTMLButtonElement).disabled).toBe(
			true,
		);
	});

	it("says there is nothing using a file nobody uses yet", async () => {
		await renderLibrary();
		const panel = await openPanel("cafe-window.jpg");
		fireEvent.click(moreButton(panel));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("panel.replace") }));
		fireEvent.change(document.querySelector("input[type=file][data-slot=replace-input]") as HTMLInputElement, {
			target: { files: [file("v2.jpg", "image/jpeg")] },
		});
		const dialog = await screen.findByRole("alertdialog", { name: t("replace.title") });
		expect(within(dialog).getByText(t("replace.bodyUnused"))).toBeTruthy();
	});
});

describe("flow: moving many (여러 개 옮기기)", () => {
	it("picks several files and swaps the filter row for a bar with the count, to folder, the trash and clear", async () => {
		await renderLibrary();
		pick("desk-morning.jpg");
		pick("cafe-window.jpg");
		const bar = await screen.findByRole("toolbar", { name: t("bulk.count", { count: 2 }) });
		expect(names(within(bar).getAllByRole("button"))).toEqual(
			[t("bulk.toFolder"), t("bulk.trash"), t("bulk.clear")].map(
				(label) => expect.stringContaining(label) as unknown as string,
			),
		);
		expect(screen.queryByRole("button", { name: t("head.folder") })).toBeNull();
		fireEvent.click(within(bar).getByRole("button", { name: t("bulk.clear") }));
		await waitFor(() => expect(screen.queryByRole("toolbar", { name: /./ })).toBeNull());
	});

	it("lists the top level, the folders and a new folder in the to-folder menu, and moves every picked file to the one chosen", async () => {
		await renderLibrary();
		pick("desk-morning.jpg");
		pick("cafe-window.jpg");
		const bar = await screen.findByRole("toolbar", { name: t("bulk.count", { count: 2 }) });
		fireEvent.click(within(bar).getByRole("button", { name: new RegExp(t("bulk.toFolder")) }));
		const items = await screen.findAllByRole("menuitem");
		expect(names(items)).toEqual([t("bulk.top"), "Blog Assets", "covers", "Wallpapers", t("bulk.newFolder")]);
		fireEvent.click(items[2] as HTMLElement);
		await waitFor(() => expect(written("PATCH", "/media/desk-morning")).toHaveLength(1));
		expect(written("PATCH", "/media/desk-morning")[0]).toEqual({ folderId: "covers" });
		expect(written("PATCH", "/media/cafe-window")[0]).toEqual({ folderId: "covers" });
		await waitFor(() =>
			expect(toast).toHaveBeenCalledWith(
				t("moved.many", { count: 2, destination: t("moved.toFolder", { name: "covers" }) }),
			),
		);
		await waitFor(() => expect(screen.queryByRole("toolbar", { name: /./ })).toBeNull());
	});

	it("makes a new folder in place from the menu and moves the picked files into it", async () => {
		await renderLibrary();
		pick("desk-morning.jpg");
		const bar = await screen.findByRole("toolbar", { name: t("bulk.count", { count: 1 }) });
		fireEvent.click(within(bar).getByRole("button", { name: new RegExp(t("bulk.toFolder")) }));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("bulk.newFolder") }));
		const field = await screen.findByRole("textbox", { name: t("folder.nameLabel") });
		fireEvent.change(field, { target: { value: "archive" } });
		fireEvent.keyDown(field, { key: "Enter" });
		await waitFor(() => expect(written("PATCH", "/media/desk-morning")).toHaveLength(1));
		expect(written("POST", "/folders")[0]).toMatchObject({ name: "archive" });
		expect(written("PATCH", "/media/desk-morning")[0]).toEqual({ folderId: "new-3" });
	});

	it("sends the picked files to the trash in one request", async () => {
		await renderLibrary();
		pick("desk-morning.jpg");
		pick("cafe-window.jpg");
		const bar = await screen.findByRole("toolbar", { name: t("bulk.count", { count: 2 }) });
		fireEvent.click(within(bar).getByRole("button", { name: t("bulk.trash") }));
		await waitFor(() => expect(written("POST", "/media/trash")).toHaveLength(1));
		expect(written("POST", "/media/trash")[0]).toEqual({ ids: ["desk-morning", "cafe-window"] });
	});
});

describe("flow: moving many by dragging", () => {
	/** Starts a drag on a tile and drops what it carried on the sidebar's folder, as the browser would. */
	const dragTo = async (tileName: RegExp, folderName: string) => {
		const carried: Record<string, string> = {};
		const dataTransfer = {
			setData: (type: string, value: string) => {
				carried[type] = value;
			},
			getData: (type: string) => carried[type] ?? "",
			setDragImage: () => undefined,
			get types() {
				return Object.keys(carried);
			},
			effectAllowed: "",
		};
		fireEvent.dragStart(screen.getByRole("button", { name: tileName }), { dataTransfer });
		// The folder of the same name in the sidebar, not the tile in the grid.
		const target = screen
			.getAllByRole("button", { name: new RegExp(folderName) })
			.find((button) => !dropArea().contains(button)) as HTMLElement;
		fireEvent.drop(target, { dataTransfer });
	};

	it("takes every picked file with the one dragged to a sidebar folder", async () => {
		await renderLibrary();
		pick("desk-morning.jpg");
		pick("cafe-window.jpg");
		await dragTo(/^desk-morning\.jpg/, "Wallpapers");
		await waitFor(() => expect(written("PATCH", "/media/desk-morning")).toHaveLength(1));
		expect(written("PATCH", "/media/desk-morning")[0]).toEqual({ folderId: "wall" });
		expect(written("PATCH", "/media/cafe-window")[0]).toEqual({ folderId: "wall" });
		expect(written("PATCH", "/media/seoul-night")).toHaveLength(0);
	});

	it("takes only the dragged file when it is not one of the picked", async () => {
		await renderLibrary();
		pick("desk-morning.jpg");
		await dragTo(/^seoul-night\.jpg/, "Wallpapers");
		await waitFor(() => expect(written("PATCH", "/media/seoul-night")).toHaveLength(1));
		expect(written("PATCH", "/media/desk-morning")).toHaveLength(0);
	});
});

describe("flow: alt text (대체 텍스트)", () => {
	const openFilter = async (name: string) => {
		fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));
		return screen.findAllByRole("menuitemcheckbox");
	};

	it("offers none and has with their counts for the folder and what is inside it", async () => {
		await renderLibrary();
		const items = await openFilter(t("filter.alt"));
		// In Blog Assets and covers: seoul-night, cafe-window and cover-cache have none; desk-morning and cover-react have one.
		expect(names(items)).toEqual([`${t("alt.none")}3`, `${t("alt.has")}2`]);
	});

	it("shows the picked condition as a chip with a remove button, asks the server for it, and offers the place to look", async () => {
		await renderLibrary();
		const items = await openFilter(t("filter.alt"));
		fireEvent.click(items[0] as HTMLElement);
		await waitFor(() => expect(lastList().get("alt")).toBe("none"));
		expect(lastList().get("folderId")).toBe("blog");
		expect(lastList().get("includeDescendants")).toBe("true");
		const chip = await screen.findByText(t("chip.alt", { value: t("alt.none") }));
		expect(
			within(chip.closest("[data-slot=chip]") as HTMLElement).getByRole("button", { name: t("filter.remove") }),
		).toBeTruthy();
		await screen.findByRole("button", { name: /^cafe-window\.jpg/ });
		expect(screen.queryByRole("button", { name: /^desk-morning\.jpg/ })).toBeNull();
		expect(screen.getByRole("group", { name: t("scope.label") })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: t("filter.remove") }));
		await waitFor(() => expect(lastList().has("alt")).toBe(false));
		expect(screen.queryByRole("group", { name: t("scope.label") })).toBeNull();
	});

	it("selects every file that matches, not only the ones on the page", async () => {
		nav.setSearch("folder=blog&alt=none");
		await renderLibrary(/^cafe-window\.jpg/);
		pick("cafe-window.jpg");
		const bar = await screen.findByRole("toolbar", { name: t("bulk.count", { count: 1 }) });
		const all = within(bar).getByRole("checkbox", { name: t("bulk.selectAll") });
		expect(all.getAttribute("aria-checked")).toBe("mixed");
		fireEvent.click(all);
		await screen.findByRole("toolbar", { name: t("bulk.count", { count: 3 }) });
		expect(backend.lists.some((q) => q.get("alt") === "none" && q.get("pageSize") === "100")).toBe(true);
	});

	it("takes the alt text condition away from the menu while the kind is files", async () => {
		await renderLibrary();
		expect(screen.getByRole("button", { name: new RegExp(`^${t("filter.alt")}`) })).toBeTruthy();
		const kinds = await openFilter(t("filter.kind"));
		fireEvent.click(kinds[1] as HTMLElement);
		await screen.findByText(t("chip.kind", { value: t("kind.value.file") }));
		expect(screen.queryByRole("button", { name: new RegExp(`^${t("filter.alt")}`) })).toBeNull();
	});
});

describe("flow: filtering by kind (종류로 거르기)", () => {
	it("offers images and files with their counts, applies a pick as a chip and sends it", async () => {
		await renderLibrary();
		fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${t("filter.kind")}`) }));
		const items = await screen.findAllByRole("menuitemcheckbox");
		expect(names(items)).toEqual([`${t("kind.image")}5`, `${t("kind.file")}1`]);
		fireEvent.click(items[1] as HTMLElement);
		await waitFor(() => expect(lastList().get("kind")).toBe("file"));
		const chip = await screen.findByText(t("chip.kind", { value: t("kind.value.file") }));
		await screen.findByRole("button", { name: /^notes-scan\.pdf/ });
		expect(screen.queryByRole("button", { name: /^desk-morning\.jpg/ })).toBeNull();
		fireEvent.click(
			within(chip.closest("[data-slot=chip]") as HTMLElement).getByRole("button", { name: t("filter.remove") }),
		);
		await waitFor(() => expect(lastList().has("kind")).toBe(false));
	});
});

describe("flow: files such as PDF (PDF 같은 파일)", () => {
	it("shows a file as a tile with its extension instead of a picture", async () => {
		await renderLibrary();
		const tileOf = tile("notes-scan.pdf");
		expect(tileOf.textContent).toContain("PDF");
		expect(tileOf.querySelector("img")).toBeNull();
	});

	it("opens a file's panel without alt text, with the replace and trash buttons in the foot", async () => {
		await renderLibrary();
		fireEvent.click(tile("notes-scan.pdf"));
		const panel = await screen.findByRole("complementary", { name: "notes-scan.pdf" });
		expect(within(panel).queryByRole("textbox", { name: t("panel.alt") })).toBeNull();
		expect(within(panel).queryByRole("textbox", { name: t("panel.caption") })).toBeNull();
		expect(within(panel).getByText(t("panel.kind"))).toBeTruthy();
		expect(within(panel).getByText(t("panel.size"))).toBeTruthy();
		expect(within(panel).getByText(t("panel.usedInNone"))).toBeTruthy();
		const foot = panel.querySelector("[data-slot=side-panel-footer]") as HTMLElement;
		expect(names(within(foot).getAllByRole("button"))).toEqual([t("panel.replace"), tc("lifecycle.trash"), tc("save")]);
		fireEvent.click(within(foot).getByRole("button", { name: tc("lifecycle.trash") }));
		await waitFor(() => expect(written("POST", "/media/trash")).toHaveLength(1));
		expect(written("POST", "/media/trash")[0]).toEqual({ ids: ["notes-scan"] });
	});
});

describe("flow: deleting (지우기)", () => {
	it("moves a file to the trash at once with no question, and the toast's undo puts it back", async () => {
		await renderLibrary();
		const items = await openMenu(tile("cafe-window.jpg"));
		fireEvent.click(items[3] as HTMLElement);
		await waitFor(() => expect(written("POST", "/media/trash")).toHaveLength(1));
		expect(written("POST", "/media/trash")[0]).toEqual({ ids: ["cafe-window"] });
		expect(screen.queryByRole("alertdialog")).toBeNull();
		await waitFor(() => expect(toast).toHaveBeenCalled());
		const [message, options] = toast.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
		expect(message).toBe(td("media.done.one", { name: "cafe-window.jpg" }));
		expect(options.action.label).toBe(td("undo"));
		options.action.onClick();
		await waitFor(() => expect(written("POST", "/trash/restore")).toHaveLength(1));
		expect(written("POST", "/trash/restore")[0]).toEqual({ items: [{ type: "media", id: "cafe-window" }] });
	});

	it("keeps a file that is in use and says so, with a view of the ones that stayed", async () => {
		backend.onTrash = (ids) => ({ trashed: ids.filter((id) => id !== "desk-morning"), kept: ["desk-morning"] });
		await renderLibrary();
		pick("desk-morning.jpg");
		pick("cafe-window.jpg");
		const bar = await screen.findByRole("toolbar", { name: t("bulk.count", { count: 2 }) });
		fireEvent.click(within(bar).getByRole("button", { name: t("bulk.trash") }));
		await waitFor(() => expect(toast).toHaveBeenCalled());
		const [message, options] = toast.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
		expect(message).toBe(td("media.partial", { moved: 1, kept: 1 }));
		expect(options.action.label).toBe(td("view"));
		act(() => options.action.onClick());
		await waitFor(() => expect(lastList().get("used")).toBe("used"));
		expect(lastList().get("folderId")).toBe("blog");
	});

	it("moves a folder to the trash with its files, no question, with an undo; one with files in use keeps those and offers to view them", async () => {
		await renderLibrary();
		const items = await openMenu(folderTile("covers"));
		fireEvent.click(items[3] as HTMLElement);
		await waitFor(() => expect(written("DELETE", "/folders/covers")).toHaveLength(1));
		expect(screen.queryByRole("alertdialog")).toBeNull();
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect((toast.mock.calls[0]?.[1] as { action: { label: string } }).action.label).toBe(td("undo"));

		toast.mockClear();
		backend.onFolderDelete = () => ({ folder: null, entries: 0, folders: 0, files: 2, kept: 4 });
		const again = await openMenu(folderTile("covers"));
		fireEvent.click(again[3] as HTMLElement);
		await waitFor(() => expect(toast).toHaveBeenCalled());
		const [message, options] = toast.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
		expect(message).toContain("4");
		expect(options.action.label).toBe(td("view"));
		act(() => options.action.onClick());
		await waitFor(() => expect(lastList().get("used")).toBe("used"));
		expect(lastList().get("folderId")).toBe("covers");
	});
});

describe("flow: exceptions (예외)", () => {
	it("keeps the title with the upload button off and says there is no storage, with a link on how to connect", () => {
		nav.render(
			<AdminQueryProvider>
				<MediaNotConfigured />
			</AdminQueryProvider>,
		);
		expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(t("title"));
		const uploadButton = screen.getByRole("button", { name: t("head.upload") }) as HTMLButtonElement;
		expect(uploadButton.disabled || uploadButton.getAttribute("aria-disabled") === "true").toBe(true);
		expect(screen.getByText(t("notConfigured.title"))).toBeTruthy();
		const link = screen.getByRole("link", { name: t("notConfigured.link") });
		expect(link.getAttribute("href")).toMatch(/^https:/);
		expect(screen.queryByRole("button", { name: t("head.folder") })).toBeNull();
	});
});
