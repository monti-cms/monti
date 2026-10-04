import { isCollection, type RelationField, schemaOf } from "@monti-cms/core/client";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_FORM } from "../entry-form";
import { EntryPicker, type FieldInputProps, OrderedEntryList } from "../field-inputs";
import { t } from "../translate";

/** 관계 대상(`post`)의 이름표. 입력 안내가 대상 컬렉션 이름표를 쓴다(설정에 없으면 컬렉션 이름). */
const TARGET = isCollection("post") ? schemaOf("post").label : "post";

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

const POSTS = [
	{ id: "p1", title: "첫 글", status: "published" },
	{ id: "p2", title: "둘째 글", status: "draft" },
	{ id: "p3", title: "셋째 글", status: "published" },
	{ id: "self", title: "지금 글", status: "published" },
];

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(String(input), "http://localhost");
			if (url.pathname === "/api/cms/v1/entries") return json({ items: POSTS, total: POSTS.length });
			const one = POSTS.find((post) => url.pathname === `/api/cms/v1/entries/${post.id}`);
			if (one) return json({ status: one.status, working: { metadata: { title: one.title } } });
			throw new Error(`Unexpected fetch ${url}`);
		}),
	);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const props = (field: RelationField, value: FieldInputProps["value"], onChange = vi.fn()): FieldInputProps => ({
	collection: "post",
	form: EMPTY_FORM,
	name: "rel",
	field,
	id: "rel",
	value,
	invalid: false,
	context: { entryId: "self", disabled: false },
	onChange,
});
const openList = async (name: string) => {
	const input = await screen.findByRole("combobox", { name });
	// Base UI는 입력칸을 누르는 순간(mousedown) 목록을 연다.
	await waitFor(() => expect((input as HTMLInputElement).disabled).toBe(false));
	fireEvent.mouseDown(input);
	return input;
};
const optionNames = async () => (await screen.findAllByRole("option")).map((option) => option.textContent);

describe("대체 글(한 개 관계)", () => {
	const field: RelationField = { kind: "relation", label: "최신 글", to: "post" };

	it("누르면 자기 자신을 뺀 전체 글 목록이 열리고, 고르면 그 ID로 바뀐다", async () => {
		const onChange = vi.fn();
		render(<EntryPicker {...props(field, null, onChange)} />);
		await openList("최신 글");

		await waitFor(async () =>
			expect(await optionNames()).toEqual(["첫 글", `둘째 글${t("entry.unpublished")}`, "셋째 글"]),
		);
		fireEvent.click(screen.getByRole("option", { name: "셋째 글" }));
		expect(onChange).toHaveBeenCalledWith("p3");
	});

	it("고른 글의 제목을 보인다", async () => {
		render(<EntryPicker {...props(field, "p1")} />);
		await waitFor(() =>
			expect((screen.getByRole("combobox", { name: "최신 글" }) as HTMLInputElement).value).toBe("첫 글"),
		);
	});
});

describe("모음집 글 목록(순서 있는 여러 개 관계)", () => {
	const field: RelationField = { kind: "relation", label: "게시글", to: "post", many: true, ordered: true };

	it("담긴 순서대로 번호와 제목을 보이고 비공개 글은 알린다", async () => {
		render(<OrderedEntryList {...props(field, ["p3", "p2"])} />);
		const list = await screen.findByRole("list", { name: t("entry.listAria", { target: TARGET }) });
		await waitFor(() =>
			expect(
				within(list)
					.getAllByRole("listitem")
					.map((item) => item.textContent),
			).toEqual([expect.stringContaining("1. 셋째 글"), expect.stringContaining("2. 둘째 글")]),
		);
		expect(within(list).getByText(t("entry.unpublished").trim())).toBeTruthy();
	});

	it("글 추가·빼기 목록에서 체크하면 끝에 넣고, 체크를 풀면 뺀다", async () => {
		const onChange = vi.fn();
		const { rerender } = render(<OrderedEntryList {...props(field, ["p3"], onChange)} />);
		await openList(t("entry.editList", { target: TARGET }));
		fireEvent.click(await screen.findByRole("option", { name: "첫 글" }));
		expect(onChange).toHaveBeenLastCalledWith(["p3", "p1"]);

		rerender(<OrderedEntryList {...props(field, ["p3", "p1"], onChange)} />);
		fireEvent.click(await screen.findByRole("option", { name: "셋째 글" }));
		expect(onChange).toHaveBeenLastCalledWith(["p1"]);
	});

	it("위로·아래로·빼기 버튼으로 순서와 목록을 바꾼다", async () => {
		const onChange = vi.fn();
		render(<OrderedEntryList {...props(field, ["p1", "p2", "p3"], onChange)} />);
		fireEvent.click(await screen.findByRole("button", { name: t("entry.up", { title: "셋째 글" }) }));
		expect(onChange).toHaveBeenLastCalledWith(["p1", "p3", "p2"]);
		fireEvent.click(screen.getByRole("button", { name: t("entry.remove", { title: "첫 글" }) }));
		expect(onChange).toHaveBeenLastCalledWith(["p2", "p3"]);
	});

	it("끌어서 옮기는 손잡이가 항목마다 있다", async () => {
		render(<OrderedEntryList {...props(field, ["p1", "p2"])} />);
		expect(await screen.findByRole("button", { name: t("entry.drag", { title: "첫 글" }) })).toBeTruthy();
		expect(screen.getByRole("button", { name: t("entry.drag", { title: "둘째 글" }) })).toBeTruthy();
	});
});
