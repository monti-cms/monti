import { createHash } from "node:crypto";
import { z } from "zod";
import type { ExportSnapshot, ExportSnapshotEntry, ExportSnapshotReference } from "../adapters/postgres/content-store";
import { COLLECTIONS } from "../core/collections";
import { storedFields } from "../schema/derive";
import { createZipArchive, type ZipEntry } from "./zip";

export const exportScopeSchema = z.enum(["admin", "public"]);
export type ExportScope = z.infer<typeof exportScopeSchema>;

/**
 * 공개 projection 스키마. `working` 필드가 아예 없고 `.strict()`이므로 항목 최상위에 초안 본문이나
 * 관리자 전용 키가 섞이면 파싱 단계에서 실패한다(fail-closed).
 * `metadata` 내부는 컬렉션 필드 자유도가 높아 재귀 allowlist까지는 하지 않는다(비차단 후속 항목).
 */
export const publicExportEntrySchema = z
	.object({
		id: z.string().uuid(),
		collection: z.string(),
		slug: z.string().nullable(),
		publishedAt: z.string().nullable(),
		updatedAt: z.string(),
		metadata: z.record(z.string(), z.unknown()),
		mdx: z.string(),
		schemaVersion: z.number().int(),
		contentHash: z.string(),
	})
	.strict();

export type PublicExportEntry = z.infer<typeof publicExportEntrySchema>;

/**
 * 공개 metadata allowlist. 컬렉션 정의의 저장 필드만 골라 내보내므로
 * 관리자 전용 키(storageKey 등)나 정의에 없는 값이 metadata에 섞여도 공개 아카이브에 나가지 않는다.
 * record 컬렉션의 언어별 이름(`translations`)은 필드가 아니라 나가지 않는다.
 */
export const PUBLIC_METADATA_KEYS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
	COLLECTIONS.map((collection) => [collection, storedFields(collection).map((stored) => stored.name)]),
);

export function pickPublicMetadata(collection: string, metadata: Record<string, unknown>): Record<string, unknown> {
	const allowed = PUBLIC_METADATA_KEYS[collection];
	if (!allowed) throw new Error(`No public metadata allowlist for collection: ${collection}`);
	const picked: Record<string, unknown> = {};
	for (const key of allowed) {
		if (metadata[key] !== undefined) picked[key] = metadata[key];
	}
	return picked;
}

export interface ExportManifestEntry {
	id: string;
	collection: string;
	/** 콘텐츠 언어와 번역 묶음 ID(v2 B4). 원문이면 묶음 ID가 자기 ID다. */
	locale: string;
	translationGroupId: string;
	status: string;
	version: number;
	workingSlug: string | null;
	publishedSlug: string | null;
	folderId: string | null;
	createdAt: string | null;
	updatedAt: string | null;
	publishedAt: string | null;
	hasWorking: boolean;
	hasPublished: boolean;
	/** 상태 1건의 canonical digest. */
	workingDigest: string | null;
	publishedDigest: string | null;
	/** 항목 전체(작업본+공개본) digest. 아카이브 간 동일성 비교·감사용이다. */
	itemDigest: string;
	files: string[];
}

export interface ExportManifest {
	formatVersion: number;
	scope: ExportScope;
	exportedAt: string;
	digest: string;
	counts: {
		entries: number;
		workingBodies: number;
		publishedBodies: number;
		folders: number;
		media: number;
		templates: number;
		addresses: number;
		preferences: number;
		references: number;
		files: number;
	};
	entries: ExportManifestEntry[];
	files: string[];
}

export interface ExportArchive {
	zip: Uint8Array;
	manifest: ExportManifest;
	digest: string;
}

const iso = (value: Date | null | undefined): string | null =>
	value instanceof Date ? value.toISOString() : value === undefined ? null : value;

/** key 순서에 의존하지 않는 canonical JSON. digest와 스냅샷 비교에 쓴다. */
export const canonicalJson = (value: unknown): string => {
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, item]) => item !== undefined)
		.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
	return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
};

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const sha256Bytes = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex");

/** 상태 1건의 canonical digest. 내용·슬러그·상태·폴더·참조까지 포함해 skip/충돌 판정이 흔들리지 않게 한다. */
const stateDigest = (
	entry: ExportSnapshotEntry,
	state: "working" | "published",
	references: readonly ExportSnapshotReference[],
): string =>
	sha256(
		canonicalJson({
			collection: entry.collection,
			id: entry.id,
			state,
			status: entry.status,
			folderId: entry.folderId,
			slug: state === "working" ? entry.workingSlug : entry.publishedSlug,
			metadata: state === "working" ? entry.working.metadata : entry.published?.metadata,
			mdx: state === "working" ? entry.working.mdx : entry.published?.mdx,
			references: references
				.filter((reference) => reference.entryId === entry.id && reference.state === state)
				.map((reference) => ({ kind: reference.kind, targetId: reference.targetId, isStale: reference.isStale }))
				.sort((left, right) =>
					`${left.kind}\u0000${left.targetId}` < `${right.kind}\u0000${right.targetId}` ? -1 : 1,
				),
		}),
	);

/** 항목 전체(작업본+공개본) digest. 한쪽만 바뀌어도 달라져야 한다. */
const entryDigest = (
	entry: ExportSnapshotEntry,
	scope: ExportScope,
	references: readonly ExportSnapshotReference[],
): string =>
	scope === "public"
		? sha256(canonicalJson({ published: stateDigest(entry, "published", references) }))
		: sha256(
				canonicalJson({
					working: stateDigest(entry, "working", references),
					published: entry.published ? stateDigest(entry, "published", references) : null,
				}),
			);

const bodyFile = (entry: ExportSnapshotEntry, state: "working" | "published"): { json: string; mdx: string } => {
	const body = state === "working" ? entry.working : entry.published;
	if (!body) throw new Error(`Entry ${entry.id} has no ${state} body`);
	return {
		json: `${canonicalJson({
			formatVersion: 1,
			collection: entry.collection,
			id: entry.id,
			state,
			status: entry.status,
			slug: state === "working" ? entry.workingSlug : entry.publishedSlug,
			metadata: body.metadata,
			schemaVersion: body.schemaVersion,
			contentHash: body.contentHash,
			// Only translated entries have this (v3); the source file shape is unchanged.
			...(body.translation ? { translation: body.translation } : {}),
			updatedAt: iso(body.updatedAt),
			createdAt: iso(entry.createdAt),
			updatedEntryAt: iso(entry.updatedAt),
			publishedAt: iso(entry.publishedAt),
			folderId: entry.folderId,
		})}\n`,
		mdx: body.mdx,
	};
};

/** 공개 아카이브에는 현재 공개 상태인 항목의 공개본만 넣는다. 초안·보관·휴지통은 공개본이 남아 있어도 제외한다. */
const publicEntry = (entry: ExportSnapshotEntry): PublicExportEntry | null => {
	if (entry.status !== "published") return null;
	if (!entry.published) return null;
	return publicExportEntrySchema.parse({
		id: entry.id,
		collection: entry.collection,
		slug: entry.publishedSlug,
		publishedAt: iso(entry.publishedAt),
		updatedAt: iso(entry.published.updatedAt) ?? iso(entry.updatedAt) ?? "",
		metadata: pickPublicMetadata(entry.collection, entry.published.metadata),
		mdx: entry.published.mdx,
		schemaVersion: entry.published.schemaVersion,
		contentHash: entry.published.contentHash,
	});
};

const sortEntries = (entries: readonly ExportSnapshotEntry[]): ExportSnapshotEntry[] =>
	[...entries].sort((left, right) =>
		left.collection === right.collection
			? left.id < right.id
				? -1
				: left.id > right.id
					? 1
					: 0
			: left.collection < right.collection
				? -1
				: 1,
	);

export interface BuildExportOptions {
	scope: ExportScope;
	exportedAt: Date;
	/** 아카이브 내부 파일 시각. 스냅샷 테스트를 위해 고정값을 쓸 수 있다. */
	archiveModifiedAt?: Date;
}

export function buildExportArchive(snapshot: ExportSnapshot, options: BuildExportOptions): ExportArchive {
	const { scope, exportedAt } = options;
	const entries = sortEntries(snapshot.entries);
	const files: ZipEntry[] = [];
	const manifestEntries: ExportManifestEntry[] = [];

	for (const entry of entries) {
		const base = `entries/${entry.collection}/${entry.id}`;
		const entryFiles: string[] = [];

		if (scope === "admin") {
			const working = bodyFile(entry, "working");
			files.push({ path: `${base}/working.json`, data: new TextEncoder().encode(working.json) });
			files.push({ path: `${base}/working.mdx`, data: new TextEncoder().encode(working.mdx) });
			entryFiles.push(`${base}/working.json`, `${base}/working.mdx`);

			if (entry.published) {
				const published = bodyFile(entry, "published");
				files.push({ path: `${base}/published.json`, data: new TextEncoder().encode(published.json) });
				files.push({ path: `${base}/published.mdx`, data: new TextEncoder().encode(published.mdx) });
				entryFiles.push(`${base}/published.json`, `${base}/published.mdx`);
			}

			const references = snapshot.references
				.filter((reference) => reference.entryId === entry.id)
				.map((reference) => ({
					state: reference.state,
					kind: reference.kind,
					targetId: reference.targetId,
					isStale: reference.isStale,
					occurrences: reference.occurrences,
				}));
			files.push({ path: `${base}/references.json`, data: new TextEncoder().encode(`${canonicalJson(references)}\n`) });
			entryFiles.push(`${base}/references.json`);

			manifestEntries.push({
				id: entry.id,
				collection: entry.collection,
				locale: entry.locale,
				translationGroupId: entry.translationGroupId,
				status: entry.status,
				version: entry.version,
				workingSlug: entry.workingSlug,
				publishedSlug: entry.publishedSlug,
				folderId: entry.folderId,
				createdAt: iso(entry.createdAt),
				updatedAt: iso(entry.updatedAt),
				publishedAt: iso(entry.publishedAt),
				hasWorking: true,
				hasPublished: entry.published !== undefined,
				workingDigest: stateDigest(entry, "working", snapshot.references),
				publishedDigest: entry.published ? stateDigest(entry, "published", snapshot.references) : null,
				itemDigest: entryDigest(entry, "admin", snapshot.references),
				files: entryFiles.sort(),
			});
			continue;
		}

		const projected = publicEntry(entry);
		if (!projected) continue;
		files.push({ path: `${base}/published.json`, data: new TextEncoder().encode(`${canonicalJson(projected)}\n`) });
		files.push({ path: `${base}/published.mdx`, data: new TextEncoder().encode(projected.mdx) });
		entryFiles.push(`${base}/published.json`, `${base}/published.mdx`);

		manifestEntries.push({
			id: entry.id,
			collection: entry.collection,
			locale: entry.locale,
			translationGroupId: entry.translationGroupId,
			status: "published",
			version: 0,
			workingSlug: null,
			publishedSlug: entry.publishedSlug,
			folderId: null,
			createdAt: null,
			updatedAt: iso(entry.published?.updatedAt),
			publishedAt: iso(entry.publishedAt),
			hasWorking: false,
			hasPublished: true,
			workingDigest: null,
			publishedDigest: stateDigest(entry, "published", snapshot.references),
			itemDigest: entryDigest(entry, "public", snapshot.references),
			files: entryFiles.sort(),
		});
	}

	const publishedIds = new Set(manifestEntries.map((entry) => entry.id));
	const media =
		scope === "admin"
			? [...snapshot.media]
					.sort((left, right) => (left.id < right.id ? -1 : 1))
					.map((asset) => ({
						id: asset.id,
						status: asset.status,
						filename: asset.filename,
						mimeType: asset.mimeType,
						byteSize: asset.byteSize,
						width: asset.width,
						height: asset.height,
						storageKey: asset.storageKey,
						stagingKey: asset.stagingKey,
						createdAt: iso(asset.createdAt),
						updatedAt: iso(asset.updatedAt),
						readyAt: iso(asset.readyAt),
					}))
			: [...snapshot.media]
					.filter((asset) =>
						snapshot.references.some(
							(reference) =>
								reference.kind === "media" &&
								reference.state === "published" &&
								reference.targetId === asset.id &&
								publishedIds.has(reference.entryId),
						),
					)
					.sort((left, right) => (left.id < right.id ? -1 : 1))
					.map((asset) => ({
						id: asset.id,
						filename: asset.filename,
						mimeType: asset.mimeType,
						byteSize: asset.byteSize,
						width: asset.width,
						height: asset.height,
					}));

	if (scope === "admin") {
		files.push({ path: "folders.json", data: jsonFile(snapshot.folders.map((folder) => ({ ...folder }))) });
		files.push({ path: "addresses.json", data: jsonFile(snapshot.addresses.map((address) => ({ ...address }))) });
		files.push({
			path: "templates.json",
			data: jsonFile(
				snapshot.templates.map((template) => ({
					id: template.id,
					name: template.name,
					mdx: template.mdx,
					version: template.version,
					createdAt: iso(template.createdAt),
					updatedAt: iso(template.updatedAt),
				})),
			),
		});
		files.push({
			path: "preferences.json",
			data: jsonFile(
				snapshot.preferences.map((preference) => ({
					userId: preference.userId,
					preferences: preference.preferences,
					updatedAt: iso(preference.updatedAt),
				})),
			),
		});
	}

	files.push({ path: "media.json", data: jsonFile(media) });
	files.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

	// digest는 아카이브에 실제로 들어가는 모든 페이로드 파일을 덮는다(manifest.json과 exportedAt은 제외).
	// 그래서 설정·미디어 목록·주소 같은 항목 외 데이터가 바뀌어도 digest가 달라진다.
	const digest = sha256(files.map((file) => `${file.path}\u0000${sha256Bytes(file.data)}`).join("\n"));

	const manifest: ExportManifest = {
		formatVersion: 1,
		scope,
		exportedAt: exportedAt.toISOString(),
		digest,
		counts: {
			entries: manifestEntries.length,
			workingBodies: manifestEntries.filter((entry) => entry.hasWorking).length,
			publishedBodies: manifestEntries.filter((entry) => entry.hasPublished).length,
			folders: scope === "admin" ? snapshot.folders.length : 0,
			media: media.length,
			templates: scope === "admin" ? snapshot.templates.length : 0,
			addresses: scope === "admin" ? snapshot.addresses.length : 0,
			preferences: scope === "admin" ? snapshot.preferences.length : 0,
			references: scope === "admin" ? snapshot.references.length : 0,
			files: files.length + 1,
		},
		entries: manifestEntries,
		files: ["manifest.json", ...files.map((file) => file.path)],
	};

	const allFiles: ZipEntry[] = [
		{ path: "manifest.json", data: new TextEncoder().encode(`${canonicalJson(manifest)}\n`) },
		...files,
	];
	allFiles.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));

	return {
		zip: createZipArchive(allFiles, options.archiveModifiedAt ? { modifiedAt: options.archiveModifiedAt } : undefined),
		manifest,
		digest,
	};
}

function jsonFile(value: unknown): Uint8Array {
	return new TextEncoder().encode(`${canonicalJson(value)}\n`);
}
