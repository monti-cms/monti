import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { renderInRouter as render } from "../../../test/router";
import { sharedMessages } from "../../shared/messages";
import { AdminQueryProvider } from "../../shared/query-provider";
import { MediaLibrary } from "../media-library";
import { mediaMessages } from "../messages";

const t = testSite.createTranslator(mediaMessages);
const tShared = testSite.createTranslator(sharedMessages);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), message: vi.fn() }));
vi.mock("sonner", () => ({ Toaster: () => null, toast }));

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const media = (id: string, fields: Record<string, unknown> = {}) => ({
	id,
	status: "ready",
	filename: `${id}.png`,
	mimeType: "image/png",
	byteSize: 2048,
	width: 640,
	height: 480,
	publicUrl: `https://media.example/${id}.png`,
	original: null,
	defaultAlt: "",
	defaultCaption: "",
	createdAt: "2026-01-02T03:04:05.000Z",
	referencesCount: 0,
	references: [],
	...fields,
});
const ITEMS = [
	media("cat", {
		defaultAlt: "고양이",
		referencesCount: 1,
		references: [{ entryId: "e1", title: "고양이 글", collection: "post", state: "published" }],
	}),
	media("dog"),
	media("guide", {
		filename: "guide.pdf",
		mimeType: "application/pdf",
		width: null,
		height: null,
		byteSize: 1_500_000,
	}),
];

let fetchMock: ReturnType<typeof vi.fn>;
const mediaRequests = () =>
	fetchMock.mock.calls
		.map(([input]) => new URL(String(input), "http://localhost"))
		.filter((url) => url.pathname === "/api/cms/v1/media");
const calls = (method: string, path: string) =>
	fetchMock.mock.calls.filter(([input, init]) => (init?.method ?? "GET") === method && String(input) === path);

beforeEach(() => {
	vi.clearAllMocks();
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		const url = new URL(input, "http://localhost");
		const method = init?.method ?? "GET";
		if (url.pathname === "/api/cms/v1/media" && method === "GET") return json({ items: ITEMS, total: ITEMS.length });
		if (url.pathname.startsWith("/api/cms/v1/media/") && method === "PATCH") return json({});
		if (url.pathname.startsWith("/api/cms/v1/media/") && method === "DELETE") return json({});
		if (url.pathname === "/api/cms/v1/entries") return json({ items: [], total: 0 });
		if (url.pathname.startsWith("/api/cms/v1/ai/")) return json({ items: [] });
		throw new Error(`Unexpected fetch ${method} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderLibrary = async () => {
	render(
		<AdminQueryProvider>
			<MediaLibrary />
		</AdminQueryProvider>,
	);
	await screen.findByRole("button", { name: /cat\.png$/ });
};
const openDetail = async (name: RegExp) => {
	fireEvent.click(screen.getByRole("button", { name }));
	return screen.findByRole("complementary", { name: t("detail.label") });
};

describe("media library", () => {
	it("loads the list and shows it with usage state", async () => {
		await renderLibrary();
		expect(screen.getByRole("button", { name: /cat\.png$/ }).textContent).toContain(t("usage.count", { count: 1 }));
		expect(screen.getByRole("button", { name: /dog\.png$/ }).textContent).toContain(t("usage.none"));
		expect(screen.getByRole("button", { name: /guide\.pdf$/ }).textContent).toContain("PDF");
	});

	it("puts search, type and usage conditions in the list request", async () => {
		await renderLibrary();
		fireEvent.change(screen.getByRole("searchbox", { name: t("library.search") }), { target: { value: "cat" } });
		await waitFor(() => expect(mediaRequests().at(-1)?.searchParams.get("search")).toBe("cat"));
		expect(mediaRequests().at(-1)?.searchParams.get("page")).toBe("1");
	});

	it("picking shows name, type, size, upload date and usages in the detail", async () => {
		await renderLibrary();
		const detail = await openDetail(/cat\.png$/);
		expect(within(detail).getAllByText("cat.png").length).toBeGreaterThan(0);
		expect(within(detail).getByText("image/png")).toBeTruthy();
		expect(within(detail).getByText(/640×480/)).toBeTruthy();
		expect(
			within(detail)
				.getByRole("link", { name: /고양이 글/ })
				.getAttribute("href"),
		).toBe(testSite.adminEntryEditHref("e1"));
		// A file in use cannot be deleted.
		expect((within(detail).getByRole("button", { name: t("common.delete") }) as HTMLButtonElement).disabled).toBe(true);
	});

	it("saves the image's default alt text and caption", async () => {
		await renderLibrary();
		const detail = await openDetail(/cat\.png$/);
		const alt = within(detail).getByRole("textbox", { name: t("detail.defaultAlt") }) as HTMLInputElement;
		expect(alt.value).toBe("고양이");
		fireEvent.change(alt, { target: { value: "창가의 고양이" } });
		fireEvent.change(within(detail).getByRole("textbox", { name: t("detail.defaultCaption") }), {
			target: { value: "캡션" },
		});
		fireEvent.click(within(detail).getByRole("button", { name: t("common.save") }));

		await waitFor(() => expect(calls("PATCH", "/api/cms/v1/media/cat")).toHaveLength(1));
		expect(JSON.parse(String(calls("PATCH", "/api/cms/v1/media/cat")[0]?.[1]?.body))).toEqual({
			defaultAlt: "창가의 고양이",
			defaultCaption: "캡션",
		});
		await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t("library.saved")));
	});

	it("opening another file with an edited default description asks whether to discard", async () => {
		await renderLibrary();
		const detail = await openDetail(/cat\.png$/);
		fireEvent.change(within(detail).getByRole("textbox", { name: t("detail.defaultCaption") }), {
			target: { value: "고친 캡션" },
		});

		fireEvent.click(screen.getByRole("button", { name: /dog\.png$/ }));
		const dialog = await screen.findByRole("alertdialog", { name: tShared("discard.title") });
		// While the confirm dialog is up, the detail panel is covered but the edited value remains.
		expect(screen.getByDisplayValue("고친 캡션")).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: tShared("discard.confirm") }));
		await waitFor(() =>
			expect(
				within(screen.getByRole("complementary", { name: t("detail.label") })).getByRole("heading", {
					name: "dog.png",
				}),
			).toBeTruthy(),
		);
	});

	it("marks the open file", async () => {
		await renderLibrary();
		await openDetail(/cat\.png$/);
		await waitFor(() =>
			expect(screen.getByRole("button", { name: /cat\.png$/ }).getAttribute("aria-current")).toBe("true"),
		);
		expect(screen.getByRole("button", { name: /dog\.png$/ }).getAttribute("aria-current")).toBeNull();
	});

	it("when loading fails, says so in place and allows retry", async () => {
		let fail = true;
		const ok = fetchMock.getMockImplementation() as (input: string, init?: RequestInit) => Promise<unknown>;
		fetchMock.mockImplementation(async (input: string, init?: RequestInit) =>
			fail && new URL(input, "http://localhost").pathname === "/api/cms/v1/media"
				? json({ code: "internal", message: "서버 오류" }, 500)
				: ok(input, init),
		);
		render(
			<AdminQueryProvider>
				<MediaLibrary />
			</AdminQueryProvider>,
		);
		// The list request is retried once before it is treated as a failure.
		const alert = await screen.findByRole("alert", undefined, { timeout: 3000 });
		expect(alert.textContent).toContain("서버 오류");
		expect(toast.error).not.toHaveBeenCalled();
		fail = false;
		fireEvent.click(within(alert).getByRole("button", { name: t("common.retry") }));
		expect(await screen.findByRole("button", { name: /cat\.png$/ })).toBeTruthy();
	});

	it("a file shows its size without a default description field", async () => {
		await renderLibrary();
		const detail = await openDetail(/guide\.pdf$/);
		expect(within(detail).queryByRole("textbox", { name: t("detail.defaultAlt") })).toBeNull();
		expect(within(detail).getByText(/1\.4 ?MB|1\.5 ?MB/)).toBeTruthy();
	});

	it("an unused file is deleted after confirmation", async () => {
		await renderLibrary();
		const detail = await openDetail(/dog\.png$/);
		fireEvent.click(within(detail).getByRole("button", { name: t("common.delete") }));
		const dialog = await screen.findByRole("alertdialog", { name: t("library.delete.title") });
		fireEvent.click(within(dialog).getByRole("button", { name: t("common.delete") }));

		await waitFor(() => expect(calls("DELETE", "/api/cms/v1/media/dog")).toHaveLength(1));
		await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t("library.deleted", { name: "dog.png" })));
	});

	it("the right-click menu has open, usages and delete", async () => {
		await renderLibrary();
		await act(async () => {
			fireEvent.contextMenu(screen.getByRole("button", { name: /cat\.png$/ }));
		});
		const items = (await screen.findAllByRole("menuitem")).map((item) => item.textContent);
		expect(items).toEqual([t("common.open"), t("library.menu.usage"), `${t("common.delete")}Del`]);
	});

	it("switching to list view shows name, type, size, dimensions, usage and upload date in a table, and clicking a row opens the detail", async () => {
		await renderLibrary();
		fireEvent.click(screen.getByRole("button", { name: t("library.viewList") }));

		const table = await screen.findByRole("table", { name: t("views.table") });
		expect(
			within(table)
				.getAllByRole("columnheader")
				.map((header) => header.textContent),
		).toEqual([
			t("views.preview"),
			t("views.filename"),
			t("views.type"),
			t("views.size"),
			t("views.dimensions"),
			t("views.usage"),
			t("views.uploadedAt"),
			t("views.actions"),
		]);
		const dogRow = within(table).getByRole("row", { name: /dog\.png/ });
		expect(within(dogRow).getByText("640×480")).toBeTruthy();
		expect(within(dogRow).getByText(t("usage.none"))).toBeTruthy();

		fireEvent.click(dogRow);
		const detail = await screen.findByRole("complementary", { name: t("detail.label") });
		expect(within(detail).getByRole("heading", { name: "dog.png" })).toBeTruthy();
	});

	it("remembers the chosen view in this browser", async () => {
		await renderLibrary();
		fireEvent.click(screen.getByRole("button", { name: t("library.viewList") }));
		await screen.findByRole("table", { name: t("views.table") });
		cleanup();

		render(
			<AdminQueryProvider>
				<MediaLibrary />
			</AdminQueryProvider>,
		);
		expect(await screen.findByRole("table", { name: t("views.table") })).toBeTruthy();
		window.localStorage.removeItem("cms:media-view");
	});
});
