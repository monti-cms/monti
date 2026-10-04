import { describe, expect, it } from "vitest";
import { type FitItem, fitSlots, layoutKeys } from "../toolbar-fit";

const slot = (key: string, priority: number, width = 10, fixed = false): FitItem => ({ key, priority, fixed, width });
const divider = (key: string): FitItem => ({ key, priority: 0, width: 5, divider: true });

describe("fitSlots", () => {
	it("hides nothing when everything fits", () => {
		const items = [slot("a", 1), slot("b", 2), slot("c", 3)];
		expect([...fitSlots(items, 100, 32, 0)]).toEqual(["a", "b", "c"]);
	});

	it("when narrow, hides tools with the larger priority number first", () => {
		const items = [slot("a", 1), slot("b", 3), slot("c", 2), slot("d", 4)];
		// All are 40. Hiding adds the overflow button (10), so hiding d and b to reach 30 is what fits in 35.
		expect([...fitSlots(items, 35, 10, 0)]).toEqual(["a", "c"]);
		expect([...fitSlots(items, 40, 10, 0)]).toEqual(["a", "b", "c", "d"]);
		// With a 5-wide overflow button, hiding just d already fits in 35.
		expect([...fitSlots(items, 35, 5, 0)]).toEqual(["a", "b", "c"]);
	});

	it("hides later tools first when priorities are equal", () => {
		const items = [slot("a", 5), slot("b", 5), slot("c", 5)];
		expect([...fitSlots(items, 25, 10, 0)]).toEqual(["a"]);
	});

	it("never hides pinned tools", () => {
		const items = [slot("a", 0, 10, true), slot("b", 9), slot("c", 0, 10, true)];
		expect([...fitSlots(items, 5, 10, 0)]).toEqual(["a", "c"]);
	});

	it("does not add the overflow button width when nothing is hidden", () => {
		const items = [slot("a", 1), slot("b", 2)];
		expect(fitSlots(items, 20, 32, 0).size).toBe(2);
		expect(fitSlots(items, 19, 32, 0).size).toBe(0);
	});

	it("counts gaps between items and the gap before the overflow button", () => {
		const items = [slot("a", 1), slot("b", 2), slot("c", 3)];
		// 3 items + 2 gaps = 34
		expect(fitSlots(items, 34, 10, 2).size).toBe(3);
		// Hiding one gives 2 items + overflow = 3 slots, 30 + 2 gaps x 2 = 34
		expect([...fitSlots(items, 33, 10, 2)]).toEqual(["a"]);
		expect([...fitSlots(items, 34, 10, 2)]).toHaveLength(3);
	});

	it("counts separator width too", () => {
		const items = [slot("a", 1), divider("d1"), slot("b", 2)];
		expect(fitSlots(items, 25, 10, 0).size).toBe(2);
		expect(fitSlots(items, 24, 10, 0).size).toBe(1);
	});
});

describe("layoutKeys", () => {
	const items = [slot("a", 1), divider("d1"), slot("b", 2), divider("d2"), slot("c", 3)];

	it("keeps only separators with visible tools on both sides", () => {
		expect(layoutKeys(items, new Set(["a", "b", "c"]))).toEqual(["a", "d1", "b", "d2", "c"]);
		expect(layoutKeys(items, new Set(["a", "c"]))).toEqual(["a", "d2", "c"]);
		expect(layoutKeys(items, new Set(["a", "b"]))).toEqual(["a", "d1", "b"]);
		expect(layoutKeys(items, new Set(["b", "c"]))).toEqual(["b", "d2", "c"]);
		expect(layoutKeys(items, new Set(["c"]))).toEqual(["c"]);
		expect(layoutKeys(items, new Set())).toEqual([]);
	});
});
