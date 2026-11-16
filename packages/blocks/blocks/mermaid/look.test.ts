import { describe, expect, it } from "vitest";
import { mixColors, toHex } from "./look";

describe("18-2 the diagram's colours", () => {
	it("18-2 a tone is an amount of the text colour over the ground, written as #rrggbb", () => {
		expect(toHex([28, 27, 24])).toBe("#1c1b18");
		expect(toHex(mixColors([0, 0, 0], [255, 255, 255], 0.5))).toBe("#808080");
		expect(toHex(mixColors([0, 0, 0], [255, 255, 255], 0))).toBe("#ffffff");
		expect(toHex(mixColors([236, 235, 230], [20, 20, 20], 1))).toBe("#ecebe6");
	});
});
