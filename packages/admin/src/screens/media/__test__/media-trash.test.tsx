import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { jsonResponse as json } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { toast } from "../../../test/ui-toast";
import { deleteMessages } from "../../shared/delete.messages";
import { AdminQueryProvider } from "../../shared/query-provider";
import { folderTrashNotice } from "../../shared/use-folder-actions";
import { MediaLibrary } from "../media-library";
import { keptFilesFolder, mediaTrashNotice } from "../media-trash";

// The media library's folders go to the trash without a question (flow 6, "폴더 지움" and "폴더 일부 남김" of the media board). A screenshot cannot show
// what is sent, which toast follows, or what its button does.

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const td = testSite.createTranslator(deleteMessages);

const FOLDERS = [
	{ id: "f-diag", collection: "media", parentId: null, name: "diagrams", position: 0, version: 2 },
	{ id: "f-covers", collection: "media", parentId: null, name: "covers", position: 1, version: 5 },
];

let fetchMock: ReturnType<typeof vi.fn>;
let folderAnswer: unknown;
let host: ReturnType<typeof createTestRouter>;

beforeEach(() => {
	host = createTestRouter();
	vi.clearAllMocks();
	folderAnswer = { folder: { id: "f-diag" }, entries: 0, folders: 0, files: 3, kept: 0 };
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const url = new URL(input, "http://localhost");
		const method = init?.method ?? "GET";
		if (url.pathname === "/api/monti/v1/media" && method === "GET") return json({ items: [], total: 0 });
		if (url.pathname === "/api/monti/v1/folders" && method === "GET") return json(FOLDERS);
		if (/^\/api\/monti\/v1\/folders\/[^/]+$/.test(url.pathname) && method === "DELETE") return json(folderAnswer);
		if (url.pathname === "/api/monti/v1/trash/restore" && method === "POST") return json({ results: [] });
		throw new Error(`Unexpected fetch ${method} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const calls = (method: string, path: string) =>
	fetchMock.mock.calls.filter(
		([input, init]) => (init?.method ?? "GET") === method && String(input).split("?")[0] === path,
	);

const openFolderMenu = async (name: string) => {
	host.render(
		<AdminQueryProvider>
			<MediaLibrary />
		</AdminQueryProvider>,
	);
	await act(async () => {
		// The sidebar tree has a button of the same name; the tile in the page is the last one.
		fireEvent.contextMenu((await screen.findAllByRole("button", { name })).at(-1) as HTMLElement);
	});
};
const lastToast = () => {
	const [message, options] = toast.mock.calls.at(-1) as [string, { action?: { label: string; onClick: () => void } }];
	return { message, action: options?.action };
};

describe("flow: a media folder goes to the trash (T9)", () => {
	it("offers open, rename, move and then 폴더 지우기, with no subfolder item", async () => {
		await openFolderMenu("diagrams");
		const items = await screen.findAllByRole("menuitem");
		expect(items.map((item) => item.textContent)).toEqual([
			"열기",
			td("folder.menu.rename"),
			td("folder.menu.move"),
			td("folder.menu.delete"),
		]);
	});

	it("moves the whole folder at once, tells how many files went, and the toast's undo restores the folder", async () => {
		await openFolderMenu("diagrams");
		fireEvent.click(await screen.findByRole("menuitem", { name: td("folder.menu.delete") }));

		await waitFor(() => expect(calls("DELETE", "/api/monti/v1/folders/f-diag")).toHaveLength(1));
		expect(String(calls("DELETE", "/api/monti/v1/folders/f-diag")[0]?.[0])).toContain("expectedVersion=2");
		expect(screen.queryByRole("alertdialog")).toBeNull();
		// A media folder is not read first: files are never public pages, so there is nothing to ask.
		expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/contents"))).toBe(false);
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(lastToast().message).toBe(td("folder.done.files", { name: "diagrams", files: 3 }));
		expect(lastToast().action?.label).toBe(td("undo"));

		await act(async () => lastToast().action?.onClick());
		await waitFor(() => expect(calls("POST", "/api/monti/v1/trash/restore")).toHaveLength(1));
		expect(JSON.parse(String(calls("POST", "/api/monti/v1/trash/restore")[0]?.[1]?.body))).toEqual({
			items: [{ type: "folder", id: "f-diag" }],
		});
	});

	it("when files in use stay, only those that could go are moved, and the toast's view shows the used ones in that folder", async () => {
		folderAnswer = { folder: null, entries: 0, folders: 0, files: 2, kept: 4 };
		await openFolderMenu("covers");
		fireEvent.click(await screen.findByRole("menuitem", { name: td("folder.menu.delete") }));

		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(lastToast().message).toBe(td("folder.partial", { name: "covers", moved: 2, kept: 4 }));
		expect(lastToast().action?.label).toBe(td("view"));
		await act(async () => lastToast().action?.onClick());
		await waitFor(() => expect(host.search.get("used")).toBe("used"));
		expect(host.search.get("folder")).toBe("f-covers");
	});
});

describe("the toast after a move to the trash", () => {
	it("names a folder of entries with its entries, and a media folder with its files", () => {
		const folder = { name: "시리즈 원고", collection: "post" };
		const whole = { folder: {} as never, entries: 2, folders: 0, files: 0, kept: 0 };
		expect(folderTrashNotice(testSite, folder, whole)).toEqual({
			message: td("folder.done", { name: "시리즈 원고", entries: 2 }),
			action: "undo",
		});
		expect(folderTrashNotice(testSite, folder, { ...whole, entries: 0 }).message).toBe(
			td("folder.done.empty", { name: "시리즈 원고" }),
		);
	});

	it("says nothing moved when every file of a media folder is in use", () => {
		const result = { folder: null, entries: 0, folders: 0, files: 0, kept: 3 };
		expect(folderTrashNotice(testSite, { name: "covers", collection: "media" }, result)).toEqual({
			message: td("folder.keptAll"),
			action: "view",
		});
	});

	it("tells a file by its name, several by their count, and keeps the undo only for a whole move", () => {
		const files = [
			{ id: "a", filename: "notes-scan.pdf" },
			{ id: "b", filename: "b.png" },
		];
		expect(mediaTrashNotice(testSite, files, { trashed: ["a"], kept: [] })).toEqual({
			message: td("media.done.one", { name: "notes-scan.pdf" }),
			action: "undo",
		});
		expect(mediaTrashNotice(testSite, files, { trashed: ["a", "b"], kept: [] })).toEqual({
			message: td("media.done.many", { count: 2 }),
			action: "undo",
		});
		expect(mediaTrashNotice(testSite, files, { trashed: ["a"], kept: ["b"] })).toEqual({
			message: td("media.partial", { moved: 1, kept: 1 }),
			action: "view",
		});
		expect(mediaTrashNotice(testSite, files, { trashed: [], kept: ["a", "b"] })).toEqual({
			message: td("media.keptAll"),
			action: "view",
		});
	});

	it("opens the folder the kept files are in, or the whole library when they are in several", () => {
		const files = [
			{ id: "a", folderId: "f1" },
			{ id: "b", folderId: "f1" },
			{ id: "c", folderId: "f2" },
		];
		expect(keptFilesFolder(files, { trashed: ["c"], kept: ["a", "b"] })).toBe("f1");
		expect(keptFilesFolder(files, { trashed: [], kept: ["a", "c"] })).toBe("all");
	});
});
