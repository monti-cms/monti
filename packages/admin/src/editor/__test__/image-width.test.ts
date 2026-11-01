import { describe, expect, it } from "vitest";
import { isValidImageWidth, moveImageResize, releaseImageResize, startImageResize } from "../image-width";

/** A press on the right handle at x 100, on a 600px image in an 800px body. */
const press = (width: string, handle: "left" | "right" = "right") =>
	startImageResize({ width, handle, startX: 100, startWidth: 600, parentWidth: 800 });

describe("the image width", () => {
	it("MEDIA-W1 accepts 1–100% or 1–4096px only", () => {
		for (const ok of ["", "1%", "100%", "600", "600px", "4096px"]) expect(isValidImageWidth(ok), ok).toBe(true);
		for (const bad of ["0%", "101%", "0px", "4097px", "50vw", "-1px"]) expect(isValidImageWidth(bad), bad).toBe(false);
	});

	it("MEDIA-W1 for % widths, computes and saves a % value of the body on drag", () => {
		const resize = moveImageResize(press("60%"), 180);
		expect(resize.preview).toBe("85%");
		expect(releaseImageResize(resize)).toBe("85%");
	});

	it("MEDIA-W1 saves any other width in px, and the left handle grows the image to the left", () => {
		expect(releaseImageResize(moveImageResize(press("500px"), 200))).toBe("700px");
		expect(releaseImageResize(moveImageResize(press(""), 200))).toBe("700px");
		expect(releaseImageResize(moveImageResize(press("500px", "left"), 50))).toBe("650px");
	});

	it("MEDIA-W1 keeps a dragged width within 1–100% and 20–4096px", () => {
		expect(moveImageResize(press("60%"), 900).preview).toBe("100%");
		expect(moveImageResize(press("60%"), -900).preview).toBe("3%");
		expect(moveImageResize(press("500px"), 9000).preview).toBe("4096px");
		expect(moveImageResize(press("500px"), -9000).preview).toBe("20px");
	});

	it("MEDIA-W1 saves nothing when the handle is released without moving (preserves images with no width set)", () => {
		expect(releaseImageResize(press(""))).toBeNull();
		expect(releaseImageResize(moveImageResize(press(""), 101))).toBeNull();
		// Moved and brought back to the width it had.
		expect(releaseImageResize(moveImageResize(moveImageResize(press("600px"), 150), 100))).toBeNull();
	});
});
