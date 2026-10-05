import { describe, expect, it } from "vitest";
import { highlight } from "../code/code-highlighter";
import { renderMdx } from "../index";

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
		await expect(renderMdx("```no-such-language\nlet x = 1\n```\n")).resolves.toBeTruthy();
	});
});
