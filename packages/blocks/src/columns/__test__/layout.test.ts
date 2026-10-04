import { describe, expect, it } from "vitest";
import { columnsGridTemplate, formatColumnWidths, parseColumnWidths, toPercentWidths } from "../layout";

describe("단 나누기 너비(widths)", () => {
	it("단 수와 맞는 양수 비율만 읽는다", () => {
		expect(parseColumnWidths("60, 40", 2)).toEqual([60, 40]);
		expect(parseColumnWidths("60,40", 3)).toBeNull();
		expect(parseColumnWidths("60,x", 2)).toBeNull();
		expect(parseColumnWidths("0,100", 2)).toBeNull();
		expect(parseColumnWidths(undefined, 2)).toBeNull();
	});

	it("합이 100인 정수 비율로 맞추고, 똑같으면 저장하지 않는다", () => {
		expect(toPercentWidths(null, 3)).toEqual([33, 33, 34]);
		expect(toPercentWidths([2, 1, 1], 3)).toEqual([50, 25, 25]);
		expect(formatColumnWidths([50, 25, 25])).toBe("50,25,25");
		expect(formatColumnWidths([50, 50])).toBe("");
	});

	it("grid 열 정의를 만든다", () => {
		expect(columnsGridTemplate([60, 40], 2)).toBe("minmax(0, 60fr) minmax(0, 40fr)");
		expect(columnsGridTemplate(null, 3)).toBe("repeat(3, minmax(0, 1fr))");
	});
});
