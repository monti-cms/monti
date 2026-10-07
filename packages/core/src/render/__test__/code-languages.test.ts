import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../test/site";
import { storedCodeBlockAttrs } from "../../doc/stored-code-block";
import { STORED_DOCUMENT_VERSION } from "../../doc/stored-document";
import { siteHighlight } from "../code/code-highlighter";
import { renderDocument } from "../index";

const highlight = await siteHighlight(testSite);

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

describe("code in a language that is not loaded", () => {
	it("is shown as plain text instead of failing", () => {
		const hast = highlight("let x = 1", "no-such-language", {});
		expect(textOf(hast)).toBe("let x = 1");
	});

	it("still highlights a loaded language and an alias", () => {
		for (const lang of ["ts", "js", "json"]) {
			const hast = highlight("const a = 1;", lang, {});
			expect(JSON.stringify(hast)).toContain("--shiki-dark");
		}
	});

	it("does not fail a page that has it", async () => {
		await expect(renderDocument(codeDoc("no-such-language", "let x = 1"), { site: testSite })).resolves.toBeTruthy();
	});
});

describe("focus lines", () => {
	it("carry the class the public styles dim the other lines by", async () => {
		const { content } = await renderDocument(
			codeDoc("ts", "const a = 1;\n// @line focus\nconst b = 2;\nconst c = 3;"),
			{ site: testSite },
		);
		const markup = renderToStaticMarkup(content);
		const lines = [...markup.matchAll(/<span class="([^"]*\bline\b[^"]*)"/g)].map((match) => match[1] ?? "");
		expect(lines.map((names) => names.split(/\s+/).includes("code-focus"))).toEqual([false, true, false]);
	});
});
