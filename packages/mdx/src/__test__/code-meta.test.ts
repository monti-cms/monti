import { describe, expect, it } from "vitest";
import { testSite } from "../../../core/test/site";
import { analyze, serialize, toDocument } from "../format";

const codeBlockOf = (mdx: string) =>
	toDocument(testSite, analyze(testSite, mdx)).content?.find((node) => node.type === "codeBlock");

describe("code fence meta", () => {
	it("keeps legitimate meta keys on the code block", () => {
		const block = codeBlockOf('```ts title="a.ts"\nconst a = 1;\n```\n');
		expect(block?.attrs?.title).toBe("a.ts");
	});

	it.each([
		"value",
		"language",
		"codeDocument",
		"meta",
	])("does not let a `%s` meta key overwrite the block's own field", (key) => {
		const mdx = `\`\`\`ts ${key}="x"\nconst a = 1;\n\`\`\`\n`;
		const block = codeBlockOf(mdx);
		expect(block?.attrs?.value).toBe("const a = 1;");
		expect(block?.attrs?.language).toBe("ts");
		expect(block?.attrs?.meta).toBe(`${key}="x"`);
		expect(typeof block?.attrs?.codeDocument).toBe("object");
		expect(serialize(testSite, toDocument(testSite, analyze(testSite, mdx))).trim()).toBe(mdx.trim());
	});
});
