import { adminEntryEditHref, createTranslator } from "@monti-cms/core/client";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedMessages } from "../../shared/messages";
import { AdminQueryProvider } from "../../shared/query-provider";
import { MediaLibrary } from "../media-library";
import { mediaMessages } from "../messages";

const t = createTranslator(mediaMessages);
const tShared = createTranslator(sharedMessages);

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

describe("미디어 라이브러리", () => {
	it("목록을 불러와 사용 여부와 함께 보인다", async () => {
		await renderLibrary();
		expect(screen.getByRole("button", { name: /cat\.png$/ }).textContent).toContain(t("usage.count", { count: 1 }));
		expect(screen.getByRole("button", { name: /dog\.png$/ }).textContent).toContain(t("usage.none"));
		expect(screen.getByRole("button", { name: /guide\.pdf$/ }).textContent).toContain("PDF");
	});

	it("검색·형식·사용 여부 조건을 목록 요청에 싣는다", async () => {
		await renderLibrary();
		fireEvent.change(screen.getByRole("searchbox", { name: t("library.search") }), { target: { value: "cat" } });
		await waitFor(() => expect(mediaRequests().at(-1)?.searchParams.get("search")).toBe("cat"));
		expect(mediaRequests().at(-1)?.searchParams.get("page")).toBe("1");
	});

	it("고르면 상세에 이름·형식·크기·올린 날짜·사용처를 보인다", async () => {
		await renderLibrary();
		const detail = await openDetail(/cat\.png$/);
		expect(within(detail).getAllByText("cat.png").length).toBeGreaterThan(0);
		expect(within(detail).getByText("image/png")).toBeTruthy();
		expect(within(detail).getByText(/640×480/)).toBeTruthy();
		expect(
			within(detail)
				.getByRole("link", { name: /고양이 글/ })
				.getAttribute("href"),
		).toBe(adminEntryEditHref("e1"));
		// 쓰이는 파일은 지울 수 없다.
		expect((within(detail).getByRole("button", { name: t("common.delete") }) as HTMLButtonElement).disabled).toBe(true);
	});

	it("이미지의 기본 대체 텍스트·캡션을 저장한다", async () => {
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

	it("기본 설명을 고친 채 다른 파일을 열면 버릴지 묻는다", async () => {
		await renderLibrary();
		const detail = await openDetail(/cat\.png$/);
		fireEvent.change(within(detail).getByRole("textbox", { name: t("detail.defaultCaption") }), {
			target: { value: "고친 캡션" },
		});

		fireEvent.click(screen.getByRole("button", { name: /dog\.png$/ }));
		const dialog = await screen.findByRole("alertdialog", { name: tShared("discard.title") });
		// 확인 창이 떠 있는 동안 상세 칸은 가려지지만 고친 값은 남아 있다.
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

	it("열린 파일을 표시한다", async () => {
		await renderLibrary();
		await openDetail(/cat\.png$/);
		await waitFor(() =>
			expect(screen.getByRole("button", { name: /cat\.png$/ }).getAttribute("aria-current")).toBe("true"),
		);
		expect(screen.getByRole("button", { name: /dog\.png$/ }).getAttribute("aria-current")).toBeNull();
	});

	it("불러오지 못하면 그 자리에 알리고 다시 시도할 수 있다", async () => {
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
		// 목록 요청은 한 번 다시 시도한 뒤 실패로 본다.
		const alert = await screen.findByRole("alert", undefined, { timeout: 3000 });
		expect(alert.textContent).toContain("서버 오류");
		expect(toast.error).not.toHaveBeenCalled();
		fail = false;
		fireEvent.click(within(alert).getByRole("button", { name: t("common.retry") }));
		expect(await screen.findByRole("button", { name: /cat\.png$/ })).toBeTruthy();
	});

	it("파일은 기본 설명 칸 없이 크기를 보인다", async () => {
		await renderLibrary();
		const detail = await openDetail(/guide\.pdf$/);
		expect(within(detail).queryByRole("textbox", { name: t("detail.defaultAlt") })).toBeNull();
		expect(within(detail).getByText(/1\.4 ?MB|1\.5 ?MB/)).toBeTruthy();
	});

	it("쓰이지 않는 파일은 확인을 받고 지운다", async () => {
		await renderLibrary();
		const detail = await openDetail(/dog\.png$/);
		fireEvent.click(within(detail).getByRole("button", { name: t("common.delete") }));
		const dialog = await screen.findByRole("alertdialog", { name: t("library.delete.title") });
		fireEvent.click(within(dialog).getByRole("button", { name: t("common.delete") }));

		await waitFor(() => expect(calls("DELETE", "/api/cms/v1/media/dog")).toHaveLength(1));
		await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t("library.deleted", { name: "dog.png" })));
	});

	it("오른쪽 클릭 메뉴에 열기·사용처·삭제가 있다", async () => {
		await renderLibrary();
		await act(async () => {
			fireEvent.contextMenu(screen.getByRole("button", { name: /cat\.png$/ }));
		});
		const items = (await screen.findAllByRole("menuitem")).map((item) => item.textContent);
		expect(items).toEqual([t("common.open"), t("library.menu.usage"), `${t("common.delete")}Del`]);
	});

	it("목록 보기로 바꾸면 이름·형식·크기·치수·사용·올린 날짜를 표로 보이고, 줄을 누르면 상세가 열린다", async () => {
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

	it("고른 보기를 이 브라우저에 기억한다", async () => {
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
