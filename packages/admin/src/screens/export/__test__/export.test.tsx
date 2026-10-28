import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { jsonResponse } from "../../../test/fetch";
import { createTestRouter } from "../../../test/router";
import { renderWithSite as render, withSite } from "../../../test/site";
import { toast } from "../../../test/ui-toast";
import { DataScreen } from "../../data/data-screen";
import { settingsMessages } from "../../settings/messages";
import { AdminQueryProvider } from "../../shared/query-provider";
import { ExportDialog } from "../export-dialog";
import { exportMessages } from "../messages";

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const t = testSite.createTranslator(exportMessages);
const ts = testSite.createTranslator(settingsMessages);

type Summary = Partial<
	Record<
		"entries" | "addedByTranslations" | "notPublished" | "notFound" | "templates" | "folders" | "addresses" | "media",
		number
	>
>;
const summaryOf = (scope: string, counts: Summary) => ({
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

/** The admin API as the export screens use it. `summaries` answers by scope; the archive answers with the headers the server sets. */
function serve(options: { formats?: unknown[]; summaries?: Record<string, Summary>; notWritten?: number } = {}) {
	const { formats = [MDX], summaries = {}, notWritten = 0 } = options;
	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url === "/api/monti/v1/meta") return jsonResponse({ formats });
		if (url === "/api/monti/v1/export/summary") {
			const { scope } = JSON.parse(String(init?.body));
			return jsonResponse(summaryOf(scope, summaries[scope] ?? {}));
		}
		if (url === "/api/monti/v1/export") {
			return new Response(new Blob(["zip bytes"]), {
				status: 200,
				headers: {
					"Content-Type": "application/zip",
					"Content-Disposition": 'attachment; filename="monti-export-admin-2026.zip"',
					"X-Monti-Export-Not-Written": String(notWritten),
				},
			});
		}
		throw new Error(`Unexpected fetch: ${url}`);
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

const bodiesTo = (fetchMock: ReturnType<typeof vi.fn>, url: string) =>
	fetchMock.mock.calls.filter(([input]) => String(input) === url).map(([, init]) => JSON.parse(String(init?.body)));

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
		expect(screen.getByText(t("note.translations"))).toBeTruthy();
		expect(screen.getByText(t("note.media"))).toBeTruthy();
	});

	it("asks for the picked ids only, and counts again when the scope changes", async () => {
		const fetchMock = serve({
			summaries: { admin: { entries: 3 }, public: { entries: 1, notPublished: 2 } },
		});
		open();
		await screen.findByTestId("export-headline");
		fireEvent.click(scopeRadio("public"));
		// The public archive leaves out what is not published, and says so.
		expect(await screen.findByText(t("note.notPublished", { count: 2 }))).toBeTruthy();
		expect(bodiesTo(fetchMock, "/api/monti/v1/export/summary")).toEqual([
			{ scope: "admin", ids: ["a", "b", "c"] },
			{ scope: "public", ids: ["a", "b", "c"] },
		]);
	});

	it("downloads the archive with the ids, the scope and the format, then toasts", async () => {
		const fetchMock = serve({ summaries: { admin: { entries: 3 } } });
		const onOpenChange = vi.fn();
		open({ onOpenChange });
		await screen.findByTestId("export-headline");
		await screen.findByRole("checkbox", { name: /MDX/ });
		fireEvent.click(screen.getByRole("button", { name: t("action.selected") }));

		await waitFor(() => expect(toast).toHaveBeenCalledWith(t("toast.done", { name: "monti-export-admin-2026.zip" })));
		expect(bodiesTo(fetchMock, "/api/monti/v1/export")).toEqual([
			{ scope: "admin", ids: ["a", "b", "c"], format: "mdx" },
		]);
		expect(saved).toEqual([{ href: "blob:test", download: "monti-export-admin-2026.zip" }]);
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	it("tells how many bodies were kept as JSON only", async () => {
		serve({ summaries: { admin: { entries: 1 } }, notWritten: 2 });
		open();
		await screen.findByTestId("export-headline");
		fireEvent.click(screen.getByRole("button", { name: t("action.selected") }));
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(String(toast.mock.calls[0]?.[0])).toContain(t("toast.notWritten", { count: 2 }));
	});

	it("notes that unsaved changes of the open entry are not in the archive", async () => {
		serve({ summaries: { admin: { entries: 1 } } });
		open({ kind: "entry", ids: ["a"], unsaved: true });
		expect(await screen.findByTestId("export-unsaved")).toBeTruthy();
		expect(screen.getByRole("dialog", { name: t("dialog.title.entry") })).toBeTruthy();
	});

	it("leaves a selection that holds nothing without an export button to press", async () => {
		serve({ summaries: { public: { entries: 0, notPublished: 1 }, admin: { entries: 1 } } });
		open();
		await screen.findByTestId("export-headline");
		fireEvent.click(scopeRadio("public"));
		await screen.findByText(t("summary.empty"));
		expect((screen.getByRole("button", { name: t("action.selected") }) as HTMLButtonElement).disabled).toBe(true);
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

	it("is a page of its own, apart from the Settings tabs and their save bar", async () => {
		serve({ summaries: { admin: { entries: 12, templates: 2 } } });
		renderData();
		expect(screen.queryByRole("navigation", { name: ts("tabs.label") })).toBeNull();
		expect(screen.queryByTestId("settings-actions")).toBeNull();
		await screen.findByTestId("site-backup");
	});

	it("shows the counts, says media files are not included, and follows the scope", async () => {
		serve({ summaries: { admin: { entries: 12, templates: 2, media: 7 }, public: { entries: 9, notPublished: 3 } } });
		renderData();
		const summary = await screen.findByTestId("export-summary");
		expect(within(summary).getByText(t("count.templates")).nextSibling?.textContent).toBe("2");
		expect(within(summary).getByText(t("count.media")).nextSibling?.textContent).toBe("7");
		expect(within(summary).getByText(t("note.media"))).toBeTruthy();

		fireEvent.click(scopeRadio("public"));
		expect(await screen.findByText(t("note.notPublished", { count: 3 }))).toBeTruthy();
		expect(within(screen.getByTestId("export-summary")).queryByText(t("count.templates"))).toBeNull();
	});

	it("shows JSON as fixed and each installed text format as a checkbox that is on", async () => {
		serve();
		renderData();
		const json = screen.getByRole("checkbox", { name: t("formats.json") });
		expect(json.getAttribute("aria-checked")).toBe("true");
		expect(json.hasAttribute("disabled") || json.getAttribute("aria-disabled") === "true").toBe(true);
		const mdx = await screen.findByRole("checkbox", { name: /MDX/ });
		expect(mdx.getAttribute("aria-checked")).toBe("true");
	});

	it("hints at installing @monti-cms/mdx when no text format is installed, and exports JSON only", async () => {
		const fetchMock = serve({ formats: [], summaries: { admin: { entries: 1 } } });
		renderData();
		expect(await screen.findByTestId("export-no-formats")).toBeTruthy();
		await screen.findByTestId("export-summary");
		fireEvent.click(screen.getByRole("button", { name: t("action.all") }));
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(bodiesTo(fetchMock, "/api/monti/v1/export")).toEqual([{ scope: "admin" }]);
	});

	it("exports everything in the chosen scope and format, and toasts the bodies kept as JSON only", async () => {
		const fetchMock = serve({ summaries: { admin: { entries: 1 } }, notWritten: 1 });
		renderData();
		await screen.findByRole("checkbox", { name: /MDX/ });
		await screen.findByTestId("export-summary");
		fireEvent.click(screen.getByRole("button", { name: t("action.all") }));
		await waitFor(() => expect(toast).toHaveBeenCalled());
		expect(bodiesTo(fetchMock, "/api/monti/v1/export")).toEqual([{ scope: "admin", format: "mdx" }]);
		expect(String(toast.mock.calls[0]?.[0])).toContain(t("toast.notWritten", { count: 1 }));
		expect(saved).toHaveLength(1);
	});

	it("toasts a failed export", async () => {
		const fetchMock = serve({ summaries: { admin: { entries: 1 } } });
		fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url === "/api/monti/v1/export")
				return jsonResponse({ error: { code: "internal", message: "no archive" } }, 500);
			if (url === "/api/monti/v1/meta") return jsonResponse({ formats: [] });
			return jsonResponse(summaryOf(JSON.parse(String(init?.body)).scope, { entries: 1 }));
		});
		renderData();
		await screen.findByTestId("export-summary");
		fireEvent.click(screen.getByRole("button", { name: t("action.all") }));
		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		expect(toast).not.toHaveBeenCalled();
	});
});
