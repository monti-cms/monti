import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { RestoreCounts, RestorePreview, RestoreRun } from "../../../api/restore";
import { commonMessages } from "../../../lib/common.messages";
import { jsonResponse } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { DataScreen } from "../../data/data-screen";
import { AdminQueryProvider } from "../../shared/query-provider";
import { restoreMessages } from "../messages";

const { success, error } = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success, error } }));

const { saveBlob } = vi.hoisted(() => ({ saveBlob: vi.fn() }));
vi.mock("../../../api/export", async (original) => ({ ...(await original<object>()), saveBlob }));

const t = testSite.createTranslator(restoreMessages);

const COUNTS: RestoreCounts = {
	entries: 6,
	byStatus: { draft: 2, published: 2, archived: 1, trashed: 1 },
	translations: 1,
	folders: 3,
	media: 1,
	addresses: 5,
	aliases: 1,
	templatesAdded: 1,
	templatesSkipped: [
		{ id: "t1", name: "Blank", reason: "id", text: "A template with this id is already on the site." },
	],
};

const NOT_RESTORED = [
	{ code: "preferences", count: null, text: "Admin preferences. They belong to users." },
	{ code: "event_logs", count: null, text: "Event logs. Plugins are not notified." },
];

const PREVIEW: RestorePreview = {
	mode: "preview",
	ready: true,
	isBackup: true,
	refusal: null,
	empty: true,
	counts: COUNTS,
	problems: [],
	warnings: [
		{ code: "media_file_missing", id: "m1", label: "photo.png", text: "The file is not in this site's storage." },
	],
	notRestored: NOT_RESTORED,
};

const RUN: RestoreRun = {
	mode: "run",
	counts: COUNTS,
	warnings: PREVIEW.warnings,
	notRestored: NOT_RESTORED,
};

function serve(options: { empty?: boolean; preview?: RestorePreview; runStatus?: number } = {}) {
	const { empty = true, preview = PREVIEW, runStatus = 200 } = options;
	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url === "/api/monti/v1/meta") return jsonResponse({ formats: [], limits: {} });
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
		if (url === "/api/monti/v1/export") {
			return new Response(new Blob(["zip"]), {
				status: 200,
				headers: { "content-disposition": 'attachment; filename="site.zip"', "content-type": "application/zip" },
			});
		}
		if (url === "/api/monti/v1/import/restore") {
			if (init?.method !== "POST") return jsonResponse({ empty, entries: empty ? 0 : 3, folders: 0, media: 0 });
			const form = init.body as FormData;
			if (form.get("mode") === "run") {
				return runStatus >= 400
					? jsonResponse(
							{ error: { code: "conflict", message: "A backup can only be restored into an empty site." } },
							runStatus,
						)
					: jsonResponse(RUN);
			}
			return jsonResponse(preview);
		}
		throw new Error(`Unexpected fetch: ${url}`);
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

const forms = (fetchMock: ReturnType<typeof vi.fn>) =>
	fetchMock.mock.calls
		.filter(([input, init]) => String(input) === "/api/monti/v1/import/restore" && init?.method === "POST")
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
	fireEvent.change(screen.getByTestId("restore-file"), { target: { files: [file] } });

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("the Restore backup card", () => {
	it("sits after the backup and the import, in a danger zone", async () => {
		serve();
		renderData();
		const backup = await screen.findByTestId("site-backup");
		const imports = await screen.findByTestId("import-entries");
		const zone = await screen.findByTestId("restore-backup");
		expect(backup.compareDocumentPosition(zone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(imports.compareDocumentPosition(zone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(within(zone).getByRole("heading", { name: t("danger.title") })).toBeTruthy();
		expect(zone.className).toContain("border-monti-destructive/40");
		expect(within(zone).getByTestId("restore-file")).toBeTruthy();
		expect(imports.id).toBe("import-entries");
	});

	it("is disabled on a site that is not empty and says it works only on an empty site", async () => {
		serve({ empty: false });
		renderData();
		const disabled = await screen.findByTestId("restore-disabled");
		expect(within(disabled).getByText(t("notEmpty.title"))).toBeTruthy();
		expect(screen.queryByTestId("restore-file")).toBeNull();
	});

	it("reads the file at once and shows the counts, warnings and what is not restored, without writing", async () => {
		const fetchMock = serve();
		renderData();
		choose();
		const preview = await screen.findByTestId("restore-preview");
		const sent = forms(fetchMock);
		expect(sent).toHaveLength(1);
		expect(sent[0]?.get("mode")).toBe("preview");

		const counts = within(preview).getByTestId("restore-counts");
		expect(counts.textContent).toContain(t("summary.entries", { count: 6 }));
		expect(counts.textContent).toContain(t("summary.translations", { count: 1 }));
		expect(counts.textContent).toContain(t("summary.addresses", { count: 5, aliases: 1 }));
		expect(within(preview).getByTestId("restore-templates").textContent).toContain("Blank");
		expect(within(preview).getByTestId("restore-warnings").textContent).toContain("photo.png");
		const notRestored = within(preview).getByTestId("restore-not-restored");
		expect(notRestored.textContent).toContain("Admin preferences");
		expect(notRestored.textContent).toContain("Plugins are not notified");
		expect(within(preview).queryByTestId("restore-problems")).toBeNull();
		expect((screen.getByTestId("restore-run") as HTMLButtonElement).disabled).toBe(false);
	});

	it("lists the problems and keeps Restore off while any is left", async () => {
		serve({
			preview: {
				...PREVIEW,
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
		const problems = await screen.findByTestId("restore-problems");
		const row = within(problems).getByTestId("restore-problem");
		expect(row.textContent).toContain("Alpha");
		expect(row.textContent).toContain("The title is too long.");
		expect((screen.getByTestId("restore-run") as HTMLButtonElement).disabled).toBe(true);
	});

	it("says why a file that is not a full backup is refused", async () => {
		serve({
			preview: {
				...PREVIEW,
				ready: false,
				isBackup: false,
				refusal: { text: "This archive is not a full backup.", fix: "Use Import entries." },
			},
		});
		renderData();
		choose();
		const refusal = await screen.findByTestId("restore-refusal");
		expect(refusal.textContent).toContain("This archive is not a full backup.");
		expect((screen.getByTestId("restore-run") as HTMLButtonElement).disabled).toBe(true);
	});

	it("asks before restoring, then shows the result with a link to the entries list", async () => {
		const fetchMock = serve();
		renderData();
		choose();
		await screen.findByTestId("restore-preview");

		fireEvent.click(screen.getByTestId("restore-run"));
		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText(t("confirm.title"))).toBeTruthy();
		// Nothing was written yet.
		expect(forms(fetchMock).map((form) => form.get("mode"))).toEqual(["preview"]);

		fireEvent.click(within(dialog).getByRole("button", { name: t("confirm.confirm") }));
		const result = await screen.findByTestId("restore-result");
		expect(forms(fetchMock).map((form) => form.get("mode"))).toEqual(["preview", "run"]);
		expect(result.textContent).toContain(t("result.summary", { count: 6 }));
		expect(within(result).getByTestId("restore-not-restored")).toBeTruthy();
		expect(within(result).getByTestId("restore-open").getAttribute("href")).toBe(testSite.adminHref());
		expect(success).toHaveBeenCalledWith(t("toast.done", { count: 6 }));
	});

	it("offers a backup of the current site first, which exports, and keeps the dialog open", async () => {
		const fetchMock = serve();
		renderData();
		choose();
		await screen.findByTestId("restore-preview");
		fireEvent.click(screen.getByTestId("restore-run"));
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: t("confirm.backupFirst") }));
		await waitFor(() => expect(saveBlob).toHaveBeenCalled());
		expect(fetchMock.mock.calls.some(([input]) => String(input) === "/api/monti/v1/export")).toBe(true);
		expect(await within(dialog).findByTestId("restore-backed-up")).toBeTruthy();
		// Nothing was restored by it.
		expect(forms(fetchMock).map((form) => form.get("mode"))).toEqual(["preview"]);
		expect(screen.queryByRole("alertdialog")).toBeTruthy();
	});

	it("does not restore when the confirmation is cancelled", async () => {
		const fetchMock = serve();
		renderData();
		choose();
		await screen.findByTestId("restore-preview");
		fireEvent.click(screen.getByTestId("restore-run"));
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: testSite.createTranslator(commonMessages)("cancel") }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(forms(fetchMock).map((form) => form.get("mode"))).toEqual(["preview"]);
	});

	it("shows the server's message when the restore is refused", async () => {
		serve({ runStatus: 409 });
		renderData();
		choose();
		await screen.findByTestId("restore-preview");
		fireEvent.click(screen.getByTestId("restore-run"));
		const dialog = await screen.findByRole("alertdialog");
		fireEvent.click(within(dialog).getByRole("button", { name: t("confirm.confirm") }));
		const failure = await screen.findByTestId("restore-error");
		expect(failure.textContent).toContain("A backup can only be restored into an empty site.");
	});
});
