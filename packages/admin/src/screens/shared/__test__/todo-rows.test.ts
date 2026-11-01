import { describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { CmsIssue } from "../../../api/error-message";
import { publishReadinessMessages } from "../publish-readiness.messages";
import {
	doneLabels,
	groupIssues,
	imageNumbers,
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
	fieldLabel: (path) => ({ intro: "소개", cover: "대표 이미지" })[path],
	picks: (path) => path === "cover",
	imageNumber: (blockId) => ({ b1: 1, b2: 2 })[blockId],
	...over,
});

describe("grouping to-dos", () => {
	it("WRITE-P1 puts the images without alt text in one row that counts them", () => {
		const issues = [missing("intro", "소개"), noAlt("b1"), noAlt("b2")];
		expect(todoCount(issues)).toBe(2);
		const rows = todoRows(t, issues, () => {}, context());
		expect(rows.map((row) => row.title)).toEqual([
			t("field.write", { name: "소개" }),
			t("group.missing_image_alt", { count: 2 }),
		]);
	});

	it("WRITE-P1 says where each image is: the body and its number among the images", () => {
		const [row] = todoRows(t, [noAlt("b1"), noAlt("b2")], () => {}, context());
		expect(row?.detail).toBe(`${t("place.body", { number: 1 })} · ${t("place.body", { number: 2 })}`);
		const [unknown] = todoRows(t, [noAlt("gone")], () => {}, context());
		expect(unknown?.detail).toBe(t("place.bodyAny"));
	});

	it("WRITE-P1 keeps one row for each of the other problems, in the server's order", () => {
		const rows = todoRows(
			t,
			[
				issue({ code: "null_slug", path: "slug" }),
				issue({ code: "plugin_rule", text: "플러그인이 막았어요", path: "intro", where: "intro" }),
			],
			() => {},
			context(),
		);
		expect(rows.map((row) => row.title)).toEqual([t("issue.null_slug"), "플러그인이 막았어요"]);
		expect(rows[1]?.detail).toBe("intro");
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

	it("WRITE-P1 groups by a key that stays the same while the group has the same kind of problem", () => {
		const keys = (issues: CmsIssue[]) => groupIssues(issues).map((group) => group.key);
		expect(keys([noAlt("b1")])).toEqual(keys([noAlt("b1"), noAlt("b2")]));
		expect(keys([missing("intro", "소개")])).not.toEqual(keys([missing("cover", "대표")]));
	});
});

describe("image numbers", () => {
	it("WRITE-P1 numbers the images of the body in reading order, also inside other blocks", () => {
		const numbers = imageNumbers({
			type: "doc",
			version: 1,
			content: [
				{ type: "paragraph", content: [{ type: "image", id: "a", attrs: {} }] },
				{ type: "blockquote", content: [{ type: "image", id: "b", attrs: {} }] },
				{ type: "image", id: "c", attrs: {} },
			],
		} as never);
		expect([numbers("a"), numbers("b"), numbers("c"), numbers("zz")]).toEqual([1, 2, 3, undefined]);
	});
});

describe("done rows", () => {
	const rowsOf = (issues: CmsIssue[]) => todoRows(t, issues, () => {}, context());

	it("WRITE-P1 remembers a to-do that is gone, with what it was, and forgets it when it comes back", () => {
		const before = rowsOf([missing("intro", "소개"), noAlt("b1"), noAlt("b2")]);
		const afterFirst = trackResolved([], before, rowsOf([noAlt("b1"), noAlt("b2")]));
		expect(afterFirst.map((item) => item.label)).toEqual(["소개"]);
		const afterAll = trackResolved(afterFirst, rowsOf([noAlt("b1"), noAlt("b2")]), rowsOf([]));
		const twoImages = t("done.imageAlt", { count: 2 });
		expect(afterAll.map((item) => item.label)).toEqual(["소개", twoImages]);
		const back = trackResolved(afterAll, rowsOf([]), rowsOf([missing("intro", "소개")]));
		expect(back.map((item) => item.label)).toEqual([twoImages]);
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
});
