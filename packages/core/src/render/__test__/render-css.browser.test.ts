import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";

declare module "vitest/browser" {
	interface BrowserCommands {
		/** `render.css` compiled as a site compiles it, run in Node (`vitest.browser.config.ts`). */
		renderCss: () => Promise<string>;
		colorScheme: (scheme: "light" | "dark") => Promise<void>;
	}
}

/**
 * The looks of the public stylesheet (`@monti-cms/core/render.css`), compiled as a site's Tailwind input takes it (with `prose`) and read as the
 * styles Chromium computes for the markup the renderer writes.
 */
beforeAll(async () => {
	const sheet = document.createElement("style");
	sheet.textContent = await commands.renderCss();
	document.head.append(sheet);
});
afterEach(async () => {
	document.body.innerHTML = "";
	await commands.colorScheme("light");
});
afterAll(() => commands.colorScheme("light"));

const mount = (html: string) => {
	document.body.innerHTML = html;
	/** The computed style of the element with this id. */
	return (id: string) => {
		const el = document.getElementById(id);
		if (!el) throw new Error(`no #${id}`);
		return getComputedStyle(el);
	};
};

describe("render.css", () => {
	it("aligns a table cell and a paragraph as written, over prose and the table cell's own alignment", () => {
		const style = mount(
			`<div class="prose"><table class="monti-table"><thead><tr>` +
				`<th id="head" class="monti-table-cell monti-table-cell-head monti-align-center">Name</th>` +
				`</tr></thead><tbody><tr>` +
				`<td id="right" class="monti-table-cell monti-align-right">1</td>` +
				`<td id="left" class="monti-table-cell monti-align-left">a</td>` +
				`<td id="plain" class="monti-table-cell">b</td>` +
				`</tr></tbody></table><p id="paragraph" class="monti-align-center">text</p></div>`,
		);
		expect(style("head").textAlign).toBe("center");
		expect(style("right").textAlign).toBe("right");
		expect(style("left").textAlign).toBe("left");
		expect(style("paragraph").textAlign).toBe("center");
		expect(style("plain").textAlign).toBe("start");
	});

	it("draws no list marker in a task list inside prose, nested ones included", () => {
		const style = mount(
			`<div class="prose"><ul class="contains-task-list">` +
				`<li id="outer" class="task-list-item"><input type="checkbox"> one` +
				`<ul class="contains-task-list"><li id="inner" class="task-list-item"><input type="checkbox" checked> two</li></ul>` +
				`</li></ul><ul><li id="bullet">a plain list keeps its bullet</li></ul></div>`,
		);
		expect(style("outer").listStyleType).toBe("none");
		expect(style("inner").listStyleType).toBe("none");
		expect(style("bullet").listStyleType).toBe("disc");
	});

	describe("code colors", () => {
		// shiki's two-theme output: the light colors inline, the dark ones as variables.
		const code = (around: string) =>
			mount(
				`<div ${around}><pre id="pre" class="shiki" style="background-color:#ffffff;--shiki-dark-bg:#24292e;color:#24292e;--shiki-dark:#e1e4e8">` +
					`<code><span class="line"><span id="token" style="color:#d73a49;--shiki-dark:#f97583">const</span></span></code></pre></div>`,
			);
		const LIGHT = { color: "rgb(36, 41, 46)", background: "rgb(255, 255, 255)", token: "rgb(215, 58, 73)" };
		const DARK = { color: "rgb(225, 228, 232)", background: "rgb(36, 41, 46)", token: "rgb(249, 117, 131)" };
		const colors = (style: ReturnType<typeof mount>) => ({
			color: style("pre").color,
			background: style("pre").backgroundColor,
			token: style("token").color,
		});

		it("are the light theme's on a light page", () => {
			expect(colors(code(""))).toEqual(LIGHT);
		});

		it("are the dark theme's under .dark and [data-theme=dark]", () => {
			expect(colors(code('class="dark"'))).toEqual(DARK);
			expect(colors(code('data-theme="dark"'))).toEqual(DARK);
		});

		it("follow the system's dark setting, unless the page opts out with .light or [data-theme=light]", async () => {
			await commands.colorScheme("dark");
			expect(colors(code(""))).toEqual(DARK);
			expect(colors(code('class="light"'))).toEqual(LIGHT);
			expect(colors(code('data-theme="light"'))).toEqual(LIGHT);
		});
	});
});
