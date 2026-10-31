import { emptyStoredDocument } from "@monti-cms/core/document";
import { createSite } from "@monti-cms/core/site";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../../../core/test/site";
import { commonMessages } from "../../lib/common.messages";
import { fakeApi } from "../../test/fake-api";
import { withSite } from "../../test/site";
import type { EntryData } from "../entries/entry-form";
import { screensMessages } from "../messages";
import { RecordPanel } from "../record-panel";

const tScreens = testSite.createTranslator(screensMessages);
const tCommon = testSite.createTranslator(commonMessages);

const tag: EntryData = {
	id: "tag-1",
	collection: "tag",
	status: "published",
	version: 3,
	folderId: null,
	workingSlug: "react",
	publishedSlug: "react",
	working: { metadata: { title: "리액트", translations: { en: { title: "React" } } }, doc: emptyStoredDocument() },
};

let api: ReturnType<typeof fakeApi>;
const calls = (method: "PATCH" | "POST") => api.requests.filter((request) => request.method === method);

beforeEach(() => {
	api = fakeApi()
		.on("GET /v1/entries/:id", () => tag)
		.on("PATCH /v1/entries/:id", () => ({ entry: { ...tag, version: 4 }, warnings: [] }))
		.on("POST /v1/entries", () => ({ entry: { ...tag, id: "tag-2" }, warnings: [] }))
		.on("GET /v1/entries", () => ({ items: [], total: 0 }))
		.install();
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

	it("WRITE-W6 on other locale tabs only that locale's name is edited, and it says the slug is the same in all locales", async () => {
		const { onSaved } = renderPanel({ collection: "tag", id: "tag-1" });
		await screen.findByDisplayValue("리액트");

		fireEvent.click(within(panel()).getByRole("tab", { name: /일본어/ }));
		expect(screen.queryByRole("textbox", { name: tScreens("column.slug") })).toBeNull();
		expect(screen.getByText(/주소와 연결은 모든 언어가 같아요/)).toBeInTheDocument();
		fireEvent.change(screen.getByRole("textbox", { name: /^이름/ }), { target: { value: "リアクト" } });
		expect(within(panel()).getByRole("tab", { name: "일본어 · 번역 있음" })).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: tCommon("save") }));
		await waitFor(() => expect(calls("PATCH")).toHaveLength(1));
		expect(calls("PATCH")[0]?.body).toMatchObject({
			expectedVersion: 3,
			metadata: { translations: { ja: { title: "リアクト" } } },
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
		expect(screen.getByRole("textbox", { name: /^이름/ })).toBeInTheDocument();
	});

	it("a new item is saved with just a name, passes the created item on, and does not close the slot", async () => {
		const { onSaved, onClose } = renderPanel({ collection: "tag", id: null });
		expect(screen.getByRole("heading", { name: "태그 추가" })).toBeInTheDocument();
		fireEvent.change(screen.getByRole("textbox", { name: /이름/ }), { target: { value: "Vue" } });
		fireEvent.click(screen.getByRole("button", { name: tCommon("save") }));

		await waitFor(() => expect(calls("POST")).toHaveLength(1));
		expect(calls("POST")[0]?.body).toEqual({
			collection: "tag",
			slug: null,
			metadata: { title: "Vue" },
			doc: emptyStoredDocument(),
		});
		await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "tag-2" })));
		expect(onClose).not.toHaveBeenCalled();
	});

	it("WRITE-S2 after saving, saves again based on the received revision", async () => {
		renderPanel({ collection: "tag", id: "tag-1" });
		fireEvent.change(await screen.findByDisplayValue("리액트"), { target: { value: "React!" } });
		fireEvent.click(screen.getByRole("button", { name: tCommon("save") }));
		await waitFor(() => expect(calls("PATCH")).toHaveLength(1));
		await waitFor(() =>
			expect((screen.getByRole("button", { name: tCommon("save") }) as HTMLButtonElement).disabled).toBe(false),
		);

		fireEvent.change(screen.getByDisplayValue("React!"), { target: { value: "React!!" } });
		fireEvent.click(screen.getByRole("button", { name: tCommon("save") }));
		await waitFor(() => expect(calls("PATCH")).toHaveLength(2));
		expect(calls("PATCH")[1]?.body.expectedVersion).toBe(4);
	});

	it("WRITE-S6 with unsaved changes, asks whether to discard before closing", async () => {
		const { onClose } = renderPanel({ collection: "tag", id: "tag-1" });
		fireEvent.change(await screen.findByDisplayValue("리액트"), { target: { value: "React!" } });

		fireEvent.click(within(panel()).getByRole("button", { name: "Close" }));
		const dialog = await screen.findByRole("alertdialog", { name: tCommon("discard.title") });
		expect(onClose).not.toHaveBeenCalled();

		fireEvent.click(within(dialog).getByRole("button", { name: tCommon("discard.confirm") }));
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
	});

	it("a series edits its post list on the default locale tab", async () => {
		renderPanel({ collection: "collection", id: null });
		expect(await screen.findByRole("combobox", { name: "게시글 추가·빼기" })).toBeInTheDocument();
	});
});
