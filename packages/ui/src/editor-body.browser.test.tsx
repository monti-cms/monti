import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { box } from "../../../testing/measure";
import { render } from "../test/render";
import { EditorBody } from "./index";

/**
 * The editor's text column, measured (causes 14 and 15 of the admin QA audit; docs/design/admin/components/editor-tools.md, "본문"): where a block's
 * edges stand, where a list's text starts, and the lines that mark a boundary.
 */

const first = (selector: string) => document.querySelector(selector) as HTMLElement;
const colour = (element: Element, property: "borderTopColor" | "borderLeftColor" | "borderBottomColor") =>
	getComputedStyle(element)[property];
/** Where the first line of text of an element starts and ends, from its own glyphs. */
function ink(element: Element) {
	const range = document.createRange();
	range.selectNodeContents(element);
	const rect = range.getClientRects()[0] as DOMRect;
	return { left: rect.left, right: rect.right };
}

function Body({ children }: { children: React.ReactNode }) {
	return (
		<div className="max-w-monti-reading">
			<EditorBody>
				<div className="ProseMirror">{children}</div>
			</EditorBody>
		</div>
	);
}

describe("blocks and their edges", () => {
	it("a right-aligned and a centred paragraph are as wide as the block, so their text ends where the other blocks end (ET-09)", async () => {
		render(
			<Body>
				<p data-align="right">오른쪽 맞춤</p>
				<p data-align="center">가운데 맞춤</p>
				<pre>
					<code>const a = 1;</code>
				</pre>
			</Body>,
		);
		await expect.element(page.getByText("오른쪽 맞춤")).toBeVisible();
		const [right, centre, pre] = [first("p[data-align=right]"), first("p[data-align=center]"), first("pre")];
		expect(box(right).right).toBe(box(pre).right);
		expect(box(right).left).toBe(box(pre).left);
		expect(Math.abs(ink(right).right - box(right).right)).toBeLessThanOrEqual(1);
		const middle = (ink(centre).left + ink(centre).right) / 2;
		expect(Math.abs(middle - (box(centre).left + box(centre).right) / 2)).toBeLessThanOrEqual(1);
	});

	it("a block in a quote starts after the bar and its 16px, and ends where the quote ends (ET-10)", async () => {
		render(
			<Body>
				<blockquote>
					<p>인용 안의 문단</p>
					<pre>
						<code>const a = 1;</code>
					</pre>
				</blockquote>
			</Body>,
		);
		await expect.element(page.getByText("인용 안의 문단")).toBeVisible();
		const quote = box(first("blockquote"));
		const code = box(first("blockquote pre"));
		expect(code.left - quote.left).toBe(2 + 16);
		expect(code.right).toBe(quote.right);
	});

	it("the text of a bulleted, a numbered and a checked list starts at one x (ET-12)", async () => {
		render(
			<Body>
				<ul>
					<li>
						<p>점 목록</p>
					</li>
				</ul>
				<ol>
					<li>
						<p>번호 목록</p>
					</li>
				</ol>
				<ul data-checklist>
					<li>
						<p>체크 목록</p>
					</li>
				</ul>
			</Body>,
		);
		await expect.element(page.getByText("체크 목록")).toBeVisible();
		const xs = ["점 목록", "번호 목록", "체크 목록"].map((text) => ink(page.getByText(text).element()).left);
		expect(new Set(xs.map((x) => Math.round(x))).size).toBe(1);
	});

	it("a footnote's text starts 24px after its number's edge, so number and words stay together (EL-05)", async () => {
		render(
			<Body>
				<p>본문</p>
				<div data-footnotes-start />
				<div data-footnote data-n="1">
					각주의 글
				</div>
			</Body>,
		);
		await expect.element(page.getByText("각주의 글")).toBeVisible();
		const note = first("[data-footnote]");
		expect(ink(note).left - box(note).left).toBe(24);
	});

	it("the cells of a table have the same padding on every side: 6px over and under, 8px at the sides, head and body alike (EX-07)", async () => {
		render(
			<Body>
				<table>
					<tbody>
						<tr>
							<th>머리</th>
							<td>칸</td>
						</tr>
					</tbody>
				</table>
			</Body>,
		);
		await expect.element(page.getByText("칸")).toBeVisible();
		for (const cell of document.querySelectorAll("th, td")) {
			const style = getComputedStyle(cell);
			expect([style.paddingTop, style.paddingBottom, style.paddingLeft, style.paddingRight]).toEqual([
				"6px",
				"6px",
				"8px",
				"8px",
			]);
		}
	});
});

describe("the lines that mark a boundary (ET-11, EX-06)", () => {
	it("the divider and the cells' grid are the emphasis line, not the quiet one", async () => {
		render(
			<Body>
				<p>글</p>
				<hr />
				<table>
					<tbody>
						<tr>
							<td>칸</td>
						</tr>
					</tbody>
				</table>
			</Body>,
		);
		await expect.element(page.getByText("칸")).toBeVisible();
		const emphasis = getComputedStyle(document.documentElement).getPropertyValue("--monti-border-emphasis").trim();
		expect(emphasis).not.toBe("");
		const probe = document.createElement("i");
		probe.style.color = "var(--monti-border-emphasis)";
		document.body.append(probe);
		const wanted = getComputedStyle(probe).color;
		probe.remove();
		expect(colour(first("hr"), "borderTopColor")).toBe(wanted);
		expect(colour(first("td"), "borderLeftColor")).toBe(wanted);
	});
});

describe("picked cells (EX-09)", () => {
	it("a cell that is picked has its own ground, and the words in it carry no second one: the browser's selection is not drawn over it", async () => {
		render(
			<Body>
				<table>
					<tbody>
						<tr>
							<td className="selectedCell">
								<p>여름</p>
							</td>
							<td>
								<p>겨울</p>
							</td>
						</tr>
					</tbody>
				</table>
			</Body>,
		);
		await expect.element(page.getByText("여름")).toBeVisible();
		const picked = getComputedStyle(first("td.selectedCell p"), "::selection").backgroundColor;
		const plain = getComputedStyle(first("td:not(.selectedCell) p"), "::selection").backgroundColor;
		expect(picked).toBe("rgba(0, 0, 0, 0)");
		expect(plain).not.toBe("rgba(0, 0, 0, 0)");
	});
});
