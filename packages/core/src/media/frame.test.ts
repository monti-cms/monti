import { describe, expect, it } from "vitest";
import { imageFrame } from "./frame";

const size = { width: 4000, height: 2000 };

describe("a cropped or turned picture", () => {
	it("09-1 a whole picture, or one of unknown size, needs no frame", () => {
		expect(imageFrame(size)).toBeNull();
		expect(imageFrame({ ...size, rotate: 0, crop: null })).toBeNull();
		expect(imageFrame({ width: null, height: 2000, rotate: 90 })).toBeNull();
	});

	it("09-1 a crop gives the crop's shape, and the picture larger than the box, its centre where the crop leaves it", () => {
		const frame = imageFrame({ ...size, crop: { x: 0.5, y: 0.25, width: 0.5, height: 0.5 } });
		expect(frame?.aspectRatio).toBe(2);
		expect(frame?.image).toEqual({ left: 0, top: 50, width: 200, height: 200, rotate: 0 });
	});

	it("09-1 turning a quarter swaps the sides of the box; the picture keeps its own proportions in it", () => {
		const frame = imageFrame({ ...size, rotate: 90 });
		expect(frame?.aspectRatio).toBe(0.5);
		expect(frame?.image).toEqual({ left: 50, top: 50, width: 200, height: 50, rotate: 90 });
	});

	it("09-1 a half turn keeps the box's shape", () => {
		expect(imageFrame({ ...size, rotate: 180 })?.aspectRatio).toBe(2);
	});

	it("09-1 a crop of a turned picture is a part of the turned picture", () => {
		const frame = imageFrame({ ...size, rotate: 270, crop: { x: 0, y: 0, width: 1, height: 0.5 } });
		expect(frame?.aspectRatio).toBe(1);
		expect(frame?.image).toEqual({ left: 50, top: 100, width: 200, height: 100, rotate: 270 });
	});
});
