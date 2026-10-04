import type { Folder } from "@monti-cms/core/runtime";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseSelectOption } from "../../../test/base-ui";
import { renderWithQuery as render } from "../../../test/query";
import { BulkBar } from "../bulk-bar";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const selected = [{ id: "entry-1", expectedVersion: 3, title: "첫 글" }];
const folders: Folder[] = [
	{ id: "folder-1", collection: "post", parentId: null, name: "Folder One", position: 0, version: 1 },
];

function stubBulkApi(results: unknown[] = [{ id: "entry-1", ok: true, version: 4 }]) {
	const payloads: Record<string, unknown>[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.startsWith("/api/cms/v1/entries?")) {
				const items = url.includes("collection=tag") ? [{ id: "tag-1", title: "Tag One", slug: "tag-one" }] : [];
				return { ok: true, status: 200, json: async () => ({ items, total: items.length }) };
			}
			if (url === "/api/cms/v1/bulk") {
				payloads.push(JSON.parse(String(init?.body)));
				return { ok: true, status: 200, json: async () => ({ results }) };
			}
			throw new Error(`Unexpected fetch: ${url}`);
		}),
	);
	return payloads;
}

const choose = chooseSelectOption;

/** 일괄 작업은 모두 묻는다. 확인창의 질문을 확인하고 확인을 누른다. */
async function confirmIn(label: string, question: string) {
	const dialog = await screen.findByRole("alertdialog", { name: label });
	expect(within(dialog).getByText(question)).toBeTruthy();
	fireEvent.click(within(dialog).getByRole("button", { name: label }));
	await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
}

describe("bulk actions (§3.4)", () => {
	it("sends tag, category clear and root folder payloads", async () => {
		const payloads = stubBulkApi();
		render(
			<BulkBar collection="post" selected={selected} folders={folders} onClearSelection={vi.fn()} onDone={vi.fn()} />,
		);
		// 태그 목록을 불러온 뒤 작은 태그 버튼을 열어 체크 목록에서 고른다.
		await waitFor(() =>
			expect(
				(fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(([url]) =>
					String(url).includes("collection=tag"),
				),
			).toBe(true),
		);
		fireEvent.click(screen.getByRole("button", { name: "적용할 태그: 없음" }));
		fireEvent.click(await screen.findByRole("option", { name: "Tag One" }));
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "적용할 태그: Tag One" }).textContent).toBe("Tag One"),
		);
		fireEvent.keyDown(screen.getByPlaceholderText("태그 검색"), { key: "Escape" });
		await waitFor(() => expect(screen.queryByPlaceholderText("태그 검색")).toBeNull());
		fireEvent.click(screen.getByRole("button", { name: "태그 추가" }));
		await confirmIn("태그 추가", "선택한 글 1개에 'Tag One' 태그를 추가할까요?");
		await waitFor(() => expect(payloads).toHaveLength(1));
		expect(payloads[0]).toEqual({
			op: "relation.add",
			items: [{ id: "entry-1", expectedVersion: 3 }],
			field: "tagIds",
			ids: ["tag-1"],
		});

		await choose("일괄 작업 종류", "카테고리 바꾸기");
		await choose("대상 카테고리", "없음");
		fireEvent.click(screen.getByRole("button", { name: "카테고리 바꾸기" }));
		await confirmIn("카테고리 바꾸기", "선택한 글 1개의 카테고리를 비울까요?");
		await waitFor(() => expect(payloads).toHaveLength(2));
		expect(payloads[1]).toMatchObject({ op: "relation.set", field: "categoryId", id: null });

		await choose("일괄 작업 종류", "폴더로 이동");
		await choose("이동할 폴더", "최상위");
		fireEvent.click(screen.getByRole("button", { name: "폴더로 이동" }));
		await confirmIn("폴더로 이동", "선택한 항목 1개를 최상위로 이동할까요?");
		await waitFor(() => expect(payloads).toHaveLength(3));
		expect(payloads[2]).toMatchObject({ op: "folder.move", folderId: null });
	});

	it("asks before unarchiving in bulk", async () => {
		const payloads = stubBulkApi();
		render(
			<BulkBar collection="post" selected={selected} folders={folders} onClearSelection={vi.fn()} onDone={vi.fn()} />,
		);
		await choose("일괄 작업 종류", "보관 해제");
		fireEvent.click(screen.getByRole("button", { name: "보관 해제" }));
		await screen.findByRole("alertdialog", { name: "보관 해제" });
		expect(payloads).toHaveLength(0);
		await confirmIn(
			"보관 해제",
			"선택한 글 1개의 보관을 해제할까요? 초안으로 돌아가고 자동으로 다시 공개하지 않습니다.",
		);
		await waitFor(() => expect(payloads).toHaveLength(1));
		expect(payloads[0]).toEqual({ op: "unarchive", items: [{ id: "entry-1", expectedVersion: 3 }] });
	});

	it("keeps destructive actions behind a confirmation dialog", async () => {
		const payloads = stubBulkApi();
		render(
			<BulkBar collection="post" selected={selected} folders={folders} onClearSelection={vi.fn()} onDone={vi.fn()} />,
		);
		await choose("일괄 작업 종류", "휴지통으로 이동");
		fireEvent.click(screen.getByRole("button", { name: "휴지통으로 이동" }));
		await screen.findByRole("alertdialog", { name: /휴지통으로 이동/ });
		expect(payloads).toHaveLength(0);
		fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "휴지통으로 이동" }));
		await waitFor(() => expect(payloads).toHaveLength(1));
		expect(payloads[0]).toEqual({ op: "trash", items: [{ id: "entry-1", expectedVersion: 3 }] });
	});

	it("names failed items with their reason and validation issues", async () => {
		stubBulkApi([
			{
				id: "entry-1",
				ok: false,
				error: "publish_validation_failed",
				issues: [{ code: "missing_field", path: "categoryId", message: "카테고리" }],
			},
		]);
		const onDone = vi.fn();
		render(
			<BulkBar collection="post" selected={selected} folders={folders} onClearSelection={vi.fn()} onDone={onDone} />,
		);
		await choose("일괄 작업 종류", "발행");
		fireEvent.click(screen.getByRole("button", { name: "발행" }));
		fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "발행" }));
		expect(await screen.findByText(/첫 글/)).toBeTruthy();
		expect(screen.getByText(/카테고리를 입력하세요/)).toBeTruthy();
		expect(screen.getByRole("button", { name: "실패만 다시 실행" })).toBeTruthy();
		expect(onDone).toHaveBeenCalledWith(["entry-1"]);
	});

	it("offers only record-safe actions for record collections", async () => {
		stubBulkApi();
		render(<BulkBar collection="tag" selected={selected} folders={[]} onClearSelection={vi.fn()} onDone={vi.fn()} />);
		fireEvent.click(screen.getByRole("combobox", { name: "일괄 작업 종류" }));
		const labels = (await screen.findAllByRole("option")).map((option) => option.textContent);
		expect(labels).toEqual(["폴더로 이동", "휴지통으로 이동"]);
	});

	it("permanently deletes in bulk on the trash screen and names what still uses a blocked item (v2 A3)", async () => {
		const payloads = stubBulkApi([
			{
				id: "entry-1",
				ok: false,
				error: "in_use",
				usages: [{ entryId: "p1", title: "참조하는 글", collection: "post", state: "working" }],
			},
		]);
		render(
			<BulkBar
				collection="post"
				mode="trash"
				selected={selected}
				folders={[]}
				onClearSelection={vi.fn()}
				onDone={vi.fn()}
			/>,
		);
		expect(screen.queryByRole("combobox", { name: "일괄 작업 종류" })).toBeNull();
		expect(screen.queryByRole("button", { name: "일괄 실행" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "영구 삭제" }));
		await screen.findByRole("alertdialog", { name: /영구 삭제/ });
		fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "영구 삭제" }));
		await waitFor(() => expect(payloads).toHaveLength(1));
		expect(payloads[0]).toEqual({ op: "permanentDelete", items: [{ id: "entry-1", expectedVersion: 3 }] });
		expect(await screen.findByText(/사용 중: 참조하는 글/)).toBeTruthy();
	});
});
