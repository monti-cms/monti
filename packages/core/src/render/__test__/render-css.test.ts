import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "../../../render.css"), "utf8");

/** The declaration block that follows the first occurrence of `selector` (exact text). */
const block = (selector: string) => {
	const start = css.indexOf(`${selector} {`);
	expect(start, `missing rule: ${selector}`).toBeGreaterThanOrEqual(0);
	return css.slice(start, css.indexOf("}", start));
};

describe("render.css", () => {
	it("makes alignment beat prose and .cms-table-cell with a doubled class", () => {
		for (const side of ["left", "center", "right"]) {
			expect(block(`.cms-align-${side}.cms-align-${side}`)).toContain(`text-align: ${side}`);
		}
	});

	it("removes list markers from task lists, nested ones included", () => {
		expect(block("ul.contains-task-list")).toContain("list-style: none");
		expect(block("li.task-list-item")).toContain("list-style: none");
		expect(css).toContain("ul.contains-task-list ul.contains-task-list");
	});

	it("applies dark code colors under .dark, [data-theme=dark] and the system setting unless opted out", () => {
		expect(css).toContain(':where(.dark, [data-theme="dark"]) .shiki');
		const media = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
		expect(media).toContain('.shiki:not(:where(.light, [data-theme="light"]) *)');
		expect(media).toContain("var(--shiki-dark-bg)");
	});
});
