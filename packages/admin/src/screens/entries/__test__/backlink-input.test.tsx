import type { BacklinkField } from "@monti-cms/core/client";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

/** 모음집 `c2`의 저장을 `release`로 풀기 전까지 붙잡아 둔다. */
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
			// 모음집마다 담는 종류를 읽는다(기본은 게시글).
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

describe("모음집 넣기(반대 방향 관계)", () => {
	it("고르면 저장을 기다리지 않고 바로 보인다", async () => {
		const release = stubApi(200);
		await addSeriesB();
		expect(screen.getByText("시리즈 B")).toBeTruthy();
		release();
		await waitFor(() => expect(shared.refresh).toHaveBeenCalled());
		expect(screen.queryByRole("alert")).toBeNull();
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("저장이 실패하면 입력 아래에 알리고 되돌린다", async () => {
		const release = stubApi(500);
		await addSeriesB();
		expect(screen.getByText("시리즈 B")).toBeTruthy();
		release();
		// 다른 관계 입력처럼 입력 바로 아래에 알린다(토스트가 아니다).
		expect((await screen.findByRole("alert")).textContent).toBe("실패");
		expect(toast.error).not.toHaveBeenCalled();
		await waitFor(() => expect(screen.queryByText("시리즈 B")).toBeNull());
		expect(screen.getByText("시리즈 A")).toBeTruthy();
	});
});

describe("메모의 모음집 넣기", () => {
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

	it("메모를 담는 모음집만 고를 수 있다", async () => {
		await openList();
		await waitFor(async () =>
			expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual(["Type Challenges"]),
		);
	});

	it("추가하면 메모를 담은 모음집 추가 칸을 열고, 저장하면 그 모음집으로 만든다", async () => {
		const input = await openList();
		fireEvent.input(input, { target: { value: "새 메모 시리즈" }, inputType: "insertText" });
		fireEvent.click(await screen.findByRole("option", { name: "'새 메모 시리즈' 추가" }));
		// 이름만으로 바로 만들지 않고, 이름이 채워진 추가 칸을 연다.
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
			mdx: "",
		});
	});
});
