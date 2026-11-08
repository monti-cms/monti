import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { typeKoreanInto } from "./ime.ts";

/**
 * The usability test's hands (docs/plans/09-media.md, 1.4): one real Chromium window, held open, that takes commands over a small local server. Everything it does to the
 * page is input the browser itself receives, trusted: a mouse that travels, keys that go down and up, a Korean input method, files dropped from the disk, a picture
 * pasted from the clipboard. It never runs a script that changes the page. Reading (`shot`, `aria`, `rect`, `console`) changes nothing.
 *
 *   node testing/usability/driver.ts <base url> <record folder>
 *   node testing/usability/do.ts <command> [args]
 */
const [base = "http://localhost:4173", record = ".usability/run"] = process.argv.slice(2);
mkdirSync(record, { recursive: true });
const headless = process.env.USABILITY_HEADLESS === "1";

const browser = await chromium.launch({ headless });
const context = await browser.newContext({
	baseURL: base,
	viewport: { width: 1440, height: 900 },
	locale: "ko-KR",
	timezoneId: "UTC",
	recordVideo: { dir: path.join(record, "video"), size: { width: 1440, height: 900 } },
});
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const consoleLines: string[] = [];
page.on("console", (message) => {
	if (message.type() === "error" || message.type() === "warning")
		consoleLines.push(`${message.type()}: ${message.text()}`);
});
page.on("pageerror", (error) => consoleLines.push(`pageerror: ${error.message}`));

let chooser: import("playwright").FileChooser | null = null;
page.on("filechooser", (opened) => {
	chooser = opened;
});

let at = { x: 720, y: 450 };
let shots = 0;
const log: string[] = [];

type Args = string[];
const number = (value: string | undefined, name: string) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) throw new Error(`${name} needs a number`);
	return parsed;
};
const steps = (args: Args, fallback = 20) => {
	const flag = args.indexOf("--steps");
	return flag >= 0 ? number(args[flag + 1], "--steps") : fallback;
};

const commands: Record<string, (args: Args) => Promise<unknown>> = {
	open: async ([where = "/"]) => {
		await page.goto(where);
		return page.url();
	},
	url: async () => page.url(),
	move: async (args) => {
		at = { x: number(args[0], "x"), y: number(args[1], "y") };
		await page.mouse.move(at.x, at.y, { steps: steps(args) });
		return at;
	},
	down: async ([button = "left"]) => page.mouse.down({ button: button as "left" | "right" }),
	up: async ([button = "left"]) => page.mouse.up({ button: button as "left" | "right" }),
	click: async ([x, y, button = "left", count = "1"]) => {
		if (x !== undefined && y !== undefined) {
			at = { x: number(x, "x"), y: number(y, "y") };
			await page.mouse.move(at.x, at.y, { steps: 15 });
		}
		await page.mouse.click(at.x, at.y, { button: button as "left" | "right", clickCount: Number(count) });
		return at;
	},
	rclick: async ([x, y]) => commands.click?.([x ?? String(at.x), y ?? String(at.y), "right"]),
	dblclick: async ([x, y]) => commands.click?.([x ?? String(at.x), y ?? String(at.y), "left", "2"]),
	wheel: async ([dx = "0", dy = "0"]) => page.mouse.wheel(Number(dx), Number(dy)),
	key: async ([combo]) => {
		if (!combo) throw new Error("key needs a key, like Enter or Meta+V");
		await page.keyboard.press(combo);
	},
	type: async (args) => page.keyboard.type(args.join(" "), { delay: 25 }),
	korean: async (args) => typeKoreanInto(cdp, args.join(" ")),
	dropfile: async (args) => {
		const y = number(args.at(-1), "y");
		const x = number(args.at(-2), "x");
		const files = args.slice(0, -2).map((file) => path.resolve(file));
		const data = { items: [], files, dragOperationsMask: 1 };
		await page.mouse.move(x, y, { steps: 15 });
		for (const type of ["dragEnter", "dragOver", "drop"] as const)
			await cdp.send("Input.dispatchDragEvent", { type, x, y, data });
		at = { x, y };
		return files;
	},
	dragfile: async (args) => {
		// Held over the page without letting go: to see what the page shows mid-drag. `droplast` lets go; `cancelfile` takes it away.
		const y = number(args.at(-1), "y");
		const x = number(args.at(-2), "x");
		const files = args.slice(0, -2).map((file) => path.resolve(file));
		const data = { items: [], files, dragOperationsMask: 1 };
		for (const type of ["dragEnter", "dragOver"] as const)
			await cdp.send("Input.dispatchDragEvent", { type, x, y, data });
		return files;
	},
	clip: async ([file]) => {
		if (!file) throw new Error("clip needs a picture file");
		const bytes = readFileSync(path.resolve(file)).toString("base64");
		await page.evaluate(async (data) => {
			const raw = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
			await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([raw], { type: "image/png" }) })]);
		}, bytes);
	},
	choose: async (args) => {
		if (!chooser) throw new Error("no file chooser is open");
		await chooser.setFiles(args.map((file) => path.resolve(file)));
		chooser = null;
	},
	chooser: async () => chooser !== null,
	shot: async ([name]) => {
		const file = path.join(record, `${String(++shots).padStart(3, "0")}${name ? `-${name}` : ""}.png`);
		await page.screenshot({ path: file });
		return path.resolve(file);
	},
	aria: async ([selector = "body"]) => page.locator(selector).first().ariaSnapshot(),
	rect: async ([role, ...name]) => {
		const label = name.join(" ");
		const found = page.getByRole(role as "button", label ? { name: label } : {}).first();
		return found.boundingBox();
	},
	text: async ([selector = "body"]) => page.locator(selector).first().innerText(),
	focused: async () =>
		page.evaluate(() => {
			const element = document.activeElement;
			return element
				? {
						tag: element.tagName,
						role: element.getAttribute("role"),
						label: element.getAttribute("aria-label"),
						text: element.textContent?.slice(0, 80),
						rect: element.getBoundingClientRect(),
					}
				: null;
		}),
	console: async () => consoleLines.splice(0),
	offline: async ([state = "on"]) => context.setOffline(state === "on"),
	resize: async ([width, height]) =>
		page.setViewportSize({ width: number(width, "width"), height: number(height, "height") }),
	wait: async ([ms = "400"]) => page.waitForTimeout(Math.min(Number(ms), 5000)),
	stop: async () => {
		writeFileSync(path.join(record, "input.log"), log.join("\n"));
		await context.close();
		await browser.close();
		setTimeout(() => process.exit(0), 50);
	},
};

createServer(async (request, response) => {
	let body = "";
	for await (const chunk of request) body += chunk;
	try {
		const { command, args } = JSON.parse(body) as { command: string; args: string[] };
		const run = commands[command];
		if (!run) throw new Error(`unknown command "${command}": ${Object.keys(commands).join(", ")}`);
		log.push(`${new Date().toISOString()} ${command} ${args.join(" ")}`);
		const result = await run(args);
		response.end(JSON.stringify({ ok: true, result }));
	} catch (error) {
		response.statusCode = 400;
		response.end(JSON.stringify({ ok: false, error: String(error) }));
	}
}).listen(4600, "127.0.0.1", () => console.log("usability driver on 4600"));
