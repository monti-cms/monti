import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { filterChipsOf, filterRowsOf, rowMatches } from "../list-filter-model";
import { parseListState } from "../list-state";

const stateOf = (query: string) => parseListState(testSite, new URLSearchParams(query));
const labelsOf = (rows: { label: string }[]) => rows.map((row) => row.label);

describe("the first level of the filter menu", () => {
	it("lists language, translation and date, then the fields in schema order", () => {
		const { top, fields } = filterRowsOf(testSite, "post");
		expect(top.map((row) => row.kind)).toEqual(["locale", "translation", "date"]);
		expect(labelsOf(fields).slice(0, 5)).toEqual(["요약", "카테고리", "태그", "정책", "대체 글"]);
	});

	it("has no language or translation row for an item collection, only a date", () => {
		expect(filterRowsOf(testSite, "tag").top.map((row) => row.kind)).toEqual(["date"]);
	});

	it("has no language or translation row when the translation screens are off", () => {
		const off = Object.create(testSite, { ADMIN_TRANSLATIONS: { value: false } });
		expect(filterRowsOf(off, "post").top.map((row) => row.kind)).toEqual(["date"]);
	});

	it("has no row for the folder: the sidebar filters by folder", () => {
		const all = [...filterRowsOf(testSite, "post").top, ...filterRowsOf(testSite, "post").fields];
		expect(labelsOf(all)).not.toContain("폴더");
	});
});

describe("finding a filter", () => {
	const { top, fields } = filterRowsOf(testSite, "post");
	const row = (label: string) =>
		[...top, ...fields].find((candidate) => candidate.label === label) as (typeof top)[number];

	it("matches a field by its name, ignoring case and the spaces around", () => {
		expect(rowMatches(row("태그"), " 태 ")).toBe(true);
		expect(rowMatches(row("태그"), "요약")).toBe(false);
		expect(rowMatches(row("태그"), "")).toBe(true);
	});

	it("matches a select by the options it offers", () => {
		expect(rowMatches(row("정책"), "지원 중단")).toBe(true);
		expect(rowMatches(row("요약"), "지원 중단")).toBe(false);
	});
});

describe("the chips of the filters that are on", () => {
	const titles = new Map([["t1", "리액트"]]);
	const chips = (query: string) =>
		filterChipsOf(testSite, stateOf(query), titles, new Date("2026-10-28T03:00:00Z")).map((chip) => [
			chip.key,
			chip.label,
		]);

	it("name the field and its values", () => {
		expect(chips("collection=post&field=tagIds:empty&field=tagIds:is:t1")).toEqual([
			["field:tagIds", "태그: 없음, 리액트"],
		]);
		expect(chips("collection=post&field=summary:filled")).toEqual([["field:summary", "요약: 채워짐"]]);
		expect(chips("collection=post&field=policy:is:deprecated")).toEqual([["field:policy", "정책: 지원 중단"]]);
	});

	it("say a missing item as … until the server has told its name", () => {
		expect(chips("collection=post&field=tagIds:is:unknown")).toEqual([["field:tagIds", "태그: …"]]);
	});

	it("name the translation, language and dates", () => {
		const names = chips("collection=post&translation=changed&updated=last30&published=2026-03-01..2026-03-05").map(
			([, label]) => label,
		);
		expect(names).toEqual(["번역: 원문 바뀜", "수정한 날: 최근 30일", "발행한 날: 03. 01 – 03. 05"]);
	});

	it("each take only their own filter off", () => {
		const state = stateOf("collection=post&field=tagIds:empty&field=summary:filled&translation=none");
		const all = filterChipsOf(testSite, state, titles);
		const tags = all.find((chip) => chip.key === "field:tagIds");
		expect({ ...state, ...tags?.clear }.fields).toEqual({ summary: [{ kind: "filled" }] });
		const translation = all.find((chip) => chip.key === "translation");
		expect({ ...state, ...translation?.clear }.translations).toEqual([]);
	});

	it("are none when nothing is filtered, and the search is not a chip", () => {
		expect(chips("collection=post&search=리액트")).toEqual([]);
	});
});
