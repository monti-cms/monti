import { analyze, serialize, toDocument } from "@monti-cms/core/mdx";
import { readSamples } from "@monti-cms/core/testing";
import type { JSONContent } from "@tiptap/core";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { ADDED_MARKS, addedMarkName, createAddedMark } from "../added-marks";
import { BLOCK_NODE_VIEWS } from "../block-views";
import { ADDED_BLOCK_NODES } from "../blocks/added";
import { cmsNodeToTiptap, mdxToTiptap, OPAQUE_BLOCK_NAME, tiptapToCmsNode, tiptapToMdx } from "../tiptap-content";
import { CMS_SCHEMA_EXTENSIONS } from "../tiptap-schema";

/**
 * Same composition as the extensions array in `tiptap-editor.tsx`. Update this too when that changes.
 * Nodes must pass schema validation, or the real editor drops them.
 */
const schema = getSchema([
	StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
	...CMS_SCHEMA_EXTENSIONS,
	...Object.values(BLOCK_NODE_VIEWS),
	...ADDED_BLOCK_NODES,
	...[...ADDED_MARKS.values()].map((block) => createAddedMark(block)),
]);

/** Checks that it passes the Tiptap schema. If not, the real editor silently drops it. */
const throughSchema = (json: JSONContent): JSONContent => schema.nodeFromJSON(json).toJSON() as JSONContent;

const write = (source: string): string => serialize(toDocument(analyze(source)));

const firstDiff = (a: unknown, b: unknown, at: string): string | null => {
	if (a === b) return null;
	if (typeof a !== typeof b || a === null || b === null)
		return `${at}: ${JSON.stringify(a)?.slice(0, 100)} !== ${JSON.stringify(b)?.slice(0, 100)}`;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return `${at}.length: ${a.length} !== ${b.length}`;
		for (let i = 0; i < a.length; i += 1) {
			const diff = firstDiff(a[i], b[i], `${at}[${i}]`);
			if (diff) return diff;
		}
		return null;
	}
	if (typeof a === "object") {
		for (const key of new Set([...Object.keys(a as object), ...Object.keys(b as object)])) {
			const diff = firstDiff((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${at}.${key}`);
			if (diff) return diff;
		}
		return null;
	}
	return `${at}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`;
};

describe("CmsNode <-> Tiptap round trip", () => {
	it("does not lose inline marks, headings, and line breaks", () => {
		const first = toDocument(
			analyze(
				'문장 **굵게** *기울임* ~~취소~~ `코드` <u>밑줄</u> <sup>위</sup> <sub>아래</sub> <Tooltip content="설명">라벨</Tooltip> [링크](https://example.com "제목")\n\n## 제목\n\n첫 줄<br />\n둘째 줄',
			),
		);

		const json = throughSchema(cmsNodeToTiptap(first));
		const second = tiptapToCmsNode(json);

		expect(second).toEqual(first);
	});

	it("expands and collapses an alignment container", () => {
		const first = toDocument(analyze('<TextAlign align="center">\n\n## 가운데\n\n</TextAlign>'));
		const json = cmsNodeToTiptap(first);

		expect(json.content?.[0]).toMatchObject({
			type: "heading",
			attrs: expect.objectContaining({ textAlign: "center" }),
		});

		const second = tiptapToCmsNode(throughSchema(json));
		expect(second).toEqual(first);
		expect(serialize(second)).toContain("<TextAlign");
	});

	it("preserves blocks not in the schema as boxes and restores them", () => {
		const source = [
			'<Callout variant="note">\n\n보존\n\n</Callout>',
			'<Tabs>\n\n<Tab label="a">\n\nA\n\n</Tab>\n\n<Tab label="b">\n\nB\n\n</Tab>\n\n</Tabs>',
			"| a | b |\n| --- | --- |\n| 1 | 2 |",
			"<Columns>\n\n<Column>\n\n단\n\n</Column>\n\n</Columns>",
		].join("\n\n");
		const first = toDocument(analyze(source));
		const json = cmsNodeToTiptap(first);

		const names = (json.content ?? []).map((block) => block?.type);
		// Valid Callout and Tabs are editable, while Columns with a single child is out of spec, so it is preserved as a raw box.
		expect(names).toEqual(["cmsCallout", "cmsTabs", "table", OPAQUE_BLOCK_NAME]);

		const second = tiptapToCmsNode(throughSchema(json));
		expect(second).toEqual(first);
	});

	it("converts tables (with column alignment) and task lists to editable nodes and restores them", () => {
		const first = toDocument(
			analyze("| a | **b** |\n| :-: | --: |\n| 1 | `2` |\n\n- [ ] 할 일\n- [x] 끝남\n\n1. [ ] 번호 체크 항목"),
		);
		const json = cmsNodeToTiptap(first);
		expect((json.content ?? []).map((block) => block?.type)).toEqual(["table", "taskList", OPAQUE_BLOCK_NAME]);
		expect(tiptapToCmsNode(throughSchema(json))).toEqual(first);
	});

	it("does not lose image attributes", () => {
		const first = toDocument(
			analyze(
				'<Image mediaId="uuid-1" alt="설명" width="60%" align="left" caption="캡션" />\n\n![그냥](https://example.com/a.png)',
			),
		);
		const json = cmsNodeToTiptap(first);

		expect(json.content?.[0]).toMatchObject({ type: "image", attrs: expect.objectContaining({ mediaId: "uuid-1" }) });

		const second = tiptapToCmsNode(throughSchema(json));
		expect(second).toEqual(first);
	});

	it("an explicit value equal to the Tiptap default is normalized once on save and converges", () => {
		// `align="center"` is the render default, so it is dropped on save. The meaning is the same, and reopening gives the same result.
		const source = '<Image mediaId="uuid-1" alt="설명" align="center" />';
		const once = tiptapToMdx(throughSchema(mdxToTiptap(source)));
		expect(once).not.toContain("align");
		expect(tiptapToMdx(throughSchema(mdxToTiptap(once)))).toBe(once);
	});

	it("does not lose decorative images", () => {
		const first = toDocument(analyze('<Image src="/images/a.png" alt="" decorative />'));
		const json = cmsNodeToTiptap(first);

		expect(json.content?.[0]).toMatchObject({
			type: "image",
			attrs: expect.objectContaining({ decorative: true }),
		});

		const second = tiptapToCmsNode(throughSchema(json));
		expect(second).toEqual(first);
		expect(serialize(second)).toContain("decorative");
	});

	it("preserves an explicit width of 100%", () => {
		const first = toDocument(analyze('<Image src="/images/a.png" alt="설명" width="100%" />'));
		const json = cmsNodeToTiptap(first);
		const second = tiptapToCmsNode(throughSchema(json));
		expect(second).toEqual(first);
		expect(serialize(second)).toContain('width="100%"');
	});

	it("the upload insertion shape comes back as is", () => {
		const first = toDocument(
			analyze('<Image mediaId="uuid-1" src="https://r2.example/a.png" alt="a.png" width="100%" align="center" />'),
		);
		const second = tiptapToCmsNode(throughSchema(cmsNodeToTiptap(first)));
		// `<Image />` is a dedicated image node (no name/attributes wrapper). Only `align="center"` is dropped.
		expect(second).toEqual({
			type: "doc",
			content: [
				{
					type: "image",
					attrs: { mediaId: "uuid-1", src: "https://r2.example/a.png", alt: "a.png", width: "100%" },
				},
			],
		});
	});

	it("the mark name of the added text decoration (block extension tooltip) matches the schema", () => {
		expect(schema.marks[addedMarkName("tooltip")]).toBeDefined();
		expect(schema.nodes[OPAQUE_BLOCK_NAME]).toBeDefined();
	});
});

describe("loads real content into the editor and restores it", () => {
	it("all sample content passes the schema and the document is the same", () => {
		const items = readSamples();
		expect(items.length).toBeGreaterThan(0);

		const failures: string[] = [];
		for (const item of items) {
			const first = toDocument(analyze(item.mdx));
			let json: JSONContent;
			try {
				json = throughSchema(mdxToTiptap(item.mdx));
			} catch (error) {
				failures.push(`${item.name}: schema rejected (${error instanceof Error ? error.message : String(error)})`);
				continue;
			}
			const second = toDocument(analyze(tiptapToMdx(json)));
			try {
				expect(second).toEqual(first);
			} catch {
				failures.push(`${item.name}: document mismatch (${firstDiff(first, second, "")})`);
			}
		}

		expect(failures).toEqual([]);
		expect(write).toBeDefined();
	});
});
