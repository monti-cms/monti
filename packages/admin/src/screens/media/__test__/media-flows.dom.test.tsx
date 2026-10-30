import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { NoticeError } from "../../../api/client";
import { commonMessages } from "../../../lib/common.messages";
import { writePreference } from "../../../lib/utils/site-storage";
import { type FakeApi, fakeApi } from "../../../test/fake-api";
import { createTestRouter } from "../../../test/router";
import { deleteMessages } from "../../shared/delete.messages";
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
const td = testSite.createTranslator(deleteMessages);

let nav: ReturnType<typeof createTestRouter>;
let backend: MediaBackend;
let api: FakeApi;

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
	api = backend
		.mount(fakeApi().install())
		// The sidebar's counts: nothing in the trash, no failed deliveries.
		.on("GET /v1/trash", () => ({ items: [], total: 0, kinds: {} }))
		.on("GET /v1/events", () => ({
			items: [],
			total: 0,
			counts: { pending: 0, delivering: 0, delivered: 0, failed: 0, dead: 0, dismissed: 0 },
		}));
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
/** The list queries the library asked for, in order. */
const lists = () => api.sent("GET /v1/media").map((request) => request.query);
const lastList = () =>
	lists()
		.filter((q) => q.get("pageSize") !== "1")
		.at(-1) as URLSearchParams;
const written = (method: string, path: string) =>
	api.requests.filter((request) => request.method === method && request.path === `/v1${path}`).map((r) => r.body);
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

		const listsBefore = lists().length;
		act(() => finish[0]?.());
		await waitFor(() => expect(upload.uploadImageFile).toHaveBeenCalledTimes(2));
		act(() => finish[1]?.());
		await waitFor(() => expect(screen.queryByRole("button", { name: /^hero/ })).toBeNull());
		expect(lists().length).toBeGreaterThan(listsBefore);
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
		expect(heic.closest("[data-slot=tile]")?.getAttribute("data-status")).toBe("failed");
		expect(heic.closest("[data-slot=tile]")?.querySelector("[data-slot=tile-failed-ring]")).toBeInTheDocument();
		expect(heic.querySelector("[data-slot=file-preview]")).toBeNull();
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
		// A picture over the limit is only held up (its own picture, no red ring); a format the site does not take is the one that fails.
		expect(failed.closest("[data-slot=tile]")?.getAttribute("data-status")).toBe("interrupted");
		expect(failed.closest("[data-slot=tile]")?.querySelector("[data-slot=tile-failed-ring]")).toBeNull();
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
});

describe("flow: browsing (둘러보기)", () => {
	it("shows the open folder: the path above the title, the way up, its folders and its files", async () => {
		await renderLibrary();
		expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Blog Assets");
		const trail = screen.getByRole("navigation", { name: t("trail.label") });
		expect(within(trail).getByRole("button", { name: t("title") })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: t("folder.up") })).toBeInTheDocument();
		expect(folderTile("covers")).toBeInTheDocument();
		expect(lastList().get("folderId")).toBe("blog");
		// The way up goes to the top, which asks for the files in no folder.
		fireEvent.click(screen.getByRole("button", { name: t("folder.up") }));
		await screen.findByRole("button", { name: /^old-cover\.jpg/ });
		expect(lastList().get("folderId")).toBe("null");
		expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(t("title"));
	});

	it("searches the open folder and what is inside it, shows each result's folder path, and widens to all folders with the toggle", async () => {
		await renderLibrary();
		fireEvent.click(screen.getByRole("button", { name: t("head.search") }));
		fireEvent.change(screen.getByRole("searchbox", { name: t("head.searchLabel") }), { target: { value: "cover" } });
		await waitFor(() => expect(lastList().get("search")).toBe("cover"), { timeout: 3000 });
		const found = await screen.findByRole("button", { name: /^cover-react\.jpg/ });
		// A file from a folder inside the open one adds its path below it, ahead of its usual line (the size stays).
		expect(found.textContent).toMatch(/covers · \d+×\d+/);
		expect(screen.queryByRole("button", { name: /^old-cover/ })).toBeNull();
		// The place to look: this folder and all folders.
		const scope = screen.getByRole("group", { name: t("scope.label") });
		expect(within(scope).getByRole("button", { name: "Blog Assets" }).getAttribute("aria-pressed")).toBe("true");
		fireEvent.click(within(scope).getByRole("button", { name: t("scope.all") }));
		await waitFor(() => expect(lastList().has("folderId")).toBe(false));
		const wider = await screen.findByRole("button", { name: /^old-cover\.jpg/ });
		expect(wider.textContent).toContain(t("result.noFolder"));
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
});

describe("flow: replacing a file (파일 바꾸기)", () => {
	const openPanel = async (name = "desk-morning.jpg") => {
		fireEvent.click(tile(name));
		return screen.findByRole("complementary", { name });
	};

	it("asks with the number of places that use the file, then uploads the new file, replaces it in the same id and tells so", async () => {
		upload.uploadImageFile.mockResolvedValue({ mediaId: "new-file" });
		await renderLibrary();
		const panel = await openPanel();
		fireEvent.click(moreButton(panel));
		fireEvent.click(await screen.findByRole("menuitem", { name: t("panel.replace") }));
		const input = document.querySelector("input[type=file][data-slot=replace-input]") as HTMLInputElement;
		fireEvent.change(input, { target: { files: [file("desk-morning-v2.jpg", "image/jpeg")] } });
		const dialog = await screen.findByRole("alertdialog", { name: t("replace.title") });
		expect(within(dialog).getByText(t("replace.body", { count: 2 }))).toBeInTheDocument();
		expect(within(dialog).getByText("desk-morning-v2.jpg")).toBeInTheDocument();
		expect(upload.uploadImageFile).not.toHaveBeenCalled();
		fireEvent.click(within(dialog).getByRole("button", { name: t("replace.confirm") }));
		await waitFor(() => expect(written("POST", "/media/desk-morning/replace")).toHaveLength(1));
		expect(written("POST", "/media/desk-morning/replace")[0]).toEqual({ fromId: "new-file" });
		expect(upload.uploadImageFile.mock.calls[0]?.[3]).toBeUndefined();
		await waitFor(() => expect(toast).toHaveBeenCalledWith(t("replace.done")));
		// The same file stays open: its id did not change.
		expect(screen.getByRole("complementary", { name: "desk-morning.jpg" })).toBeInTheDocument();
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
		expect(within(dialog).getByText(t("replace.kind"))).toBeInTheDocument();
		expect((within(dialog).getByRole("button", { name: t("replace.confirm") }) as HTMLButtonElement).disabled).toBe(
			true,
		);
	});
});

describe("flow: moving many (여러 개 옮기기)", () => {
	it("lists the top level, the folders and a new folder in the to-folder menu, and moves every picked file to the one chosen", async () => {
		await renderLibrary();
		pick("desk-morning.jpg");
		pick("cafe-window.jpg");
		const bar = await screen.findByRole("toolbar", { name: t("bulk.count", { count: 2 }) });
		fireEvent.click(within(bar).getByRole("button", { name: new RegExp(t("bulk.toFolder")) }));
		const places = await screen.findAllByRole("menuitemradio");
		expect(names(places)).toEqual([t("bulk.top"), "Blog Assets", "covers", "Wallpapers"]);
		expect(names(await screen.findAllByRole("menuitem"))).toEqual([t("bulk.newFolder")]);
		// The folder the picked files are in now is the one that is ticked.
		expect(places.map((place) => place.getAttribute("aria-checked"))).toEqual(["false", "true", "false", "false"]);
		fireEvent.click(places[1] as HTMLElement);
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});
		expect(written("PATCH", "/media/desk-morning")).toHaveLength(0);
		fireEvent.click(within(bar).getByRole("button", { name: new RegExp(t("bulk.toFolder")) }));
		fireEvent.click((await screen.findAllByRole("menuitemradio"))[2] as HTMLElement);
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
});

describe("flow: alt text (대체 텍스트)", () => {
	const openFilter = async (name: string) => {
		fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));
		return screen.findAllByRole("menuitemcheckbox");
	};

	it("shows the picked condition as a chip with a remove button, asks the server for it, and offers the place to look", async () => {
		await renderLibrary();
		const items = await openFilter(t("filter.alt"));
		fireEvent.click(items[0] as HTMLElement);
		await waitFor(() => expect(lastList().get("alt")).toBe("none"));
		const chip = await screen.findByText(t("chip.alt", { value: t("alt.none") }));
		expect(
			within(chip.closest("[data-slot=chip]") as HTMLElement).getByRole("button", { name: t("filter.remove") }),
		).toBeInTheDocument();
		await screen.findByRole("button", { name: /^cafe-window\.jpg/ });
		expect(screen.queryByRole("button", { name: /^desk-morning\.jpg/ })).toBeNull();
		expect(screen.getByRole("group", { name: t("scope.label") })).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: t("filter.remove") }));
		await waitFor(() => expect(lastList().has("alt")).toBe(false));
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
		expect(lists().some((q) => q.get("alt") === "none" && q.get("pageSize") === "100")).toBe(true);
	});
});

describe("flow: filtering by kind (종류로 거르기)", () => {
	it("offers images and files with their counts, applies a pick as a chip and sends it", async () => {
		await renderLibrary();
		fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${t("filter.kind")}`) }));
		const items = await screen.findAllByRole("menuitemcheckbox");
		// The type only narrows the open folder's own files (the files of covers are not counted).
		expect(names(items)).toEqual([`${t("kind.image")}3`, `${t("kind.file")}1`]);
		fireEvent.click(items[1] as HTMLElement);
		await waitFor(() => expect(lastList().get("kind")).toBe("file"));
		// The folder stays browsable: its folders and the way up stay.
		expect(within(dropArea()).getByRole("button", { name: new RegExp(`^${t("folder.up")}`) })).toBeInTheDocument();
		expect(within(dropArea()).getByRole("button", { name: /^covers/ })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: t("head.folder") })).toBeInTheDocument();
		const chip = await screen.findByText(t("chip.kind", { value: t("kind.value.file") }));
		await screen.findByRole("button", { name: /^notes-scan\.pdf/ });
		expect(screen.queryByRole("button", { name: /^desk-morning\.jpg/ })).toBeNull();
		fireEvent.click(
			within(chip.closest("[data-slot=chip]") as HTMLElement).getByRole("button", { name: t("filter.remove") }),
		);
		await waitFor(() => expect(lastList().has("kind")).toBe(false));
	});
});

describe("flow: deleting (지우기)", () => {
	it("moves a file to the trash at once with the Del key and no question, and the toast's undo puts it back", async () => {
		await renderLibrary();
		// The Del key on the tile (the menu of the tile has no trash row).
		fireEvent.keyDown(tile("cafe-window.jpg"), { key: "Delete" });
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
		// The search stays beside the dimmed upload, as in the library.
		expect(screen.getByRole("button", { name: t("head.search") })).toBeInTheDocument();
		expect(screen.getByText(t("notConfigured.title"))).toBeInTheDocument();
		const link = screen.getByRole("link", { name: t("notConfigured.link") });
		expect(link.getAttribute("href")).toMatch(/^https:/);
		expect(screen.queryByRole("button", { name: t("head.folder") })).toBeNull();
	});
});
