import { describe, expect, it } from "vitest";
import { fakeCms } from "../../cms";
import { ServiceError } from "../../core/types";
import { exportBodyText } from "../export-body";
import { doc, paragraphsFormat } from "./paragraphs-format";

describe("exportBodyText", () => {
	it("writes a document through a format of the instance, for importing again", async () => {
		const cms = fakeCms({ formats: [paragraphsFormat] });
		const document = doc(
			{ type: "paragraph", content: [{ type: "text", text: "One" }] },
			{ type: "paragraph", content: [{ type: "text", text: "Two" }] },
		);
		expect(await exportBodyText(cms, { format: "paragraphs", doc: document, locale: "en" })).toEqual({
			text: "One\n\nTwo",
			warnings: [],
		});
	});

	it("keeps the id of a link that cannot be resolved, and fails for a format the instance does not have", async () => {
		const missing = "4a1f0b0e-6f3a-4c52-9d0e-1f2a3b4c5d6e";
		const cms = fakeCms({
			formats: [paragraphsFormat],
			store: {
				listPublishedByGroups: async () => [],
			},
		});
		const document = doc({
			type: "paragraph",
			content: [{ type: "text", text: "see", marks: [{ type: "link", attrs: { href: `entry:${missing}` } }] }],
		});
		const { text } = await exportBodyText(cms, { format: "paragraphs", doc: document, locale: "en" });
		expect(text).toContain(missing);
		await expect(exportBodyText(cms, { format: "nope", doc: document, locale: "en" })).rejects.toBeInstanceOf(
			ServiceError,
		);
	});
});
