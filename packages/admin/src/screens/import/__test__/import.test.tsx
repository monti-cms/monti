import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { ImportPreview, ImportRun } from "../../../api/import";
import { jsonResponse } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { DataScreen } from "../../settings/data-screen";
import { AdminQueryProvider } from "../../shared/query-provider";
import { importMessages } from "../messages";

const { success, error } = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success, error } }));

const t = testSite.createTranslator(importMessages);

const reason = (code: string, text: string) => ({ code, text });

const PREVIEW: ImportPreview = {
	mode: "preview",
	kind: "export",
	collections: [
		{ name: "memo", entries: 3, target: "memo", skipped: null },
		{
			name: "tag",
			entries: 1,
			target: null,
			skipped: reason("item_collection", "tag is an item collection (records such as categories and tags)."),
		},
	],
	targets: [
		{ name: "post", label: "Post" },
		{ name: "memo", label: "Memo" },
	],
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
			outsideImages: 2,
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
			keptLinks: 1,
			skipped: reason("slug_exists", "An entry with the address second already exists here."),
			notes: [],
		},
		{
			key: "c",
			collection: "memo",
			target: "memo",
			title: "First, in English",
			slug: "first",
			locale: "en",
			isTranslation: true,
			body: { kind: "text", format: "mdx" },
			published: false,
			outsideImages: 0,
			keptLinks: 0,
			skipped: null,
			notes: [],
		},
		{
			key: "d",
			collection: "tag",
			target: null,
			title: "A tag",
			slug: "a-tag",
			locale: "ko",
			isTranslation: false,
			body: { kind: "json" },
			published: true,
			outsideImages: 0,
			keptLinks: 0,
			skipped: reason("item_collection", "tag is an item collection (records such as categories and tags)."),
			notes: [],
		},
	],
	fieldsNotImported: [{ collection: "memo", target: "memo", fields: ["tagIds", "seoTitle"], required: [] }],
	counts: {
		entries: 4,
		imported: 2,
		skipped: 2,
		conflicts: 1,
		publishable: 1,
		outsideImages: 2,
		keptLinks: 1,
		otherFiles: 0,
	},
};

const RUN: ImportRun = {
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
			publish: { status: "done" },
			warnings: [],
			notes: [],
		},
		{
			key: "b",
			collection: "memo",
			target: "memo",
			locale: "ko",
			title: "Second",
			slug: "second",
			id: null,
			outcome: "skipped",
			create: {
				status: "skipped",
				reason: reason("slug_exists", "An entry with the address second already exists here."),
			},
			body: null,
			publish: null,
			warnings: [],
			notes: [],
		},
		{
			key: "c",
			collection: "memo",
			target: "memo",
			locale: "en",
			title: "First, in English",
			slug: "first",
			id: "22222222-2222-4222-8222-222222222222",
			outcome: "draft",
			create: { status: "done" },
			body: { status: "failed", reason: reason("write_failed", "The body is too large.") },
			publish: null,
			warnings: [],
			notes: [],
		},
	],
	counts: { imported: 1, draft: 1, skipped: 1, failed: 0, published: 1 },
};

/** The admin API as the import card uses it. */
function serve(options: { limit?: number; preview?: ImportPreview; previewStatus?: number } = {}) {
	const { limit, preview = PREVIEW, previewStatus = 200 } = options;
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
		if (url === "/api/monti/v1/import/restore") return jsonResponse({ empty: true, entries: 0, folders: 0, media: 0 });
		if (url === "/api/monti/v1/import/entries") {
			const form = init?.body as FormData;
			if (form.get("mode") === "run") return jsonResponse(RUN);
			if (previewStatus >= 400)
				return jsonResponse(
					{ error: { code: "invalid_input", message: "This file isn't a zip archive that can be read." } },
					previewStatus,
				);
			return jsonResponse(preview);
		}
		throw new Error(`Unexpected fetch: ${url}`);
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

const importForms = (fetchMock: ReturnType<typeof vi.fn>) =>
	fetchMock.mock.calls
		.filter(([input]) => String(input) === "/api/monti/v1/import/entries")
		.map(([, init]) => init?.body as FormData);

const renderData = () =>
	createTestRouter().render(
		withSite(
			<AdminQueryProvider>
				<DataScreen />
			</AdminQueryProvider>,
		),
	);

const choose = (file = new File(["zip"], "backup.zip", { type: "application/zip" })) =>
	fireEvent.change(screen.getByTestId("import-file"), { target: { files: [file] } });

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("the Import entries card", () => {
	it("sits below Site backup on the Data page and explains the two kinds of zip", async () => {
		serve();
		renderData();
		const backup = await screen.findByTestId("site-backup");
		const card = screen.getByTestId("import-entries");
		expect(backup.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(within(card).getByRole("heading", { name: t("title") })).toBeTruthy();
		expect(within(card).getByText(t("kinds.export"))).toBeTruthy();
		expect(within(card).getByText(t("kinds.markdown"))).toBeTruthy();
	});

	it("reads the file at once and shows what would happen without writing", async () => {
		const fetchMock = serve();
		renderData();
		choose();
		const preview = await screen.findByTestId("import-preview");
		const forms = importForms(fetchMock);
		expect(forms).toHaveLength(1);
		expect(forms[0]?.get("mode")).toBe("preview");
		expect((forms[0]?.get("file") as File).name).toBe("backup.zip");

		expect(within(preview).getByTestId("import-summary").textContent).toContain(t("summary.found", { count: 4 }));
		expect(within(preview).getByTestId("import-summary").textContent).toContain(t("summary.conflicts", { count: 1 }));
		const rows = within(preview).getAllByTestId("import-entry");
		expect(rows).toHaveLength(4);
		// A conflict is flagged with its reason, a skipped item collection says why, a translation is marked.
		expect(within(rows[1] as HTMLElement).getByText(t("entries.conflict"))).toBeTruthy();
		expect(
			within(rows[1] as HTMLElement).getByText("An entry with the address second already exists here."),
		).toBeTruthy();
		expect(within(rows[3] as HTMLElement).getByText(t("entries.skipped"))).toBeTruthy();
		expect(within(rows[2] as HTMLElement).getByText(t("entries.translation"))).toBeTruthy();
		expect(within(rows[0] as HTMLElement).getByText(t("body.text", { format: "mdx" }))).toBeTruthy();
		expect(within(rows[1] as HTMLElement).getByText(t("body.json"))).toBeTruthy();
		// The collection choices: the memo goes to Memo, the tag collection is skipped with the reason.
		const collections = within(preview).getByTestId("import-collections");
		expect(within(collections).getByRole("combobox", { name: /: memo$/ }).textContent).toContain("Memo");
		expect(within(collections).getByRole("combobox", { name: /: tag$/ }).textContent).toContain(t("collections.skip"));
		// What is left behind is said in plain lines.
		expect(within(preview).getByTestId("import-fields").textContent).toContain("tagIds, seoTitle");
		expect(within(preview).getByTestId("import-images").textContent).toBe(t("images.line", { count: 2 }));
		expect(within(preview).getByTestId("import-links").textContent).toBe(t("links.line", { count: 1 }));
	});

	it("keeps publishing off until chosen, then imports with the mapping and shows a link to each new entry", async () => {
		const fetchMock = serve();
		renderData();
		choose();
		await screen.findByTestId("import-preview");
		const publish = screen.getByRole("checkbox", { name: new RegExp(t("publish.label")) });
		expect(publish.getAttribute("aria-checked")).toBe("false");
		fireEvent.click(publish);
		fireEvent.click(screen.getByRole("button", { name: t("action.import") }));

		const result = await screen.findByTestId("import-run-result");
		const runForm = importForms(fetchMock).at(-1) as FormData;
		expect(runForm.get("mode")).toBe("run");
		expect(runForm.get("publish")).toBe("true");
		expect(JSON.parse(String(runForm.get("mapping")))).toEqual({ memo: "memo", tag: null });
		expect(success).toHaveBeenCalledWith(t("toast.done", { count: 2 }));

		const rows = within(result).getAllByTestId("import-result");
		expect(rows.map((row) => row.getAttribute("data-outcome"))).toEqual(["imported", "skipped", "draft"]);
		expect(
			within(rows[0] as HTMLElement)
				.getAllByRole("link")[0]
				?.getAttribute("href"),
		).toBe(testSite.adminEntryEditHref("11111111-1111-4111-8111-111111111111"));
		// A skipped entry says why; a draft that stayed says which step failed.
		expect(within(rows[1] as HTMLElement).getByText(/already exists here/)).toBeTruthy();
		expect(within(rows[2] as HTMLElement).getByText(/The body is too large/)).toBeTruthy();
		expect(within(result).getByTestId("import-result-summary").textContent).toContain(t("result.draft", { count: 1 }));
	});

	it("does not publish unless the box is ticked", async () => {
		const fetchMock = serve();
		renderData();
		choose();
		await screen.findByTestId("import-preview");
		fireEvent.click(screen.getByRole("button", { name: t("action.import") }));
		await screen.findByTestId("import-run-result");
		expect((importForms(fetchMock).at(-1) as FormData).get("publish")).toBeNull();
	});

	it("refuses a file over the size the server takes, before sending it", async () => {
		const fetchMock = serve({ limit: 10 });
		renderData();
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/monti/v1/meta", expect.anything()));
		await new Promise((resolve) => setTimeout(resolve, 50));
		choose(new File([new Uint8Array(2048)], "big.zip"));
		expect(await screen.findByText(t("file.tooLarge", { limit: "1 KB" }))).toBeTruthy();
		expect(importForms(fetchMock)).toHaveLength(0);
	});

	it("says when the archive cannot be read", async () => {
		serve({ previewStatus: 400 });
		renderData();
		choose();
		expect(await screen.findByText(/isn't a zip archive that can be read/)).toBeTruthy();
		expect(screen.queryByTestId("import-preview")).toBeNull();
	});
});
