import { defineConfig } from "@monti-cms/core/server";
import { testServer } from "@monti-cms/core/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema } from "../site";
import { markdown } from "./index";

const test = testServer();
const cms = defineConfig({ schema, plugins: [markdown()], ...test.server });

beforeAll(() => cms.migrate());
afterAll(async () => {
	await cms.close();
	await test.drop();
});

const TEXT = [
	"## Why a format",
	"",
	"Plain **bold**, *italic*, `code`, an escaped \\*star\\* and a [link](https://example.com/docs).",
	"",
	"- one",
	"- two",
	"",
	"1. first",
	"2. second",
	"",
].join("\n");

const publish = async (slug: string, body: string, format: string) => {
	const service = cms.contentService();
	const draft = await service.createDraft({ collection: "post", slug, metadata: { title: slug }, body, format });
	await service.publish({ id: draft.id, expectedVersion: draft.version });
};

const read = async (slug: string, format: string) => {
	const result = await cms.read.getEntry({ collection: "post", slug, format });
	if (result.status !== "found") throw new Error(`${slug} is not published`);
	return result.entry;
};

describe("markdown format", () => {
	it("is listed with the formats of the instance", async () => {
		const formats = await cms.formats();
		expect(formats.list().map((format) => format.name)).toEqual(["markdown", "text"]);
	});

	it("writes a text into the document and reads the same text back", async () => {
		await publish("round-trip", TEXT, "markdown");
		const entry = await read("round-trip", "markdown");
		expect(entry.body).toEqual({ format: "markdown", text: TEXT });
		// What was stored is a document of real blocks and marks, not the text.
		expect(entry.doc?.content.map((node) => node.type)).toEqual(["heading", "paragraph", "bulletList", "orderedList"]);
		expect(entry.doc?.content[1]?.content?.map((node) => node.marks?.map((mark) => mark.type))).toContainEqual([
			"bold",
		]);
	});

	it("writes an address of this site as a link by entry, and reads it back as the address", async () => {
		await publish("target", "The target.", "markdown");
		await publish("source", "See [the target](/posts/target).", "markdown");
		const entry = await read("source", "markdown");
		expect(entry.body?.text).toBe("See [the target](/posts/target).\n");
	});

	it("a one-way format reads but is refused for writing", async () => {
		const entry = await read("round-trip", "text");
		expect(entry.body?.text).toContain("Why a format Plain bold, italic, code, an escaped *star*");
		const write = cms
			.contentService()
			.createDraft({ collection: "post", slug: "no", metadata: { title: "no" }, body: "x", format: "text" });
		await expect(write).rejects.toMatchObject({ code: "format_not_importable" });
	});

	it("an unknown format says so", async () => {
		await expect(read("round-trip", "hugo")).rejects.toMatchObject({ code: "unknown_format" });
	});
});
