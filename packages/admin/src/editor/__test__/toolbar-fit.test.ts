import { describe, expect, it } from "vitest";
import { type FitItem, fitSlots, layoutKeys } from "../toolbar-fit";

const slot = (key: string, priority: number, width = 10, fixed = false): FitItem => ({ key, priority, fixed, width });
const divider = (key: string): FitItem => ({ key, priority: 0, width: 5, divider: true });

describe("fitSlots", () => {
	it("전부 들어가면 아무것도 숨기지 않는다", () => {
		const items = [slot("a", 1), slot("b", 2), slot("c", 3)];
		expect([...fitSlots(items, 100, 32, 0)]).toEqual(["a", "b", "c"]);
	});

	it("좁으면 우선순위 숫자가 큰 도구부터 숨긴다", () => {
		const items = [slot("a", 1), slot("b", 3), slot("c", 2), slot("d", 4)];
		// 전부 40. 숨기면 더보기 버튼(10)이 붙으므로 d와 b를 숨긴 30이 되어야 35에 들어간다.
		expect([...fitSlots(items, 35, 10, 0)]).toEqual(["a", "c"]);
		expect([...fitSlots(items, 40, 10, 0)]).toEqual(["a", "b", "c", "d"]);
		// 더보기 버튼이 5면 d만 숨겨도 35에 들어간다.
		expect([...fitSlots(items, 35, 5, 0)]).toEqual(["a", "b", "c"]);
	});

	it("우선순위가 같으면 뒤쪽 도구를 먼저 숨긴다", () => {
		const items = [slot("a", 5), slot("b", 5), slot("c", 5)];
		expect([...fitSlots(items, 25, 10, 0)]).toEqual(["a"]);
	});

	it("고정 도구는 숨기지 않는다", () => {
		const items = [slot("a", 0, 10, true), slot("b", 9), slot("c", 0, 10, true)];
		expect([...fitSlots(items, 5, 10, 0)]).toEqual(["a", "c"]);
	});

	it("숨긴 도구가 없으면 더보기 버튼 폭을 더하지 않는다", () => {
		const items = [slot("a", 1), slot("b", 2)];
		expect(fitSlots(items, 20, 32, 0).size).toBe(2);
		expect(fitSlots(items, 19, 32, 0).size).toBe(0);
	});

	it("항목 사이 간격과 더보기 버튼 간격을 센다", () => {
		const items = [slot("a", 1), slot("b", 2), slot("c", 3)];
		// 3개 + 간격 2 = 34
		expect(fitSlots(items, 34, 10, 2).size).toBe(3);
		// 하나 숨기면 2개 + 더보기 = 3칸, 30 + 간격 2 x 2 = 34
		expect([...fitSlots(items, 33, 10, 2)]).toEqual(["a"]);
		expect([...fitSlots(items, 34, 10, 2)]).toHaveLength(3);
	});

	it("구분선 폭도 센다", () => {
		const items = [slot("a", 1), divider("d1"), slot("b", 2)];
		expect(fitSlots(items, 25, 10, 0).size).toBe(2);
		expect(fitSlots(items, 24, 10, 0).size).toBe(1);
	});
});

describe("layoutKeys", () => {
	const items = [slot("a", 1), divider("d1"), slot("b", 2), divider("d2"), slot("c", 3)];

	it("양쪽에 보이는 도구가 있는 구분선만 남긴다", () => {
		expect(layoutKeys(items, new Set(["a", "b", "c"]))).toEqual(["a", "d1", "b", "d2", "c"]);
		expect(layoutKeys(items, new Set(["a", "c"]))).toEqual(["a", "d2", "c"]);
		expect(layoutKeys(items, new Set(["a", "b"]))).toEqual(["a", "d1", "b"]);
		expect(layoutKeys(items, new Set(["b", "c"]))).toEqual(["b", "d2", "c"]);
		expect(layoutKeys(items, new Set(["c"]))).toEqual(["c"]);
		expect(layoutKeys(items, new Set())).toEqual([]);
	});
});
