import { describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { CmsIssue } from "../../../api/error-message";
import { publishReadinessMessages } from "../publish-readiness.messages";
import {
	doneLabels,
	groupIssues,
	imageNumbers,
	requiredFields,
	type TodoContext,
	todoCount,
	todoRows,
	trackResolved,
} from "../todo-rows";

const t = testSite.createTranslator(publishReadinessMessages);

const issue = (over: Partial<CmsIssue>): CmsIssue => ({ text: "서버 문구", ...over });
const noAlt = (blockId: string) => issue({ code: "missing_image_alt", path: "body", position: { blockId } });
const missing = (path: string, message: string) => issue({ code: "missing_field", path, message });

const context = (over: Partial<TodoContext> = {}): TodoContext => ({
	fieldLabel: (path) => ({ summary: "요약", cover: "대표 이미지" })[path],
	picks: (path) => path === "cover",
	imageNumber: (blockId) => ({ b1: 1, b2: 2 })[blockId],
	...over,
});

describe("grouping to-dos", () => {
	it("WRITE-P1 puts the images without alt text in one row that counts them", () => {
		const issues = [missing("summary", "요약"), noAlt("b1"), noAlt("b2")];
		expect(todoCount(issues)).toBe(2);
		const rows = todoRows(t, issues, () => {}, context());
		expect(rows.map((row) => row.title)).toEqual(["요약 쓰기", "대체 텍스트 없는 이미지 2개"]);
	});

	it("WRITE-P1 says where each image is: the body and its number among the images", () => {
		const [row] = todoRows(t, [noAlt("b1"), noAlt("b2")], () => {}, context());
		expect(row?.detail).toBe("본문 1 · 본문 2");
		const [unknown] = todoRows(t, [noAlt("gone")], () => {}, context());
		expect(unknown?.detail).toBe("본문");
	});

	it("words an empty field with its name, and picks instead of writing for a field that is chosen", () => {
		const rows = todoRows(t, [missing("summary", "요약"), missing("cover", "대표 이미지")], () => {}, context());
		expect(rows.map((row) => [row.title, row.detail])).toEqual([
			["요약 쓰기", "요약 · 비어 있음"],
			["대표 이미지 고르기", "대표 이미지 · 비어 있음"],
		]);
	});

	it("WRITE-P1 keeps one row for each of the other problems, in the server's order", () => {
		const rows = todoRows(
			t,
			[
				issue({ code: "null_slug", path: "slug" }),
				issue({ code: "plugin_rule", text: "플러그인이 막았어요", path: "summary", where: "summary" }),
			],
			() => {},
			context(),
		);
		expect(rows.map((row) => row.title)).toEqual(["주소(slug)를 입력해 주세요", "플러그인이 막았어요"]);
		expect(rows[1]?.detail).toBe("summary");
	});

	it("WRITE-P1 goes to the first place of a group, and only for a problem that has one", () => {
		const focus = vi.fn();
		const first = noAlt("b1");
		const rows = todoRows(
			t,
			[first, noAlt("b2"), issue({ code: "plugin_rule", text: "어디에도 없음" })],
			focus,
			context(),
		);
		rows[0]?.onOpen?.();
		expect(focus).toHaveBeenCalledWith(first);
		expect(rows[1]?.onOpen).toBeUndefined();
	});

	it("names the thing a problem is about", () => {
		const [row] = todoRows(t, [issue({ code: "code_ref_broken", message: "foo", path: "body" })], () => {}, context());
		expect(row?.title).toContain("`foo`");
	});

	it("groups by a key that stays the same while the group has the same kind of problem", () => {
		const keys = (issues: CmsIssue[]) => groupIssues(issues).map((group) => group.key);
		expect(keys([noAlt("b1")])).toEqual(keys([noAlt("b1"), noAlt("b2")]));
		expect(keys([missing("summary", "요약")])).not.toEqual(keys([missing("cover", "대표")]));
	});
});

describe("image numbers", () => {
	it("WRITE-P1 numbers the images of the body in reading order, also inside other blocks", () => {
		const numbers = imageNumbers({
			type: "doc",
			version: 1,
			content: [
				{ type: "paragraph", content: [{ type: "image", id: "a", attrs: {} }] },
				{ type: "callout", content: [{ type: "image", id: "b", attrs: {} }] },
				{ type: "image", id: "c", attrs: {} },
			],
		} as never);
		expect([numbers("a"), numbers("b"), numbers("c"), numbers("zz")]).toEqual([1, 2, 3, undefined]);
	});
});

describe("done rows", () => {
	const rowsOf = (issues: CmsIssue[]) => todoRows(t, issues, () => {}, context());

	it("WRITE-P1 remembers a to-do that is gone, with what it was, and forgets it when it comes back", () => {
		const before = rowsOf([missing("summary", "요약"), noAlt("b1"), noAlt("b2")]);
		const afterFirst = trackResolved([], before, rowsOf([noAlt("b1"), noAlt("b2")]));
		expect(afterFirst.map((item) => item.label)).toEqual(["요약"]);
		const afterAll = trackResolved(afterFirst, rowsOf([noAlt("b1"), noAlt("b2")]), rowsOf([]));
		expect(afterAll.map((item) => item.label)).toEqual(["요약", "이미지 대체 텍스트 2개"]);
		const back = trackResolved(afterAll, rowsOf([]), rowsOf([missing("summary", "요약")]));
		expect(back.map((item) => item.label)).toEqual(["이미지 대체 텍스트 2개"]);
	});

	it("does not remember a problem that has no name to put under a check", () => {
		const plugin = issue({ code: "plugin_rule", text: "플러그인" });
		expect(trackResolved([], rowsOf([plugin]), rowsOf([]))).toEqual([]);
	});
});

describe("done labels", () => {
	const required = [
		{ name: "title", label: "제목" },
		{ name: "slug", label: "주소" },
		{ name: "cover", label: "대표 이미지" },
	];

	it("WRITE-P1 lists the required fields that have no problem", () => {
		expect(doneLabels(required, [missing("cover", "대표 이미지")])).toEqual(["제목", "주소"]);
	});

	it("lists every required field when nothing is left to fix", () => {
		expect(doneLabels(required, [])).toEqual(["제목", "주소", "대표 이미지"]);
	});

	it("leaves out the fields that have their own row because they were fixed just now", () => {
		expect(doneLabels(required, [], ["대표 이미지"])).toEqual(["제목", "주소"]);
	});
});

describe("required fields", () => {
	const field = (name: string, order: number, label?: string) => ({ name, label, slug: false, order });
	/** The schema of a note with a `kind` that shows an address for a link, and a blurb for a text. */
	const site = {
		isCollection: () => true,
		requiredFieldsOf: (
			_collection: string,
			metadata: Record<string, unknown>,
			options?: { localizedOnly?: boolean },
		) => [
			{ ...field("slug", 1, "주소"), slug: true },
			field("title", 0, "제목"),
			...(metadata.kind === "link" ? [field("url", 2, "링크 주소")] : []),
			...(options?.localizedOnly ? [] : [field("categoryId", 3, "카테고리")]),
		],
	} as unknown as Parameters<typeof requiredFields>[0];

	it("lists the required fields in the order of the form", () => {
		expect(requiredFields(site, "note", false, {}).map((item) => item.label)).toEqual(["제목", "주소", "카테고리"]);
	});

	it("names a field of a conditional group when its condition is met and it has no problem", () => {
		const required = requiredFields(site, "note", false, { kind: "link" });
		expect(doneLabels(required, [])).toContain("링크 주소");
	});

	it("leaves out a field whose condition is not met", () => {
		const required = requiredFields(site, "note", false, { kind: "text" });
		expect(doneLabels(required, [])).not.toContain("링크 주소");
	});

	it("asks the check only for the fields written per language when the entry is a translation", () => {
		expect(requiredFields(site, "note", true, {}).map((item) => item.name)).toEqual(["title", "slug"]);
	});
});
