// The series rows of the properties pane: a post's `series` is a backlink to the blog's `collection` items, a field kind only the blog's config has.
import { emptyStoredDocument } from "@monti-cms/core/document";
import { createSite } from "@monti-cms/core/site";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import blog from "../../../../../core/test/cms.config";
import type { SlotAction, SlotSource } from "../../../slots/slots";
import type { FakeApi } from "../../../test/fake-api";
import { uiMessages } from "../../../ui/messages";
import type { EntryData } from "../entry-form";
import { entriesMessages } from "../messages";
import { pressSave, renderEdit, row, setUpPropertiesFlow, valueButton } from "./properties-flow.fixture";

const blogSite = createSite(blog);
const tEntries = blogSite.createTranslator(entriesMessages);
const tUi = blogSite.createTranslator(uiMessages);
const SERIES_FIELD = blogSite.schemaOf("post").fields.series?.label ?? "series";
/** What the assistant's mark reads, on a value and on its open input. */
const ASSISTED = tUi("proposal");

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

/** The series the search offers: the collections a post can be added to. */
const SERIES = [{ id: "series-1", title: "리액트 다시 만들기", slug: "react-again", status: "published" }];
const SERIES_TITLE = SERIES[0]?.title ?? "";
/** The kind each series holds is read per series, to offer only the ones that take posts. */
const series: EntryData = {
	id: "series-1",
	collection: "collection",
	status: "published",
	version: 1,
	folderId: null,
	workingSlug: "react-again",
	publishedSlug: "react-again",
	working: { metadata: { title: SERIES_TITLE, itemIds: [] }, doc: emptyStoredDocument() },
};

let api: FakeApi;

beforeEach(() => {
	const flow = setUpPropertiesFlow(
		"post",
		{ title: "테스트", categoryId: "cat-1", summary: "" },
		{ "series-1": series },
	);
	api = flow.api
		.on("GET /v1/entries/search", ({ query }) => ({ items: query.get("collection") === "collection" ? SERIES : [] }))
		// The series whose working list holds the post, the way the server reads the post's usages.
		.on("GET /v1/entries/:id/relations", ({ params }) => ({
			incomingReferences: Object.values(flow.entries)
				.filter((other) => (other.working.metadata.itemIds as string[] | undefined)?.includes(params.id))
				.map((other) => ({
					state: "working" as const,
					sourceId: other.id,
					sourceCollection: other.collection,
					sourceTitle: other.working.metadata.title as string,
					sourceSlug: other.workingSlug,
					sourceStatus: other.status,
					kind: "entry" as const,
					isStale: false,
					occurrences: [{ type: "metadata" as const, path: "itemIds", ordinal: 0 }],
				})),
		}));
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

/** The series action picks one existing series, as the decide model does. */
const pickSeries: SlotAction = {
	id: "series",
	label: "시리즈 추천",
	apply: "append",
	run: vi.fn(async () => ({
		kind: "candidates" as const,
		items: [{ value: "series-1", label: SERIES_TITLE }],
	})),
};
const seriesSource: SlotSource = (request) =>
	request.slot === "field" && request.target === "series" ? [pickSeries] : [];

describe("flow: set properties, the series of a post", () => {
	it("WRITE-W3 the series field offers the series that exist", async () => {
		renderEdit([seriesSource]);
		expect((await valueButton(SERIES_FIELD)).textContent).toBe(tEntries("property.none"));
		fireEvent.click(await valueButton(SERIES_FIELD));
		const box = await (await row(SERIES_FIELD)).findByRole("combobox");
		await waitFor(() => expect(document.activeElement).toBe(box));
		expect(await screen.findByRole("option", { name: SERIES_TITLE })).toBeInTheDocument();
	});

	it("WRITE-W7 fills the series row: the series the assistant picked is shown and marked as the assistant's, and the save writes it", async () => {
		renderEdit([seriesSource]);
		fireEvent.click((await row(SERIES_FIELD)).getByRole("button", { name: tUi("ai.fill") }));
		await waitFor(async () => expect((await valueButton(SERIES_FIELD)).textContent).toBe(SERIES_TITLE));
		expect((await valueButton(SERIES_FIELD)).getAttribute("aria-description")).toBe(ASSISTED);
		expect(api.sent("PATCH /v1/entries/series-1")).toHaveLength(0);
		pressSave();
		await waitFor(() => expect(api.sent("PATCH /v1/entries/series-1")).toHaveLength(1));
		expect(api.sent("PATCH /v1/entries/series-1")[0]?.body.metadata.itemIds).toEqual(["entry-1"]);
		// Only the series changed, so the post itself is not sent.
		expect(api.sent("PATCH /v1/entries/entry-1")).toHaveLength(0);
		// The row reads the series again and keeps showing the one it is in now.
		await waitFor(() => expect(api.sent("GET /v1/entries/entry-1/relations")).toHaveLength(2));
		expect((await valueButton(SERIES_FIELD)).textContent).toBe(SERIES_TITLE);
	});
});
