import type { CropBox } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { cropSheetResult, FULL_CROP, setCropValue } from "../image-crop";

/** Types the numbers into the sheet one after another, from the whole image. */
const typed = (...values: [keyof CropBox, number][]) =>
	values.reduce((crop, [field, value]) => setCropValue(crop, field, value), FULL_CROP);

describe("the crop sheet", () => {
	it("MEDIA-W1 stores the crop coordinates relative to the original (0-100) even when rotated", () => {
		const crop = typed(["x", 15], ["y", 25], ["width", 50], ["height", 60]);
		expect(cropSheetResult(crop, 90)).toEqual({ crop: "15,25,50,60", rotate: "90" });
		expect(cropSheetResult(crop, 270)).toEqual({ crop: "15,25,50,60", rotate: "270" });
	});

	it("MEDIA-W1 saves the whole image and no rotation as nothing", () => {
		expect(cropSheetResult(FULL_CROP, 0)).toEqual({ crop: null, rotate: null });
		expect(cropSheetResult(typed(["x", 10]), 0)).toEqual({ crop: "10,0,90,100", rotate: null });
	});

	it("MEDIA-W1 keeps a typed crop inside the image", () => {
		expect(typed(["x", 120])).toEqual({ x: 99, y: 0, width: 1, height: 100 });
		expect(typed(["y", 30], ["height", 90])).toEqual({ x: 0, y: 30, width: 100, height: 70 });
		expect(typed(["width", 0])).toEqual({ x: 0, y: 0, width: 1, height: 100 });
		expect(typed(["x", Number.NaN])).toBe(FULL_CROP);
	});
});
