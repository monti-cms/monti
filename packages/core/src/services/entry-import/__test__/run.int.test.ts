import type { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { doc, paragraphsFormat } from "../../../../test/paragraphs-format";
import { fakeCms } from "../../../cms";
import type { ContentStore } from "../../../core/store";
import { emptyStoredDocument } from "../../../doc/stored-document";
import { createFormatRegistry } from "../../../format/registry";
import { createSite } from "../../../site";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
} from "../../../testing";
import { createContentService } from "../../content-service";
import { type ImportPlan, planImport } from "../plan";
import { runImport } from "../run";
import type { ImportHost, SourceEntry } from "../types";
import { importConfig, paragraph, sourceEntry } from "./fixture";

const site = createSite(importConfig);

describe("runImport", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let service: ReturnType<typeof createContentService>;
	let cms: ImportHost;

	beforeEach(async () => {
		({ pool, schemaName } = await createIsolatedTestPool());
		await migrateContentStore(pool, { site, schema: schemaName });
		store = createContentStore(pool, { site, schema: schemaName });
		const registry = createFormatRegistry([paragraphsFormat]);
		service = createContentService(store, { site, formats: async () => registry });
		cms = fakeCms({ config: importConfig, store, contentService: service as never, formats: [paragraphsFormat] });
	});

	afterEach(async () => {
		await dropIsolatedTestPool(pool, schemaName);
	});

	afterAll(async () => {
		await closeGlobalPool();
	});

	const planOf = (entries: SourceEntry[]) => planImport(cms, { kind: "export", entries, otherFiles: 0 });
	const resultsOf = async (plan: ImportPlan, publish = false) =>
		Object.fromEntries((await runImport(cms, plan, { publish })).map((result) => [result.key, result]));
	const storedEntries = async () => (await store.readExportSnapshot()).entries;

	it("DATA-I8 reports the step each entry failed at and keeps what was written: a draft whose body fails keeps its title and is not published", async () => {
		const planned = await planOf([
			sourceEntry("broken-body", { published: true }),
			sourceEntry("broken-draft"),
			// An address the store does not take (`?` is not allowed in a slug).
			sourceEntry("bad-slug", { slug: "what?", published: true }),
			sourceEntry("fine", {
				published: true,
				body: { kind: "text", format: "paragraphs", text: "See [the other note](/notes/other)" },
			}),
			// Imported, and not published.
			sourceEntry("other"),
		]);
		// A body the store refuses: an image of a media file this site does not have.
		const unsaveable = doc({ type: "image", attrs: { mediaId: "77777777-7777-4777-8777-777777777777", alt: "" } });
		const plan: ImportPlan = {
			...planned,
			entries: planned.entries.map((entry) =>
				entry.source.key.startsWith("broken-") ? { ...entry, doc: unsaveable } : entry,
			),
		};
		const results = await resultsOf(plan, true);

		expect(results["broken-body"]).toMatchObject({
			outcome: "draft",
			create: { status: "done" },
			body: { status: "failed", reason: { code: "write_failed" } },
			publish: { status: "skipped", reason: { code: "draft_missing" } },
			warnings: [],
		});
		const draft = await store.getEntry(results["broken-body"]?.id as string);
		expect(draft.status).toBe("draft");
		expect((await store.getWorking({ entryId: draft.id })).metadata.title).toBe("Title of broken-body");
		// Not published in the archive: no publish step, and still only a draft.
		expect(results["broken-draft"]).toMatchObject({ outcome: "draft", body: { status: "failed" }, publish: null });

		expect(results["bad-slug"]).toMatchObject({
			id: null,
			outcome: "failed",
			create: { status: "failed", reason: { code: "write_failed" } },
			body: null,
			publish: null,
			warnings: [],
		});

		const fine = results.fine;
		expect(fine).toMatchObject({ outcome: "imported", body: { status: "done" }, publish: { status: "done" } });
		// What the writes found is on the result.
		expect(fine?.warnings.map((warning) => warning.code)).toContain("unpublished_internal_link");
		expect((await store.getEntry(fine?.id as string)).status).toBe("published");

		expect((await storedEntries()).map((entry) => entry.workingSlug).sort()).toEqual([
			"broken-body",
			"broken-draft",
			"fine",
			"other",
		]);
	});

	it("DATA-I2 writes nothing for an entry the plan skipped, or whose address was taken after the plan, nor for its translation", async () => {
		const plan = await planOf([
			sourceEntry("kept"),
			sourceEntry("late"),
			sourceEntry("late-fr", { isSource: false, group: "late", locale: "fr", slug: null }),
			// Skipped by the plan, each with a collection to go to.
			sourceEntry("bodiless", { body: null }),
			sourceEntry("french-source", { locale: "fr" }),
			sourceEntry("twin", { slug: "kept" }),
		]);
		// Between the plan and the run, another request takes the address `late`.
		await service.createDraft({
			collection: "note",
			slug: "late",
			metadata: { title: "Already here" },
			doc: emptyStoredDocument(),
		} as never);
		const results = await resultsOf(plan);

		expect(results.kept).toMatchObject({ outcome: "imported" });
		const skipped = (code: string, params?: Record<string, string>) => ({
			id: null,
			outcome: "skipped",
			create: { status: "skipped", reason: params ? { code, params } : { code } },
			body: null,
			publish: null,
			warnings: [],
		});
		expect(results.late).toMatchObject(skipped("slug_exists", { slug: "late" }));
		expect(results["late-fr"]).toMatchObject(skipped("source_skipped"));
		expect(results.bodiless).toMatchObject(skipped("no_body"));
		expect(results["french-source"]).toMatchObject(skipped("locale_not_default", { locale: "fr" }));
		expect(results.twin).toMatchObject(skipped("slug_repeated", { slug: "kept" }));

		const stored = await storedEntries();
		expect(stored.map((entry) => entry.working.metadata.title).sort()).toEqual(["Already here", "Title of kept"]);
		expect((await store.getWorking({ entryId: results.kept?.id as string })).doc.content).toMatchObject([
			paragraph("Body of kept"),
		]);
	});
});
