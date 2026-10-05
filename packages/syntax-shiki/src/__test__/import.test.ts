import { bodyFromMdx } from "@monti-cms/core/mdx";
import { describe, expect, it } from "vitest";
import { shikiNotation } from "..";

/** End to end with the core: a body written with Shiki notation is stored with Monti annotations, and is only ever written in Monti's notation. */

const SHIKI = `# Diff

\`\`\`ts
const a = 1
const b = 2 // [!code --]
const b = 3 // [!code ++]
// [!code highlight]
console.log(a, b)
\`\`\`

\`\`\`python
x = 1  # [!code error:2]
y = 2
\`\`\`
`;

const extensions = [shikiNotation()];

describe("importing Shiki notation", () => {
	const body = bodyFromMdx(SHIKI, extensions);

	it("stores the body with Monti annotation comments and no Shiki notation", () => {
		expect(body.doc).not.toBeNull();
		expect(body.mdx).not.toContain("[!code");
		expect(body.mdx).toBe(`# Diff

\`\`\`ts
const a = 1
// @line minus {1-1}
const b = 2
// @line plus {2-2}
const b = 3
// @line highlight {3-3}
console.log(a, b)
\`\`\`

\`\`\`python
# @line error {0-1}
x = 1
y = 2
\`\`\`
`);
	});

	it("gives the document the code and its annotations as data", () => {
		const code = (body.doc?.content ?? []).filter((node) => node.type === "codeBlock");
		expect(code.map((node) => node.attrs?.code)).toEqual([
			"const a = 1\nconst b = 2\nconst b = 3\nconsole.log(a, b)",
			"x = 1\ny = 2",
		]);
		expect(code.map((node) => node.attrs?.annotations)).toEqual([
			{
				lines: [
					{ name: "minus", start: 1, end: 2 },
					{ name: "plus", start: 2, end: 3 },
					{ name: "highlight", start: 3, end: 4 },
				],
			},
			{ lines: [{ name: "error", start: 0, end: 2 }] },
		]);
	});

	it("reads the written MDX back to the same document and the same text", () => {
		// Block ids are not content: they are inherited from the previous body, as they are when a post is saved again.
		const again = bodyFromMdx(body.mdx, extensions, { previous: body.doc });
		expect(again.mdx).toBe(body.mdx);
		expect(again.doc?.content).toEqual(body.doc?.content);
		// Written MDX needs no extension to read: it is Monti's own notation, so the document is the same.
		const plain = bodyFromMdx(body.mdx, [], { previous: body.doc });
		expect(plain.mdx).toBe(body.mdx);
		expect(plain.doc?.content).toEqual(body.doc?.content);
	});

	it("without the extension the notation is ordinary code", () => {
		const plain = bodyFromMdx(SHIKI, []);
		expect(plain.mdx).toBe(SHIKI);
		expect(plain.mdx).toContain("[!code ++]");
	});

	it("leaves a body without notation byte for byte", () => {
		const mdx = "```ts\nconst a = 1\n```\n";
		expect(bodyFromMdx(mdx, extensions).mdx).toBe(mdx);
	});

	it("converts a word rule", () => {
		const word = bodyFromMdx("```ts\n// [!code word:Hello]\nconst message = 'Hello'\n```\n", extensions);
		expect(word.mdx).toBe("```ts\n// @document strong {re:/Hello/g}\nconst message = 'Hello'\n```\n");
		expect(bodyFromMdx(word.mdx, extensions, { previous: word.doc }).doc?.content).toEqual(word.doc?.content);
	});

	it("does not touch a notation inside a string", () => {
		const mdx = '```ts\nconst s = "// [!code ++]"\n```\n';
		expect(bodyFromMdx(mdx, extensions).mdx).toBe(mdx);
	});
});
