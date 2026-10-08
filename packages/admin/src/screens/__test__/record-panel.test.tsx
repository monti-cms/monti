import { createSite } from "@monti-cms/core/client";
import { emptyStoredDocument } from "@monti-cms/core/document";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../../core/test/site";
import { RecordPanel } from "../record-panel";
import { withSite } from "./site-wrapper";

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

const tag = {
	id: "tag-1",
	collection: "tag",
	status: "published",
	version: 3,
	folderId: null,
	workingSlug: "react",
	publishedSlug: "react",
	working: { metadata: { title: "리액트", translations: { en: { title: "React" } } }, mdx: "" },
};

let fetchMock: ReturnType<typeof vi.fn>;
const calls = (method: string) => fetchMock.mock.calls.filter(([, init]) => init?.method === method);
const bodyOf = (call: unknown[] | undefined) => JSON.parse(String((call?.[1] as RequestInit).body));

beforeEach(() => {
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		if (input === "/api/cms/v1/entries/tag-1" && !init?.method) return json(tag);
		if (input === "/api/cms/v1/entries/tag-1" && init?.method === "PATCH")
			return json({ entry: { ...tag, version: 4 }, warnings: [] });
		if (input === "/api/cms/v1/entries" && init?.method === "POST")
			return json({ entry: { ...tag, id: "tag-2" }, warnings: [] }, 201);
		if (input.startsWith("/api/cms/v1/entries?")) return json({ items: [], total: 0 });
		throw new Error(`Unexpected fetch ${init?.method ?? "GET"} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderPanel = (target: { collection: "tag" | "category" | "collection"; id: string | null }) => {
	const onClose = vi.fn();
	const onSaved = vi.fn();
	render(withSite(<RecordPanel target={target} onClose={onClose} onSaved={onSaved} />));
	return { onClose, onSaved };
};
const panel = () => screen.getByRole("complementary", { name: /태그/ });

describe("taxonomy edit panel", () => {
	it("opens as a panel beside the list and shows per locale tab whether a translation exists", async () => {
		renderPanel({ collection: "tag", id: "tag-1" });
		const name = (await screen.findByRole("textbox", { name: /이름/ })) as HTMLInputElement;
		await waitFor(() => expect(name.value).toBe("리액트"));

		const tabs = within(panel())
			.getAllByRole("tab")
			.map((tab) => tab.getAttribute("aria-label"));
		expect(tabs).toEqual(["한국어", "영어 · 번역 있음", "일본어 · 번역 없음"]);
	});

	it("on other locale tabs only that locale's name is edited, and it says the slug is the same in all locales", async () => {
		const { onSaved } = renderPanel({ collection: "tag", id: "tag-1" });
		await screen.findByDisplayValue("리액트");

		fireEvent.click(within(panel()).getByRole("tab", { name: /일본어/ }));
		expect(screen.queryByRole("textbox", { name: "주소" })).toBeNull();
		expect(screen.getByText(/주소와 연결은 모든 언어가 같습니다/)).toBeTruthy();
		fireEvent.change(screen.getByRole("textbox", { name: /^이름/ }), { target: { value: "リアクト" } });
		expect(within(panel()).getByRole("tab", { name: "일본어 · 번역 있음" })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		await waitFor(() => expect(calls("PATCH")).toHaveLength(1));
		expect(bodyOf(calls("PATCH")[0])).toEqual({
			expectedVersion: 3,
			slug: "react",
			metadata: { title: "리액트", translations: { en: { title: "React" }, ja: { title: "リアクト" } } },
		});
		await waitFor(() => expect(onSaved).toHaveBeenCalled());
	});

	it("shows no language tabs when the site turns the translation UI off, and still edits the default language", async () => {
		const site = createSite({ ...testConfig, admin: { ...testConfig.admin, translations: false } });
		render(
			withSite(<RecordPanel target={{ collection: "tag", id: "tag-1" }} onClose={vi.fn()} onSaved={vi.fn()} />, site),
		);
		await screen.findByDisplayValue("리액트");
		expect(within(panel()).queryAllByRole("tab")).toHaveLength(0);
		expect(screen.getByRole("textbox", { name: /^이름/ })).toBeTruthy();
	});

	it("a new item is saved with just a name, passes the created item on, and does not close the slot", async () => {
		const { onSaved, onClose } = renderPanel({ collection: "tag", id: null });
		expect(screen.getByRole("heading", { name: "태그 추가" })).toBeTruthy();
		fireEvent.change(screen.getByRole("textbox", { name: /이름/ }), { target: { value: "Vue" } });
		fireEvent.click(screen.getByRole("button", { name: "저장" }));

		await waitFor(() => expect(calls("POST")).toHaveLength(1));
		expect(bodyOf(calls("POST")[0])).toEqual({
			collection: "tag",
			slug: null,
			metadata: { title: "Vue" },
			doc: emptyStoredDocument(),
		});
		await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "tag-2" })));
		expect(onClose).not.toHaveBeenCalled();
	});

	it("after saving, saves again based on the received revision", async () => {
		renderPanel({ collection: "tag", id: "tag-1" });
		fireEvent.change(await screen.findByDisplayValue("리액트"), { target: { value: "React!" } });
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		await waitFor(() => expect(calls("PATCH")).toHaveLength(1));
		await waitFor(() =>
			expect((screen.getByRole("button", { name: "저장" }) as HTMLButtonElement).disabled).toBe(false),
		);

		fireEvent.change(screen.getByDisplayValue("React!"), { target: { value: "React!!" } });
		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		await waitFor(() => expect(calls("PATCH")).toHaveLength(2));
		expect(bodyOf(calls("PATCH")[1]).expectedVersion).toBe(4);
	});

	it("with unsaved changes, asks whether to discard before closing", async () => {
		const { onClose } = renderPanel({ collection: "tag", id: "tag-1" });
		fireEvent.change(await screen.findByDisplayValue("리액트"), { target: { value: "React!" } });

		fireEvent.click(within(panel()).getByRole("button", { name: "닫기" }));
		const dialog = await screen.findByRole("alertdialog", { name: "저장하지 않은 내용" });
		expect(onClose).not.toHaveBeenCalled();

		fireEvent.click(within(dialog).getByRole("button", { name: "버리기" }));
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
	});

	it("closes without asking if nothing was changed", async () => {
		const { onClose } = renderPanel({ collection: "tag", id: "tag-1" });
		await screen.findByDisplayValue("리액트");
		fireEvent.click(within(panel()).getByRole("button", { name: "취소" }));
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("a series edits its post list on the default locale tab", async () => {
		renderPanel({ collection: "collection", id: null });
		expect(await screen.findByRole("combobox", { name: "게시글 추가·빼기" })).toBeTruthy();
	});
});
