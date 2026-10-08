import { CmsContent } from "@monti-cms/core/render";
import { defineConfig } from "@monti-cms/core/server";
import { testServer } from "@monti-cms/core/testing";
import { mdx } from "@monti-cms/mdx";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema } from "../site";
import { notice } from "./index";

const test = testServer();
const cms = defineConfig({ schema, plugins: [mdx(), notice()], ...test.server });

beforeAll(() => cms.migrate());
afterAll(async () => {
	await cms.close();
	await test.drop();
});

const save = (slug: string, body: string) =>
	cms.contentService().createDraft({ collection: "post", slug, metadata: { title: slug }, body, format: "mdx" });

describe("notice block", () => {
	it("is stored as a block of the document, not as text", async () => {
		const draft = await save("stored", '<Notice level="warn" title="Heads up">\n\nBackups first.\n\n</Notice>');
		const [block] = draft.working.doc.content;
		expect(block).toMatchObject({ type: "notice", attrs: { level: "warn", title: "Heads up" } });
	});

	it("warns, without blocking, when a warning has no title", async () => {
		const draft = await save("untitled", '<Notice level="warn">\n\nBackups first.\n\n</Notice>');
		expect(draft.warnings).toEqual([
			expect.objectContaining({
				code: "notice_warning_needs_title",
				params: expect.objectContaining({ block: "notice" }),
			}),
		]);
		expect(
			(await save("titled", '<Notice level="warn" title="Heads up">\n\nBackups first.\n\n</Notice>')).warnings,
		).toBeUndefined();
	});

	it("is drawn on the public page by the plugin's component", async () => {
		const service = cms.contentService();
		const draft = await save("public", '<Notice level="warn" title="Heads up">\n\nBackups first.\n\n</Notice>');
		await service.publish({ id: draft.id, expectedVersion: draft.version });
		const result = await cms.read.getEntry({ collection: "post", slug: "public" });
		if (result.status !== "found") throw new Error("the post is not published");
		const html = renderToStaticMarkup(await CmsContent({ cms, entry: result.entry }));
		expect(html).toContain('<aside data-notice-level="warn" role="alert"><strong>Heads up</strong>');
		expect(html).toContain("Backups first.");
	});
});
