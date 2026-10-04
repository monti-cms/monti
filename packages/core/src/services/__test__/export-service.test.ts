import { describe, expect, it } from "vitest";
import { recordCollection } from "../../../test/any-site";
import {
	buildExportArchive,
	canonicalJson,
	PUBLIC_METADATA_KEYS,
	pickPublicMetadata,
	publicExportEntrySchema,
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
	it("admin 아카이브는 초안과 공개본, 관계, 설정을 모두 담는다", () => {
		const { manifest, zip } = buildExportArchive(makeSnapshot(), { scope: "admin", exportedAt: FIXED_TIME });
		const archive = readAll(zip);

		expect(archive.paths).toEqual(
			[
				"addresses.json",
				entryPath(DRAFT, DRAFT_ID, "references.json"),
				entryPath(DRAFT, DRAFT_ID, "working.json"),
				entryPath(DRAFT, DRAFT_ID, "working.mdx"),
				entryPath(CONTENT, PUBLISHED_ID, "published.json"),
				entryPath(CONTENT, PUBLISHED_ID, "published.mdx"),
				entryPath(CONTENT, PUBLISHED_ID, "references.json"),
				entryPath(CONTENT, PUBLISHED_ID, "working.json"),
				entryPath(CONTENT, PUBLISHED_ID, "working.mdx"),
				entryPath(CONTENT, ARCHIVED_ID, "published.json"),
				entryPath(CONTENT, ARCHIVED_ID, "published.mdx"),
				entryPath(CONTENT, ARCHIVED_ID, "references.json"),
				entryPath(CONTENT, ARCHIVED_ID, "working.json"),
				entryPath(CONTENT, ARCHIVED_ID, "working.mdx"),
				"folders.json",
				"manifest.json",
				"media.json",
				"preferences.json",
				"templates.json",
			].sort(),
		);
		expect(archive.text(entryPath(DRAFT, DRAFT_ID, "working.mdx"))).toBe("draft secret body");
		expect(archive.text(entryPath(CONTENT, PUBLISHED_ID, "working.mdx"))).toBe("working body");
		expect(archive.text(entryPath(CONTENT, PUBLISHED_ID, "published.mdx"))).toBe("published body");
		expect(archive.text(entryPath(CONTENT, ARCHIVED_ID, "published.mdx"))).toBe("archived published body");
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

	it("public 아카이브는 초안 본문과 관리자 전용 값을 포함하지 않는다", () => {
		const { manifest, zip } = buildExportArchive(makeSnapshot(), { scope: "public", exportedAt: FIXED_TIME });
		const archive = readAll(zip);

		expect(archive.paths).toEqual(
			[
				entryPath(CONTENT, PUBLISHED_ID, "published.json"),
				entryPath(CONTENT, PUBLISHED_ID, "published.mdx"),
				"manifest.json",
				"media.json",
			].sort(),
		);
		// 초안 전용 문자열이 어떤 파일에도 남지 않는다.
		for (const path of archive.paths) {
			expect(archive.text(path)).not.toContain("draft secret body");
			expect(archive.text(path)).not.toContain("working body");
		}
		// 공개 항목에는 working 계열 키가 존재하지 않는다.
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
		// 공개 미디어는 공개 상태에서 참조된 것만 남는다(작업본 전용·초안 전용 제외).
		const publicMedia = JSON.parse(archive.text("media.json")) as { id: string; filename: string }[];
		expect(publicMedia.map((asset) => asset.id)).toEqual(["44444444-4444-4444-8444-444444444444"]);
		expect(archive.text("media.json")).not.toContain("storageKey");
		expect(archive.text("media.json")).not.toContain("working-only.png");
	});

	it("public 아카이브는 archived/trashed 항목의 잔여 공개본을 내보내지 않는다", () => {
		const snapshot = makeSnapshot();
		const archived = snapshot.entries.find((entry) => entry.status === "archived");
		expect(archived?.published).toBeDefined();

		const archivedTrashed = {
			...snapshot,
			entries: snapshot.entries.map((entry) => (entry.status === "archived" ? { ...entry, status: "trashed" } : entry)),
		};

		for (const candidate of [snapshot, archivedTrashed]) {
			const { manifest, zip } = buildExportArchive(candidate, { scope: "public", exportedAt: FIXED_TIME });
			const archive = readAll(zip);
			expect(archive.paths.some((path) => path.includes("88888888"))).toBe(false);
			expect(decoder.decode(zip)).not.toContain("archived published body");
			expect(manifest.entries.some((entry) => entry.id === "88888888-8888-4888-8888-888888888888")).toBe(false);
		}
	});

	it("참조만 바뀌어도 항목 digest가 달라진다", () => {
		const snapshot = makeSnapshot();
		const base = buildExportArchive(snapshot, { scope: "admin", exportedAt: FIXED_TIME });
		const changedReferences = {
			...snapshot,
			references: snapshot.references.map((reference) =>
				reference.entryId === "11111111-1111-4111-8111-111111111111" && reference.kind === FIXTURE_RELATION_KIND
					? { ...reference, targetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }
					: reference,
			),
		};
		const changed = buildExportArchive(changedReferences, { scope: "admin", exportedAt: FIXED_TIME });

		expect(changed.digest).not.toBe(base.digest);
	});

	it("같은 입력과 같은 exportedAt이면 바이트까지 동일하다", () => {
		const first = buildExportArchive(makeSnapshot(), {
			scope: "admin",
			exportedAt: FIXED_TIME,
			archiveModifiedAt: FIXED_TIME,
		});
		const second = buildExportArchive(makeSnapshot(), {
			scope: "admin",
			exportedAt: FIXED_TIME,
			archiveModifiedAt: FIXED_TIME,
		});
		expect(Array.from(first.zip)).toEqual(Array.from(second.zip));
	});

	it("digest는 exportedAt에 영향받지 않고 내용이 바뀌면 달라진다", () => {
		const base = buildExportArchive(makeSnapshot(), { scope: "admin", exportedAt: FIXED_TIME });
		const later = buildExportArchive(makeSnapshot(), {
			scope: "admin",
			exportedAt: new Date("2026-09-23T00:00:00.000Z"),
		});
		expect(later.digest).toBe(base.digest);

		const changed = makeSnapshot();
		const firstEntry = changed.entries[0];
		if (!firstEntry?.published) throw new Error("fixture");
		changed.entries[0] = { ...firstEntry, published: fixtureBody("published body v2", "게시글", "hash-published-2") };
		expect(buildExportArchive(changed, { scope: "admin", exportedAt: FIXED_TIME }).digest).not.toBe(base.digest);
	});

	it("공개 projection 스키마는 초안 필드가 섞이면 거부한다", () => {
		const valid = publicExportEntrySchema.safeParse({
			id: "11111111-1111-4111-8111-111111111111",
			collection: CONTENT,
			slug: "s",
			publishedAt: null,
			updatedAt: "2026-09-22T00:00:00.000Z",
			metadata: {},
			mdx: "body",
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
			mdx: "body",
			schemaVersion: 1,
			contentHash: "h",
			working: { mdx: "draft" },
		});
		expect(withWorking.success).toBe(false);
	});

	it("canonicalJson은 key 순서에 의존하지 않는다", () => {
		expect(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(canonicalJson({ a: [2, { c: 4, d: 3 }], b: 1 }));
	});
	it("public 아카이브는 중첩 metadata의 관리자 전용 키를 제거한다", () => {
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

		const admin = readAll(buildExportArchive(withInternals, { scope: "admin", exportedAt: FIXED_TIME }).zip);
		expect(admin.text(entryPath(CONTENT, PUBLISHED_ID, "published.json"))).toContain("internalNote");

		const publicArchive = readAll(buildExportArchive(withInternals, { scope: "public", exportedAt: FIXED_TIME }).zip);
		const publicJson = publicArchive.text(entryPath(CONTENT, PUBLISHED_ID, "published.json"));
		expect(publicJson).not.toContain("internalNote");
		expect(publicJson).not.toContain("storageKey");
		expect(JSON.parse(publicJson).metadata.title).toBe("게시글");
	});

	it("설정만 바뀌어도 아카이브 digest가 달라진다", () => {
		const base = buildExportArchive(makeSnapshot(), { scope: "admin", exportedAt: FIXED_TIME });
		const changedPreferences = {
			...makeSnapshot(),
			preferences: [{ userId: "admin", preferences: { defaultPageSize: 50 }, updatedAt: FIXED_TIME }],
		};
		const changedFolders = {
			...makeSnapshot(),
			folders: [{ ...makeSnapshot().folders[0], name: "바뀐 폴더" }],
		};

		expect(buildExportArchive(changedPreferences, { scope: "admin", exportedAt: FIXED_TIME }).digest).not.toBe(
			base.digest,
		);
		expect(buildExportArchive(changedFolders, { scope: "admin", exportedAt: FIXED_TIME }).digest).not.toBe(base.digest);
	});
	it("allowlist가 없는 컬렉션은 공개 투영에서 실패한다", () => {
		expect(() => pickPublicMetadata("unknown-collection", { title: "x" })).toThrow(/allowlist/);
	});

	it("공개 metadata 키는 컬렉션 allowlist의 부분집합이다", () => {
		const archive = buildExportArchive(makeSnapshot(), { scope: "public", exportedAt: FIXED_TIME });
		const { paths, text } = readAll(archive.zip);
		const publishedPaths = paths.filter((path) => path.endsWith("published.json"));

		expect(publishedPaths.length).toBeGreaterThan(0);
		for (const path of publishedPaths) {
			const parsed = JSON.parse(text(path)) as { collection: string; metadata: Record<string, unknown> };
			const allowed = PUBLIC_METADATA_KEYS[parsed.collection];
			expect(allowed).toBeDefined();
			for (const key of Object.keys(parsed.metadata)) {
				expect(allowed).toContain(key);
			}
		}
	});

	it.skipIf(Object.keys(FIXTURE_SEO_METADATA).length === 0)("public 아카이브는 SEO metadata를 그대로 내보낸다", () => {
		const { zip } = buildExportArchive(makeSnapshot(), { scope: "public", exportedAt: FIXED_TIME });
		const archive = readAll(zip);
		const parsed = JSON.parse(archive.text(entryPath(CONTENT, PUBLISHED_ID, "published.json"))) as {
			metadata: Record<string, unknown>;
		};

		for (const [name, value] of Object.entries(FIXTURE_SEO_METADATA)) {
			expect(parsed.metadata[name]).toBe(value);
		}
		// SEO 키는 컬렉션 allowlist에 있어야 하고, 분류 같은 항목 컬렉션에는 열리지 않는다.
		const seoKeys = Object.keys(FIXTURE_SEO_METADATA);
		expect(PUBLIC_METADATA_KEYS[CONTENT]).toEqual(expect.arrayContaining(seoKeys));
		for (const key of seoKeys) expect(PUBLIC_METADATA_KEYS[recordCollection]).not.toContain(key);
	});
});
