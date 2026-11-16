import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as entry from "./entry/entry.stories";
import * as siteBlocks from "./entry/site-blocks.stories";
import * as translation from "./entry/translation.stories";
import { setScreenMode } from "./frame/use-screen-mode";
import * as list from "./list/list.stories";
import * as media from "./media/media.stories";
import * as collections from "./settings/collections.stories";
import * as settings from "./settings/settings.stories";

/**
 * Where things stand on a screen, measured on the real screens (causes 14, 15 and 7 of the admin QA audit): the property panel's fields, and a disabled pill
 * in dark. The rules are in docs/design/admin/components/field.md and button.md.
 */

const { Draft, Published } = composeStories(entry);
const { Main } = composeStories(list);
const { SourceChanged, SourceDraft, SideBySide } = composeStories(translation);
const { EveryBlock } = composeStories(siteBlocks);
const { Site } = composeStories(settings);
const { EditField } = composeStories(collections);
const { Top, ListView, FilePanel, FilePanelManyUses } = composeStories(media);
const box = (element: Element) => element.getBoundingClientRect();

/** The WCAG contrast of two `rgb(...)` colours. */
function contrast(a: string, b: string) {
	const lum = (rgb: string) => {
		const [r, g, bl] = (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => {
			const v = Number(value) / 255;
			return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
		}) as [number, number, number];
		return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
	};
	const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
	return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}
const channels = (rgb: string) => (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
/** `colour` shown at `opacity` over `ground`, as a person sees it. */
const over = (colour: string, ground: string, opacity: number) => {
	const [c, g] = [channels(colour), channels(ground)];
	return `rgb(${c.map((v, at) => Math.round(v * opacity + (g[at] ?? 0) * (1 - opacity))).join(",")})`;
};

describe("the property panel's fields (PP-07, PP-08, PP-09, PP-10)", () => {
	it("every field of the panel is one height (32px, `md`), one width (the panel's) and starts its words at one x", async () => {
		await Draft.run();
		const panel = page.getByRole("complementary").first();
		await expect.element(panel.getByText("대표 이미지")).toBeVisible();
		const root = panel.element();
		const fields = [
			...root.querySelectorAll(
				"[data-slot=input-line], [data-slot=media-input], [data-slot=combobox-input], input[data-slot=input]:not([data-slot=combobox-input] input)",
			),
		].filter((field) => !field.closest("[data-slot=input-line]") || field.matches("[data-slot=input-line]"));
		expect(fields.length).toBeGreaterThanOrEqual(4);
		const heights = fields.map((field) => Math.round(box(field).height));
		const widths = fields.map((field) => Math.round(box(field).width));
		expect(new Set(heights), `heights ${heights.join(", ")}`).toEqual(new Set([32]));
		expect(new Set(widths), `widths ${widths.join(", ")}`).toHaveProperty("size", 1);
		// The words start 8px in from the field's edge, whichever part draws it.
		const starts = [...root.querySelectorAll("input[data-slot=input]")].map((input) => {
			const field = input.closest("[data-slot=input-line], [data-slot=combobox-input]") ?? input;
			return Math.round(box(input).left + Number.parseFloat(getComputedStyle(input).paddingLeft) - box(field).left);
		});
		expect(new Set(starts), `starts ${starts.join(", ")}`).toHaveProperty("size", 1);
	});
});

describe("a disabled pill in dark (PP-61)", () => {
	it('"Published" in dark reads as off, and its words keep 3:1 against its fill', async () => {
		setScreenMode("dark");
		try {
			await Published.run();
			const button = page.getByRole("button", { name: "발행됨" });
			await expect.element(button).toBeVisible();
			const element = button.element() as HTMLElement;
			const style = getComputedStyle(element);
			expect(Number.parseFloat(style.opacity)).toBeLessThan(1);
			let ground = "rgb(0, 0, 0)";
			for (let up: HTMLElement | null = element.parentElement; up; up = up.parentElement) {
				const background = getComputedStyle(up).backgroundColor;
				if (!/rgba\(.*, 0\)|transparent/.test(background)) {
					ground = background;
					break;
				}
			}
			const opacity = Number.parseFloat(style.opacity);
			const fill = over(style.backgroundColor, ground, opacity);
			const words = over(style.color, ground, opacity);
			expect(contrast(words, fill), `words ${words} on ${fill}`).toBeGreaterThanOrEqual(3);
			// And it is dimmer than the pill that can be pressed: the fill is not the pill's own.
			expect(contrast(fill, ground)).toBeLessThan(contrast(style.backgroundColor, ground));
		} finally {
			setScreenMode("system");
		}
	});
});

describe("the list's header and rows (LH-11, LR-05, LR-13)", () => {
	it("closing the search with Esc leaves the buttons of the header where they were", async () => {
		await Main.run();
		const main = page.getByRole("main");
		await expect.element(main.getByRole("heading", { level: 1 })).toBeVisible();
		const header = main.element().querySelector("[data-slot=page-header]") as HTMLElement;
		const positions = () =>
			[...header.querySelectorAll("button")].map((button) => Math.round(box(button).right * 10) / 10);
		const before = positions();
		await userEvent.click(main.getByRole("button", { name: "검색" }));
		await userEvent.keyboard("{Escape}");
		await expect.poll(positions).toEqual(before);
	});
});

describe("the media page's rows (MD-09, MD-10, MD-27)", () => {
	it("the filter row and the grid start where the table's words start, 12px in from the title, as every row does", async () => {
		await Top.run();
		const main = page.getByRole("main").element();
		await expect.element(page.getByRole("heading", { level: 1, name: "미디어" })).toBeVisible();
		const title = box(main.querySelector("h1") as Element).left;
		const toolbar = main.querySelector("[data-slot=page-toolbar] button") as Element;
		const tile = main.querySelector("[data-slot=tile]") as Element;
		expect(Math.round(box(toolbar).left - title)).toBe(12);
		expect(Math.round(box(tile).left - title)).toBe(12);
	});

	it("the header's buttons are 36px, its segmented switch 28px and the filter row 48px: one height to a row", async () => {
		await Top.run();
		await expect.element(page.getByRole("heading", { level: 1, name: "미디어" })).toBeVisible();
		const main = page.getByRole("main").element();
		const header = main.querySelector("[data-slot=page-header]") as Element;
		for (const button of header.querySelectorAll("[data-slot=button], [data-slot=split-button]"))
			expect(Math.round(box(button).height)).toBe(36);
		expect(Math.round(box(header.querySelector("[data-slot=segmented]") as Element).height)).toBe(28);
		expect(Math.round(box(main.querySelector("[data-slot=page-toolbar]") as Element).height)).toBe(48);
	});

	it("in the list view the columns fill the table: the title takes what the others leave, and no column is wider than its kind's width", async () => {
		await ListView.run();
		await expect.element(page.getByRole("heading", { level: 1, name: "미디어" })).toBeVisible();
		const table = page.getByRole("main").element().querySelector("table") as HTMLElement;
		const widths = [...table.querySelectorAll("thead th")].map((th) => box(th).width);
		expect(Math.abs(widths.reduce((sum, width) => sum + width, 0) - box(table).width)).toBeLessThanOrEqual(1);
		const [name, ...others] = widths;
		expect(name).toBeGreaterThan(Math.max(...others));
	});
});

describe("a file's panel (MD-06, MD-42)", () => {
	it("the file name's extension stands inside the field's underline, and the name is typed text in mono", async () => {
		await FilePanel.run();
		const panel = page.getByRole("complementary").first();
		await expect.element(panel).toBeVisible();
		const input = panel.element().querySelector("input") as HTMLInputElement;
		const line = input.closest("[data-slot=affix], [data-slot=input-line]") as HTMLElement;
		expect(line, "the name field's underline box").not.toBeNull();
		expect(getComputedStyle(input).fontFamily).toContain("Plex Mono");
		const extension = [...line.querySelectorAll("*")].find(
			(each) => /^\.\w+$/.test(each.textContent?.trim() ?? "") && each.children.length === 0,
		);
		expect(extension, "the extension is drawn inside the same box").toBeTruthy();
		expect(box(extension as Element).right).toBeLessThanOrEqual(box(line).right + 0.5);
	});

	it("a place where the file is used is a link: it changes under the pointer (underline or ink) and is pressable over 24px", async () => {
		await FilePanelManyUses.run();
		const panel = page.getByRole("complementary").first();
		const link = panel.getByRole("link").first();
		await expect.element(link).toBeVisible();
		const element = link.element() as HTMLElement;
		const before = getComputedStyle(element);
		const rest = [before.textDecorationLine, before.color, before.backgroundColor].join("|");
		await userEvent.hover(link);
		const after = getComputedStyle(element);
		expect([after.textDecorationLine, after.color, after.backgroundColor].join("|")).not.toBe(rest);
		expect(
			Math.max(box(element).height, Number.parseFloat(getComputedStyle(element, "::after").height) || 0),
		).toBeGreaterThanOrEqual(24);
	});
});

describe("the translation's two panes (TR-03, TR-08, TR-31)", () => {
	it("the words of the source pane's head are sans and read as a label (fg-subtle), not as a switched-off control", async () => {
		await SourceDraft.run();
		const head = page.getByText("원문 발행본 · 읽기 전용", { exact: false }).first();
		await expect.element(head).toBeVisible();
		const style = getComputedStyle(head.element());
		expect(style.fontFamily).toContain("Pretendard");
		const probe = document.createElement("i");
		probe.style.color = "var(--monti-fg-subtle)";
		document.body.append(probe);
		const subtle = getComputedStyle(probe).color;
		probe.remove();
		expect(style.color).toBe(subtle);
	});

	it("the follow-the-source tags are sans words and stay inside the pane that scrolls them", async () => {
		await SourceChanged.run();
		await expect.element(page.getByText("원문 따름").first()).toBeVisible();
		const marks = [...document.querySelectorAll("[data-slot=marker]")];
		expect(marks.length).toBeGreaterThan(0);
		for (const mark of marks) {
			let pane: Element | null = mark.parentElement;
			while (pane && !/(auto|scroll|hidden)/.test(getComputedStyle(pane).overflowX)) pane = pane.parentElement;
			const edge = (pane ?? document.documentElement).getBoundingClientRect().right;
			expect(
				box(mark).right,
				`${mark.textContent} ends at ${box(mark).right}, its pane at ${edge}`,
			).toBeLessThanOrEqual(edge);
			expect(getComputedStyle(mark).fontFamily).toContain("Pretendard");
		}
	});

	it("text picked in the translation takes the admin's one selection ground (`bg-selection`)", async () => {
		await SourceChanged.run();
		await expect.element(page.getByText("원문 따름").first()).toBeVisible();
		const probe = document.createElement("i");
		probe.style.color = "var(--monti-bg-selection)";
		document.body.append(probe);
		const wanted = getComputedStyle(probe).color;
		probe.remove();
		const body = document.querySelector("[data-slot=editor-body]") as Element;
		expect(getComputedStyle(body.querySelector("p, h2, li") as Element, "::selection").backgroundColor).toBe(wanted);
	});
});

describe("the settings forms (ST-06, ST-25)", () => {
	it("a section's title starts level with its first field's label", async () => {
		await Site.run();
		await expect.element(page.getByRole("heading", { level: 1, name: "설정" })).toBeVisible();
		const sections = [...page.getByRole("main").element().querySelectorAll("[data-slot=section]")];
		expect(sections.length).toBeGreaterThan(1);
		for (const section of sections) {
			const title = section.querySelector("h2") as Element;
			const label = section.querySelector("[data-slot=field-label]") as Element;
			expect(Math.round(box(title).top), `${title.textContent}`).toBe(Math.round(box(label).top));
		}
	});

	it("the fields of a two-column row are as wide as each other", async () => {
		await EditField.run();
		await expect.element(page.getByRole("heading", { name: /게시글/ }).first()).toBeVisible();
		const inputs = [
			...document.querySelectorAll("[data-slot=sheet] [data-slot=input], [role=dialog] [data-slot=input]"),
		].filter((each) => box(each).width > 200);
		const widths = inputs.map((input) => Math.round(box(input).width));
		expect(widths.length).toBeGreaterThan(1);
		expect(new Set(widths).size, `widths ${widths.join(", ")}`).toBe(1);
	});
});

describe("the editor's margin and its tabs (EB-07, EH-01, EE-03)", () => {
	it("the block handle is 20 by 24px and stands 4px left of the block it belongs to, in the margin", async () => {
		await Draft.run();
		await expect.element(page.getByRole("textbox", { name: "본문" })).toBeVisible();
		const block = document.querySelector("[data-slot=editor-body] .ProseMirror > *") as HTMLElement;
		await userEvent.hover(block);
		await expect.poll(() => document.querySelector("[data-slot=block-handle]")).not.toBeNull();
		const handle = box(document.querySelector("[data-slot=block-handle]") as Element);
		expect([Math.round(handle.width), Math.round(handle.height)]).toEqual([20, 24]);
		expect(Math.round(box(block).left - handle.right)).toBe(4);
	});

	it("the language tabs stand 24px over the title: room enough that they read as their own row", async () => {
		await SideBySide.run();
		const tabs = page.getByRole("navigation", { name: "언어" });
		await expect.element(tabs).toBeVisible();
		const title = page.getByRole("textbox", { name: "제목" }).element();
		expect(Math.round(box(title).top - box(tabs.element()).bottom)).toBeGreaterThanOrEqual(24);
	});

	it("the open tab of a tabs block is as wide as its name, not the row", async () => {
		await EveryBlock.run();
		await expect.element(page.getByRole("textbox", { name: "본문" })).toBeVisible();
		await expect.poll(() => document.querySelector("[data-slot=folder-tab-edit]")).not.toBeNull();
		const open = document.querySelector("[data-slot=folder-tab-edit]") as HTMLElement;
		expect(box(open).width).toBeLessThan(200);
	});
});

describe("the list's left edges (LT-02, LF-05)", () => {
	it("a column's name stands over its words: the cell's words start at the head's x, or after a mark that leads them (an icon, a dot)", async () => {
		await Main.run();
		const main = page.getByRole("main");
		await expect.element(main.getByRole("heading", { level: 1 })).toBeVisible();
		/** The left of the first words in an element (not a check that hangs in the margin). */
		const inkLeft = (element: Element) => {
			const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				if (!node.textContent?.trim()) continue;
				const r = document.createRange();
				r.selectNodeContents(node);
				return r.getBoundingClientRect().left;
			}
			return Number.NaN;
		};
		const heads = [...main.element().querySelectorAll("thead th")];
		const at = heads.findIndex((th) => th.textContent?.trim().startsWith("제목"));
		expect(at).toBeGreaterThanOrEqual(0);
		const row = [...main.element().querySelectorAll("tbody tr")].find((each) =>
			each.querySelectorAll("td")[at]?.textContent?.trim(),
		);
		const cell = row?.querySelectorAll("td")[at] as Element;
		// The column's name and its words stand at one x: the head does not step away from what is under it.
		expect(Math.round(inkLeft(heads[at] as Element) - inkLeft(cell))).toBeLessThanOrEqual(0);
		expect(Math.round(inkLeft(cell) - inkLeft(heads[at] as Element))).toBeLessThanOrEqual(24);
	});
});
