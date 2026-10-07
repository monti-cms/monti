import type { BacklinkField } from "@monti-cms/core/client";
import { emptyStoredDocument } from "@monti-cms/core/document";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithSite as render } from "../../__test__/site-wrapper";
import { BacklinkInput } from "../field-inputs";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

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

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

/** Holds the save of collection `c2` until it is released with `release`. */
function stubApi(patchStatus: number) {
	let release: () => void = () => {};
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.startsWith("/api/cms/v1/entries?")) {
				return json({
					items: [
						{ id: "c1", title: "시리즈 A", slug: "a" },
						{ id: "c2", title: "시리즈 B", slug: "b" },
					],
					total: 2,
				});
			}
			// Reads the kind each collection holds (default is post).
			if (url === "/api/cms/v1/entries/c1" && !init?.method) {
				return json({
					version: 1,
					workingSlug: "a",
					working: { metadata: { title: "시리즈 A", itemIds: ["post-1"] } },
				});
			}
			if (url === "/api/cms/v1/entries/c2" && !init?.method) {
				return json({ version: 1, workingSlug: "b", working: { metadata: { title: "시리즈 B", itemIds: [] } } });
			}
			if (url === "/api/cms/v1/entries/c2" && init?.method === "PATCH") {
				await held;
				return patchStatus < 400 ? json({ version: 2 }) : json({ code: "internal", message: "실패" }, patchStatus);
			}
			throw new Error(`Unexpected fetch: ${url}`);
		}),
	);
	return () => release();
}

const addSeriesB = async () => {
	render(<BacklinkInput field={field} targetId="post-1" disabled={false} shared={shared} />);
	const input = await screen.findByRole("combobox", { name: "모음집" });
	await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
	fireEvent.input(input, { target: { value: "시리즈 B" }, inputType: "insertText" });
	fireEvent.click(await screen.findByRole("option", { name: "시리즈 B" }));
};

describe("adding to a collection (inverse relation)", () => {
	it("picking shows it right away without waiting for the save", async () => {
		const release = stubApi(200);
		await addSeriesB();
		expect(screen.getByText("시리즈 B")).toBeTruthy();
		release();
		await waitFor(() => expect(shared.refresh).toHaveBeenCalled());
		expect(screen.queryByRole("alert")).toBeNull();
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("if the save fails, reports below the input and reverts", async () => {
		const release = stubApi(500);
		await addSeriesB();
		expect(screen.getByText("시리즈 B")).toBeTruthy();
		release();
		// Reports right below the input like other relation inputs (not a toast).
		expect((await screen.findByRole("alert")).textContent).toBe("실패");
		expect(toast.error).not.toHaveBeenCalled();
		await waitFor(() => expect(screen.queryByText("시리즈 B")).toBeNull());
		expect(screen.getByText("시리즈 A")).toBeTruthy();
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
	let fetchMock: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.startsWith("/api/cms/v1/entries?"))
				return json({
					items: Object.entries(records).map(([id, record]) => ({ id, title: record.title, slug: id })),
					total: 3,
				});
			const id = url.match(/^\/api\/cms\/v1\/entries\/(c\d)$/)?.[1];
			if (id && !init?.method) {
				const { title, itemKind } = records[id] as { title: string; itemKind?: string };
				return json({
					version: 1,
					workingSlug: id,
					working: { metadata: { title, ...(itemKind ? { itemKind } : {}) } },
				});
			}
			if (url === "/api/cms/v1/entries" && init?.method === "POST") return json({ id: "c9" }, 201);
			throw new Error(`Unexpected fetch: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);
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

	it("only collections that hold memos can be picked", async () => {
		await openList();
		await waitFor(async () =>
			expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual(["Type Challenges"]),
		);
	});

	it("adding opens the add sheet for a memo-holding collection, and saving creates it as that collection", async () => {
		const input = await openList();
		fireEvent.input(input, { target: { value: "새 메모 시리즈" }, inputType: "insertText" });
		fireEvent.click(await screen.findByRole("option", { name: "'새 메모 시리즈' 추가" }));
		// Does not create from the name alone; opens the add sheet with the name filled in.
		const panel = await screen.findByRole("complementary", { name: "모음집 추가" });
		expect(within(panel).getByDisplayValue("새 메모 시리즈")).toBeTruthy();
		expect(fetchMock.mock.calls.some(([url, init]) => url === "/api/cms/v1/entries" && init?.method === "POST")).toBe(
			false,
		);
		fireEvent.click(within(panel).getByRole("button", { name: "저장" }));
		await waitFor(() =>
			expect(fetchMock.mock.calls.some(([url, init]) => url === "/api/cms/v1/entries" && init?.method === "POST")).toBe(
				true,
			),
		);
		const post = fetchMock.mock.calls.find(([url, init]) => url === "/api/cms/v1/entries" && init?.method === "POST");
		expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
			collection: "collection",
			metadata: { title: "새 메모 시리즈", itemKind: "memo", memoIds: ["memo-1"] },
			doc: emptyStoredDocument(),
		});
	});
});
