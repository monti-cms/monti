import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { box } from "../../../testing/measure";
import { render } from "../test/render";
import { CodeArea, CodeFrame, CodeGround, CodeNumber, Text } from "./index";

/** The code block of the editor, measured (EC-02, EC-08; editor-tools.md, "코드 칸"). */
function Frame() {
	const lines = ["const a = 1;", "const b = 2;", "const c = 3;"];
	return (
		<div className="max-w-monti-reading">
			<CodeFrame
				head={
					<>
						<Text variant="caption" tone="muted">
							TypeScript
						</Text>
						<Text variant="caption" mono>
							src/counter.ts
						</Text>
					</>
				}
			>
				<CodeArea
					gutter={lines.map((text, line) => <CodeNumber key={text} number={line + 1} />)}
					grounds={lines.map((text) => <CodeGround key={text} />)}
				>
					<div>{lines.join("\n")}</div>
				</CodeArea>
			</CodeFrame>
		</div>
	);
}

describe("the code block's head (EC-02)", () => {
	it("the language and the file name are one size; the name is typed text and is mono, the language is a word and is sans", async () => {
		render(<Frame />);
		await expect.element(page.getByText("TypeScript")).toBeVisible();
		const language = getComputedStyle(page.getByText("TypeScript").element());
		const name = getComputedStyle(page.getByText("src/counter.ts").element());
		expect(language.fontSize).toBe(name.fontSize);
		expect(language.fontFamily).toContain("Pretendard");
		expect(name.fontFamily).toContain("Plex Mono");
	});
});

describe("the numbers' column (EC-08)", () => {
	it("the numbers end at the right of their column and the code starts within 24px of them; lines are 24px, one for each number", async () => {
		render(<Frame />);
		await expect.element(page.getByText("const a = 1;", { exact: false })).toBeVisible();
		const numbers = [...document.querySelectorAll("[data-slot=code-number]")];
		const text = document.querySelector("[data-slot=code-text]") as HTMLElement;
		/** Where the digits of a number end, from its own glyphs (not the box of the cell they stand in). */
		const inkRight = (number: Element) => {
			const walker = document.createTreeWalker(number, NodeFilter.SHOW_TEXT);
			const range = document.createRange();
			range.selectNodeContents(walker.nextNode() as Node);
			return range.getBoundingClientRect().right;
		};
		const gap = box(text).left + 8 - inkRight(numbers[0] as Element);
		expect(gap).toBeLessThanOrEqual(24);
		for (const number of numbers) expect(box(number).height).toBe(24);
		expect(new Set(numbers.map((number) => Math.round(inkRight(number)))).size, "the numbers end at one x").toBe(1);
	});
});
