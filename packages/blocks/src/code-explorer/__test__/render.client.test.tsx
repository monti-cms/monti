import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { revealLines, revealRefText } from "../../code-ref/dom";
import { CodeRef } from "../../code-ref/render.client";
import { CodeExplorerView } from "../render.client";
import { buildTree } from "../tree";

// jsdom has no `scrollIntoView`; tests that scroll install a stub and this puts the original back.
const originalScroll = HTMLElement.prototype.scrollIntoView;

afterEach(() => {
	HTMLElement.prototype.scrollIntoView = originalScroll;
	cleanup();
	vi.restoreAllMocks();
	document.body.innerHTML = "";
});

interface File {
	readonly path: string;
	readonly code?: string;
	/** Anchor label of the code line. */
	readonly anchor?: string;
}

/** What the core code block renders, reduced to what the explorer and code links touch. */
const codeBlock = ({ path, code, anchor }: File) => (
	<div className="cms-code">
		<div className="cms-code-title" data-title={path}>
			{path}
		</div>
		<pre>
			<code>
				<span className="line" data-anchor={anchor}>
					{code}
				</span>
			</code>
		</pre>
	</div>
);

function mount(files: readonly File[], initial: number | null = 0, extra?: React.ReactNode) {
	const { nodes } = buildTree(files.map((file) => ({ path: file.path, code: file.code !== undefined })));
	return render(
		<>
			<CodeExplorerView
				tree={nodes}
				panels={files.map((file) => (file.code === undefined ? null : codeBlock(file)))}
				initial={initial}
				labels={{ files: "Files", toggle: "Toggle files" }}
			/>
			{extra}
		</>,
	);
}

const FILES: readonly File[] = [
	{ path: "src/app/page.tsx", code: "page();" },
	{ path: "src/lib/db.ts", code: "db();" },
	{ path: "src/lib/notes.txt" },
	{ path: "package.json", code: "{}" },
];

const item = (name: string) => screen.getByRole("treeitem", { name });
const panelOf = (code: string) =>
	screen.getByText(code, { selector: ".line" }).closest("[data-code-explorer-panel]") as HTMLElement;
/** Text of the lines of the shown panel (without the back-link button a code link adds to its line). */
const shownCode = () =>
	Array.from(document.querySelectorAll<HTMLElement>("[data-code-explorer-panel]:not([hidden]) .line"), (line) =>
		line.textContent?.replace("\u21a9", ""),
	);

describe("code explorer view", () => {
	it("shows the initial file, marks it selected, and keeps every panel in the DOM", () => {
		mount(FILES, 1);
		expect(shownCode()).toEqual(["db();"]);
		expect(item("db.ts").getAttribute("aria-selected")).toBe("true");
		expect(item("page.tsx").getAttribute("aria-selected")).toBe("false");
		expect(document.querySelectorAll("[data-code-explorer-panel]")).toHaveLength(3);
		expect(panelOf("page();").hidden).toBe(true);
		expect(screen.getByRole("tree", { name: "Files" })).toBeTruthy();
	});

	it("switches the file when a file in the tree is clicked and does nothing for a file with no code", () => {
		mount(FILES);
		fireEvent.click(item("package.json"));
		expect(shownCode()).toEqual(["{}"]);
		expect(item("package.json").getAttribute("aria-selected")).toBe("true");
		fireEvent.click(item("notes.txt"));
		expect(shownCode()).toEqual(["{}"]);
		expect(item("notes.txt").getAttribute("aria-disabled")).toBe("true");
		expect(item("notes.txt").hasAttribute("aria-selected")).toBe(false);
	});

	it("opens and closes folders with a click without changing the shown file", () => {
		mount(FILES);
		const lib = item("lib");
		expect(lib.getAttribute("aria-expanded")).toBe("true");
		fireEvent.click(lib);
		expect(lib.getAttribute("aria-expanded")).toBe("false");
		expect(screen.queryByRole("treeitem", { name: "db.ts" })).toBeNull();
		// The code of the closed folder's file is still in the page.
		expect(panelOf("db();")).toBeTruthy();
		expect(shownCode()).toEqual(["page();"]);
		fireEvent.click(lib);
		expect(item("db.ts")).toBeTruthy();
	});

	it("has one tab stop that follows the last focused item", () => {
		mount(FILES);
		const stops = () => screen.getAllByRole("treeitem").filter((node) => node.tabIndex === 0);
		expect(stops().map((node) => node.getAttribute("data-path"))).toEqual(["src/app/page.tsx"]);
		fireEvent.click(item("package.json"));
		expect(stops().map((node) => node.getAttribute("data-path"))).toEqual(["package.json"]);
	});

	it("moves with Up, Down, Home and End over the visible items, skipping the inside of closed folders", () => {
		mount(FILES);
		act(() => item("page.tsx").focus());
		const press = (key: string) => fireEvent.keyDown(document.activeElement as Element, { key });
		press("ArrowDown");
		expect(document.activeElement).toBe(item("lib"));
		press("ArrowDown");
		expect(document.activeElement).toBe(item("db.ts"));
		press("End");
		expect(document.activeElement).toBe(item("package.json"));
		press("ArrowDown");
		expect(document.activeElement).toBe(item("package.json"));
		press("Home");
		expect(document.activeElement).toBe(item("src"));
		press("ArrowUp");
		expect(document.activeElement).toBe(item("src"));

		// Close `lib` from the keyboard: its files are no longer visited.
		act(() => item("lib").focus());
		press("ArrowLeft");
		expect(item("lib").getAttribute("aria-expanded")).toBe("false");
		press("ArrowDown");
		expect(document.activeElement).toBe(item("package.json"));
	});

	it("opens a folder and goes into it with Right, and closes it or goes to its folder with Left", () => {
		mount(FILES);
		const press = (key: string) => fireEvent.keyDown(document.activeElement as Element, { key });
		act(() => item("app").focus());
		press("ArrowRight");
		expect(document.activeElement).toBe(item("page.tsx"));
		press("ArrowRight");
		expect(document.activeElement).toBe(item("page.tsx"));
		press("ArrowLeft");
		expect(document.activeElement).toBe(item("app"));
		press("ArrowLeft");
		expect(item("app").getAttribute("aria-expanded")).toBe("false");
		press("ArrowLeft");
		expect(document.activeElement).toBe(item("src"));
		press("ArrowLeft");
		expect(item("src").getAttribute("aria-expanded")).toBe("false");
		press("ArrowLeft");
		expect(document.activeElement).toBe(item("src"));
		press("ArrowRight");
		expect(item("src").getAttribute("aria-expanded")).toBe("true");
		// `app` was closed before and stays closed.
		expect(item("app").getAttribute("aria-expanded")).toBe("false");
	});

	it("picks a file with Enter and Space and toggles a folder with them; a file with no code is skipped", () => {
		mount(FILES);
		const press = (key: string) => fireEvent.keyDown(document.activeElement as Element, { key });
		act(() => item("db.ts").focus());
		press("Enter");
		expect(shownCode()).toEqual(["db();"]);
		act(() => item("package.json").focus());
		press(" ");
		expect(shownCode()).toEqual(["{}"]);
		act(() => item("notes.txt").focus());
		press("Enter");
		expect(shownCode()).toEqual(["{}"]);
		act(() => item("lib").focus());
		press("Enter");
		expect(item("lib").getAttribute("aria-expanded")).toBe("false");
		press(" ");
		expect(item("lib").getAttribute("aria-expanded")).toBe("true");
		// Other keys are left alone.
		const handled = fireEvent.keyDown(document.activeElement as Element, { key: "a" });
		expect(handled).toBe(true);
	});

	it("renders only the tree, with no button, when no file has code", () => {
		mount([{ path: "a.ts" }, { path: "src/" }], null);
		expect(screen.getByRole("tree")).toBeTruthy();
		expect(document.querySelector("[data-code-explorer-panel]")).toBeNull();
		expect(screen.queryByRole("button")).toBeNull();
		fireEvent.click(item("a.ts"));
		expect(document.querySelector("[data-code-explorer-panel]")).toBeNull();
	});

	it("shows the current path on the narrow screen button, which opens the list and closes it when a file is picked", () => {
		mount(FILES);
		const toggle = screen.getByRole("button", { name: "src/app/page.tsx" });
		const root = toggle.closest(".cms-block-code-explorer") as HTMLElement;
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
		expect(toggle.getAttribute("aria-controls")).toBe(screen.getByRole("tree").id);
		expect(root.hasAttribute("data-nav-open")).toBe(false);
		fireEvent.click(toggle);
		expect(toggle.getAttribute("aria-expanded")).toBe("true");
		expect(root.hasAttribute("data-nav-open")).toBe(true);
		fireEvent.click(item("package.json"));
		expect(toggle.textContent).toBe("package.json");
		expect(toggle.getAttribute("aria-expanded")).toBe("false");
	});

	describe("reveal", () => {
		it("shows the file of the element a `cms:reveal` event comes from, and opens the folders above it", () => {
			mount(FILES);
			fireEvent.click(item("lib"));
			fireEvent.click(item("app"));
			const line = screen.getByText("db();", { selector: ".line" });
			expect(line.closest("[data-code-explorer-panel]")?.hasAttribute("hidden")).toBe(true);
			act(() => {
				line.dispatchEvent(new CustomEvent("cms:reveal", { bubbles: true }));
			});
			expect(shownCode()).toEqual(["db();"]);
			expect(item("db.ts").getAttribute("aria-selected")).toBe("true");
			// The folders above the file are open again; others are left as they were.
			expect(item("lib").getAttribute("aria-expanded")).toBe("true");
			expect(item("src").getAttribute("aria-expanded")).toBe("true");
			expect(item("app").getAttribute("aria-expanded")).toBe("false");
		});

		it("is applied before the dispatch returns, so a scroll right after lands on a visible line", () => {
			mount(FILES);
			const line = screen.getByText("{}", { selector: ".line" });
			expect(line.closest<HTMLElement>("[data-code-explorer-panel]")?.hidden).toBe(true);
			line.dispatchEvent(new CustomEvent("cms:reveal", { bubbles: true }));
			expect(line.closest<HTMLElement>("[data-code-explorer-panel]")?.hidden).toBe(false);
		});

		it("ignores events from outside the panels", () => {
			mount(FILES);
			act(() => {
				item("package.json").dispatchEvent(new CustomEvent("cms:reveal", { bubbles: true }));
			});
			expect(shownCode()).toEqual(["page();"]);
		});

		it("lets a code link switch to the file of its line (revealLines through the real link)", () => {
			vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (this: HTMLElement) {
				// jsdom has no layout: a line is "rendered" only while its panel is shown.
				return (this.closest("[hidden]") ? [] : [{}]) as unknown as DOMRectList;
			});
			const scrolledTo: { text: string | null; hidden: boolean }[] = [];
			const scroll = vi.fn(function (this: HTMLElement) {
				scrolledTo.push({
					text: this.textContent?.replace("\u21a9", "") ?? null,
					hidden: Boolean(this.closest("[hidden]")),
				});
			});
			HTMLElement.prototype.scrollIntoView = scroll;

			mount(
				[
					{ path: "a.ts", code: "a();" },
					{ path: "b.ts", code: "b();", anchor: "c1" },
				],
				0,
				<p>
					see <CodeRef to="c1">the b line</CodeRef>
				</p>,
			);
			expect(shownCode()).toEqual(["a();"]);
			fireEvent.click(screen.getByText("the b line"));
			expect(shownCode()).toEqual(["b();"]);
			expect(scroll).toHaveBeenCalledTimes(1);
			expect(scrolledTo).toEqual([{ text: "b();", hidden: false }]);
		});

		it("lets revealLines and revealRefText on raw elements switch the panel too", () => {
			HTMLElement.prototype.scrollIntoView = vi.fn();
			mount(
				[
					{ path: "a.ts", code: "a();" },
					{ path: "b.ts", code: "b();", anchor: "c1" },
				],
				0,
				<p data-code-ref="c1">text</p>,
			);
			const line = screen.getByText("b();", { selector: ".line" });
			revealLines([line]);
			expect(shownCode()).toEqual(["b();"]);

			fireEvent.click(item("a.ts"));
			expect(shownCode()).toEqual(["a();"]);
			// A text outside the explorer does not change the file.
			revealRefText("c1", 10);
			expect(shownCode()).toEqual(["a();"]);
			const inside = within(document.body).getByText("a();", { selector: ".line" });
			expect(inside.closest("[hidden]")).toBeNull();
		});
	});
});
