import type { CmsJsonValue } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { parseYamlMapping, serializeFrontmatter, splitFrontmatter } from "../frontmatter";

const roundTrip = (data: Record<string, CmsJsonValue>) => {
	const text = serializeFrontmatter(data);
	const { raw } = splitFrontmatter(text);
	return parseYamlMapping(raw ?? "");
};

describe("front matter YAML", () => {
	it("reads a flow list as a list, not as a string", () => {
		expect(parseYamlMapping("tags: [a, b]\nempty: []")).toEqual({ tags: ["a", "b"], empty: [] });
	});

	it("reads block lists, nested maps, block scalars, quoted keys and anchors", () => {
		const raw = [
			"tags:",
			"  - a",
			"  - b",
			"meta:",
			"  author:",
			"    name: Ada",
			'"odd key": 1',
			"note: |",
			"  line one",
			"  line two",
			"base: &base",
			"  x: 1",
			"copy: *base",
		].join("\n");
		expect(parseYamlMapping(raw)).toEqual({
			tags: ["a", "b"],
			meta: { author: { name: "Ada" } },
			"odd key": 1,
			note: "line one\nline two\n",
			base: { x: 1 },
			copy: { x: 1 },
		});
	});

	it("keeps dates as plain strings", () => {
		expect(parseYamlMapping("date: 2026-10-07")).toEqual({ date: "2026-10-07" });
	});

	it("round-trips lists, nested maps, multi-line strings, dates and awkward strings", () => {
		const data: Record<string, CmsJsonValue> = {
			title: "Hello: world",
			tags: ["a", "b c", "[x]"],
			nested: { list: [{ a: 1, b: "two" }, { a: 3 }], empty: {}, none: [] },
			text: "first\nsecond\n",
			date: "2026-10-07",
			numberLike: "123",
			flag: true,
			nothing: null,
		};
		expect(roundTrip(data)).toEqual(data);
	});

	it("writes simple values the way it always did", () => {
		expect(serializeFrontmatter({ title: "Hello", draft: false, tags: ["a", "b"], n: 3 })).toBe(
			"---\ntitle: Hello\ndraft: false\ntags:\n  - a\n  - b\nn: 3\n---\n",
		);
	});
});
