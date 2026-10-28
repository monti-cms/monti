import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { filterChipsOf } from "../list-filter-model";
import { parseListState } from "../list-state";

const stateOf = (query: string) => parseListState(testSite, new URLSearchParams(query));
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
		expect(chips("collection=post&field=summary:empty")).toEqual([["field:summary", "요약 비어 있음"]]);
		expect(chips("collection=post&field=policy:is:deprecated")).toEqual([["field:policy", "정책: 지원 중단"]]);
	});

	it("say a missing item as … until the server has told its name", () => {
		expect(chips("collection=post&field=tagIds:is:unknown")).toEqual([["field:tagIds", "태그: …"]]);
	});

	it("name the status with its values in the order of the status menu, whatever order they were ticked in", () => {
		expect(chips("collection=post&status=draft&status=editing")).toEqual([["status", "상태: 수정 중, 초안"]]);
		expect(chips("collection=post&status=archived&status=published")).toEqual([["status", "상태: 발행됨, 보관됨"]]);
	});

	it("name the translation, language and dates", () => {
		const names = chips(
			"collection=post&translation=changed&updated=last30&published=2026-03-01..2026-03-05&created=today",
		).map(([, label]) => label);
		expect(names).toEqual(["번역: 원문 바뀜", "수정한 날: 최근 30일", "발행한 날: 03. 01 – 03. 05", "만든 날: 오늘"]);
	});

	it("each take only their own filter off", () => {
		const state = stateOf("collection=post&field=tagIds:empty&field=summary:empty&translation=none&status=draft");
		const all = filterChipsOf(testSite, state, titles);
		const status = all.find((chip) => chip.key === "status");
		expect({ ...state, ...status?.clear }.statuses).toEqual([]);
		const tags = all.find((chip) => chip.key === "field:tagIds");
		expect({ ...state, ...tags?.clear }.fields).toEqual({ summary: [{ kind: "empty" }] });
		const translation = all.find((chip) => chip.key === "translation");
		expect({ ...state, ...translation?.clear }.translations).toEqual([]);
	});

	it("are none when nothing is filtered, and the search is not a chip", () => {
		expect(chips("collection=post&search=리액트")).toEqual([]);
	});
});
