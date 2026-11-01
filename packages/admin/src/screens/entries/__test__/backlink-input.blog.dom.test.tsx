// Blog-only: a backlink field (a post or memo in a `collection` item, which holds one kind by its conditional `itemKind`) exists only in the blog config.
import type { BacklinkField } from "@monti-cms/core";
import { emptyStoredDocument } from "@monti-cms/core/document";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { commonMessages } from "../../../lib/common.messages";
import { type FakeApi, failure, fakeApi } from "../../../test/fake-api";
import { renderWithSite as render } from "../../../test/site";
import { toast } from "../../../test/ui-toast";
import { screensMessages } from "../../messages";
import type { BacklinkChange } from "../backlink-changes";
import type { EntryData } from "../entry-form";
import { BacklinkInput } from "../field-inputs";
import { entriesMessages } from "../messages";

const tCommon = testSite.createTranslator(commonMessages);
const tScreens = testSite.createTranslator(screensMessages);
const tEntries = testSite.createTranslator(entriesMessages);

vi.mock("@monti-cms/ui", async (importOriginal) =>
	(await import("../../../test/ui-toast")).withToast(await importOriginal<typeof import("@monti-cms/ui")>()),
);

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/** Titles of the series records the test makes. */
const SERIES_A = "시리즈 A";
const SERIES_B = "시리즈 B";
const NEW_SERIES = "새 메모 시리즈";

const field: BacklinkField = {
	kind: "backlink",
	label: "모음집",
	from: "collection",
	via: "itemIds",
	createInline: true,
};

const shared = {
	references: [
		{
			state: "working" as const,
			sourceId: "c1",
			sourceCollection: "collection",
			sourceTitle: SERIES_A,
			sourceSlug: "a",
			sourceStatus: "draft" as const,
			kind: "entry" as const,
			isStale: false,
			occurrences: [{ type: "metadata" as const, path: "itemIds", ordinal: 0 }],
		},
	],
	loading: false,
	refresh: vi.fn(),
};

/** A collection entry as the server reads it out: `metadata` holds its title, the kind it holds and its items. */
const collectionEntry = (id: string, metadata: Record<string, unknown>): EntryData => ({
	id,
	collection: "collection",
	status: "draft",
	version: 1,
	folderId: null,
	workingSlug: id,
	publishedSlug: null,
	working: { metadata, doc: emptyStoredDocument() },
});

/** The series the search finds; `api` keeps the requests. */
function stubApi() {
	const entries: Record<string, EntryData> = {
		c1: { ...collectionEntry("c1", { title: SERIES_A, itemIds: ["post-1"] }), workingSlug: "a" },
		c2: { ...collectionEntry("c2", { title: SERIES_B, itemIds: [] }), workingSlug: "b" },
	};
	return fakeApi()
		.on("GET /v1/entries/search", () => ({
			items: [
				{ id: "c1", title: SERIES_A, slug: "a", status: "draft" },
				{ id: "c2", title: SERIES_B, slug: "b", status: "draft" },
			],
		}))
		.on("GET /v1/entries/:id", ({ params }) => entries[params.id] ?? failure("not_found"))
		.install();
}

/** The input with its picks held the way the editor holds them; `set` records every change it asked for. */
function Picking({
	field: picked = field,
	targetId = "post-1",
	references = shared,
	initial,
	error,
	set,
}: {
	field?: BacklinkField;
	targetId?: string;
	references?: typeof shared;
	initial?: BacklinkChange;
	error?: string;
	set: (change: BacklinkChange | null) => void;
}) {
	const [change, setChange] = useState(initial);
	return (
		<BacklinkInput
			field={picked}
			targetId={targetId}
			disabled={false}
			shared={references}
			pick={{
				change,
				error,
				set: (next) => {
					set(next);
					setChange(next ?? undefined);
				},
			}}
		/>
	);
}

const enabledInput = async () => {
	const input = await screen.findByRole("combobox", { name: field.label });
	await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
	return input;
};

describe("adding to a collection (inverse relation)", () => {
	it("WRITE-W7 picking shows the series at once as an unsaved pick, and sends nothing", async () => {
		const api = stubApi();
		const set = vi.fn();
		render(<Picking set={set} />);
		const input = await enabledInput();
		fireEvent.input(input, { target: { value: SERIES_B }, inputType: "insertText" });
		fireEvent.click(await screen.findByRole("option", { name: SERIES_B }));
		expect(screen.getByText(SERIES_B)).toBeInTheDocument();
		expect(set).toHaveBeenLastCalledWith({ add: [{ id: "c2", title: SERIES_B }], remove: [] });
		expect(api.sent("PATCH /v1/entries/:id")).toHaveLength(0);
	});

	it("WRITE-W7 a pick the save could not write shows its reason below the input, not in a toast", async () => {
		stubApi();
		render(<Picking set={vi.fn()} error="실패" />);
		expect((await screen.findByRole("alert")).textContent).toBe("실패");
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("WRITE-W7 once the save wrote the picks, an input that reads its own usages reads them again", async () => {
		const api = stubApi().on("GET /v1/entries/:id/relations", () => ({ incomingReferences: shared.references }));
		const view = (change: BacklinkChange | undefined) => (
			<BacklinkInput
				field={field}
				targetId="post-1"
				disabled={false}
				pick={{ change, error: undefined, set: vi.fn() }}
			/>
		);
		const { rerender } = render(view({ add: [{ id: "c2", title: SERIES_B }], remove: [] }));
		expect(await screen.findByText(SERIES_B)).toBeInTheDocument();
		await waitFor(() => expect(api.sent("GET /v1/entries/:id/relations")).toHaveLength(1));
		rerender(view(undefined));
		await waitFor(() => expect(api.sent("GET /v1/entries/:id/relations")).toHaveLength(2));
	});
});

describe("adding a memo to a collection", () => {
	const memoField: BacklinkField = {
		kind: "backlink",
		label: "모음집",
		from: "collection",
		via: "memoIds",
		createInline: true,
	};
	const records: Record<string, { itemKind?: string; title: string }> = {
		c1: { title: "글 시리즈" },
		c2: { itemKind: "memo", title: "Type Challenges" },
		c3: { itemKind: "post", title: "다른 글 시리즈" },
	};
	let api: FakeApi;
	beforeEach(() => {
		api = fakeApi()
			.on("GET /v1/entries/search", () => ({
				items: Object.entries(records).map(([id, record]) => ({ id, title: record.title, slug: id, status: "draft" })),
			}))
			.on("GET /v1/entries/:id", ({ params }) => {
				const record = records[params.id];
				if (!record) return failure("not_found");
				const { title, itemKind } = record;
				return collectionEntry(params.id, { title, ...(itemKind ? { itemKind } : {}) });
			})
			.on("POST /v1/entries", ({ body }) => ({
				entry: { ...collectionEntry("c9", body.metadata), working: { metadata: body.metadata, doc: body.doc } },
				warnings: [],
			}))
			.install();
	});
	const openList = async (set = vi.fn()) => {
		render(<Picking field={memoField} targetId="memo-1" references={{ ...shared, references: [] }} set={set} />);
		const input = await enabledInput();
		fireEvent.mouseDown(input);
		return input;
	};

	it("WRITE-W7 only collections that hold memos can be picked", async () => {
		await openList();
		await waitFor(async () =>
			expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual(["Type Challenges"]),
		);
	});

	it("WRITE-W5 adding opens the add sheet for a memo-holding collection, creates it as that collection, and picks it", async () => {
		const set = vi.fn();
		const input = await openList(set);
		fireEvent.input(input, { target: { value: NEW_SERIES }, inputType: "insertText" });
		fireEvent.click(await screen.findByRole("option", { name: tEntries("relation.create", { label: NEW_SERIES }) }));
		// Does not create from the name alone; opens the add sheet with the name filled in.
		const panel = await screen.findByRole("dialog", {
			name: tScreens("list.add", { label: testSite.schemaOf("collection").label }),
		});
		expect(within(panel).getByDisplayValue(NEW_SERIES)).toBeInTheDocument();
		expect(api.sent("POST /v1/entries")).toHaveLength(0);
		fireEvent.click(within(panel).getByRole("button", { name: tCommon("save") }));
		await waitFor(() => expect(api.sent("POST /v1/entries").length).toBeGreaterThan(0));
		// The new series is made empty; putting the memo in it is a pick the memo's save writes.
		expect(api.sent("POST /v1/entries")[0]?.body).toMatchObject({
			collection: "collection",
			metadata: { title: NEW_SERIES, itemKind: "memo" },
			doc: emptyStoredDocument(),
		});
		expect(api.sent("POST /v1/entries")[0]?.body.metadata.memoIds).toBeUndefined();
		await waitFor(() => expect(set).toHaveBeenLastCalledWith({ add: [{ id: "c9", title: NEW_SERIES }], remove: [] }));
	});
});
