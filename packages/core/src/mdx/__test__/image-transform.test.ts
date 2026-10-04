import { describe, expect, it } from "vitest";
import {
	computeImageTransform,
	formatCrop,
	intrinsicDisplayWidth,
	isFullCrop,
	isValidCrop,
	isValidRotate,
	parseCrop,
	parseRotate,
	roundCropBox,
} from "../image-transform";

describe("image-transform pure functions", () => {
	describe("parseCrop & isValidCrop", () => {
		it("parses a valid x,y,w,h percent string", () => {
			expect(parseCrop("10,20,50.5,40.25")).toEqual({
				x: 10,
				y: 20,
				width: 50.5,
				height: 40.25,
			});
			expect(isValidCrop("10,20,50,40")).toBe(true);
		});

		it("parses even when whitespace is mixed in", () => {
			expect(parseCrop("  0,  0 , 100 , 100 ")).toEqual({
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			});
		});

		it("returns null for a crop that is out of range or malformed", () => {
			expect(parseCrop("invalid")).toBeNull();
			expect(parseCrop("-1,0,50,50")).toBeNull();
			expect(parseCrop("0,0,0,50")).toBeNull(); // width <= 0
			expect(parseCrop("0,0,105,50")).toBeNull(); // width > 100
			expect(parseCrop("60,0,50,50")).toBeNull(); // x + width > 100
			expect(parseCrop("0,70,50,50")).toBeNull(); // y + height > 100
			expect(parseCrop("0,0,0.001,100")).toBeNull(); // guards against a third decimal place or more, or 0 after rounding
			expect(parseCrop(null)).toBeNull();
			expect(parseCrop(undefined)).toBeNull();
			expect(isValidCrop("invalid")).toBe(false);
			expect(isValidCrop("")).toBe(true);
		});

		it("checks the behavior of formatCrop and isFullCrop", () => {
			const crop = { x: 12.345, y: 0.1, width: 45.678, height: 80 };
			expect(formatCrop(crop)).toBe("12.35,0.1,45.68,80");
			expect(isFullCrop({ x: 0, y: 0, width: 100, height: 100 })).toBe(true);
			expect(isFullCrop({ x: 10, y: 0, width: 90, height: 100 })).toBe(false);
			expect(isFullCrop(null)).toBe(true);
		});
	});

	describe("parseRotate & isValidRotate", () => {
		it("parses rotate values 90, 180 and 270 correctly", () => {
			expect(parseRotate("90")).toBe(90);
			expect(parseRotate(180)).toBe(180);
			expect(parseRotate("270")).toBe(270);
		});

		it("returns null (no rotation) for 0 or missing", () => {
			expect(parseRotate("0")).toBeNull();
			expect(parseRotate(0)).toBeNull();
			expect(parseRotate("")).toBeNull();
			expect(parseRotate(null)).toBeNull();
			expect(parseRotate(undefined)).toBeNull();
		});

		it("returns null for an invalid rotate value", () => {
			expect(parseRotate("45")).toBeNull();
			expect(parseRotate("360")).toBeNull();
			expect(parseRotate("foo")).toBeNull();
			expect(parseRotate("90deg")).toBeNull();
		});

		it("isValidRotate validation", () => {
			expect(isValidRotate("90")).toBe(true);
			expect(isValidRotate(180)).toBe(true);
			expect(isValidRotate("0")).toBe(true);
			expect(isValidRotate("")).toBe(true);
			expect(isValidRotate("45")).toBe(false);
		});
	});

	describe("computeImageTransform", () => {
		it("no transform when crop and rotate are both missing or full", () => {
			const result = computeImageTransform({});
			expect(result.isTransformed).toBe(false);
			expect(result.wrapperStyle).toEqual({});
			expect(result.imageStyle).toEqual({});
		});

		it("ignores invalid crop and rotate", () => {
			const result = computeImageTransform({ crop: "invalid", rotate: "invalid" });
			expect(result.isTransformed).toBe(false);
		});

		it("computes the correct CSS style when only crop is applied", () => {
			const result = computeImageTransform({
				crop: "20,10,50,40",
				aspectRatio: 2, // 1000x500
			});
			expect(result.isTransformed).toBe(true);
			expect(result.wrapperStyle.position).toBe("relative");
			expect(result.wrapperStyle.overflow).toBe("hidden");
			// cropAspect = (50/40) * 2 = 2.5
			expect(result.wrapperStyle.aspectRatio).toBe(2.5);

			expect(result.imageStyle.position).toBe("absolute");
			expect(result.imageStyle.width).toBe("200%"); // 100/50 * 100
			expect(result.imageStyle.height).toBe("250%"); // 100/40 * 100
			expect(result.imageStyle.transform).toContain("translate(-50%, -50%)");
		});

		it("the aspect ratio is swapped when rotate 90/270 is applied", () => {
			const result90 = computeImageTransform({
				crop: "0,0,100,100",
				rotate: "90",
				aspectRatio: 2, // 2:1
			});
			expect(result90.isTransformed).toBe(true);
			// A 2:1 image rotated 90 degrees becomes 1:2 (0.5)
			expect(result90.wrapperStyle.aspectRatio).toBe(0.5);
			expect(result90.imageStyle.transform).toContain("rotate(90deg)");

			const result270 = computeImageTransform({
				rotate: "270",
				aspectRatio: 1.5,
			});
			expect(result270.isTransformed).toBe(true);
			expect(result270.wrapperStyle.aspectRatio).toBeCloseTo(1 / 1.5, 3);
			expect(result270.imageStyle.transform).toContain("rotate(270deg)");
		});

		it("the aspect ratio is kept with rotate 180 and rotate(180deg) is included", () => {
			const result = computeImageTransform({
				rotate: 180,
				aspectRatio: 1.6,
			});
			expect(result.isTransformed).toBe(true);
			expect(result.wrapperStyle.aspectRatio).toBe(1.6);
			expect(result.imageStyle.transform).toContain("rotate(180deg)");
		});
	});
});

describe("intrinsicDisplayWidth", () => {
	it("a transformed image with no width set shows the original width of the visible area", () => {
		const natural = { width: 400, height: 200 };
		expect(intrinsicDisplayWidth({ crop: { x: 0, y: 0, width: 50, height: 100 }, rotate: null }, natural)).toBe(200);
		expect(intrinsicDisplayWidth({ crop: { x: 0, y: 0, width: 100, height: 50 }, rotate: 90 }, natural)).toBe(100);
		expect(intrinsicDisplayWidth({ crop: null, rotate: 180 }, natural)).toBe(400);
		expect(intrinsicDisplayWidth({ crop: null, rotate: 90 }, null)).toBeNull();
	});

	it("the crop area does not exceed the right and bottom edges even on a rounding tie", () => {
		const crop = roundCropBox({ x: 12.125, y: 12.125, width: 87.875, height: 87.875 });
		expect(crop).toEqual({ x: 12.13, y: 12.13, width: 87.87, height: 87.87 });
		expect(parseCrop(`${crop.x},${crop.y},${crop.width},${crop.height}`)).toEqual(crop);
	});
});
