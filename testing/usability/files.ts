import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

/** The files of the usability test, made fresh in `testing/usability/files` (not in the repository): real pictures, a large one, and what the library refuses. */
const folder = path.join(import.meta.dirname, "files");
mkdirSync(folder, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("data:text/html,<title>files</title>");
const picture = async (name: string, width: number, height: number, from: string, to: string, noise = false) => {
	const type = name.endsWith(".png") ? "image/png" : "image/jpeg";
	const base64 = await page.evaluate(
		async ({ width, height, from, to, noise, type }) => {
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
				gradient.addColorStop(0, from);
				gradient.addColorStop(1, to);
				context.fillStyle = gradient;
				context.fillRect(0, 0, width, height);
			}
			const bytes = new Uint8Array(await (await canvas.convertToBlob({ type, quality: 0.92 })).arrayBuffer());
			let text = "";
			for (let at = 0; at < bytes.length; at += 32_768) text += String.fromCharCode(...bytes.subarray(at, at + 32_768));
			return btoa(text);
		},
		{ width, height, from, to, noise, type },
	);
	writeFileSync(path.join(folder, name), Buffer.from(base64, "base64"));
};

await picture("책상-아침.jpg", 3000, 2000, "#d8cdb8", "#a69479");
await picture("서울의-밤.jpg", 2400, 1600, "#3a3f55", "#1c1e2b");
await picture("표지-봄.jpg", 1600, 900, "#7d8c6a", "#3b4630");
await picture("붙여넣기.png", 800, 600, "#335577", "#ddeeff");
await picture("아주-큰-사진.png", 2600, 2200, "#000000", "#ffffff", true);
await browser.close();

const ftyp = Buffer.from([0, 0, 0, 24, ...Buffer.from("ftypheic"), 0, 0, 0, 0, ...Buffer.from("mif1heic")]);
writeFileSync(path.join(folder, "아이폰-사진.heic"), ftyp);
writeFileSync(path.join(folder, "설치.exe"), Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0]));
writeFileSync(path.join(folder, "가격표-2026.pdf"), Buffer.from("%PDF-1.7\n가격표\n"));
writeFileSync(path.join(folder, `${"아주 긴 한글 파일 이름 ".repeat(6).trim()}.txt`), "긴 이름");
console.log(folder);
