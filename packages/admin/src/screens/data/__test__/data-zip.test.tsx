import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { ImportPreview, ImportRun } from "../../../api/import";
import type { RestoreCounts, RestorePreview, RestoreRun } from "../../../api/restore";
import { commonMessages } from "../../../lib/common.messages";
import { jsonResponse } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { toast } from "../../../test/ui-toast";
import { importMessages } from "../../import/messages";
import { restoreMessages } from "../../restore/messages";
import { AdminQueryProvider } from "../../shared/query-provider";
import { DataScreen } from "../data-screen";

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const ti = testSite.createTranslator(importMessages);
const tr = testSite.createTranslator(restoreMessages);
const tc = testSite.createTranslator(commonMessages);

const reason = (code: string, text: string) => ({ code, text });

const IMPORT_PREVIEW: ImportPreview = {
	mode: "preview",
	kind: "export",
	collections: [{ name: "memo", entries: 2, target: "memo", skipped: null }],
	targets: [{ name: "memo", label: "Memo" }],
	entries: [
		{
			key: "a",
			collection: "memo",
			target: "memo",
			title: "First",
			slug: "first",
			locale: "ko",
			isTranslation: false,
			body: { kind: "text", format: "mdx" },
			published: true,
			outsideImages: 0,
			keptLinks: 0,
			skipped: null,
			notes: [],
		},
		{
			key: "b",
			collection: "memo",
			target: "memo",
			title: "Second",
			slug: "second",
			locale: "ko",
			isTranslation: false,
			body: { kind: "json" },
			published: false,
			outsideImages: 0,
			keptLinks: 0,
			skipped: reason("slug_exists", "An entry with the address second already exists here."),
			notes: [],
		},
	],
	fieldsNotImported: [],
	counts: {
		entries: 2,
		imported: 1,
		skipped: 1,
		conflicts: 1,
		publishable: 0,
		outsideImages: 0,
		keptLinks: 0,
		otherFiles: 0,
	},
};

const IMPORT_RUN: ImportRun = {
	mode: "run",
	results: [
		{
			key: "a",
			collection: "memo",
			target: "memo",
			locale: "ko",
			title: "First",
			slug: "first",
			id: "11111111-1111-4111-8111-111111111111",
			outcome: "imported",
			create: { status: "done" },
			body: { status: "done" },
			publish: null,
			warnings: [],
			notes: [],
		},
	],
	counts: { imported: 1, draft: 0, skipped: 1, failed: 0, published: 0 },
};

const COUNTS: RestoreCounts = {
	entries: 6,
	byStatus: { draft: 2, published: 2, archived: 1, trashed: 1 },
	translations: 1,
	folders: 3,
	media: 1,
	addresses: 5,
	aliases: 1,
	templatesAdded: 1,
	templatesSkipped: [],
};

const RESTORE_PREVIEW: RestorePreview = {
	mode: "preview",
	ready: true,
	isBackup: true,
	refusal: null,
	empty: true,
	counts: COUNTS,
	problems: [],
	warnings: [],
	notRestored: [{ code: "preferences", count: null, text: "Admin preferences. They belong to users." }],
};

const RESTORE_RUN: RestoreRun = {
	mode: "run",
	counts: COUNTS,
	warnings: [],
	notRestored: RESTORE_PREVIEW.notRestored,
};

interface Server {
	/** Whether the site has no entries, folders or media, so a backup can be restored into it. */
	empty?: boolean;
	limit?: number;
	importPreview?: ImportPreview;
	importPreviewStatus?: number;
	restorePreview?: RestorePreview;
	restoreRunStatus?: number;
	/** The import run answers only when this resolves; until then it is running. */
	importRun?: Promise<void>;
}

/** The admin API as the Data page uses it. */
function serve({
	empty = false,
	limit,
	importPreview = IMPORT_PREVIEW,
	importPreviewStatus = 200,
	restorePreview = RESTORE_PREVIEW,
	restoreRunStatus = 200,
	importRun,
}: Server = {}) {
	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url === "/api/monti/v1/meta") return jsonResponse({ formats: [], limits: limit ? { importBytes: limit } : {} });
		if (url === "/api/monti/v1/export/summary") {
			return jsonResponse({
				scope: "admin",
				entries: 0,
				addedByTranslations: 0,
				notPublished: 0,
				notFound: 0,
				templates: 0,
				folders: 0,
				addresses: 0,
				media: 0,
			});
		}
		if (url === "/api/monti/v1/import/restore") {
			if (init?.method !== "POST") return jsonResponse({ empty, entries: empty ? 0 : 3, folders: 0, media: 0 });
			const form = init.body as FormData;
			if (form.get("mode") === "run") {
				return restoreRunStatus >= 400
					? jsonResponse(
							{ error: { code: "conflict", message: "A backup can only be restored into an empty site." } },
							restoreRunStatus,
						)
					: jsonResponse(RESTORE_RUN);
			}
			return jsonResponse(restorePreview);
		}
		if (url === "/api/monti/v1/import/entries") {
			const form = init?.body as FormData;
			if (form.get("mode") === "run") {
				await importRun;
				return jsonResponse(IMPORT_RUN);
			}
			if (importPreviewStatus >= 400) {
				return jsonResponse(
					{ error: { code: "invalid_input", message: "This file isn't a zip archive that can be read." } },
					importPreviewStatus,
				);
			}
			return jsonResponse(importPreview);
		}
		throw new Error(`Unexpected fetch: ${url}`);
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

const sent = (fetchMock: ReturnType<typeof vi.fn>, path: string) =>
	fetchMock.mock.calls
		.filter(([input, init]) => String(input) === path && init?.method === "POST")
		.map(([, init]) => (init?.body as FormData).get("mode"));
const importModes = (fetchMock: ReturnType<typeof vi.fn>) => sent(fetchMock, "/api/monti/v1/import/entries");
const restoreModes = (fetchMock: ReturnType<typeof vi.fn>) => sent(fetchMock, "/api/monti/v1/import/restore");

const renderData = () =>
	createTestRouter().render(
		withSite(
			<AdminQueryProvider>
				<DataScreen />
			</AdminQueryProvider>,
		),
	);

const choose = (file = new File(["zip"], "blog-export.zip", { type: "application/zip" })) =>
	fireEvent.change(screen.getByLabelText(ti("file.choose")), { target: { files: [file] } });

const importSheet = () => screen.findByRole("dialog", { name: new RegExp(ti("title")) });
const restoreSheet = () => screen.findByRole("dialog", { name: new RegExp(tr("title")) });

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("Data page: choosing a zip", () => {
	it("opens the import sheet for the file once it is read, and writes nothing", async () => {
		const fetchMock = serve();
		renderData();
		choose();

		const sheet = await importSheet();
		expect(sheet.textContent).toContain("blog-export.zip");
		expect(within(sheet).getByText(ti("summary.found", { count: 2 }))).toBeTruthy();
		expect(importModes(fetchMock)).toEqual(["preview"]);
		// A site with entries never reads the zip as a backup to restore.
		expect(restoreModes(fetchMock)).toEqual([]);
	});

	it("says it is reading on the page until the sheet can open", async () => {
		serve();
		renderData();
		choose();
		expect(await screen.findByText(ti("preview.loading"))).toBeTruthy();
		await importSheet();
	});

	it("refuses a file over the size the server takes, before sending it", async () => {
		const fetchMock = serve({ limit: 10 });
		renderData();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/monti/v1/meta", expect.anything()));
		await new Promise((resolve) => setTimeout(resolve, 50));
		choose(new File([new Uint8Array(2048)], "big.zip"));
		expect(await screen.findByText(ti("file.tooLarge", { limit: "1 KB" }))).toBeTruthy();
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(importModes(fetchMock)).toEqual([]);
	});

	it("says on the page that a zip cannot be read, and opens no sheet", async () => {
		serve({ importPreviewStatus: 400 });
		renderData();
		choose();
		expect(await screen.findByText(/isn't a zip archive that can be read/)).toBeTruthy();
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});

describe("Import sheet", () => {
	it("imports from its pill and shows the result in the same sheet, with a link to the list", async () => {
		const fetchMock = serve();
		renderData();
		choose();
		const sheet = await importSheet();

		fireEvent.click(within(sheet).getByRole("button", { name: ti("action.import", { count: 1 }) }));
		expect(await within(sheet).findByRole("heading", { name: ti("result.title") })).toBeTruthy();
		expect(importModes(fetchMock)).toEqual(["preview", "run"]);
		expect(toast).toHaveBeenCalledWith(ti("toast.done", { count: 1 }));
		const entry = within(sheet).getAllByRole("link", { name: "First" })[0];
		expect(entry?.getAttribute("href")).toBe(testSite.adminEntryEditHref("11111111-1111-4111-8111-111111111111"));
		// The pill now leads to the list; Cancel is gone.
		expect(
			within(sheet)
				.getByRole("link", { name: ti("action.view") })
				.getAttribute("href"),
		).toBe(testSite.adminHref());
		expect(within(sheet).queryByRole("button", { name: tc("cancel") })).toBeNull();
	});

	it("closes from Cancel and from the close button, and the page forgets the file", async () => {
		const fetchMock = serve();
		renderData();
		choose();
		let sheet = await importSheet();
		fireEvent.click(within(sheet).getByRole("button", { name: tc("cancel") }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(screen.queryByText("blog-export.zip")).toBeNull();

		// The same file chosen again is read again.
		choose();
		sheet = await importSheet();
		fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(importModes(fetchMock)).toEqual(["preview", "preview"]);
	});

	it("cannot be left while it imports: no close button, and Escape does nothing", async () => {
		let finish: () => void = () => undefined;
		const importRun = new Promise<void>((resolve) => {
			finish = resolve;
		});
		serve({ importRun });
		renderData();
		choose();
		const sheet = await importSheet();
		fireEvent.click(within(sheet).getByRole("button", { name: ti("action.import", { count: 1 }) }));

		const busy = await within(sheet).findByRole("button", { name: ti("action.importing") });
		expect(busy.getAttribute("aria-busy")).toBe("true");
		expect(within(sheet).queryByRole("button", { name: "Close" })).toBeNull();
		fireEvent.keyDown(sheet, { key: "Escape" });
		expect(screen.getByRole("dialog")).toBeTruthy();

		finish();
		await within(sheet).findByRole("heading", { name: ti("result.title") });
		expect(within(sheet).getByRole("button", { name: "Close" })).toBeTruthy();
	});
});

describe("Restore sheet", () => {
	it("opens for a full backup on an empty site, and restores from its pill with the result in the sheet", async () => {
		const fetchMock = serve({ empty: true });
		renderData();
		choose(new File(["zip"], "monti-backup.zip", { type: "application/zip" }));

		const sheet = await restoreSheet();
		expect(sheet.textContent).toContain("monti-backup.zip");
		expect(within(sheet).getByText(tr("summary.entries", { count: 6 }))).toBeTruthy();
		// Reading it wrote nothing, and it was not read as an import.
		expect(restoreModes(fetchMock)).toEqual(["preview"]);
		expect(importModes(fetchMock)).toEqual([]);

		fireEvent.click(within(sheet).getByRole("button", { name: tr("action.restore") }));
		expect(await within(sheet).findByRole("heading", { name: tr("result.title") })).toBeTruthy();
		expect(restoreModes(fetchMock)).toEqual(["preview", "run"]);
		expect(toast).toHaveBeenCalledWith(tr("toast.done", { count: 6 }));
		// The site is no longer empty, yet the result stays where it is, with the way to the list.
		expect(
			within(sheet)
				.getByRole("link", { name: tr("action.view") })
				.getAttribute("href"),
		).toBe(testSite.adminHref());
		fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("is the import sheet instead when the zip on an empty site is not a full backup", async () => {
		const fetchMock = serve({
			empty: true,
			restorePreview: {
				...RESTORE_PREVIEW,
				ready: false,
				isBackup: false,
				refusal: { text: "This archive is not a full backup.", fix: "Use Import entries." },
			},
		});
		renderData();
		choose();
		await importSheet();
		expect(screen.queryByRole("dialog", { name: new RegExp(tr("title")) })).toBeNull();
		expect(restoreModes(fetchMock)).toEqual(["preview"]);
		expect(importModes(fetchMock)).toEqual(["preview"]);
	});

	it("lists the problems and keeps its pill off while any is left", async () => {
		serve({
			empty: true,
			restorePreview: {
				...RESTORE_PREVIEW,
				ready: false,
				problems: [
					{
						subject: "entry",
						id: "e1",
						label: "Alpha",
						code: "body_invalid",
						text: "Its draft doesn't fit this site's schema.",
						found: ["The title is too long. (title)"],
					},
				],
			},
		});
		renderData();
		choose();
		const sheet = await restoreSheet();
		expect(within(sheet).getByText("Alpha")).toBeTruthy();
		expect(within(sheet).getByText(/The title is too long\./)).toBeTruthy();
		expect(
			within(sheet)
				.getByRole("button", { name: tr("action.restore") })
				.hasAttribute("disabled"),
		).toBe(true);
	});

	it("shows the server's message when the restore is refused, and stays open", async () => {
		serve({ empty: true, restoreRunStatus: 409 });
		renderData();
		choose();
		const sheet = await restoreSheet();
		fireEvent.click(within(sheet).getByRole("button", { name: tr("action.restore") }));
		expect(await within(sheet).findByRole("alert")).toBeTruthy();
		expect(within(sheet).getByRole("alert").textContent).toContain("A backup can only be restored into an empty site.");
		expect(within(sheet).getByRole("button", { name: tr("action.restore") })).toBeTruthy();
	});
});
