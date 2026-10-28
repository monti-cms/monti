import { describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import type { CmsIssue } from "../../../api/error-message";
import { publishReadinessMessages } from "../publish-readiness.messages";
import { doneLabels, requiredFields, todoRows } from "../todo-rows";

const t = testSite.createTranslator(publishReadinessMessages);

const issue = (over: Partial<CmsIssue>): CmsIssue => ({ text: "서버 문구", ...over });

describe("to-do rows", () => {
	it("words a problem the dictionary knows as a to-do and keeps the server's text for one it does not know", () => {
		const rows = todoRows(
			t,
			[
				issue({ code: "missing_image_alt", path: "body", position: { blockId: "b1" } }),
				issue({ code: "plugin_rule", text: "플러그인이 막았어요", path: "summary", where: "summary" }),
			],
			() => {},
		);
		expect(rows.map((row) => row.title)).toEqual(["이미지에 설명(alt)이 필요해요", "플러그인이 막았어요"]);
		expect(rows[1]?.detail).toBe("summary");
	});

	it("names the thing a problem is about", () => {
		const [row] = todoRows(t, [issue({ code: "code_ref_broken", message: "foo", path: "body" })], () => {});
		expect(row?.title).toContain("`foo`");
	});

	it("goes to the place only for a problem that has one", () => {
		const focus = vi.fn();
		const placed = issue({ code: "missing_field", path: "title", message: "제목" });
		const unplaced = issue({ code: "plugin_rule", text: "어디에도 없음" });
		const rows = todoRows(t, [placed, unplaced], focus);
		rows[0]?.onOpen?.();
		expect(focus).toHaveBeenCalledWith(placed);
		expect(rows[1]?.onOpen).toBeUndefined();
	});
});

describe("done labels", () => {
	const required = [
		{ name: "title", label: "제목" },
		{ name: "slug", label: "주소" },
		{ name: "cover", label: "대표 이미지" },
	];

	it("lists the required fields that have no problem", () => {
		expect(doneLabels(required, [issue({ code: "missing_field", path: "cover", message: "대표 이미지" })])).toEqual([
			"제목",
			"주소",
		]);
	});

	it("lists every required field when nothing is left to fix", () => {
		expect(doneLabels(required, [])).toEqual(["제목", "주소", "대표 이미지"]);
	});
});

describe("required fields", () => {
	const site = {
		isCollection: () => true,
		titleField: () => ({ name: "title" }),
		schemaOf: () => ({
			fields: {
				title: { kind: "text", label: "제목", localized: true },
				slug: { kind: "slug", label: "주소", required: true },
				summary: { kind: "text", label: "요약", localized: true, required: true },
				note: { kind: "text", label: "메모" },
			},
		}),
	} as unknown as Parameters<typeof requiredFields>[0];

	it("lists the title, which is always required, and the fields marked required", () => {
		expect(requiredFields(site, "post", false)).toEqual([
			{ name: "title", label: "제목" },
			{ name: "slug", label: "주소" },
			{ name: "summary", label: "요약" },
		]);
	});

	it("keeps only the per-language fields for a translation", () => {
		expect(requiredFields(site, "post", true).map((field) => field.name)).toEqual(["title", "summary"]);
	});
});
