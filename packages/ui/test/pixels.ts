import { page } from "vitest/browser";

/** The colour painted at a point of an element, as the browser drew it (a screenshot of the element, read back): "r g b a". */
export async function colourAt(element: Element, x: number, y: number) {
	// Not kept on disk: the screenshot comes back as base64.
	const shot = await page.screenshot({ element, save: false });
	const image = new Image();
	image.src = `data:image/png;base64,${shot}`;
	await image.decode();
	const canvas = document.createElement("canvas");
	[canvas.width, canvas.height] = [image.width, image.height];
	const context = canvas.getContext("2d");
	context?.drawImage(image, 0, 0);
	const scale = image.width / element.getBoundingClientRect().width;
	return [...(context?.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data ?? [])].join(" ");
}
