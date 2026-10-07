import { describe, expect, it } from "vitest";
import { formatSchemaText, indentOf } from "../text";

const hand = `{
  "a": { "x": 1, "y": [1, 2, 3] },
  "list": [
    "one",
    "two"
  ],
  "deep": {
    "keep": "as   written",
    "change": 1
  }
}`;

describe("formatSchemaText", () => {
	it("gives the same text back for the same content, however it was formatted", () => {
		expect(formatSchemaText(hand, JSON.parse(hand))).toBe(hand);
	});

	it("rewrites only what changed and keeps the rest as written, with no trailing newline added", () => {
		const next = JSON.parse(hand);
		next.deep.change = 2;
		const text = formatSchemaText(hand, next);
		expect(text).toBe(hand.replace('"change": 1', '"change": 2'));
		expect(text.endsWith("\n")).toBe(false);
	});

	it("writes new parts in the indentation of the file, and keeps a trailing newline", () => {
		const text = formatSchemaText(`${hand}\n`, { ...JSON.parse(hand), added: { k: [{ n: 1 }] } });
		expect(text.endsWith("}\n")).toBe(true);
		expect(text).toContain('  "added": {\n    "k": [\n      {\n        "n": 1\n      }\n    ]\n  }');
		expect(indentOf(hand)).toBe("  ");
		expect(indentOf('{\n\t"a": 1\n}')).toBe("\t");
	});

	it("keeps an inline array inline when its items change, and appends to a long one on new lines", () => {
		const next = JSON.parse(hand);
		next.a.y = [1, 2, 3, 4];
		next.list = ["one", "two", "three"];
		const text = formatSchemaText(hand, next);
		expect(text).toContain('"y": [1, 2, 3, 4]');
		expect(text).toContain('"list": [\n    "one",\n    "two",\n    "three"\n  ]');
	});

	it("follows the key order of the new content: a reordered object is a change", () => {
		const text = formatSchemaText(hand, {
			deep: { change: 1, keep: "as   written" },
			a: { x: 1, y: [1, 2, 3] },
			list: ["one", "two"],
		});
		expect(Object.keys(JSON.parse(text))).toEqual(["deep", "a", "list"]);
		expect(Object.keys(JSON.parse(text).deep)).toEqual(["change", "keep"]);
	});

	it("moves a part that stays the same to another depth with its own formatting", () => {
		const text = formatSchemaText('{\n\t"a": {\n\t\t"b": [\n\t\t\t1,\n\t\t\t2\n\t\t]\n\t}\n}\n', { b: [1, 2] });
		expect(JSON.parse(text)).toEqual({ b: [1, 2] });
		expect(text).toBe('{\n\t"b": [\n\t\t1,\n\t\t2\n\t]\n}\n');
	});

	it("writes a new file with tabs", () => {
		expect(formatSchemaText(undefined, { a: [] })).toBe('{\n\t"a": []\n}\n');
	});
});
