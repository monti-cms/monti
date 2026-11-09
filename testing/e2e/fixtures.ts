import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { ADMIN } from "./account";

type Written<Output> = { output: Output };

/** Calls one operation the way the admin does, with the page's session: a test sets up what it needs through the same door (docs/testing.md). */
export async function operation<Output>(page: Page, name: string, input: unknown): Promise<Written<Output>> {
	const answer = await page.request.post(`/admin/api/operations/${name}`, { data: { input } });
	expect(answer.status(), `${name}: ${await answer.text()}`).toBe(200);
	return (await answer.json()) as Written<Output>;
}

/** A page with a session, on the admin. */
export const test = base.extend<{ admin: Page }>({
	admin: async ({ page }, use) => {
		const answer = await page.request.post("/admin/api/operations/auth.signIn", {
			data: { input: { email: ADMIN.email, password: ADMIN.password } },
		});
		expect(answer.status()).toBe(200);
		await use(page);
	},
});

export { expect };

/** A unique word, so a test finds what it made however the runs before it went (one database for one run, many tests). */
export const unique = (word: string) => `${word}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

/**
 * Files on disk, as a person has them: made by the browser so they are real pictures. `noise` makes one that compresses badly, for a large file.
 */
export async function picture(
	page: Page,
	folder: string,
	name: string,
	{ width = 640, height = 480, noise = false }: { width?: number; height?: number; noise?: boolean } = {},
): Promise<string> {
	const type = name.endsWith(".png") ? "image/png" : "image/jpeg";
	const base64 = await page.evaluate(
		async ({ width, height, noise, type }) => {
			const canvas = new OffscreenCanvas(width, height);
			const context = canvas.getContext("2d");
			if (!context) throw new Error("no 2d context");
			if (noise) {
				const image = context.createImageData(width, height);
				for (let at = 0; at < image.data.length; at += 65_536)
					crypto.getRandomValues(image.data.subarray(at, Math.min(at + 65_536, image.data.length)));
				for (let at = 3; at < image.data.length; at += 4) image.data[at] = 255;
				context.putImageData(image, 0, 0);
			} else {
				const gradient = context.createLinearGradient(0, 0, width, height);
				gradient.addColorStop(0, "#335577");
				gradient.addColorStop(1, "#ddeeff");
				context.fillStyle = gradient;
				context.fillRect(0, 0, width, height);
			}
			const bytes = new Uint8Array(await (await canvas.convertToBlob({ type, quality: 0.9 })).arrayBuffer());
			let text = "";
			for (let at = 0; at < bytes.length; at += 32_768) text += String.fromCharCode(...bytes.subarray(at, at + 32_768));
			return btoa(text);
		},
		{ width, height, noise, type },
	);
	const file = path.join(folder, name);
	await mkdir(folder, { recursive: true });
	await writeFile(file, Buffer.from(base64, "base64"));
	return file;
}

/** A file from the operating system dropped on a place of the page: the browser's own drag, with the file on disk (Chrome DevTools Protocol). */
export async function dropFromDisk(page: Page, files: string[], on: Locator) {
	const box = await on.boundingBox();
	if (!box) throw new Error("nothing to drop on");
	const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	const session = await page.context().newCDPSession(page);
	const data = { items: [], files, dragOperationsMask: 1 };
	await page.mouse.move(at.x, at.y);
	for (const type of ["dragEnter", "dragOver", "drop"] as const)
		await session.send("Input.dispatchDragEvent", { type, ...at, data });
	await session.detach();
}

/** A picture on the system clipboard, and a real ⌘V in the focused place. */
export async function pastePicture(page: Page, file: string) {
	await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
	const base64 = (await readFile(file)).toString("base64");
	await page.evaluate(async (data) => {
		const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
		await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([bytes], { type: "image/png" }) })]);
	}, base64);
	await page.keyboard.press("ControlOrMeta+V");
}

/** That a picture on the page really came down and decoded, not only that its tag is there. */
export const decoded = (image: Locator) => image.evaluate((element) => (element as HTMLImageElement).naturalWidth);
