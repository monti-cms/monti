import { describe, expect, it } from "vitest";
import { fitLongSide } from "./fit";

describe("fitting a picture", () => {
	it("09-1 the long side comes to the limit and the other keeps the shape (flow 6·16: 4032×2688 is 2400×1600)", () => {
		expect(fitLongSide(4032, 2688, 2400)).toEqual({ width: 2400, height: 1600 });
		expect(fitLongSide(2688, 4032, 2400)).toEqual({ width: 1600, height: 2400 });
	});

	it("09-1 a picture already small enough stays as it is", () => {
		expect(fitLongSide(800, 600, 2400)).toEqual({ width: 800, height: 600 });
		expect(fitLongSide(2400, 100, 2400)).toEqual({ width: 2400, height: 100 });
	});
});
