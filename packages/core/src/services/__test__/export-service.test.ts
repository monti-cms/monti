import { describe, expect, it } from "vitest";
import { recordCollection } from "../../../test/any-site";
import { testSite } from "../../../test/site";
import { STORED_DOCUMENT_VERSION, unparsedDocument } from "../../doc/stored-document";
import {
	buildExportArchive,
	canonicalJson,
	type ExportTexts,
	exportTextKey,
	pickPublicMetadata,
	publicExportEntrySchema,
	publicMetadataKeys,
} from "../export-service";
import { readZipArchive } from "../zip";
import {
	FIXTURE_CONTENT_COLLECTION as CONTENT,
	FIXTURE_DRAFT_COLLECTION as DRAFT,
	fixtureEntryPath as entryPath,
	FIXTURE_TIME as FIXED_TIME,
	FIXTURE_RELATION_KIND,
	FIXTURE_SEO_METADATA,
	fixtureBody,
	fixtureDocument,
	makeExportFixtureSnapshot as makeSnapshot,
} from "./export-fixture";

const PUBLISHED_ID = "11111111-1111-4111-8111-111111111111";
const DRAFT_ID = "22222222-2222-4222-8222-222222222222";
const ARCHIVED_ID = "88888888-8888-4888-8888-888888888888";

const decoder = new TextDecoder();

const readAll = (zip: Uint8Array) => {
	const entries = readZipArchive(zip);
	return {
		paths: entries.map((entry) => entry.path).sort(),
		text: (path: string) => {
			const found = entries.find((entry) => entry.path === path);
			if (!found) throw new Error(`missing ${path}`);
			return decoder.decode(found.data);
		},
	};
};

describe("export archive builder", () => {
	it("the admin archive contains drafts, published copies, relations and settings", () => {
		const { manifest, zip } = buildExportArchive(makeSnapshot(), {
			site: testSite,
			scope: "admin",
			exportedAt: FIXED_TIME,
		});
		const archive = readAll(zip);

		expect(archive.paths).toEqual(
			[
				"addresses.json",
				entryPath(DRAFT, DRAFT_ID, "references.json"),
				entryPath(DRAFT, DRAFT_ID, "working.doc.json"),
				entryPath(DRAFT, DRAFT_ID, "working.json"),
				entryPath(CONTENT, PUBLISHED_ID, "published.doc.json"),
				entryPath(CONTENT, PUBLISHED_ID, "published.json"),
				entryPath(CONTENT, PUBLISHED_ID, "references.json"),
				entryPath(CONTENT, PUBLISHED_ID, "working.doc.json"),
				entryPath(CONTENT, PUBLISHED_ID, "working.json"),
				entryPath(CONTENT, ARCHIVED_ID, "published.doc.json"),
				entryPath(CONTENT, ARCHIVED_ID, "published.json"),
				entryPath(CONTENT, ARCHIVED_ID, "references.json"),
				entryPath(CONTENT, ARCHIVED_ID, "working.doc.json"),
				entryPath(CONTENT, ARCHIVED_ID, "working.json"),
				"folders.json",
				"manifest.json",
				"media.json",
				"preferences.json",
				"templates.json",
			].sort(),
		);
		// The archive holds the documents; text files exist only when the export asks for a format.
		expect(manifest.format).toBeNull();
		expect(archive.text(entryPath(DRAFT, DRAFT_ID, "working.doc.json"))).toBe(
			`${canonicalJson(fixtureDocument("draft secret body"))}\n`,
		);
		expect(manifest.counts).toMatchObject({
			entries: 3,
			workingBodies: 3,
			publishedBodies: 2,
			folders: 1,
			templates: 1,
			addresses: 1,
			preferences: 1,
			references: 4,
		});
		expect(manifest.entries).toHaveLength(3);
		expect(manifest.entries[0]?.files.length).toBeGreaterThan(0);
	});

	it("the public archive does not include draft bodies or admin-only values", () => {
		const { manifest, zip } = buildExportArchive(makeSnapshot(), {
			site: testSite,
			scope: "public",
			exportedAt: FIXED_TIME,
		});
		const archive = readAll(zip);

		expect(archive.paths).toEqual(
			[entryPath(CONTENT, PUBLISHED_ID, "published.json"), "manifest.json", "media.json"].sort(),
		);
		// The draft-only string does not remain in any file.
		for (const path of archive.paths) {
			expect(archive.text(path)).not.toContain("draft secret body");
			expect(archive.text(path)).not.toContain("working body");
		}
		// Public items have no working-family keys.
		for (const path of archive.paths.filter((p) => p.endsWith(".json"))) {
			expect(archive.text(path)).not.toContain('"working"');
		}
		expect(manifest.entries).toHaveLength(1);
		expect(manifest.scope).toBe("public");
		expect(manifest.counts).toMatchObject({
			entries: 1,
			workingBodies: 0,
			publishedBodies: 1,
			folders: 0,
			templates: 0,
			addresses: 0,
			preferences: 0,
			references: 0,
		});
		// Public media keeps only what is referenced in the public state (excluding working-only and draft-only).
		const publicMedia = JSON.parse(archive.text("media.json")) as { id: string; filename: string }[];
		expect(publicMedia.map((asset) => asset.id)).toEqual(["44444444-4444-4444-8444-444444444444"]);
		expect(archive.text("media.json")).not.toContain("storageKey");
		expect(archive.text("media.json")).not.toContain("working-only.png");
	});

	it("the public archive does not export the leftover published copy of archived/trashed items", () => {
		const snapshot = makeSnapshot();
		const archived = snapshot.entries.find((entry) => entry.status === "archived");
		expect(archived?.published).toBeDefined();

		const archivedTrashed = {
			...snapshot,
			entries: snapshot.entries.map((entry) => (entry.status === "archived" ? { ...entry, status: "trashed" } : entry)),
		};

		for (const candidate of [snapshot, archivedTrashed]) {
			const { manifest, zip } = buildExportArchive(candidate, {
				site: testSite,
				scope: "public",
				exportedAt: FIXED_TIME,
			});
			const archive = readAll(zip);
			expect(archive.paths.some((path) => path.includes("88888888"))).toBe(false);
			expect(decoder.decode(zip)).not.toContain("archived published body");
			expect(manifest.entries.some((entry) => entry.id === "88888888-8888-4888-8888-888888888888")).toBe(false);
		}
	});

	it("the item digest changes even when only the references change", () => {
		const snapshot = makeSnapshot();
		const base = buildExportArchive(snapshot, { site: testSite, scope: "admin", exportedAt: FIXED_TIME });
		const changedReferences = {
			...snapshot,
			references: snapshot.references.map((reference) =>
				reference.entryId === "11111111-1111-4111-8111-111111111111" && reference.kind === FIXTURE_RELATION_KIND
					? { ...reference, targetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }
					: reference,
			),
		};
		const changed = buildExportArchive(changedReferences, { site: testSite, scope: "admin", exportedAt: FIXED_TIME });

		expect(changed.digest).not.toBe(base.digest);
	});

	it("the same input and the same exportedAt give identical bytes", () => {
		const first = buildExportArchive(makeSnapshot(), {
			site: testSite,
			scope: "admin",
			exportedAt: FIXED_TIME,
			archiveModifiedAt: FIXED_TIME,
		});
		const second = buildExportArchive(makeSnapshot(), {
			site: testSite,
			scope: "admin",
			exportedAt: FIXED_TIME,
			archiveModifiedAt: FIXED_TIME,
		});
		expect(Array.from(first.zip)).toEqual(Array.from(second.zip));
	});

	it("the digest is not affected by exportedAt and changes when the content changes", () => {
		const base = buildExportArchive(makeSnapshot(), { site: testSite, scope: "admin", exportedAt: FIXED_TIME });
		const later = buildExportArchive(makeSnapshot(), {
			site: testSite,
			scope: "admin",
			exportedAt: new Date("2026-09-23T00:00:00.000Z"),
		});
		expect(later.digest).toBe(base.digest);

		const changed = makeSnapshot();
		const firstEntry = changed.entries[0];
		if (!firstEntry?.published) throw new Error("fixture");
		changed.entries[0] = { ...firstEntry, published: fixtureBody("published body v2", "게시글", "hash-published-2") };
		expect(buildExportArchive(changed, { site: testSite, scope: "admin", exportedAt: FIXED_TIME }).digest).not.toBe(
			base.digest,
		);
	});

	it("the admin archive is format version 4 and writes the document, the only body", () => {
		const { manifest, zip } = buildExportArchive(makeSnapshot(), {
			site: testSite,
			scope: "admin",
			exportedAt: FIXED_TIME,
		});
		const archive = readAll(zip);

		expect(manifest.formatVersion).toBe(4);
		expect(JSON.parse(archive.text("manifest.json")).formatVersion).toBe(4);
		for (const path of archive.paths.filter((item) => /\/(working|published)\.json$/.test(item))) {
			const body = JSON.parse(archive.text(path));
			expect(body.formatVersion, path).toBe(4);
			expect(body).not.toHaveProperty("mdx");
		}
		const workingDoc = archive.text(entryPath(CONTENT, PUBLISHED_ID, "working.doc.json"));
		expect(workingDoc).toBe(`${canonicalJson(fixtureDocument("working body"))}\n`);
		expect(JSON.parse(workingDoc)).toMatchObject({ type: "doc", version: STORED_DOCUMENT_VERSION });
		expect(archive.text(entryPath(CONTENT, PUBLISHED_ID, "published.doc.json"))).toBe(
			`${canonicalJson(fixtureDocument("published body"))}\n`,
		);
		// The document files are listed with the item.
		const item = manifest.entries.find((entry) => entry.id === PUBLISHED_ID);
		expect(item?.files).toEqual(
			expect.arrayContaining([
				entryPath(CONTENT, PUBLISHED_ID, "working.doc.json"),
				entryPath(CONTENT, PUBLISHED_ID, "published.doc.json"),
			]),
		);
		expect(manifest.files).toContain(entryPath(CONTENT, PUBLISHED_ID, "working.doc.json"));
		expect(manifest.counts.files).toBe(manifest.files.length);
	});

	it("every body has a document file, a body that could not become a document included (as an unparsed node)", () => {
		const snapshot = makeSnapshot();
		const draft = snapshot.entries.find((entry) => entry.id === DRAFT_ID);
		if (!draft) throw new Error("fixture");
		draft.working = { ...draft.working, doc: unparsedDocument("<Open") };
		const archive = readAll(
			buildExportArchive(snapshot, { site: testSite, scope: "admin", exportedAt: FIXED_TIME }).zip,
		);

		for (const [collection, id, file] of [
			[DRAFT, DRAFT_ID, "working.doc.json"],
			[CONTENT, ARCHIVED_ID, "working.doc.json"],
			[CONTENT, ARCHIVED_ID, "published.doc.json"],
		] as const) {
			expect(archive.paths).toContain(entryPath(collection, id, file));
		}
		expect(JSON.parse(archive.text(entryPath(DRAFT, DRAFT_ID, "working.doc.json"))).content[0]).toMatchObject({
			type: "unparsed",
			attrs: { source: "<Open" },
		});
	});

	it("templates.json carries the document of each template, and no text", () => {
		const { zip } = buildExportArchive(makeSnapshot(), { site: testSite, scope: "admin", exportedAt: FIXED_TIME });
		const templates = JSON.parse(readAll(zip).text("templates.json")) as { doc: unknown }[];

		expect(templates).toHaveLength(1);
		expect(templates[0]).not.toHaveProperty("mdx");
		expect(templates[0]).not.toHaveProperty("body");
		expect(templates[0]?.doc).toEqual(fixtureDocument("## 문제"));
	});

	describe("with a format", () => {
		const TEMPLATE_ID = "66666666-6666-4666-8666-666666666666";
		const texts: ExportTexts = {
			format: { name: "demo", extension: "demo" },
			bodies: new Map([
				[exportTextKey(DRAFT_ID, "working"), "draft text"],
				[exportTextKey(PUBLISHED_ID, "working"), "working text"],
				[exportTextKey(PUBLISHED_ID, "published"), "published text"],
				[exportTextKey(TEMPLATE_ID, "template"), "template text"],
			]),
		};

		it("the admin archive also holds each body as a file of that format, named by the format's extension", () => {
			const { manifest, zip } = buildExportArchive(makeSnapshot(), {
				site: testSite,
				scope: "admin",
				exportedAt: FIXED_TIME,
				texts,
			});
			const archive = readAll(zip);

			expect(manifest.format).toEqual({ name: "demo", extension: "demo" });
			expect(archive.text(entryPath(DRAFT, DRAFT_ID, "working.demo"))).toBe("draft text");
			expect(archive.text(entryPath(CONTENT, PUBLISHED_ID, "working.demo"))).toBe("working text");
			expect(archive.text(entryPath(CONTENT, PUBLISHED_ID, "published.demo"))).toBe("published text");
			// A body that has no text (the archived item was not given one) has no file, and the documents are all still there.
			expect(archive.paths).not.toContain(entryPath(CONTENT, ARCHIVED_ID, "working.demo"));
			expect(archive.paths).toContain(entryPath(CONTENT, ARCHIVED_ID, "working.doc.json"));
			const item = manifest.entries.find((entry) => entry.id === PUBLISHED_ID);
			expect(item?.files).toContain(entryPath(CONTENT, PUBLISHED_ID, "published.demo"));
			expect(manifest.counts.files).toBe(manifest.files.length);
			const templates = JSON.parse(archive.text("templates.json")) as { body?: string; doc: unknown }[];
			expect(templates[0]).toMatchObject({ body: "template text", doc: fixtureDocument("## 문제") });
		});

		it("the public archive holds the published text of the published items only", () => {
			const { zip } = buildExportArchive(makeSnapshot(), {
				site: testSite,
				scope: "public",
				exportedAt: FIXED_TIME,
				texts,
			});
			const archive = readAll(zip);

			expect(archive.text(entryPath(CONTENT, PUBLISHED_ID, "published.demo"))).toBe("published text");
			expect(archive.paths.some((path) => path.endsWith("working.demo"))).toBe(false);
			expect(archive.paths).not.toContain(entryPath(DRAFT, DRAFT_ID, "working.demo"));
			for (const path of archive.paths) expect(archive.text(path)).not.toContain("working text");
		});

		it("the same documents give the same digest whether or not text files are added", () => {
			const plain = buildExportArchive(makeSnapshot(), { site: testSite, scope: "admin", exportedAt: FIXED_TIME });
			const withText = buildExportArchive(makeSnapshot(), {
				site: testSite,
				scope: "admin",
				exportedAt: FIXED_TIME,
				texts,
			});
			// The item digests cover the state (document, slug, references), not how it was spelled out.
			expect(withText.manifest.entries.map((entry) => entry.itemDigest)).toEqual(
				plain.manifest.entries.map((entry) => entry.itemDigest),
			);
		});
	});

	it("the admin digests change when only the document changes", () => {
		const base = buildExportArchive(makeSnapshot(), { site: testSite, scope: "admin", exportedAt: FIXED_TIME });
		const changeDoc = (state: "working" | "published") => {
			const snapshot = makeSnapshot();
			const first = snapshot.entries[0];
			const body = first?.[state];
			if (!first || !body) throw new Error("fixture");
			// The same MDX and hash, another document.
			snapshot.entries[0] = { ...first, [state]: { ...body, doc: fixtureDocument("another body") } };
			return buildExportArchive(snapshot, { site: testSite, scope: "admin", exportedAt: FIXED_TIME });
		};

		for (const state of ["working", "published"] as const) {
			const changed = changeDoc(state);
			expect(changed.digest).not.toBe(base.digest);
			const before = base.manifest.entries.find((entry) => entry.id === PUBLISHED_ID);
			const after = changed.manifest.entries.find((entry) => entry.id === PUBLISHED_ID);
			expect(before).toBeDefined();
			expect(after?.itemDigest).not.toBe(before?.itemDigest);
			expect(after?.[`${state}Digest`]).not.toBe(before?.[`${state}Digest`]);
		}

		const noDoc = makeSnapshot();
		const template = noDoc.templates[0];
		if (!template) throw new Error("fixture");
		noDoc.templates[0] = { ...template, doc: fixtureDocument("another template") };
		expect(buildExportArchive(noDoc, { site: testSite, scope: "admin", exportedAt: FIXED_TIME }).digest).not.toBe(
			base.digest,
		);
	});

	it("the public archive carries the published document, and its digests depend on it", () => {
		const options = { site: testSite, scope: "public", exportedAt: FIXED_TIME } as const;
		const base = buildExportArchive(makeSnapshot(), options);
		const archive = readAll(base.zip);

		expect(base.manifest.formatVersion).toBe(4);
		// The document is a field of the entry, not a file of its own, and it is the document the admin archive stores.
		expect(archive.paths.some((path) => path.includes(".doc.json"))).toBe(false);
		const published = JSON.parse(archive.text(entryPath(CONTENT, PUBLISHED_ID, "published.json")));
		expect(published.doc).toEqual(fixtureDocument("published body"));
		expect(published.doc).toMatchObject({ type: "doc" });
		// A draft's document never goes out.
		for (const path of archive.paths) {
			expect(archive.text(path)).not.toContain(canonicalJson(fixtureDocument("working body")));
		}

		const stripped = makeSnapshot();
		stripped.entries = stripped.entries.map((entry) => ({
			...entry,
			...(entry.published ? { published: { ...entry.published, doc: fixtureDocument("stripped") } } : {}),
		}));
		const without = buildExportArchive(stripped, options);
		expect(JSON.parse(readAll(without.zip).text(entryPath(CONTENT, PUBLISHED_ID, "published.json"))).doc).toEqual(
			fixtureDocument("stripped"),
		);
		expect(without.digest).not.toBe(base.digest);
		const entryOf = (manifest: typeof base.manifest) => manifest.entries.find((entry) => entry.id === PUBLISHED_ID);
		expect(entryOf(without.manifest)?.publishedDigest).not.toBe(entryOf(base.manifest)?.publishedDigest);
	});

	it("the public projection schema rejects a mix of draft fields", () => {
		const valid = publicExportEntrySchema.safeParse({
			id: "11111111-1111-4111-8111-111111111111",
			collection: CONTENT,
			slug: "s",
			publishedAt: null,
			updatedAt: "2026-09-22T00:00:00.000Z",
			metadata: {},
			doc: fixtureDocument("body"),
			schemaVersion: 1,
			contentHash: "h",
		});
		expect(valid.success).toBe(true);

		const withWorking = publicExportEntrySchema.safeParse({
			id: "11111111-1111-4111-8111-111111111111",
			collection: CONTENT,
			slug: "s",
			publishedAt: null,
			updatedAt: "2026-09-22T00:00:00.000Z",
			metadata: {},
			doc: fixtureDocument("body"),
			schemaVersion: 1,
			contentHash: "h",
			working: { doc: fixtureDocument("draft") },
		});
		expect(withWorking.success).toBe(false);
	});

	it("canonicalJson does not depend on key order", () => {
		expect(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(canonicalJson({ a: [2, { c: 4, d: 3 }], b: 1 }));
	});
	it("the public archive removes admin-only keys from nested metadata", () => {
		const snapshot = makeSnapshot();
		const withInternals = {
			...snapshot,
			entries: snapshot.entries.map((entry) =>
				entry.id === "11111111-1111-4111-8111-111111111111" && entry.published
					? {
							...entry,
							published: {
								...entry.published,
								metadata: { ...entry.published.metadata, storageKey: "media/secret.png", internalNote: "관리자 메모" },
							},
						}
					: entry,
			),
		};

		const admin = readAll(
			buildExportArchive(withInternals, { site: testSite, scope: "admin", exportedAt: FIXED_TIME }).zip,
		);
		expect(admin.text(entryPath(CONTENT, PUBLISHED_ID, "published.json"))).toContain("internalNote");

		const publicArchive = readAll(
			buildExportArchive(withInternals, { site: testSite, scope: "public", exportedAt: FIXED_TIME }).zip,
		);
		const publicJson = publicArchive.text(entryPath(CONTENT, PUBLISHED_ID, "published.json"));
		expect(publicJson).not.toContain("internalNote");
		expect(publicJson).not.toContain("storageKey");
		expect(JSON.parse(publicJson).metadata.title).toBe("게시글");
	});

	it("the archive digest changes even when only the settings change", () => {
		const base = buildExportArchive(makeSnapshot(), { site: testSite, scope: "admin", exportedAt: FIXED_TIME });
		const changedPreferences = {
			...makeSnapshot(),
			preferences: [{ userId: "admin", preferences: { defaultPageSize: 50 }, updatedAt: FIXED_TIME }],
		};
		const changedFolders = {
			...makeSnapshot(),
			folders: [{ ...makeSnapshot().folders[0], name: "바뀐 폴더" }],
		};

		expect(
			buildExportArchive(changedPreferences, { site: testSite, scope: "admin", exportedAt: FIXED_TIME }).digest,
		).not.toBe(base.digest);
		expect(
			buildExportArchive(changedFolders, { site: testSite, scope: "admin", exportedAt: FIXED_TIME }).digest,
		).not.toBe(base.digest);
	});
	it("a collection without an allowlist fails in the public projection", () => {
		expect(() => pickPublicMetadata(testSite, "unknown-collection", { title: "x" })).toThrow(/allowlist/);
	});

	it("public metadata keys are a subset of the collection allowlist", () => {
		const archive = buildExportArchive(makeSnapshot(), { site: testSite, scope: "public", exportedAt: FIXED_TIME });
		const { paths, text } = readAll(archive.zip);
		const publishedPaths = paths.filter((path) => path.endsWith("published.json"));

		expect(publishedPaths.length).toBeGreaterThan(0);
		for (const path of publishedPaths) {
			const parsed = JSON.parse(text(path)) as { collection: string; metadata: Record<string, unknown> };
			const allowed = publicMetadataKeys(testSite)[parsed.collection];
			expect(allowed).toBeDefined();
			for (const key of Object.keys(parsed.metadata)) {
				expect(allowed).toContain(key);
			}
		}
	});

	it.skipIf(Object.keys(FIXTURE_SEO_METADATA).length === 0)("the public archive exports SEO metadata as is", () => {
		const { zip } = buildExportArchive(makeSnapshot(), { site: testSite, scope: "public", exportedAt: FIXED_TIME });
		const archive = readAll(zip);
		const parsed = JSON.parse(archive.text(entryPath(CONTENT, PUBLISHED_ID, "published.json"))) as {
			metadata: Record<string, unknown>;
		};

		for (const [name, value] of Object.entries(FIXTURE_SEO_METADATA)) {
			expect(parsed.metadata[name]).toBe(value);
		}
		// SEO keys must be in the collection allowlist and are not opened for item collections such as categories.
		const seoKeys = Object.keys(FIXTURE_SEO_METADATA);
		expect(publicMetadataKeys(testSite)[CONTENT]).toEqual(expect.arrayContaining(seoKeys));
		for (const key of seoKeys) expect(publicMetadataKeys(testSite)[recordCollection]).not.toContain(key);
	});
});
