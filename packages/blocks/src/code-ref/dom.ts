/**
 * Functions that find and handle, in the public page DOM, the code lines a body `:code-ref` points to.
 * Code lines are marked by the core code block as `.line[data-anchor~="name"]` (the `anchor` line effect).
 */

const ANCHOR_ID = /^[\w-]+$/;

/**
 * Code lines whose anchor is `id` (document order). A label is meant to be unique per document, and a link must resolve to exactly one code block,
 * so only the lines of the first `<pre>` (in document order) that has a matching line are returned, never lines from two code blocks.
 * Nothing is found if `id` has characters that cannot be used as an anchor.
 */
export function findAnchorLines(id: string, root: ParentNode = document): HTMLElement[] {
	if (!ANCHOR_ID.test(id)) return [];
	const lines = Array.from(root.querySelectorAll<HTMLElement>(`.line[data-anchor~="${id}"]`));
	const pre = lines[0]?.closest("pre") ?? null;
	return lines.filter((line) => (line.closest("pre") ?? null) === pre);
}

/** The body text elements (`[data-code-ref]`) that point to `id` (document order). Nothing is found for an id that cannot be an anchor. */
export function findRefTexts(id: string, root: ParentNode = document): HTMLElement[] {
	if (!ANCHOR_ID.test(id)) return [];
	return Array.from(root.querySelectorAll<HTMLElement>(`[data-code-ref="${id}"]`));
}

/** Whether it is rendered (it is not when inside a closed collapsible). */
const isRendered = (element: HTMLElement) => element.getClientRects().length > 0;

/** Whether any of the lines is currently visible in the viewport. If so, highlight in place without scrolling. */
export function isOnScreen(lines: readonly HTMLElement[]): boolean {
	const height = window.innerHeight || document.documentElement.clientHeight;
	return lines.some((line) => {
		if (!isRendered(line)) return false;
		const rect = line.getBoundingClientRect();
		return rect.bottom > 0 && rect.top < height;
	});
}

/** Highlights the lines (`data-focused`) and dims the other lines of the same code block (`pre[data-code-focus]`). Returns a function that undoes it. */
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

/**
 * Event a reveal dispatches on its target before scrolling (it bubbles). A block that hides content (a tab, a file of the code explorer)
 * listens for it, shows the part that holds `event.target` synchronously, and so makes the target visible before the scroll.
 */
export const REVEAL_EVENT = "cms:reveal";

const announceReveal = (element: HTMLElement) =>
	element.dispatchEvent(new CustomEvent(REVEAL_EVENT, { bubbles: true }));

/**
 * Expands the lines if they are inside a collapsed area, asks the blocks that hide them to show them (`cms:reveal`), and scrolls them to the center.
 * With the reduced-motion setting, scrolls without animation.
 */
export function revealLines(lines: readonly HTMLElement[]) {
	const first = lines[0];
	if (!first) return;
	for (const line of lines) {
		for (let details = line.closest("details"); details; details = details.parentElement?.closest("details") ?? null)
			details.open = true;
		announceReveal(line);
	}
	first.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/** Preview of linked code lines: the code block title (if any), the text of each line, and whether the list was cut short. */
export interface CodePreview {
	readonly title?: string;
	readonly lines: readonly string[];
	readonly truncated: boolean;
}

/** Elements inside a code line that are not code text (in-code tooltip contents and numbers, the back-link button). */
const NON_CODE = '[role="tooltip"], .cms-block-tooltip-note, [data-code-ref-back]';

/** Text of one code line without the elements that are not code (they are added to the line by tooltips and back links). */
function lineText(line: HTMLElement): string {
	const copy = line.cloneNode(true) as HTMLElement;
	for (const extra of copy.querySelectorAll(NON_CODE)) extra.remove();
	return (copy.textContent ?? "").replace(/\n+$/, "");
}

/** Removes the indentation shared by all non-blank lines so deeply nested code still fits a small box. */
function dedent(lines: readonly string[]): string[] {
	const indents = lines.filter((line) => line.trim()).map((line) => /^[ \t]*/.exec(line)?.[0].length ?? 0);
	const shared = indents.length ? Math.min(...indents) : 0;
	return lines.map((line) => line.slice(Math.min(shared, line.length)));
}

/** Text of the linked lines (at most `max`, the rest is reported by `truncated`) and the title of their code block (`.cms-code-title`). */
export function previewLines(lines: readonly HTMLElement[], max: number): CodePreview {
	const title = lines[0]?.closest(".cms-code")?.querySelector(".cms-code-title")?.getAttribute("data-title")?.trim();
	return {
		...(title ? { title } : {}),
		lines: dedent(lines.slice(0, max).map(lineText)),
		truncated: lines.length > max,
	};
}

/**
 * Adds a small back-link button at the end of the first line of the linked lines (code to text). Does nothing if the line already has one,
 * so only one `CodeRef` per label adds it. Returns a function that removes the button.
 */
export function addBackLink(lines: readonly HTMLElement[], onClick: () => void, label: string): () => void {
	const first = lines[0];
	if (!first || Array.from(first.children).some((child) => child.hasAttribute("data-code-ref-back"))) return () => {};
	const button = first.ownerDocument.createElement("button");
	button.type = "button";
	button.className = "cms-block-code-ref-back";
	button.setAttribute("data-code-ref-back", "");
	button.setAttribute("aria-label", label);
	button.title = label;
	button.textContent = "\u21a9";
	button.addEventListener("click", onClick);
	first.append(button);
	return () => {
		button.removeEventListener("click", onClick);
		button.remove();
	};
}

const flashTimers = new WeakMap<HTMLElement, number>();

/** Highlights the element (`data-focused`) and removes the highlight after `ms`. Pressing again restarts the timer. */
export function flashElement(element: HTMLElement, ms: number) {
	window.clearTimeout(flashTimers.get(element));
	element.setAttribute("data-focused", "");
	flashTimers.set(
		element,
		window.setTimeout(() => {
			element.removeAttribute("data-focused");
			flashTimers.delete(element);
		}, ms),
	);
}

/** Scrolls the first body text that points to `id` to the center (expanding collapsed areas, `cms:reveal`) and highlights it briefly. */
export function revealRefText(id: string, ms: number, root: ParentNode = document) {
	const text = findRefTexts(id, root)[0];
	if (!text) return;
	for (let details = text.closest("details"); details; details = details.parentElement?.closest("details") ?? null)
		details.open = true;
	announceReveal(text);
	text.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
	flashElement(text, ms);
}
