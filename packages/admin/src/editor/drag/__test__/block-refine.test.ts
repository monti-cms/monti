import { describe, expect, it } from "vitest";
import { findBlockDOM, refineBlock } from "../block-resolve";

/** jsdom에는 배치가 없다. 테스트할 요소마다 사각형을 준다. */
const box = (element: Element | null, left: number, top: number, right: number, bottom: number) => {
	if (!element) throw new Error("요소 없음");
	(element as HTMLElement).getBoundingClientRect = () => new DOMRect(left, top, right - left, bottom - top);
	return element as HTMLElement;
};

const html = (markup: string) => {
	const root = document.createElement("div");
	root.className = "ProseMirror";
	root.innerHTML = markup;
	document.body.replaceChildren(root);
	return root;
};

describe("한 줄에 핸들 하나(refineBlock)", () => {
	it("목록의 글머리표 자리는 그 높이의 항목, 들여쓴 목록이면 안쪽 항목이다", () => {
		const root = html("<ul><li><p>첫째</p></li><li><p>둘째</p><ul><li><p>안쪽</p></li></ul></li></ul>");
		const [outer, first, second, inner] = [
			root.querySelector("ul"),
			root.querySelectorAll("li")[0],
			root.querySelectorAll("li")[1],
			root.querySelectorAll("li")[2],
		];
		box(outer, 0, 0, 500, 90);
		box(first, 20, 0, 500, 30);
		box(second, 20, 30, 500, 90);
		box(second?.querySelector("ul") ?? null, 40, 60, 500, 90);
		box(inner, 60, 60, 500, 90);
		expect(refineBlock(outer as HTMLElement, 5, 10)).toBe(first);
		expect(refineBlock(outer as HTMLElement, 5, 40)).toBe(second);
		expect(refineBlock(outer as HTMLElement, 5, 70)).toBe(inner);
	});

	it("목록 항목 사이 여백은 목록 전체가 아니라 가까운 항목이다", () => {
		const root = html("<ul><li><p>첫째</p></li><li><p>둘째</p></li></ul>");
		const [first, second] = Array.from(root.querySelectorAll("li"));
		const list = box(root.querySelector("ul"), 0, 0, 500, 100);
		box(first ?? null, 20, 0, 500, 40);
		box(second ?? null, 20, 60, 500, 100);
		expect(refineBlock(list, 5, 45)).toBe(first);
		expect(refineBlock(list, 5, 56)).toBe(second);
	});

	it("단 하나는 대상이 아니다: 단의 틈·여백은 그 높이의 문단, 문단이 없는 줄은 단 나누기 전체다", () => {
		const root = html(
			'<div class="react-renderer node-cmsColumns"><div data-node-view-wrapper><div data-node-view-content><div data-node-view-content-react>' +
				'<div class="react-renderer node-cmsColumn"><div data-node-view-wrapper><div data-node-view-content><div data-node-view-content-react><p>왼쪽</p></div></div></div></div>' +
				'<div class="react-renderer node-cmsColumn"><div data-node-view-wrapper><div data-node-view-content><div data-node-view-content-react><p>오른쪽</p></div></div></div></div>' +
				"</div></div></div></div>",
		);
		const columns = root.querySelector<HTMLElement>(".node-cmsColumns");
		const [left, right] = Array.from(root.querySelectorAll<HTMLElement>(".node-cmsColumn"));
		box(columns, 0, 0, 500, 100);
		box(left ?? null, 0, 12, 240, 100);
		box(right ?? null, 260, 12, 500, 100);
		const leftText = box(left?.querySelector("p") ?? null, 8, 16, 232, 40);
		const rightText = box(right?.querySelector("p") ?? null, 268, 16, 492, 40);

		expect(refineBlock(columns as HTMLElement, 255, 20)).toBe(rightText);
		expect(refineBlock(columns as HTMLElement, 100, 20)).toBe(leftText);
		// 단 안의 문단 아래 여백: 단 하나가 아니라 단 나누기 전체
		expect(refineBlock(left as HTMLElement, 100, 80)).toBe(columns);
		// 위쪽 여백(문단이 없는 줄): 단 나누기 전체
		expect(refineBlock(columns as HTMLElement, 100, 5)).toBe(columns);
	});

	it("인용문 안쪽을 가리켜도 인용문 전체가 대상이다", () => {
		const root = html("<blockquote><p>인용</p><p>둘째</p></blockquote><p>뒤</p>");
		const quote = root.querySelector("blockquote");
		expect(findBlockDOM(root, root.querySelector("blockquote p"))).toBe(quote);
	});
});
