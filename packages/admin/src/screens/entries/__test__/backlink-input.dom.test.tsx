import type { BacklinkField } from "@monti-cms/core";
import { emptyStoredDocument } from "@monti-cms/core/document";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { commonMessages } from "../../../lib/common.messages";
import { type FakeApi, failure, fakeApi } from "../../../test/fake-api";
import { renderWithSite as render } from "../../../test/site";
import { toast } from "../../../test/ui-toast";
import { screensMessages } from "../../messages";
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

/** Holds the save of collection `c2` until it is released with `release`; `api` keeps the requests. */
function stubApi(patchStatus: number) {
	let release: () => void = () => {};
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	// Reads the kind each collection holds (default is post).
	const entries: Record<string, EntryData> = {
		c1: { ...collectionEntry("c1", { title: "시리즈 A", itemIds: ["post-1"] }), workingSlug: "a" },
		c2: { ...collectionEntry("c2", { title: "시리즈 B", itemIds: [] }), workingSlug: "b" },
	};
	const api = fakeApi()
		.on("GET /v1/entries/search", () => ({
			items: [
				{ id: "c1", title: "시리즈 A", slug: "a", status: "draft" },
				{ id: "c2", title: "시리즈 B", slug: "b", status: "draft" },
			],
		}))
		.on("GET /v1/entries/:id", ({ params }) => entries[params.id] ?? failure("not_found"))
		.on("PATCH /v1/entries/:id", async ({ params, body }) => {
			if (params.id !== "c2") return failure("not_found");
			await held;
			const saved = entries.c2 as EntryData;
			return patchStatus < 400
				? { entry: { ...saved, version: 2, working: { ...saved.working, metadata: body.metadata } }, warnings: [] }
				: failure("internal_error", "실패");
		})
		.install();
	return { release: () => release(), api };
}

const addSeriesB = async () => {
	render(<BacklinkInput field={field} targetId="post-1" disabled={false} shared={shared} />);
	const input = await screen.findByRole("combobox", { name: "모음집" });
	await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
	fireEvent.input(input, { target: { value: "시리즈 B" }, inputType: "insertText" });
	fireEvent.click(await screen.findByRole("option", { name: "시리즈 B" }));
};

describe("adding to a collection (inverse relation)", () => {
	it("WRITE-W7 picking shows it right away without waiting for the save", async () => {
		const { release, api } = stubApi(200);
		await addSeriesB();
		expect(screen.getByText("시리즈 B")).toBeInTheDocument();
		// The pick saves series B with this post among its items, before the save answers.
		await waitFor(() => expect(api.sent("PATCH /v1/entries/:id")).toHaveLength(1));
		const [save] = api.sent("PATCH /v1/entries/:id");
		expect(save?.params.id).toBe("c2");
		expect(save?.body.metadata.itemIds).toEqual(["post-1"]);
		release();
		await waitFor(() => expect(shared.refresh).toHaveBeenCalled());
		expect(screen.queryByRole("alert")).toBeNull();
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("WRITE-W7 if the save fails, reports below the input and reverts", async () => {
		const { release } = stubApi(500);
		await addSeriesB();
		expect(screen.getByText("시리즈 B")).toBeInTheDocument();
		release();
		// Reports right below the input like other relation inputs (not a toast).
		expect((await screen.findByRole("alert")).textContent).toBe("실패");
		expect(toast.error).not.toHaveBeenCalled();
		await waitFor(() => expect(screen.queryByText("시리즈 B")).toBeNull());
		expect(screen.getByText("시리즈 A")).toBeInTheDocument();
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
	const openList = async () => {
		render(
			<BacklinkInput field={memoField} targetId="memo-1" disabled={false} shared={{ ...shared, references: [] }} />,
		);
		const input = await screen.findByRole("combobox", { name: "모음집" });
		await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
		fireEvent.mouseDown(input);
		return input;
	};

	it("WRITE-W7 only collections that hold memos can be picked", async () => {
		await openList();
		await waitFor(async () =>
			expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual(["Type Challenges"]),
		);
	});

	it("WRITE-W5 adding opens the add sheet for a memo-holding collection, and saving creates it as that collection", async () => {
		const input = await openList();
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
		expect(api.sent("POST /v1/entries")[0]?.body).toMatchObject({
			collection: "collection",
			metadata: { title: "새 메모 시리즈", itemKind: "memo", memoIds: ["memo-1"] },
			doc: emptyStoredDocument(),
		});
	});
});
