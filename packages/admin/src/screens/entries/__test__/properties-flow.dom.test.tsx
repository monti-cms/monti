import { emptyStoredDocument } from "@monti-cms/core/document";
import { createSite } from "@monti-cms/core/site";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import blog from "../../../../../core/test/cms.config";
import { testSite } from "../../../../../core/test/site";
import { SEO_ADMIN_COMPONENTS } from "../../../../../seo/src/admin/provider";
import { seoMessages } from "../../../../../seo/src/messages";
import { AdminComponentsProvider } from "../../../admin-components";
import { commonMessages } from "../../../lib/common.messages";
import { type SlotAction, SlotRegistryProvider, type SlotSource } from "../../../slots/slots";
import { pressOption } from "../../../test/base-ui";
import { type FakeApi, failure, fakeApi } from "../../../test/fake-api";
import { installFakeIndexedDB } from "../../../test/fake-indexed-db";
import { docOf } from "../../../test/mdx";
import { createTestRouter } from "../../../test/router";
import { withSite } from "../../../test/site";
import { AdminUiLabels } from "../../../ui/labels";
import { uiMessages } from "../../../ui/messages";
import { EntryEditorShell } from "../entry-editor-shell";
import { entryEditorShellMessages } from "../entry-editor-shell.messages";
import type { EntryData } from "../entry-form";
import { entriesMessages } from "../messages";

const tEntryEditorShell = testSite.createTranslator(entryEditorShellMessages);
const tEntries = testSite.createTranslator(entriesMessages);
const tCommon = testSite.createTranslator(commonMessages);
const tUi = testSite.createTranslator(uiMessages);
const tSeo = testSite.createTranslator(seoMessages);
/** The label the blog config gives a field of a post: this flow renders the blog's post (its series, policy and SEO tab). */
const blogSite = createSite(blog);
const label = (field: string) =>
	(blogSite.schemaOf("post").fields as Record<string, { label: string } | undefined>)[field]?.label ?? field;
const SLUG = label("slug");
const SUMMARY = label("summary");
const SERIES_FIELD = label("series");
const POLICY = label("policy");
const SEO_TITLE = label("seoTitle");
/** What the assistant's mark reads, on a value and on its open input. */
const ASSISTED = tUi("proposal");

// The flow "set properties" of the editor board (flow 1, steps 07, 08 and 11): the 300px properties pane is a tab bar over a read list; a value opens for editing
// where it is; the SEO tab reads what each empty value follows; "채우기" writes the value at once and marks it as the assistant's until it is edited. They check
// what a screenshot cannot: the requests, the focus, the keys, the roles and names and the accessible state.

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

const { render } = createTestRouter();
/** The tab the SEO plugin places its fields in (the blog config keeps the plugin's default name). */
const SEO_TAB = "SEO";
/** The group the blog config puts the category, the tags and the series in. */
const CLASSIFICATION = "분류";

const entry: EntryData = {
	id: "entry-1",
	collection: "post",
	status: "draft",
	version: 4,
	folderId: null,
	workingSlug: "test",
	publishedSlug: null,
	working: { metadata: { title: "테스트", categoryId: "cat-1", summary: "" }, doc: docOf("첫째 줄") },
};

let api: FakeApi;

/** The series the search offers: the collections a post can be added to. */
const SERIES = [{ id: "series-1", title: "리액트 다시 만들기", slug: "react-again", status: "published" }];
/** The kind each series holds is read per series, to offer only the ones that take posts. */
const series: EntryData = {
	id: "series-1",
	collection: "collection",
	status: "published",
	version: 1,
	folderId: null,
	workingSlug: "react-again",
	publishedSlug: "react-again",
	working: { metadata: { title: "리액트 다시 만들기", itemIds: [] }, doc: emptyStoredDocument() },
};
const entries: Record<string, EntryData> = { "entry-1": entry, "series-1": series };

beforeEach(() => {
	installFakeIndexedDB();
	api = fakeApi()
		.on("GET /v1/entries/:id", ({ params }) => entries[params.id] ?? failure("not_found"))
		.on("PATCH /v1/entries/:id", ({ params, body }) => {
			const current = entries[params.id];
			if (!current) return failure("not_found");
			return {
				entry: {
					...current,
					version: current.version + 1,
					working: { metadata: body.metadata, doc: body.doc ?? current.working.doc },
				},
				warnings: [],
			};
		})
		.on("GET /v1/entries/search", ({ query }) => ({ items: query.get("collection") === "collection" ? SERIES : [] }))
		.on("GET /v1/entries", () => ({ items: [], total: 0 }))
		.on("GET /v1/entries/:id/relations", () => ({ incomingReferences: [] }))
		.on("POST /v1/entries/:id/check", () => ({ issues: [], warnings: [] }))
		.install();
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
const saved = () => api.sent("PATCH /v1/entries/:id");
const pressSave = () => fireEvent.keyDown(window, { key: "s", metaKey: true });

describe("flow: set properties (steps 07, 08, 11)", () => {
	it("WRITE-W3 is the properties pane: a tab bar over a list, with no head and no close button", async () => {
		renderEdit();
		const panel = await pane();
		expect(panel.getAllByRole("tab")).toHaveLength(2);
		expect(panel.getByRole("tab", { name: SEO_TAB })).toBeInTheDocument();
		expect(panel.getByRole("tab", { name: tEntries("tab.default") }).getAttribute("aria-selected")).toBe("true");
		expect(panel.queryByRole("button", { name: tCommon("close") })).toBeNull();
		expect(panel.queryByRole("heading", { level: 2 })).toBeNull();
	});

	it("WRITE-W3 reads as a list: the label above its value, and the group name as a subheading", async () => {
		renderEdit();
		expect((await valueButton(SLUG)).textContent).toBe("/test");
		expect((await valueButton(SUMMARY)).textContent).toBe(tEntries("property.empty"));
		const group = (await pane()).getByRole("region", { name: CLASSIFICATION });
		expect(within(group).getAllByRole("group").length).toBeGreaterThan(1);
		expect(within(group).getByRole("group", { name: SERIES_FIELD })).toBeInTheDocument();
		// At rest nothing is a box: no text field is on the screen besides the title.
		expect((await pane()).queryAllByRole("textbox")).toEqual([]);
	});

	it("WRITE-W3 a value opens for editing where it is, takes the caret, and the edit goes in the saved request", async () => {
		renderEdit();
		fireEvent.click(await valueButton(SUMMARY));
		const box = await (await row(SUMMARY)).findByRole("textbox");
		expect(document.activeElement).toBe(box);
		fireEvent.change(box, { target: { value: "새 요약" } });
		act(() => box.blur());
		await waitFor(async () => expect((await row(SUMMARY)).queryByRole("textbox")).toBeNull());
		expect((await valueButton(SUMMARY)).textContent).toBe("새 요약");
		pressSave();
		await waitFor(() => expect(saved()).toHaveLength(1));
		expect(saved()[0]?.body.metadata.summary).toBe("새 요약");
	});

	it("WRITE-W3 Enter ends a one-line value, Escape ends any value, and the typed text stays", async () => {
		renderEdit();
		fireEvent.click(await valueButton(SLUG));
		const slug = await (await row(SLUG)).findByRole("textbox");
		fireEvent.change(slug, { target: { value: "hello" } });
		fireEvent.keyDown(slug, { key: "Enter" });
		await waitFor(async () => expect((await row(SLUG)).queryByRole("textbox")).toBeNull());
		expect((await valueButton(SLUG)).textContent).toBe("/hello");

		fireEvent.click(await valueButton(SUMMARY));
		const box = await (await row(SUMMARY)).findByRole("textbox");
		fireEvent.change(box, { target: { value: "줄 하나" } });
		// A multi-line value takes Enter as a new line: it stays open.
		fireEvent.keyDown(box, { key: "Enter" });
		expect((await row(SUMMARY)).getByRole("textbox")).toBeInTheDocument();
		fireEvent.keyDown(box, { key: "Escape" });
		await waitFor(async () => expect((await row(SUMMARY)).queryByRole("textbox")).toBeNull());
		expect((await valueButton(SUMMARY)).textContent).toBe("줄 하나");
	});

	it("WRITE-W3 a select opens its list; the pick closes it and goes in the request", async () => {
		renderEdit();
		fireEvent.click(await valueButton(POLICY));
		pressOption(await screen.findByRole("option", { name: "항상 최신 글" }));

		await waitFor(async () => expect((await valueButton(POLICY)).textContent).toBe("항상 최신 글"));
		pressSave();
		await waitFor(() => expect(saved()).toHaveLength(1));
		expect(saved()[0]?.body.metadata.policy).toBe("evergreen");
	});

	it("WRITE-W3 the series field offers the series that exist", async () => {
		renderEdit();
		expect((await valueButton(SERIES_FIELD)).textContent).toBe(tEntries("property.none"));
		fireEvent.click(await valueButton(SERIES_FIELD));
		const box = await (await row(SERIES_FIELD)).findByRole("combobox");
		await waitFor(() => expect(document.activeElement).toBe(box));
		expect(await screen.findByRole("option", { name: "리액트 다시 만들기" })).toBeInTheDocument();
	});

	it("WRITE-W3 the SEO tab is a read list of what each empty value follows, with no preview boxes", async () => {
		renderEdit();
		fireEvent.click((await pane()).getByRole("tab", { name: SEO_TAB }));
		// The title "테스트" is 3 of the 60 characters a search title may have.
		expect((await valueButton(SEO_TITLE)).textContent).toBe(`${tSeo("same.title")} · 3/60`);
		expect((await valueButton(label("seoDescription"))).textContent).toBe(tSeo("same.description"));
		expect((await valueButton(label("ogImageId"))).textContent).toBe(tSeo("same.image"));
		expect((await valueButton(label("seoRobots"))).textContent).toBe(tSeo("option.index"));
		// No preview box: the tab holds its values and no region of its own.
		expect((await pane()).queryAllByRole("region")).toEqual([]);
		// Opening the title shows its count and the title as the hint.
		fireEvent.click(await valueButton(SEO_TITLE));
		const box = await (await row(SEO_TITLE)).findByRole("textbox");
		expect((box as HTMLInputElement).placeholder).toBe("테스트");
		expect((await row(SEO_TITLE)).getByText("3/60")).toBeInTheDocument();
	});

	it("ASSIST-F1 fills the empty summary at once, marks it as the assistant's, and an edit takes the mark off", async () => {
		renderEdit();
		expect((await row(SUMMARY)).queryByRole("button", { name: tUi("ai.again") })).toBeNull();
		fireEvent.click((await row(SUMMARY)).getByRole("button", { name: tUi("ai.fill") }));
		await waitFor(async () => expect((await valueButton(SUMMARY)).textContent).toContain("리액트로 블로그를"));
		expect(fill.run).toHaveBeenCalledWith(
			expect.objectContaining({ collection: "post", title: "테스트" }),
			expect.anything(),
		);
		// The value is in place without a step to accept it.
		expect((await valueButton(SUMMARY)).getAttribute("aria-description")).toBe(ASSISTED);
		// The action now asks again.
		expect((await row(SUMMARY)).getByRole("button", { name: tUi("ai.again") })).toBeInTheDocument();
		fireEvent.click(await valueButton(SUMMARY));
		const box = await (await row(SUMMARY)).findByRole("textbox");
		expect(box.getAttribute("aria-description")).toBe(ASSISTED);
		fireEvent.change(box, { target: { value: "고친 요약" } });
		expect(box.getAttribute("aria-description")).toBeNull();
		act(() => box.blur());
		await waitFor(async () => expect((await valueButton(SUMMARY)).getAttribute("aria-description")).toBeNull());
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
		expect(saved()[0]?.body.metadata.summary).toContain("리액트로 블로그를");
		await waitFor(async () => expect((await valueButton("요약")).getAttribute("aria-description")).toBeNull());
	});

	it("WRITE-W7 fills the series row: the post goes into the series the assistant picked, saved at once, and the row is marked as the assistant's", async () => {
		renderEdit();
		fireEvent.click((await row(SERIES_FIELD)).getByRole("button", { name: tUi("ai.fill") }));
		await waitFor(() => expect(api.sent("PATCH /v1/entries/series-1")).toHaveLength(1));
		expect(api.sent("PATCH /v1/entries/series-1")[0]?.body.metadata.itemIds).toEqual(["entry-1"]);
		await waitFor(async () =>
			expect((await valueButton(SERIES_FIELD)).getAttribute("aria-description")).toBe(ASSISTED),
		);
	});
});
