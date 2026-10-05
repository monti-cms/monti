import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addBackLink, findAnchorLines, previewLines, revealLines, revealRefText } from "../dom";
import { CodeRef } from "../render.client";

const BACK = "Go to the text that links here";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.useRealTimers();
	document.body.innerHTML = "";
});

/** jsdom has no layout: every element is "not rendered" unless told otherwise. */
function stubLayout(onScreen: boolean) {
	vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
		(onScreen ? { top: 100, bottom: 120 } : { top: 5000, bottom: 5020 }) as DOMRect,
	);
}

const line = (text: string, anchor?: string) =>
	`<span class="line"${anchor ? ` data-anchor="${anchor}"` : ""}>${text}</span>\n`;

const block = (lines: string, title?: string) =>
	`<div class="cms-code">${title ? `<div class="cms-code-title" data-title="${title}">${title}</div>` : ""}<pre><code>${lines}</code></pre></div>`;

function mount(code: string, texts: readonly string[] = ["the text"]) {
	document.body.innerHTML = `${code}<div id="root"></div>`;
	return render(
		<p>
			{texts.map((text) => (
				<CodeRef key={text} to="c1">
					{text}
				</CodeRef>
			))}
		</p>,
		{ container: document.getElementById("root") as HTMLElement },
	);
}

describe("findAnchorLines", () => {
	it("returns only the lines of the first code block that has the label", () => {
		document.body.innerHTML =
			block(line("a", "c1") + line("b") + line("c", "c1")) + block(line("x", "c1") + line("y", "c1"));
		const found = findAnchorLines("c1");
		expect(found.map((item) => item.textContent)).toEqual(["a", "c"]);
		expect(new Set(found.map((item) => item.closest("pre"))).size).toBe(1);
		expect(findAnchorLines("c1")[0]?.closest("pre")).toBe(document.querySelector("pre"));
	});

	it("skips code blocks without the label and rejects ids that cannot be anchors", () => {
		document.body.innerHTML = block(line("a", "c2")) + block(line("b", "c1"));
		expect(findAnchorLines("c1").map((item) => item.textContent)).toEqual(["b"]);
		expect(findAnchorLines('c1"]')).toEqual([]);
	});
});

describe("reveal events", () => {
	it("dispatches a bubbling `cms:reveal` on each line before scrolling, so a block that hides them can show them", () => {
		document.body.innerHTML = block(line("a", "c1") + line("b", "c1"));
		const order: string[] = [];
		const lines = findAnchorLines("c1");
		document.body.addEventListener("cms:reveal", (event) =>
			order.push(`reveal ${(event.target as HTMLElement).textContent}`),
		);
		const scrollIntoView = vi.fn(() => order.push("scroll"));
		for (const item of lines) item.scrollIntoView = scrollIntoView;
		revealLines(lines);
		expect(order).toEqual(["reveal a", "reveal b", "scroll"]);
	});

	it("dispatches it on the text before scrolling to a text that points to the label", () => {
		document.body.innerHTML = '<p><span data-code-ref="c1">the text</span></p>';
		const text = document.querySelector("span") as HTMLElement;
		const order: string[] = [];
		document.body.addEventListener("cms:reveal", () => order.push("reveal"));
		text.scrollIntoView = vi.fn(() => order.push("scroll"));
		revealRefText("c1", 10);
		expect(order).toEqual(["reveal", "scroll"]);
	});
});

describe("addBackLink", () => {
	it("adds one labeled button to the first line, once, and removes it on cleanup", () => {
		document.body.innerHTML = block(line("a", "c1") + line("b", "c1"));
		const lines = findAnchorLines("c1");
		const onClick = vi.fn();
		const remove = addBackLink(lines, onClick, BACK);
		const again = addBackLink(lines, onClick, BACK);

		const buttons = document.querySelectorAll("button[data-code-ref-back]");
		expect(buttons).toHaveLength(1);
		expect(buttons[0]?.parentElement).toBe(lines[0]);
		expect(buttons[0]?.getAttribute("aria-label")).toBe(BACK);
		(buttons[0] as HTMLElement).click();
		expect(onClick).toHaveBeenCalledTimes(1);

		again();
		expect(document.querySelectorAll("button[data-code-ref-back]")).toHaveLength(1);
		remove();
		expect(document.querySelectorAll("button[data-code-ref-back]")).toHaveLength(0);
	});

	it("the button text is not part of the line preview", () => {
		document.body.innerHTML = block(line("  const a = 1;", "c1") + line("  return a;", "c1"), "src/add.ts");
		addBackLink(findAnchorLines("c1"), () => {}, BACK);
		expect(previewLines(findAnchorLines("c1"), 8)).toEqual({
			title: "src/add.ts",
			lines: ["const a = 1;", "return a;"],
			truncated: false,
		});
	});
});

describe("CodeRef back link", () => {
	it("the first text of a label owns one button, clicking it highlights that text, and unmounting removes it", () => {
		vi.useFakeTimers();
		const scroll = vi.fn();
		vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(scroll);
		const view = mount(block(line("a", "c1") + line("b", "c1")), ["first", "second"]);

		const buttons = document.querySelectorAll<HTMLElement>("button[data-code-ref-back]");
		expect(buttons).toHaveLength(1);
		const first = screen.getByText("first");
		buttons[0]?.click();
		expect(scroll).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
		expect(first.hasAttribute("data-focused")).toBe(true);
		expect(screen.getByText("second").hasAttribute("data-focused")).toBe(false);
		act(() => {
			vi.advanceTimersByTime(2600);
		});
		expect(first.hasAttribute("data-focused")).toBe(false);

		view.unmount();
		expect(document.querySelectorAll("button[data-code-ref-back]")).toHaveLength(0);
	});

	it("adds no button when the label is not found", () => {
		mount(block(line("a", "c2")));
		expect(document.querySelectorAll("button[data-code-ref-back]")).toHaveLength(0);
	});
});

describe("CodeRef hover preview", () => {
	it("shows the linked lines and the code block title next to the text while they are off screen, and hides on leave", () => {
		stubLayout(false);
		mount(block(line("const a = 1;", "c1") + line("return a;", "c1") + line("other"), "src/add.ts"));
		const ref = screen.getByRole("button", { name: "the text" });
		expect(screen.queryByRole("tooltip")).toBeNull();

		fireEvent.pointerEnter(ref, { pointerType: "mouse" });
		const tip = screen.getByRole("tooltip");
		expect(ref.getAttribute("aria-describedby")).toBe(tip.id);
		expect(tip.textContent).toBe("src/add.tsconst a = 1;return a;");
		expect(tip.querySelectorAll(".cms-block-code-ref-preview-line")).toHaveLength(2);

		fireEvent.pointerLeave(ref, { pointerType: "mouse" });
		expect(screen.queryByRole("tooltip")).toBeNull();
		expect(ref.hasAttribute("aria-describedby")).toBe(false);
	});

	it("shows on keyboard focus, hides on Esc and blur, and caps long ranges with an ellipsis line", () => {
		stubLayout(false);
		const many = Array.from({ length: 12 }, (_, index) => line(`l${index}`, "c1")).join("");
		mount(block(many));
		const ref = screen.getByRole("button", { name: "the text" });

		fireEvent.focus(ref);
		const lines = screen.getByRole("tooltip").querySelectorAll(".cms-block-code-ref-preview-line");
		expect(Array.from(lines, (item) => item.textContent)).toEqual([
			"l0",
			"l1",
			"l2",
			"l3",
			"l4",
			"l5",
			"l6",
			"l7",
			"…",
		]);

		fireEvent.keyDown(ref, { key: "Escape" });
		expect(screen.queryByRole("tooltip")).toBeNull();
		fireEvent.focus(ref);
		expect(screen.getByRole("tooltip")).toBeTruthy();
		fireEvent.blur(ref);
		expect(screen.queryByRole("tooltip")).toBeNull();
	});

	it("shows no preview when the lines are on screen, but still highlights them in place", () => {
		stubLayout(true);
		mount(block(line("a", "c1") + line("b")));
		const ref = screen.getByRole("button", { name: "the text" });
		fireEvent.pointerEnter(ref, { pointerType: "mouse" });
		expect(screen.queryByRole("tooltip")).toBeNull();
		expect(document.querySelector(".line")?.hasAttribute("data-focused")).toBe(true);
	});

	it("pressing the text hides the preview and scrolls to the lines", () => {
		stubLayout(false);
		const scroll = vi.fn();
		vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(scroll);
		mount(block(line("a", "c1")));
		const ref = screen.getByRole("button", { name: "the text" });
		fireEvent.pointerEnter(ref, { pointerType: "mouse" });
		expect(screen.getByRole("tooltip")).toBeTruthy();
		fireEvent.click(ref);
		expect(screen.queryByRole("tooltip")).toBeNull();
		expect(scroll).toHaveBeenCalled();
		expect(document.querySelector(".line")?.hasAttribute("data-focused")).toBe(true);
	});
});
