import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ADDED_BLOCKS } from "../../blocks/active";
import { analyze, toDocument } from "../../mdx";
import { canonicalBodyForHash, computeContentHash } from "../content-hash";

const metadata = { title: "A" };
const hashOf = (mdx: string, meta: Record<string, unknown> = metadata, schemaVersion = 1) =>
	computeContentHash(meta as never, mdx, schemaVersion);

/**
 * A container block from the active config, written once with directive syntax and once as JSX.
 * The block and its attribute are read from the config, so the same test runs against every site setup.
 */
const container = (() => {
	const block = ADDED_BLOCKS.find(
		(candidate) => candidate.syntax.kind === "container" && !candidate.children && !candidate.parent,
	);
	if (!block || block.syntax.kind !== "container")
		throw new Error("content-hash: the config adds no plain container block");
	const [name, attribute] = Object.entries(block.attributes).find(([, a]) => a.type === "string") ?? [];
	if (!name || !attribute || attribute.type !== "string")
		throw new Error(`content-hash: ${block.name} has no string attribute`);
	const optionValue = (index: number) => Object.keys(attribute.options ?? {})[index] ?? `value-${index}`;
	const { directive } = block.syntax;
	return {
		directive: (value: string, body = "Inside") => `:::${directive}{${name}="${value}"}\n${body}\n:::\n`,
		jsx: (value: string, body = "Inside") =>
			`<${block.component} ${name}="${value}">\n${body}\n</${block.component}>\n`,
		first: optionValue(0),
		second: optionValue(1),
	};
})();

describe("content hash v2", () => {
	describe("equivalent spellings hash equally", () => {
		it("directive and JSX syntax of the same block", () => {
			expect(analyze(container.directive(container.first)).errors).toEqual([]);
			expect(analyze(container.jsx(container.first)).errors).toEqual([]);
			expect(hashOf(container.directive(container.first))).toBe(hashOf(container.jsx(container.first)));
		});

		it("emphasis written with asterisks or underscores", () => {
			expect(hashOf("An *a* word")).toBe(hashOf("An _a_ word"));
		});

		it("attributes listed in a different order", () => {
			const image = (attributes: string) => `<Image ${attributes} />\n`;
			const a = image('src="https://example.com/a.png" alt="A" width="50"');
			const b = image('width="50" alt="A" src="https://example.com/a.png"');
			expect(analyze(a).errors).toEqual([]);
			expect(hashOf(a)).toBe(hashOf(b));
		});

		it("metadata keys in a different order", () => {
			expect(hashOf("Hello", { title: "A", summary: "B" })).toBe(hashOf("Hello", { summary: "B", title: "A" }));
		});

		it("is deterministic", () => {
			expect(hashOf(container.jsx(container.first))).toBe(hashOf(container.jsx(container.first)));
		});
	});

	describe("content changes hash differently", () => {
		const base = "An *a* word";
		it.each([
			["a text change", "An *b* word"],
			["a mark change", "An **a** word"],
			["a block change", "# An *a* word"],
		])("%s", (_name, changed) => {
			expect(hashOf(changed)).not.toBe(hashOf(base));
		});

		it("an attribute value change", () => {
			expect(hashOf(container.directive(container.first))).not.toBe(hashOf(container.directive(container.second)));
		});

		it("the code of a code block", () => {
			expect(hashOf("```ts\nconst a = 1\n```")).not.toBe(hashOf("```ts\nconst a = 2\n```"));
		});

		it("metadata and schema version", () => {
			expect(hashOf("Hello", { title: "B" })).not.toBe(hashOf("Hello"));
			expect(hashOf("Hello", metadata, 2)).not.toBe(hashOf("Hello", metadata, 1));
		});
	});

	describe("a body that does not parse cleanly", () => {
		const broken = `${container.jsx(container.first).replace(/<\/[^>]+>\n$/, "")}\n`;

		it("is hashed from the raw string, tagged so it never collides with a parsed body", () => {
			expect(analyze(broken).errors.length).toBeGreaterThan(0);
			const expected = createHash("sha256")
				.update(JSON.stringify(["cms-snapshot-v2-raw", 1, metadata, broken]))
				.digest("hex");
			expect(hashOf(broken)).toBe(expected);
		});

		it("is stable and distinct per raw string", () => {
			expect(hashOf(broken)).toBe(hashOf(broken));
			expect(hashOf(`${broken}more`)).not.toBe(hashOf(broken));
		});
	});

	describe("canonicalBodyForHash", () => {
		const canonical = (mdx: string) => canonicalBodyForHash(toDocument(analyze(mdx)));

		it("drops the raw JSX attribute list but keeps the attribute values", () => {
			const json = JSON.stringify(canonical(container.jsx(container.first)));
			expect(json).not.toContain('"attributes"');
			expect(json).toContain(container.first);
		});

		it("drops the redundant code document but keeps the code and its language", () => {
			const json = JSON.stringify(canonical('```ts title="a"\nconst a = 1\n```'));
			expect(json).not.toContain("codeDocument");
			expect(json).toContain("const a = 1");
			expect(json).toContain('"language":"ts"');
		});

		it("does not change the parsed document it receives", () => {
			const document = toDocument(analyze(container.jsx(container.first)));
			const before = JSON.stringify(document);
			canonicalBodyForHash(document);
			expect(JSON.stringify(document)).toBe(before);
		});
	});
});
