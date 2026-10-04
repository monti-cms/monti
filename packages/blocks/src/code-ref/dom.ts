/**
 * 본문 `:code-ref`가 가리키는 코드 줄을 공개 화면 DOM에서 찾고 다루는 함수들.
 * 코드 줄은 본체 코드 블록이 `.line[data-anchor~="이름"]`로 표시한다(줄 이름표 `anchor` 줄 효과).
 */

const ANCHOR_ID = /^[\w-]+$/;

/** 이름표가 `id`인 코드 줄(문서 순서). 이름표로 쓸 수 없는 글자가 있으면 찾지 않는다. */
export function findAnchorLines(id: string, root: ParentNode = document): HTMLElement[] {
	if (!ANCHOR_ID.test(id)) return [];
	return Array.from(root.querySelectorAll<HTMLElement>(`.line[data-anchor~="${id}"]`));
}

/** 화면에 그려져 있는지(닫힌 접기 안이면 그려지지 않는다). */
const isRendered = (element: HTMLElement) => element.getClientRects().length > 0;

/** 줄 가운데 하나라도 지금 화면 안에 보이는지. 보이면 페이지를 움직이지 않고 그 자리에서 강조한다. */
export function isOnScreen(lines: readonly HTMLElement[]): boolean {
	const height = window.innerHeight || document.documentElement.clientHeight;
	return lines.some((line) => {
		if (!isRendered(line)) return false;
		const rect = line.getBoundingClientRect();
		return rect.bottom > 0 && rect.top < height;
	});
}

/** 줄을 강조(`data-focused`)하고 같은 코드 블록의 나머지 줄을 흐리게 한다(`pre[data-code-focus]`). 되돌리는 함수를 돌려준다. */
export function focusLines(lines: readonly HTMLElement[]): () => void {
	const pres = new Set<HTMLElement>();
	for (const line of lines) {
		line.setAttribute("data-focused", "");
		const pre = line.closest("pre");
		if (pre) pres.add(pre);
	}
	for (const pre of pres) pre.setAttribute("data-code-focus", "");
	return () => {
		for (const line of lines) line.removeAttribute("data-focused");
		for (const pre of pres) pre.removeAttribute("data-code-focus");
	};
}

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** 줄이 접힌 곳 안이면 펼치고, 화면 가운데로 옮긴다. 움직임 줄이기 설정이면 애니메이션 없이 옮긴다. */
export function revealLines(lines: readonly HTMLElement[]) {
	const first = lines[0];
	if (!first) return;
	for (const line of lines) {
		for (let details = line.closest("details"); details; details = details.parentElement?.closest("details") ?? null)
			details.open = true;
	}
	first.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}
