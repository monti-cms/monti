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
			sourceTitle: "시리즈 A",
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
		c1: { ...collectionEntry("c1", { title: "시리즈 A", itemIds: ["post-1"] }), workingSlug: "a" },
		c2: { ...collectionEntry("c2", { title: "시리즈 B", itemIds: [] }), workingSlug: "b" },
	};
	return fakeApi()
		.on("GET /v1/entries/search", () => ({
			items: [
				{ id: "c1", title: "시리즈 A", slug: "a", status: "draft" },
				{ id: "c2", title: "시리즈 B", slug: "b", status: "draft" },
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
	const input = await screen.findByRole("combobox", { name: "모음집" });
	await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
	return input;
};

describe("adding to a collection (inverse relation)", () => {
	it("WRITE-W7 picking shows the series at once as an unsaved pick, and sends nothing", async () => {
		const api = stubApi();
		const set = vi.fn();
		render(<Picking set={set} />);
		const input = await enabledInput();
		fireEvent.input(input, { target: { value: "시리즈 B" }, inputType: "insertText" });
		fireEvent.click(await screen.findByRole("option", { name: "시리즈 B" }));
		expect(screen.getByText("시리즈 B")).toBeInTheDocument();
		expect(set).toHaveBeenLastCalledWith({ add: [{ id: "c2", title: "시리즈 B" }], remove: [] });
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
		const { rerender } = render(view({ add: [{ id: "c2", title: "시리즈 B" }], remove: [] }));
		expect(await screen.findByText("시리즈 B")).toBeInTheDocument();
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
		fireEvent.input(input, { target: { value: "새 메모 시리즈" }, inputType: "insertText" });
		fireEvent.click(
			await screen.findByRole("option", { name: tEntries("relation.create", { label: "새 메모 시리즈" }) }),
		);
		// Does not create from the name alone; opens the add sheet with the name filled in.
		const panel = await screen.findByRole("dialog", {
			name: tScreens("list.add", { label: testSite.schemaOf("collection").label }),
		});
		expect(within(panel).getByDisplayValue("새 메모 시리즈")).toBeInTheDocument();
		expect(api.sent("POST /v1/entries")).toHaveLength(0);
		fireEvent.click(within(panel).getByRole("button", { name: tCommon("save") }));
		await waitFor(() => expect(api.sent("POST /v1/entries").length).toBeGreaterThan(0));
		// The new series is made empty; putting the memo in it is a pick the memo's save writes.
		expect(api.sent("POST /v1/entries")[0]?.body).toMatchObject({
			collection: "collection",
			metadata: { title: "새 메모 시리즈", itemKind: "memo" },
			doc: emptyStoredDocument(),
		});
		expect(api.sent("POST /v1/entries")[0]?.body.metadata.memoIds).toBeUndefined();
		await waitFor(() =>
			expect(set).toHaveBeenLastCalledWith({ add: [{ id: "c9", title: "새 메모 시리즈" }], remove: [] }),
		);
	});
});
