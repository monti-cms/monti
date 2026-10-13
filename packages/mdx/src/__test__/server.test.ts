import { describe, expect, it } from "vitest";
import { testSite } from "../../../core/test/site";
import { createMdxFormat } from "../format";
import { createServerMdxFormat } from "../server";
import type { SyntaxExtension } from "../syntax";
import { siteCodeLineEffects, siteSyntaxBlocks } from "../syntax-config";
import { docOfMdx } from "../testing";

/** A made-up notation for a mark: `{u text}` is underlined text. It is written and read only while the extension is listed. */
const braces: SyntaxExtension = {
	name: "braces",
	fromMark: { underline: (_mark, inner) => `{u ${inner}}` },
};

describe("createServerMdxFormat", () => {
	it("is the mdx format", () => {
		const plain = createMdxFormat();
		const server = createServerMdxFormat();
		expect(server).toMatchObject({
			name: plain.name,
			label: plain.label,
			mimeType: plain.mimeType,
			extension: plain.extension,
		});
	});

	it("reads and writes like the plain format", async () => {
		const server = createServerMdxFormat();
		const doc = docOfMdx(testSite, "# Title\n\nSome *words*\n");
		const ctx = {
			locale: "ko",
			blocks: siteSyntaxBlocks(testSite),
			site: testSite,
			codeLineEffects: siteCodeLineEffects(testSite),
		};
		const exportContext = {
			...ctx,
			purpose: "read" as const,
			link: () => null,
			media: () => null,
			report: () => {},
		};
		expect(await server.export(doc, exportContext)).toBe(await createMdxFormat().export(doc, exportContext));
		const text = "# Title\n\nSome *words*\n";
		expect(await server.import?.(text, ctx)).toEqual(await createMdxFormat().import?.(text, ctx));
	});

	it("passes its syntax extensions to the format", async () => {
		const server = createServerMdxFormat({ syntax: [braces] });
		const doc = {
			...docOfMdx(testSite, "x"),
			content: [{ type: "paragraph", content: [{ type: "text", text: "word", marks: [{ type: "underline" }] }] }],
		};
		const text = await server.export(doc, {
			locale: "ko",
			blocks: siteSyntaxBlocks(testSite),
			site: testSite,
			codeLineEffects: new Set(),
			purpose: "read",
			link: () => null,
			media: () => null,
			report: () => {},
		});
		expect(text).toContain("{u word}");
	});
});
