import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "../schema/define";
import { usesInDoc, usesInValues } from "./uses";

const image = (id: string, media: string) => ({ id, type: "image", attrs: { media } });

describe("what a body uses", () => {
	it("09-4 finds a file wherever the block sits: at the top, in a list, deep in a quote", () => {
		const doc = {
			type: "doc",
			blocks: [
				image("b1", "m1"),
				{ id: "l", type: "list", children: [{ id: "li", type: "listItem", children: [image("b2", "m2")] }] },
				{ id: "q", type: "quote", children: [{ id: "q2", type: "quote", children: [image("b3", "m3")] }] },
				{ id: "f", type: "file", attrs: { media: "m4" } },
				{ id: "p", type: "paragraph", content: [{ type: "text", text: "no file" }] },
			],
		};
		expect(usesInDoc(doc)).toEqual([
			{ media: "m1", place: { block: "b1" } },
			{ media: "m2", place: { block: "b2" } },
			{ media: "m3", place: { block: "b3" } },
			{ media: "m4", place: { block: "f" } },
		]);
	});

	it("09-4 a block that has not got its file yet uses nothing, and an empty body neither", () => {
		expect(usesInDoc({ type: "doc", blocks: [image("b1", "")] })).toEqual([]);
		expect(usesInDoc(null)).toEqual([]);
	});
});

describe("what fields use", () => {
	const fields: Record<string, FieldDefinition> = {
		title: { kind: "text" },
		cover: { kind: "media", accept: "image" },
		attachment: { kind: "media", accept: "any" },
		note: { kind: "text" },
	};

	it("09-4 a media field with a file uses it; an empty one, and any other field that happens to hold the same shape, do not", () => {
		expect(
			usesInValues(fields, {
				cover: { media: "m1", alt: "책상" },
				attachment: null,
				note: { media: "m2" },
				gone: { media: "m3" },
			}),
		).toEqual([{ media: "m1", place: { field: "cover" } }]);
	});
});
