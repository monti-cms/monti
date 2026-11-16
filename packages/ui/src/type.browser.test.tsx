import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { box } from "../../../testing/measure";
import { render } from "../test/render";
import { Count, EditorBody, Label, StatusBar, StatusBarCell, Text } from "./index";

/**
 * The type roles as a person sees them (cause 13 of the admin QA audit): the editor's headings step down, its code is 14px, Korean words in the small
 * roles are sans, and what is typed or counted is mono only where it says so.
 */

const style = (text: string, exact = true) => getComputedStyle(page.getByText(text, { exact }).first().element());

describe("the editor body's headings and code (ET-01, ET-02, ET-04, ET-06, ET-07, EC-01)", () => {
	function Body() {
		return (
			<EditorBody>
				<h2>둘째 크기 제목</h2>
				<h3>셋째 크기 제목</h3>
				<h4>넷째 크기 제목</h4>
				<p>
					본문 문단 H<sub>2</sub>O 와 x<sup>2</sup> 그리고 <code>인라인 코드</code> 가 있다.
				</p>
				<pre>
					<code>const name = 1;</code>
				</pre>
			</EditorBody>
		);
	}

	it("h2, h3 and h4 step down 22, 19, 17px and never pass the text's own size; h4 is the body size, set apart by weight", async () => {
		render(<Body />);
		await expect.element(page.getByText("둘째 크기 제목")).toBeVisible();
		const sizes = ["둘째 크기 제목", "셋째 크기 제목", "넷째 크기 제목"].map((text) =>
			Number.parseFloat(style(text).fontSize),
		);
		expect(sizes).toEqual([22, 19, 17]);
		const body = Number.parseFloat(getComputedStyle(page.getByText("본문 문단", { exact: false }).element()).fontSize);
		expect(body).toBe(17);
		expect(style("넷째 크기 제목").fontWeight).toBe("600");
		expect(style("셋째 크기 제목").fontWeight).toBe("600");
	});

	it("code in the editor, in a block and inline, is 14px mono", async () => {
		render(<Body />);
		await expect.element(page.getByText("인라인 코드")).toBeVisible();
		for (const text of ["인라인 코드", "const name = 1;"]) {
			const code = style(text);
			expect(code.fontSize).toBe("14px");
			expect(code.fontFamily).toContain("Plex Mono");
		}
	});

	it("a raised and a lowered mark are moved the same distance from the baseline, and add nothing to the line", async () => {
		render(<Body />);
		await expect.element(page.getByText("본문 문단", { exact: false })).toBeVisible();
		const sub = getComputedStyle(document.querySelector("sub") as HTMLElement);
		const sup = getComputedStyle(document.querySelector("sup") as HTMLElement);
		expect(sup.position).toBe("relative");
		expect(sub.position).toBe("relative");
		expect(Math.abs(Number.parseFloat(sup.top))).toBeCloseTo(Math.abs(Number.parseFloat(sub.bottom)), 1);
		expect(box(document.querySelector("p") as HTMLElement).height % 30).toBe(0);
	});
});

describe("Korean words are sans; values are mono where they say so (LX-02, UX-02, EH-05, PP-47, PP-52)", () => {
	it("the small roles (`caption`, `micro`) draw words in the sans stack", async () => {
		render(
			<>
				<Text variant="micro">발행 전에 고칠 것</Text>
				<Text variant="caption">할 일 없음</Text>
			</>,
		);
		await expect.element(page.getByText("발행 전에 고칠 것")).toBeVisible();
		expect(style("발행 전에 고칠 것").fontFamily).toContain("Pretendard");
		expect(style("할 일 없음").fontFamily).toContain("Pretendard");
	});

	it("a typed value takes `mono`, and a count is mono", async () => {
		render(
			<>
				<Text mono variant="caption">
					/posts/first-post
				</Text>
				<Count>148</Count>
			</>,
		);
		await expect.element(page.getByText("148")).toBeVisible();
		expect(style("/posts/first-post").fontFamily).toContain("Plex Mono");
		expect(style("148").fontFamily).toContain("Plex Mono");
	});

	it("the status bar says its words in sans", async () => {
		render(
			<StatusBar aria-label="상태">
				<StatusBarCell>저장됨</StatusBarCell>
			</StatusBar>,
		);
		await expect.element(page.getByText("저장됨")).toBeVisible();
		expect(style("저장됨").fontFamily).toContain("Pretendard");
	});

	it("a field label is 12px sans (tokens.md), like the rest of its field", async () => {
		render(<Label>제목</Label>);
		await expect.element(page.getByText("제목")).toBeVisible();
		expect(style("제목").fontSize).toBe("12px");
		expect(style("제목").fontFamily).toContain("Pretendard");
	});

	it("the mono stack takes Hangul from a Hangul-only face after the monospace fonts, so Latin stays mono", async () => {
		render(
			<>
				<Text mono>한국어 코드</Text>
				<Text mono>iiiiiiii</Text>
				<Text mono>WWWWWWWW</Text>
			</>,
		);
		await expect.element(page.getByText("한국어 코드")).toBeVisible();
		const family = style("한국어 코드").fontFamily;
		expect(family.indexOf("Plex Mono")).toBeLessThan(family.indexOf("monospace"));
		expect(family.indexOf("monospace")).toBeLessThan(family.indexOf("Pretendard Hangul"));
		// The plain Pretendard is not in the mono stack: the Hangul alias is the only way to it.
		expect(family).not.toMatch(/"Monti Pretendard"/);
		await document.fonts.load('16px "Monti Pretendard Hangul"', "한국어");
		expect(document.fonts.check('16px "Monti Pretendard Hangul"', "한국어")).toBe(true);
		// Latin stays mono: the same width for a narrow and a wide letter.
		expect(box(page.getByText("iiiiiiii").element()).width).toBe(box(page.getByText("WWWWWWWW").element()).width);
	});
});

describe("digits are tabular (LR-18, LB-10)", () => {
	it("a count keeps one width for 9 and for 10 digits' worth of room", async () => {
		render(
			<>
				<Text>1111111111</Text>
				<Text>0000000000</Text>
			</>,
		);
		await expect.element(page.getByText("1111111111")).toBeVisible();
		const [ones, zeros] = ["1111111111", "0000000000"].map((text) => box(page.getByText(text).element()).width);
		expect(ones).toBe(zeros);
	});
});
