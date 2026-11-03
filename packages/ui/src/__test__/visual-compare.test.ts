import { describe, expect, it } from "vitest";
import { compareShots, type Pixels } from "../../visual/compare";

const WHITE = [255, 255, 255, 255];
const INK = [20, 20, 20, 255];
const RED = [220, 40, 40, 255];

/** A white image with `paint` colored rectangles on it: [x, y, width, height, color]. */
const image = (width: number, height: number, ...paint: [number, number, number, number, number[]][]): Pixels => {
	const data = new Uint8Array(width * height * 4);
	for (let i = 0; i < width * height; i++) data.set(WHITE, i * 4);
	for (const [x0, y0, w, h, color] of paint)
		for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) data.set(color, (y * width + x) * 4);
	return { width, height, data };
};

const compare = (expected: Pixels, actual: Pixels) => compareShots(expected, actual, { shift: 1, threshold: 0.2 });

describe("comparing two shots", () => {
	it("UI-T10 finds nothing between two same shots", () => {
		const result = compare(image(40, 30, [5, 5, 10, 4, INK]), image(40, 30, [5, 5, 10, 4, INK]));
		expect(result).toMatchObject({ differing: 0, sizeChanged: false, diff: null });
	});

	it("UI-T10 lets a part move by 1px, on its own or with the whole page 1px taller", () => {
		const before = image(40, 30, [5, 5, 10, 4, INK], [20, 10, 8, 8, RED]);
		expect(compare(before, image(40, 30, [5, 6, 10, 4, INK], [20, 10, 8, 8, RED])).differing).toBe(0);
		expect(compare(before, image(40, 30, [6, 5, 10, 4, INK], [20, 10, 8, 8, RED])).differing).toBe(0);
		const taller = compare(before, image(40, 31, [5, 6, 10, 4, INK], [20, 11, 8, 8, RED]));
		expect(taller).toMatchObject({ differing: 0, sizeChanged: false });
	});

	it("UI-T10 fails a part moved by 2px, a new color, a mark added or gone and a size change of more than 1px", () => {
		const before = image(40, 30, [5, 5, 10, 4, INK]);
		expect(compare(before, image(40, 30, [5, 7, 10, 4, INK])).differing).toBeGreaterThan(0);
		expect(compare(before, image(40, 30, [5, 5, 10, 4, RED])).differing).toBeGreaterThan(0);
		// A one-pixel dot where there was none: what a changed letter does.
		expect(compare(before, image(40, 30, [5, 5, 10, 4, INK], [30, 20, 1, 1, INK])).differing).toBe(1);
		expect(compare(image(40, 30, [5, 5, 10, 4, INK], [30, 20, 1, 1, INK]), before).differing).toBe(1);
		expect(compare(before, image(40, 32, [5, 5, 10, 4, INK])).sizeChanged).toBe(true);
	});

	it("UI-T10 draws the differing pixels in red on the faded expected image", () => {
		const result = compare(image(10, 10), image(10, 10, [3, 4, 1, 1, INK]));
		const at = (x: number, y: number) => [...(result.diff?.data.slice((y * 10 + x) * 4, (y * 10 + x) * 4 + 4) ?? [])];
		expect(at(3, 4)).toEqual([255, 0, 0, 255]);
		expect(at(0, 0)).toEqual(WHITE);
	});
});
