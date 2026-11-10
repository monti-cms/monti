import { describe, expect, it } from "vitest";
import { placeholderOf } from "./images";

/** A picture drawn by the browser, as an upload reads one. */
async function picture(width: number, height: number) {
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext("2d");
	if (context) {
		const gradient = context.createLinearGradient(0, 0, width, height);
		gradient.addColorStop(0, "#d8693c");
		gradient.addColorStop(1, "#1f3b5c");
		context.fillStyle = gradient;
		context.fillRect(0, 0, width, height);
	}
	return createImageBitmap(canvas);
}

const sizeOf = async (url: string) => {
	const image = new Image();
	image.src = url;
	await image.decode();
	return [image.naturalWidth, image.naturalHeight];
};

describe("a picture's placeholder", () => {
	it("09-1 is a copy 20px on its long side, as a data URL small enough for the library to take", async () => {
		const wide = await placeholderOf(await picture(800, 600));
		expect(wide).toMatch(/^data:image\/(webp|png);base64,[A-Za-z0-9+/]+={0,2}$/);
		expect(wide?.length).toBeLessThan(4096);
		expect(await sizeOf(wide ?? "")).toEqual([20, 15]);
		// A tall one keeps its shape; a picture smaller than that stays as it is.
		expect(await sizeOf((await placeholderOf(await picture(300, 1200))) ?? "")).toEqual([5, 20]);
		expect(await sizeOf((await placeholderOf(await picture(12, 8))) ?? "")).toEqual([12, 8]);
	});
});
