import type { Element, ElementContent } from "hast";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { defineSite } from "../../../config/define";
import { storedCodeBlockAttrs } from "../../../doc/stored-code-block";
import { STORED_DOCUMENT_VERSION } from "../../../doc/stored-document";
import { defineCollection } from "../../../schema/collection";
import { fields } from "../../../schema/fields";
import { createSite } from "../../../site";
import { renderDocument } from "../../index";
import { siteCodeHighlighterOptions, siteHighlight } from "../code-highlighter";

const highlight = await siteHighlight(testSite);

describe("highlight indent guides integration", () => {
	const hasIndentClass = (node: Element) => {
		const value = node.properties?.class ?? node.properties?.className;
		if (typeof value === "string") return value.split(/\s+/).includes("indent");
		if (Array.isArray(value)) return value.map(String).includes("indent");
		return false;
	};

	const findIndentNodes = (node: Element): Element[] => {
		const result: Element[] = [];

		for (const child of node.children) {
			if (child.type !== "element") continue;
			if (hasIndentClass(child)) {
				result.push(child);
			}
			result.push(...findIndentNodes(child));
		}

		return result;
	};

	const textOf = (node: ElementContent): string =>
		node.type === "text" ? node.value : node.type === "element" ? node.children.map(textOf).join("") : "";

	// The `indent` class is the render output contract: the public styles draw the indent guides by it.
	it("SITE-D2 renders indent tokens as indent class spans", () => {
		const hast = highlight("function f() {\n  console.log(1)\n    console.log(2)\n}", "ts", {}, {});
		const pre = hast.children[0] as Element;
		expect(pre).toMatchObject({ tagName: "pre", children: [{ tagName: "code" }] });
		const code = pre.children[0] as Element;

		const lines = code.children.filter((node): node is Element => node.type === "element");
		// One span per indent step (two spaces) at the start of each line.
		expect(lines.map((line) => findIndentNodes(line).map(textOf))).toEqual([[], ["  "], ["  ", "  "], []]);
	});
});

describe("highlight inline render integration", () => {
	const findCode = (pre: Element) =>
		pre.children.find((child) => child.type === "element" && child.tagName === "code") as Element | undefined;

	const findElementByTagName = (root: Element, tagName: string): Element | undefined => {
		if (root.tagName === tagName) return root;

		for (const child of root.children) {
			if (child.type !== "element") continue;
			const found = findElementByTagName(child, tagName);
			if (found) return found;
		}

		return undefined;
	};

	const textOf = (node: ElementContent): string =>
		node.type === "text" ? node.value : node.type === "element" ? node.children.map(textOf).join("") : "";

	it("SITE-D2 converts inline annotation decorations into render tags", () => {
		const hast = highlight(
			"console.log('hello')",
			"ts",
			{},
			{
				decorations: [
					{
						start: { line: 0, character: 5 },
						end: { line: 0, character: 17 },
						properties: {
							"data-anno-render": "Tooltip",
							"data-anno-content": '"console.log"',
						},
					},
				],
				allowedRenderTags: ["Tooltip"],
			},
		);

		const pre = hast.children.find((node) => node.type === "element") as Element | undefined;
		const code = pre ? findCode(pre) : undefined;
		const wrapper = code ? findElementByTagName(code, "Tooltip") : undefined;

		// The tag wraps exactly the characters of the decoration (5 up to 17), and its content is the parsed attribute.
		expect(wrapper ? textOf(wrapper) : undefined).toBe("le.log('hell");
		expect(wrapper?.properties.content).toBe("console.log");
		expect(wrapper?.properties["data-anno-render"]).toBeUndefined();
		expect(wrapper?.properties["data-anno-content"]).toBeUndefined();
	});
});

describe("highlight line wrapper integration", () => {
	const textOf = (node: ElementContent): string =>
		node.type === "text" ? node.value : node.type === "element" ? node.children.map(textOf).join("") : "";

	/** The children of the highlighted `code` element as `[tag, text]` pairs (`#text` for a text node), so the place of a wrapper reads as its lines. */
	const outline = (hast: { children: unknown[] }) => {
		const pre = hast.children[0] as Element;
		expect(pre).toMatchObject({ tagName: "pre", children: [{ tagName: "code" }] });
		const code = pre.children[0] as Element;
		return code.children.map((node) => [node.type === "element" ? node.tagName : `#${node.type}`, textOf(node)]);
	};

	it("SITE-D2 injects line wrapper into highlighted hast", () => {
		const hast = highlight(
			"const a = 1\nconst b = 2",
			"ts",
			{},
			{
				rowWrappers: [{ scope: "line", name: "Callout", range: { start: 0, end: 2 }, order: 0, render: "Callout" }],
				allowedRenderTags: ["Callout"],
			},
		);
		// The wrapper holds both lines.
		expect(outline(hast)).toEqual([["Callout", "const a = 1\nconst b = 2"]]);
	});

	it("SITE-D2 renders without a line count mismatch even when decorations and a line wrapper are used together", () => {
		const hast = highlight(
			"const a = 1\nconst b = 2",
			"ts",
			{},
			{
				decorations: [
					{
						start: { line: 0, character: 0 },
						end: { line: 0, character: 5 },
						properties: {
							"data-anno-render": "Tooltip",
							"data-anno-content": '"const"',
						},
					},
				],
				rowWrappers: [{ scope: "line", name: "Callout", range: { start: 0, end: 2 }, order: 0, render: "Callout" }],
				allowedRenderTags: ["Tooltip", "Callout"],
			},
		);

		expect(outline(hast)).toEqual([["Callout", "const a = 1\nconst b = 2"]]);
		// The inline tag stays inside the first line of the wrapper.
		const code = (hast.children[0] as Element).children[0] as Element;
		const wrapper = code.children[0] as Element;
		const lines = wrapper.children.filter((node): node is Element => node.type === "element");
		expect(lines.map((line) => [line.properties.class, textOf(line)])).toEqual([
			["line", "const a = 1"],
			["line", "const b = 2"],
		]);
		expect(lines[0]?.children[0]).toMatchObject({ tagName: "Tooltip", properties: { content: "const" } });
	});

	it("SITE-D2 applies up to EOF even when the line wrapper range end exceeds the line count", () => {
		const hast = highlight(
			"const a = 1\nconst b = 2",
			"ts",
			{},
			{
				rowWrappers: [{ scope: "line", name: "Callout", range: { start: 1, end: 99 }, order: 0, render: "Callout" }],
				allowedRenderTags: ["Callout"],
			},
		);

		// The wrapper starts at the second line and ends at the last one.
		expect(outline(hast)).toEqual([
			["span", "const a = 1"],
			["#text", "\n"],
			["Callout", "const b = 2"],
		]);
	});
});

describe("the site's code block themes and languages", () => {
	const collections = {
		page: defineCollection({
			label: "Page",
			kind: "document",
			path: "/:slug",
			fields: {
				title: fields.text({ label: "Title", required: true }),
				slug: fields.slug({ label: "Slug", from: "title", required: true }),
			},
		}),
	};
	const locales = [{ code: "en", name: "English" }];

	const siteWith = (codeBlock?: Parameters<typeof defineSite>[0]["codeBlock"]) =>
		createSite(defineSite({ collections, locales, defaultLocale: "en", codeBlock }));

	const ELIXIR = 'defmodule Hello do\n  def hi, do: "hi"\nend';

	it("SITE-D2 highlight with the configured themes and an added language", async () => {
		const site = siteWith({ themes: { light: "github-light", dark: "github-dark" }, languages: ["elixir"] });
		const options = await siteCodeHighlighterOptions(site);
		expect([options.themes?.light.name, options.themes?.dark.name]).toEqual(["github-light", "github-dark"]);

		const highlight = await siteHighlight(site);
		const html = JSON.stringify(highlight(ELIXIR, "elixir", {}));
		// github-dark's keyword color, which one-dark-pro does not use.
		expect(html).toContain("--shiki-dark:#F97583");
	});

	it("SITE-D2 keeps the default themes for a site that sets none", async () => {
		const site = siteWith();
		const options = await siteCodeHighlighterOptions(site);
		expect([options.themes?.light.name, options.themes?.dark.name]).toEqual(["one-light", "one-dark-pro"]);
	});

	it("SITE-D2 builds one highlighter per site, each with its own themes", async () => {
		const github = siteWith({ themes: { light: "github-light", dark: "github-dark" } });
		const plain = siteWith();
		expect(await siteHighlight(github)).toBe(await siteHighlight(github));
		expect(await siteHighlight(github)).not.toBe(await siteHighlight(plain));
		const code = "const a = 1;";
		const withGithub = JSON.stringify((await siteHighlight(github))(code, "ts", {}));
		const withDefault = JSON.stringify((await siteHighlight(plain))(code, "ts", {}));
		expect(withGithub).toContain("github-dark");
		expect(withDefault).toContain("one-dark-pro");
	});
});

describe("code in a language that is not loaded", () => {
	const codeDoc = (language: string, value: string) => ({
		type: "doc" as const,
		version: STORED_DOCUMENT_VERSION,
		content: [{ type: "codeBlock", attrs: storedCodeBlockAttrs(testSite, { language, meta: "", value }) }],
	});

	const textOf = (node: unknown): string => {
		if (!node || typeof node !== "object") return "";
		const item = node as { type?: string; value?: string; children?: unknown[] };
		return item.type === "text" ? (item.value ?? "") : (item.children ?? []).map(textOf).join("");
	};

	it("SITE-D2 is shown as plain text instead of failing", () => {
		const hast = highlight("let x = 1", "no-such-language", {});
		expect(textOf(hast)).toBe("let x = 1");
	});

	it("SITE-D2 still highlights a loaded language and an alias", () => {
		for (const lang of ["ts", "js", "json"]) {
			const hast = highlight("const a = 1;", lang, {});
			expect(JSON.stringify(hast)).toContain("--shiki-dark");
		}
	});

	it("SITE-D2 does not fail a page that has it", async () => {
		const { content } = await renderDocument(codeDoc("no-such-language", "let x = 1"), { site: testSite });
		expect(renderToStaticMarkup(content)).toContain("let x = 1");
	});
});
