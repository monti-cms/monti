import { describe, expect, it } from "vitest";
import { firstShrink, fitLongSide } from "./fit";

describe("fitting a picture", () => {
	it("09-1 the long side comes to the limit and the other keeps the shape (flow 6·16: 4032×2688 is 2400×1600)", () => {
		expect(fitLongSide(4032, 2688, 2400)).toEqual({ width: 2400, height: 1600 });
		expect(fitLongSide(2688, 4032, 2400)).toEqual({ width: 1600, height: 2400 });
	});

	it("09-1 a picture already small enough stays as it is", () => {
		expect(fitLongSide(800, 600, 2400)).toEqual({ width: 800, height: 600 });
		expect(fitLongSide(2400, 100, 2400)).toEqual({ width: 2400, height: 100 });
	});

	it("09-1 shrinking a 14 MB picture to 10 MB starts well under the limit, and never enlarges", () => {
		const scale = firstShrink(14, 10);
		expect(scale).toBeLessThan(Math.sqrt(10 / 14));
		expect(scale * scale * 14).toBeLessThan(10);
		expect(firstShrink(5, 10)).toBe(1);
	});
});
