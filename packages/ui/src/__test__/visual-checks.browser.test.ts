import { afterEach, describe, expect, it } from "vitest";
import {
	findBoxProblems,
	findOffCenterText,
	findSplitIcons,
	findWrongMono,
	measureBoxes,
	measureCenter,
	measureIcons,
	measureMono,
} from "../../visual/checks";

/**
 * The wiring of the visual checks: each `measure*` reads a page Chromium laid out, and its `find*` finds the fault planted in it. The cases of each
 * decision are in `visual-checks.test.ts`.
 */
const page = (html: string) => {
	document.body.innerHTML = html;
};

afterEach(() => {
	document.body.innerHTML = "";
	document.documentElement.style.removeProperty("--monti-font-mono");
	document.documentElement.style.removeProperty("--monti-text-body-size");
});

describe("the visual checks on a real page", () => {
	it("UI-T5 the icon check finds a block icon that drops above the text of a button, a link and a tab", () => {
		const control = (tag: string, attrs: string) =>
			`<${tag} ${attrs} style="display:inline-block"><svg width="14" height="14" style="display:block"></svg><span>보기</span></${tag}>`;
		page(
			`${control("button", "")}${control("a", 'href="#"')}${control("div", 'role="tab"')}` +
				`<button style="display:inline-flex;align-items:center"><svg width="14" height="14"></svg><span>열기</span></button>`,
		);
		const findings = findSplitIcons(measureIcons());
		expect(findings.map((finding) => finding.detail.split(" ")[0])).toEqual(["<button>", "<a>", "<div>"]);
	});

	it("UI-T6 the center check finds text at the top of a fixed-height button, menu row, tab, option, chip and status bar cell", () => {
		const control = (tag: string, attrs: string, align: string) =>
			`<${tag} ${attrs} style="display:flex;align-items:${align};height:36px;padding:0;border:0;font:14px sans-serif"><span>Save</span></${tag}>`;
		const controls = [
			["button", ""],
			["div", 'role="menuitem"'],
			["div", 'role="tab"'],
			["div", 'role="option"'],
			["span", 'data-slot="chip"'],
			["span", 'data-slot="status-bar-cell"'],
		];
		page(
			controls.map(([tag, attrs]) => control(tag, attrs, "flex-start")).join("") +
				control("div", 'class="not-a-control"', "flex-start"),
		);
		const findings = findOffCenterText(measureCenter());
		expect(findings).toHaveLength(controls.length);
		for (const finding of findings)
			expect(finding.detail).toMatch(/"Save" ink is [\d.]+px above the center of its 36px box/);
	});

	it("UI-T7 the mono check finds a font-mono element the page draws in another face", () => {
		document.documentElement.style.setProperty("--monti-font-mono", "'Test Mono', monospace");
		page(
			`<span class="font-mono" style="font-family:'Test Mono', monospace">/posts</span>` +
				`<span class="font-mono" style="font-family:serif">/tags</span>`,
		);
		expect(findWrongMono(measureMono())).toEqual([
			{ check: "mono", detail: '<span.font-mono> "/tags" asks for Test Mono but computes serif' },
		]);
	});

	it("UI-T8 the box checks find a page that scrolls sideways, text cut by its box and a type role at the wrong size", () => {
		document.documentElement.style.setProperty("--monti-text-body-size", "14px");
		page(
			`<div style="width:5000px;height:1px"></div>` +
				`<div style="width:40px;overflow:hidden;white-space:nowrap">a name too long for its box</div>` +
				`<div style="width:40px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">a name cut on purpose</div>` +
				`<p class="text-monti-body" style="font-size:14px">fits</p>` +
				`<p class="text-monti-body" style="font-size:20px">too big</p>`,
		);
		const findings = findBoxProblems(measureBoxes());
		expect(findings.map((finding) => finding.check)).toEqual(["overflow", "clipped", "type"]);
		expect(findings[1]?.detail).toContain('"a name too long for its box"');
		expect(findings[2]?.detail).toContain("computes font size 20px (token 14px)");
	});
});
