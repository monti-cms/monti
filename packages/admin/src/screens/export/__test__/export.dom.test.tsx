import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { ExportFormat, ExportScope, ExportSummary } from "../../../api/export";
import type { RestoreState } from "../../../api/restore";
import { type FakeApi, failure, fakeApi, raw } from "../../../test/fake-api";
import { createTestRouter } from "../../../test/router";
import { renderWithSite as render, withSite } from "../../../test/site";
import { toast } from "../../../test/ui-toast";
import { DataScreen } from "../../data/data-screen";
import { AdminQueryProvider } from "../../shared/query-provider";
import { ExportDialog } from "../export-dialog";
import { exportMessages } from "../messages";

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const t = testSite.createTranslator(exportMessages);

type Summary = Partial<
	Record<
		"entries" | "addedByTranslations" | "notPublished" | "notFound" | "templates" | "folders" | "addresses" | "media",
		number
	>
>;
const summaryOf = (scope: ExportScope, counts: Summary): ExportSummary => ({
	scope,
	entries: 0,
	addedByTranslations: 0,
	notPublished: 0,
	notFound: 0,
	templates: 0,
	folders: 0,
	addresses: 0,
	media: 0,
	...counts,
});

/** The radio of a scope: its label also holds the hint, so the name starts with the label. */
const scopeRadio = (scope: "admin" | "public") =>
	screen.getByRole("radio", { name: (name) => name.startsWith(t(`scope.${scope}`)) });

const MDX = { name: "mdx", label: "MDX", mimeType: "text/mdx", extension: "mdx", canImport: true };

/** The archive `POST /v1/export` answers with, and the headers the server sets on it. */
const archive = (notWritten: number) =>
	new Response(new Blob(["zip bytes"]), {
		status: 200,
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": 'attachment; filename="monti-export-admin-2026.zip"',
			"X-Monti-Export-Not-Written": String(notWritten),
		},
	});

/** The admin API as the export screens use it. `summaries` answers by scope; the archive answers with the headers the server sets. */
function serve(options: { formats?: ExportFormat[]; summaries?: Record<string, Summary>; notWritten?: number } = {}) {
	const { formats = [MDX], summaries = {}, notWritten = 0 } = options;
	const api = fakeApi()
		// The rail's counts: the trash and the failed deliveries.
		.on("GET /v1/trash", () => ({ items: [], total: 0, kinds: {} }))
		.on("GET /v1/events", () => ({
			items: [],
			total: 0,
			counts: { pending: 0, delivering: 0, delivered: 0, failed: 0, dead: 0, dismissed: 0 },
		}))
		.on("GET /v1/meta", () => ({ formats }))
		.on("POST /v1/export/summary", ({ body }) => summaryOf(body.scope, summaries[body.scope] ?? {}))
		// The Data page also asks whether the site is empty (a backup can be restored); `getRestoreState` reads a `RestoreState`.
		.on("GET /v1/import/restore", (): RestoreState => ({ empty: false, entries: 1, folders: 0, media: 0 }))
		.on("POST /v1/export", () => raw(archive(notWritten)))
		.install();
	return api;
}

const bodiesTo = (api: FakeApi, route: "POST /v1/export" | "POST /v1/export/summary") =>
	api.sent(route).map((request) => request.body);

let saved: { href: string; download: string }[];
beforeEach(() => {
	saved = [];
	vi.clearAllMocks();
	URL.createObjectURL = vi.fn(() => "blob:test");
	URL.revokeObjectURL = vi.fn();
	vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
		saved.push({ href: this.href, download: this.download });
	});
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("the export dialog", () => {
	const open = (props: Partial<React.ComponentProps<typeof ExportDialog>> = {}) =>
		render(<ExportDialog open onOpenChange={vi.fn()} kind="selected" ids={["a", "b", "c"]} noun="글" {...props} />);

	it("says what goes in: the entries picked and the translations that come with them", async () => {
		serve({ summaries: { admin: { entries: 5, addedByTranslations: 2, folders: 1, addresses: 4, media: 3 } } });
		open();
		const headline = await screen.findByTestId("export-headline");
		expect(headline.textContent).toBe(
			`${t("summary.entries", { count: 3, noun: "글" })} + ${t("summary.translations", { count: 2 })}`,
		);
		expect(screen.getByText(t("note.translations"))).toBeInTheDocument();
		expect(screen.getByText(t("note.media"))).toBeInTheDocument();
	});

	it("asks for the picked ids only, and counts again when the scope changes", async () => {
		const api = serve({
			summaries: { admin: { entries: 3 }, public: { entries: 1, notPublished: 2 } },
		});
		open();
		await screen.findByTestId("export-headline");
		fireEvent.click(scopeRadio("public"));
		// The public archive leaves out what is not published, and says so.
		expect(await screen.findByText(t("note.notPublished", { count: 2 }))).toBeInTheDocument();
		expect(bodiesTo(api, "POST /v1/export/summary")).toEqual([
			{ scope: "admin", ids: ["a", "b", "c"] },
			{ scope: "public", ids: ["a", "b", "c"] },
		]);
	});

	it("downloads the archive with the ids, the scope and the format, then toasts", async () => {
		const api = serve({ summaries: { admin: { entries: 3 } } });
		const onOpenChange = vi.fn();
		open({ onOpenChange });
		await screen.findByTestId("export-headline");
		await screen.findByRole("checkbox", { name: /MDX/ });
		fireEvent.click(screen.getByRole("button", { name: t("action.selected") }));

		await waitFor(() => expect(toast).toHaveBeenCalledWith(t("toast.done", { name: "monti-export-admin-2026.zip" })));
		expect(bodiesTo(api, "POST /v1/export")).toEqual([{ scope: "admin", ids: ["a", "b", "c"], format: "mdx" }]);
		expect(saved).toEqual([{ href: "blob:test", download: "monti-export-admin-2026.zip" }]);
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	it("notes that unsaved changes of the open entry are not in the archive", async () => {
		serve({ summaries: { admin: { entries: 1 } } });
		open({ kind: "entry", ids: ["a"], unsaved: true });
		expect(await screen.findByTestId("export-unsaved")).toBeInTheDocument();
		expect(screen.getByRole("dialog", { name: t("dialog.title.entry") })).toBeInTheDocument();
	});
});

describe("the Data page", () => {
	const renderData = () =>
		createTestRouter().render(
			withSite(
				<AdminQueryProvider>
					<DataScreen />
				</AdminQueryProvider>,
			),
		);

	it("hints at installing @monti-cms/mdx when no text format is installed, and exports JSON only", async () => {
		const api = serve({ formats: [], summaries: { admin: { entries: 1 } } });
		renderData();
		expect(await screen.findByTestId("export-no-formats")).toBeInTheDocument();
		await screen.findByTestId("export-summary");
		fireEvent.click(screen.getByRole("button", { name: t("action.all") }));
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(bodiesTo(api, "POST /v1/export")).toEqual([{ scope: "admin" }]);
	});

	it("exports everything in the chosen scope and format, and toasts the bodies kept as JSON only", async () => {
		const api = serve({ summaries: { admin: { entries: 1 } }, notWritten: 1 });
		renderData();
		await screen.findByRole("checkbox", { name: /MDX/ });
		await screen.findByTestId("export-summary");
		fireEvent.click(screen.getByRole("button", { name: t("action.all") }));
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(bodiesTo(api, "POST /v1/export")).toEqual([{ scope: "admin", format: "mdx" }]);
		expect(String(toast.mock.calls[0]?.[0])).toContain(t("toast.notWritten", { count: 1 }));
		expect(saved).toHaveLength(1);
	});

	it("toasts a failed export", async () => {
		const api = serve({ summaries: { admin: { entries: 1 } } });
		api
			.on("GET /v1/meta", () => ({ formats: [] }))
			.on("POST /v1/export/summary", ({ body }) => summaryOf(body.scope, { entries: 1 }))
			.on("POST /v1/export", () => failure("internal_error", "no archive"));
		renderData();
		await screen.findByTestId("export-summary");
		fireEvent.click(screen.getByRole("button", { name: t("action.all") }));
		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		expect(toast).not.toHaveBeenCalled();
	});
});
