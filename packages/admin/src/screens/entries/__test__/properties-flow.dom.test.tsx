import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { SEO_ADMIN_COMPONENTS } from "../../../../../seo/src/admin/provider";
import { AdminComponentsProvider } from "../../../admin-components";
import { commonMessages } from "../../../lib/common.messages";
import { type SlotAction, SlotRegistryProvider, type SlotSource } from "../../../slots/slots";
import { pressOption } from "../../../test/base-ui";
import { docOf } from "../../../test/mdx";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { AdminUiLabels } from "../../../ui/labels";
import { EntryEditorShell } from "../entry-editor-shell";
import { entryEditorShellMessages } from "../entry-editor-shell.messages";
import { entriesMessages } from "../messages";

const tEntryEditorShell = testSite.createTranslator(entryEditorShellMessages);
const tEntries = testSite.createTranslator(entriesMessages);
const tCommon = testSite.createTranslator(commonMessages);

// The flow "set properties" of the editor board (flow 1, steps 07, 08 and 11): the 300px properties pane is a tab bar over a read list; a value opens for editing
// where it is; the SEO tab reads what each empty value follows; "채우기" writes the value at once and marks it as the assistant's until it is edited. They check
// what a screenshot cannot: the requests, the focus, the keys, the roles and names and the accessible state.

vi.mock("../local-backup", async (importOriginal) => ({
	...(await importOriginal<typeof import("../local-backup")>()),
	getLocalBackup: async () => null,
	deleteLocalBackup: async () => undefined,
	saveLocalBackup: async () => true,
}));
// The body editor is not under test here: the screen keeps its title field and toolbar slots.
vi.mock("../../../editor/tiptap-editor", () => ({
	CmsEditor: ({ titleField, toolbarEnd }: { titleField?: React.ReactNode; toolbarEnd?: React.ReactNode }) => (
		<div>
			{toolbarEnd}
			{titleField}
		</div>
	),
}));
vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);
vi.mock("../ai-translate", () => ({
	useAiTranslate: () => ({ blockAction: null, toolbar: null, setEditor: () => {} }),
}));

const { render } = createTestRouter();

const entry = {
	id: "entry-1",
	collection: "post",
	status: "draft",
	version: 4,
	folderId: null,
	workingSlug: "test",
	publishedSlug: null,
	working: { metadata: { title: "테스트", categoryId: "cat-1", summary: "" }, doc: docOf("첫째 줄") },
};

const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
let fetchMock: ReturnType<typeof vi.fn>;

/** The series the search offers: the collections a post can be added to. */
const SERIES = [{ id: "series-1", title: "리액트 다시 만들기", slug: "react-again", status: "published" }];

beforeEach(() => {
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		if (init?.method === "PATCH" && input === "/api/monti/v1/entries/series-1") return json({ version: 2 });
		if (init?.method === "PATCH") {
			const body = JSON.parse(String(init.body));
			return json({
				entry: { ...entry, version: 5, working: { metadata: body.metadata, doc: body.doc } },
				warnings: [],
			});
		}
		if (input.startsWith("/api/monti/v1/entries/search?")) {
			const collection = new URL(input, "http://localhost").searchParams.get("collection");
			return json({ items: collection === "collection" ? SERIES : [], total: 0 });
		}
		// The kind each series holds is read per series, to offer only the ones that take posts.
		if (input === "/api/monti/v1/entries/series-1" && !init?.method) {
			return json({
				version: 1,
				workingSlug: "react-again",
				working: { metadata: { title: "리액트 다시 만들기", itemIds: [] } },
			});
		}
		if (input.startsWith("/api/monti/v1/entries?")) return json({ items: [], total: 0 });
		if (input.endsWith("/relations")) return json({ incomingReferences: [] });
		if (input.endsWith("/check") && init?.method === "POST") return json({ issues: [], warnings: [] });
		if (input === "/api/monti/v1/entries/entry-1" && !init?.method) return json(entry);
		throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const fill: SlotAction = {
	id: "summary",
	label: "요약 쓰기",
	apply: "replace",
	run: vi.fn(async () => ({ kind: "text" as const, text: "리액트로 블로그를 다시 만들며 덜어낸 것과 남긴 것." })),
};
const summarySource: SlotSource = (request) => (request.slot === "field" && request.target === "summary" ? [fill] : []);
/** The series action picks one existing series, as the decide model does. */
const pickSeries: SlotAction = {
	id: "series",
	label: "시리즈 추천",
	apply: "append",
	run: vi.fn(async () => ({
		kind: "candidates" as const,
		items: [{ value: "series-1", label: "리액트 다시 만들기" }],
	})),
};
const seriesSource: SlotSource = (request) =>
	request.slot === "field" && request.target === "series" ? [pickSeries] : [];

const renderEdit = () =>
	render(
		withSite(
			<AdminUiLabels>
				<AdminComponentsProvider components={SEO_ADMIN_COMPONENTS}>
					<SlotRegistryProvider sources={[summarySource, seriesSource]}>
						<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId="u1" />
					</SlotRegistryProvider>
				</AdminComponentsProvider>
			</AdminUiLabels>,
		),
	);
const pane = async () => within(await screen.findByRole("complementary", { name: tEntryEditorShell("properties") }));
/** One property of the list: its label names the group. */
const row = async (label: string) => within((await pane()).getByRole("group", { name: label }));
const valueButton = async (label: string) => (await row(label)).getByRole("button", { name: new RegExp(`^${label}`) });
const saved = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
const pressSave = () => fireEvent.keyDown(window, { key: "s", metaKey: true });

describe("flow: set properties (steps 07, 08, 11)", () => {
	it("is the properties pane: a tab bar over a list, with no head and no close button", async () => {
		renderEdit();
		const panel = await pane();
		expect(panel.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["기본", "SEO"]);
		expect(panel.getByRole("tab", { name: tEntries("tab.default") }).getAttribute("aria-selected")).toBe("true");
		expect(panel.queryByRole("button", { name: tCommon("close") })).toBeNull();
		expect(panel.queryByRole("heading", { level: 2 })).toBeNull();
	});

	it("reads as a list: the label above its value, and the group name as a subheading", async () => {
		renderEdit();
		expect((await valueButton("주소")).textContent).toBe("/test");
		expect((await valueButton("요약")).textContent).toBe("비어 있음");
		const group = (await pane()).getByRole("region", { name: "분류" });
		expect(within(group).getAllByRole("group").length).toBeGreaterThan(1);
		expect(within(group).getByRole("group", { name: "모음집" })).toBeInTheDocument();
		// At rest nothing is a box: no text field is on the screen besides the title.
		expect((await pane()).queryAllByRole("textbox")).toEqual([]);
	});

	it("a value opens for editing where it is, takes the caret, and the edit goes in the saved request", async () => {
		renderEdit();
		fireEvent.click(await valueButton("요약"));
		const box = await (await row("요약")).findByRole("textbox");
		expect(document.activeElement).toBe(box);
		fireEvent.change(box, { target: { value: "새 요약" } });
		act(() => box.blur());
		await waitFor(async () => expect((await row("요약")).queryByRole("textbox")).toBeNull());
		expect((await valueButton("요약")).textContent).toBe("새 요약");
		pressSave();
		await waitFor(() => expect(saved()).toHaveLength(1));
		expect(JSON.parse(String(saved()[0]?.[1]?.body)).metadata.summary).toBe("새 요약");
	});

	it("Enter ends a one-line value, Escape ends any value, and the typed text stays", async () => {
		renderEdit();
		fireEvent.click(await valueButton("주소"));
		const slug = await (await row("주소")).findByRole("textbox");
		fireEvent.change(slug, { target: { value: "hello" } });
		fireEvent.keyDown(slug, { key: "Enter" });
		await waitFor(async () => expect((await row("주소")).queryByRole("textbox")).toBeNull());
		expect((await valueButton("주소")).textContent).toBe("/hello");

		fireEvent.click(await valueButton("요약"));
		const box = await (await row("요약")).findByRole("textbox");
		fireEvent.change(box, { target: { value: "줄 하나" } });
		// A multi-line value takes Enter as a new line: it stays open.
		fireEvent.keyDown(box, { key: "Enter" });
		expect((await row("요약")).getByRole("textbox")).toBeInTheDocument();
		fireEvent.keyDown(box, { key: "Escape" });
		await waitFor(async () => expect((await row("요약")).queryByRole("textbox")).toBeNull());
		expect((await valueButton("요약")).textContent).toBe("줄 하나");
	});

	it("a select opens its list; the pick closes it and goes in the request", async () => {
		renderEdit();
		fireEvent.click(await valueButton("정책"));
		pressOption(await screen.findByRole("option", { name: "항상 최신 글" }));

		await waitFor(async () => expect((await valueButton("정책")).textContent).toBe("항상 최신 글"));
		pressSave();
		await waitFor(() => expect(saved()).toHaveLength(1));
		expect(JSON.parse(String(saved()[0]?.[1]?.body)).metadata.policy).toBe("evergreen");
	});

	it("the series field offers the series that exist", async () => {
		renderEdit();
		expect((await valueButton("모음집")).textContent).toBe("없음");
		fireEvent.click(await valueButton("모음집"));
		const box = await (await row("모음집")).findByRole("combobox");
		await waitFor(() => expect(document.activeElement).toBe(box));
		expect(await screen.findByRole("option", { name: "리액트 다시 만들기" })).toBeInTheDocument();
	});

	it("the SEO tab is a read list of what each empty value follows, with no preview boxes", async () => {
		renderEdit();
		fireEvent.click((await pane()).getByRole("tab", { name: "SEO" }));
		expect((await valueButton("SEO 제목")).textContent).toBe("제목과 같음 · 3/60");
		expect((await valueButton("SEO 설명")).textContent).toBe("요약과 같음");
		expect((await valueButton("공유 이미지")).textContent).toBe("기본 이미지와 같음");
		expect((await valueButton("검색에서 숨기기")).textContent).toBe("아니요");
		expect(screen.queryByRole("region", { name: /미리보기/ })).toBeNull();
		// Opening the title shows its count and the title as the hint.
		fireEvent.click(await valueButton("SEO 제목"));
		const box = await (await row("SEO 제목")).findByRole("textbox");
		expect((box as HTMLInputElement).placeholder).toBe("테스트");
		expect((await row("SEO 제목")).getByText("3/60")).toBeInTheDocument();
	});

	it("fills the empty summary at once, marks it as the assistant's, and an edit takes the mark off", async () => {
		renderEdit();
		expect((await row("요약")).queryByRole("button", { name: /^다시$/ })).toBeNull();
		fireEvent.click((await row("요약")).getByRole("button", { name: /채우기/ }));
		await waitFor(async () => expect((await valueButton("요약")).textContent).toContain("리액트로 블로그를"));
		expect(fill.run).toHaveBeenCalledWith(
			expect.objectContaining({ collection: "post", title: "테스트" }),
			expect.anything(),
		);
		// No result to accept: there is no replace step anywhere.
		expect(screen.queryByRole("button", { name: /바꾸기|넣기/ })).toBeNull();
		expect((await valueButton("요약")).getAttribute("aria-description")).toBe("AI 제안");
		// The action now asks again.
		expect((await row("요약")).getByRole("button", { name: /^다시$/ })).toBeInTheDocument();
		fireEvent.click(await valueButton("요약"));
		const box = await (await row("요약")).findByRole("textbox");
		expect(box.getAttribute("aria-description")).toBe("AI 제안");
		fireEvent.change(box, { target: { value: "고친 요약" } });
		expect(box.getAttribute("aria-description")).toBeNull();
		act(() => box.blur());
		await waitFor(async () => expect((await valueButton("요약")).getAttribute("aria-description")).toBeNull());
	});

	it('"다시" fills again, and saving ends the assistant\'s mark', async () => {
		renderEdit();
		fireEvent.click((await row("요약")).getByRole("button", { name: /채우기/ }));
		await waitFor(async () => expect((await valueButton("요약")).getAttribute("aria-description")).toBe("AI 제안"));
		vi.mocked(fill.run).mockClear();
		fireEvent.click((await row("요약")).getByRole("button", { name: /^다시$/ }));
		await waitFor(() => expect(fill.run).toHaveBeenCalledTimes(1));
		pressSave();
		await waitFor(() => expect(saved()).toHaveLength(1));
		expect(JSON.parse(String(saved()[0]?.[1]?.body)).metadata.summary).toContain("리액트로 블로그를");
		await waitFor(async () => expect((await valueButton("요약")).getAttribute("aria-description")).toBeNull());
	});

	it("fills the series row: the post goes into the series the assistant picked, saved at once, and the row is marked as the assistant's", async () => {
		renderEdit();
		fireEvent.click((await row("모음집")).getByRole("button", { name: /채우기/ }));
		await waitFor(() =>
			expect(
				fetchMock.mock.calls.filter(
					([input, init]) => init?.method === "PATCH" && input === "/api/monti/v1/entries/series-1",
				),
			).toHaveLength(1),
		);
		const sent = fetchMock.mock.calls.find(
			([input, init]) => init?.method === "PATCH" && input === "/api/monti/v1/entries/series-1",
		);
		expect(JSON.parse(String(sent?.[1]?.body)).metadata.itemIds).toEqual(["entry-1"]);
		await waitFor(async () => expect((await valueButton("모음집")).getAttribute("aria-description")).toBe("AI 제안"));
	});
});
