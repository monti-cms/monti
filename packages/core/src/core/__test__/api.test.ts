import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { testSite } from "../../../test/site";
import { docOf } from "../../../test/stored-content";
import { createTemplateBodySchema, patchEntryBodySchema, patchTemplateBodySchema } from "../api";

/** Every request schema that takes a body, with the other fields it needs. */
const schemas = [
	["create entry", testSite.api.createEntryBodySchema, { collection: contentCollection }],
	["patch entry", patchEntryBodySchema, { expectedVersion: 1 }],
	["create template", createTemplateBodySchema, { name: "Template" }],
	["patch template", patchTemplateBodySchema, { expectedVersion: 1 }],
] as const;

describe("the body of a write request", () => {
	it("WRITE-S7 is a document, or a text with its format, or nothing; never both, and never a text or a format alone", () => {
		const doc = docOf("Body");
		const taken = [{ doc }, { body: "Text", format: "paragraphs" }, {}];
		const refused = [
			{ doc, body: "Text", format: "paragraphs" },
			{ doc, body: "Text" },
			{ doc, format: "paragraphs" },
			{ body: "Text" },
			{ format: "paragraphs" },
		];
		for (const [name, schema, fields] of schemas) {
			for (const body of taken) {
				expect(schema.safeParse({ ...fields, ...body }).success, `${name} ${JSON.stringify(body)}`).toBe(true);
			}
			for (const body of refused) {
				const parsed = schema.safeParse({ ...fields, ...body });
				expect(parsed.error?.issues, `${name} ${JSON.stringify(body)}`).toEqual([
					expect.objectContaining({ code: "custom", path: ["doc"] }),
				]);
			}
		}
	});
});
