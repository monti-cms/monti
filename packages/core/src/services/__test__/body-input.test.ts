import { describe, expect, it } from "vitest";
import { emptyStoredDocument } from "../../doc/stored-document";
import { bodyInputOf } from "../body-input";

describe("bodyInputOf", () => {
	const fallback = emptyStoredDocument();

	it("takes the document that was sent", () => {
		const doc = { type: "doc", version: 3, content: [] };
		expect(bodyInputOf({ doc }, fallback)).toEqual({ doc });
	});

	it("takes a text with its format", () => {
		expect(bodyInputOf({ body: "# Hi", format: "mdx" }, fallback)).toEqual({ body: "# Hi", format: "mdx" });
	});

	it("falls back to the given document when the request sends no body", () => {
		expect(bodyInputOf({}, fallback)).toEqual({ doc: fallback });
	});
});
