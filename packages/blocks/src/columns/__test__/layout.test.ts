import { describe, expect, it } from "vitest";
import { columnsGridTemplate, formatColumnWidths, parseColumnWidths, toPercentWidths } from "../layout";

describe("column widths (widths)", () => {
	it("reads only positive ratios that match the column count", () => {
		expect(parseColumnWidths("60, 40", 2)).toEqual([60, 40]);
		expect(parseColumnWidths("60,40", 3)).toBeNull();
		expect(parseColumnWidths("60,x", 2)).toBeNull();
		expect(parseColumnWidths("0,100", 2)).toBeNull();
		expect(parseColumnWidths(undefined, 2)).toBeNull();
	});

	it("normalizes to integer ratios summing to 100 and does not store equal ratios", () => {
		expect(toPercentWidths(null, 3)).toEqual([33, 33, 34]);
		expect(toPercentWidths([2, 1, 1], 3)).toEqual([50, 25, 25]);
		expect(formatColumnWidths([50, 25, 25])).toBe("50,25,25");
		expect(formatColumnWidths([50, 50])).toBe("");
	});

	it("builds the grid column definition", () => {
		expect(columnsGridTemplate([60, 40], 2)).toBe("minmax(0, 60fr) minmax(0, 40fr)");
		expect(columnsGridTemplate(null, 3)).toBe("repeat(3, minmax(0, 1fr))");
	});
});
