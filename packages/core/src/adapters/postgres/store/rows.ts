import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import type { TranslationState } from "../../../core/translation/state";
import { normalizeReferenceKind, type Reference, type ReferenceOccurrence } from "../../../core/types";
import type { Queryable } from "./context";
import { CmsError } from "./errors";
import type {
	BodyTemplate,
	Entry,
	EntryBody,
	EntryMetadata,
	Folder,
	JsonObject,
	JsonValue,
	MediaAssetRecord,
	PublishedEntryRecord,
} from "./types";

/** 행 ↔ 도메인 객체 변환과 여러 모듈이 같이 쓰는 SQL 조각. */

function normalizeJsonValue(val: unknown): JsonValue {
	if (val === null) return null;
	if (typeof val === "string" || typeof val === "boolean") return val;
	if (typeof val === "number") {
		if (!Number.isFinite(val)) throw new CmsError("Non-finite number", "invalid_input");
		return val;
	}
	if (Array.isArray(val)) return val.map((v) => normalizeJsonValue(v));
	if (typeof val === "object") {
		if (Object.getPrototypeOf(val) !== Object.prototype && Object.getPrototypeOf(val) !== null) {
			throw new CmsError("Invalid object type", "invalid_input");
		}
		const obj: JsonObject = {};
		for (const key of Object.keys(val).sort()) {
			Object.defineProperty(obj, key, {
				value: normalizeJsonValue((val as Record<string, unknown>)[key]),
				enumerable: true,
				writable: true,
				configurable: true,
			});
		}
		return obj;
	}
	throw new CmsError(`Invalid JSON type: ${typeof val}`, "invalid_input");
}

export function normalizeMetadata(input: unknown): EntryMetadata {
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		throw new CmsError("Metadata must be a JSON object", "invalid_input");
	}
	if (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) {
		throw new CmsError("Metadata must be a plain object", "invalid_input");
	}
	return normalizeJsonValue(input) as EntryMetadata;
}

/** 본문 검색용 일반 텍스트. 주석·import/export·태그를 걷어내고 링크는 라벨만 남긴다. */
export function extractVisibleText(mdx: string): string {
	if (!mdx) return "";
	let t = mdx;
	t = t.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
	t = t.replace(/<!--[\s\S]*?-->/g, " ");
	t = t.replace(/^\s*(?:export|import)\b[\s\S]*?;(?:\r?\n|$)/gm, " ");
	t = t.replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1");
	t = t.replace(/<[a-zA-Z0-9_/][^>"\x27]*(?:"[^"]*"|\x27[^\x27]*\x27|[^>"\x27]*)*>/g, " ");
	return t;
}

export interface BodyRow {
	content_hash: string;
	mdx: string;
	schema_version: number;
	metadata: EntryMetadata;
	updated_at: Date;
	translation: TranslationState | null;
}

export interface ReferenceRow {
	/** 예전 행은 `category`·`tag`일 수 있다. */
	kind: string;
	target_id: string;
	is_stale: boolean;
	occurrences: readonly ReferenceOccurrence[];
}

export interface AddressRow {
	collection: string;
	slug: string;
	type: "current" | "alias" | "reservation" | "deleted";
	entry_id: string | null;
}

export interface FolderRow {
	id: string;
	collection: string;
	parent_id: string | null;
	name: string;
	position: number;
	version: number;
}

export const mapFolderRow = (row: FolderRow): Folder => ({
	id: row.id,
	collection: row.collection,
	parentId: row.parent_id,
	name: row.name,
	position: row.position,
	version: row.version ?? 1,
});

export const mapReferenceRow = (row: ReferenceRow): Reference => ({
	kind: normalizeReferenceKind(row.kind),
	targetId: row.target_id,
	isStale: row.is_stale,
	occurrences: row.occurrences,
});

export function mapPublishedEntryRow(row: {
	id: string;
	collection: string;
	locale: string;
	translation_group_id: string;
	slug: string;
	metadata: EntryMetadata;
	mdx: string;
	published_at: Date | null;
	body_updated_at: Date;
}): PublishedEntryRecord {
	return {
		id: row.id,
		collection: row.collection,
		locale: row.locale,
		translationGroupId: row.translation_group_id,
		slug: row.slug,
		metadata: row.metadata,
		mdx: row.mdx,
		publishedAt: row.published_at,
		updatedAt: row.body_updated_at,
	};
}

export const MEDIA_COLUMNS = `id, status, filename, mime_type, byte_size, width, height, staging_key, storage_key,
	original_storage_key, original_staging_key, original_mime_type, original_byte_size, original_width, original_height,
	default_alt, default_caption, created_at, updated_at, ready_at`;

export interface MediaRow {
	id: string;
	status: MediaAssetRecord["status"];
	filename: string;
	mime_type: string | null;
	byte_size: string | number | null;
	width: number | null;
	height: number | null;
	staging_key: string | null;
	storage_key: string | null;
	original_storage_key: string | null;
	original_staging_key: string | null;
	original_mime_type: string | null;
	original_byte_size: string | number | null;
	original_width: number | null;
	original_height: number | null;
	default_alt: string | null;
	default_caption: string | null;
	created_at: Date;
	updated_at: Date;
	ready_at: Date | null;
}

const toNumberOrNull = (value: string | number | null) => (value === null ? null : Number(value));

export const mapMediaRow = (row: MediaRow): MediaAssetRecord => ({
	id: row.id,
	status: row.status,
	filename: row.filename,
	mimeType: row.mime_type,
	byteSize: toNumberOrNull(row.byte_size),
	width: row.width,
	height: row.height,
	stagingKey: row.staging_key,
	storageKey: row.storage_key,
	original:
		row.original_staging_key || row.original_storage_key
			? {
					storageKey: row.original_storage_key,
					stagingKey: row.original_staging_key,
					mimeType: row.original_mime_type,
					byteSize: toNumberOrNull(row.original_byte_size),
					width: row.original_width,
					height: row.original_height,
				}
			: null,
	defaultAlt: row.default_alt ?? "",
	defaultCaption: row.default_caption ?? "",
	createdAt: row.created_at,
	updatedAt: row.updated_at,
	readyAt: row.ready_at,
});

export const TEMPLATE_COLUMNS = "id, name, mdx, version, created_at, updated_at";

export interface TemplateRow {
	id: string;
	name: string;
	mdx: string;
	version: number;
	created_at: Date;
	updated_at: Date;
}

export const mapTemplateRow = (row: TemplateRow): BodyTemplate => ({
	id: row.id,
	name: row.name,
	mdx: row.mdx,
	version: row.version,
	createdAt: row.created_at,
	updatedAt: row.updated_at,
});

export function isReferencesEqual(a: readonly Reference[], b: readonly Reference[]): boolean {
	if (a.length !== b.length) return false;
	const key = (r: Reference) => `${r.kind}:${r.targetId.toLowerCase()}`;
	const mapA = new Map(a.map((r) => [key(r), r]));
	const mapB = new Map(b.map((r) => [key(r), r]));
	if (mapA.size !== mapB.size) return false;
	for (const [k, refA] of mapA.entries()) {
		const refB = mapB.get(k);
		if (!refB) return false;
		if (refA.isStale !== refB.isStale) return false;
		if (!isDeepStrictEqual(refA.occurrences, refB.occurrences)) return false;
	}
	return true;
}

/** 참조 인덱스 행을 넣는다. 종류에 따라 FK 대상 컬럼을 고른다(CHECK 제약과 같은 규칙). */
export async function insertReferences(
	client: PoolClient,
	qSchema: string,
	entryId: string,
	state: "working" | "published",
	references: readonly Reference[],
): Promise<void> {
	for (const ref of references) {
		const targetEntryId = ref.kind === "media" ? null : ref.targetId;
		const targetMediaId = ref.kind === "media" ? ref.targetId : null;
		await client.query(
			`INSERT INTO "${qSchema}".entry_references
			 (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			[
				entryId,
				state,
				ref.kind,
				ref.targetId,
				targetEntryId,
				targetMediaId,
				ref.isStale,
				JSON.stringify(ref.occurrences),
			],
		);
	}
}

export async function readReferences(
	client: Queryable,
	qSchema: string,
	entryId: string,
	state: "working" | "published",
): Promise<Reference[]> {
	const res = await client.query<ReferenceRow>(
		`SELECT kind, target_id, is_stale, occurrences FROM "${qSchema}".entry_references
		 WHERE entry_id = $1 AND state = $2 ORDER BY kind ASC, target_id ASC`,
		[entryId, state],
	);
	return res.rows.map(mapReferenceRow);
}

export async function readBody(
	client: Queryable,
	qSchema: string,
	entryId: string,
	state: "working" | "published",
): Promise<BodyRow | undefined> {
	const res = await client.query<BodyRow>(
		`SELECT metadata, mdx, schema_version, content_hash, updated_at, translation FROM "${qSchema}".entry_bodies
		 WHERE entry_id = $1 AND state = $2`,
		[entryId, state],
	);
	return res.rows[0];
}

/** working/published 본문을 쓴다. 검색용 일반 텍스트도 같이 갱신한다. */
export async function writeBody(
	client: PoolClient,
	qSchema: string,
	entryId: string,
	state: "working" | "published",
	body: {
		metadata: EntryMetadata;
		mdx: string;
		schemaVersion: number;
		contentHash: string;
		updatedAt: Date;
		/** 번역본의 번역 상태(v3). 원문은 `null`. */
		translation: TranslationState | null;
	},
): Promise<void> {
	await client.query(
		`INSERT INTO "${qSchema}".entry_bodies (entry_id, state, metadata, mdx, schema_version, content_hash, updated_at, search_text, translation)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (entry_id, state) DO UPDATE SET
		   metadata = EXCLUDED.metadata, mdx = EXCLUDED.mdx, schema_version = EXCLUDED.schema_version,
		   content_hash = EXCLUDED.content_hash, updated_at = EXCLUDED.updated_at, search_text = EXCLUDED.search_text,
		   translation = EXCLUDED.translation`,
		[
			entryId,
			state,
			JSON.stringify(body.metadata),
			body.mdx,
			body.schemaVersion,
			body.contentHash,
			body.updatedAt,
			extractVisibleText(body.mdx),
			body.translation === null ? null : JSON.stringify(body.translation),
		],
	);
}

interface EntryRow {
	id: string;
	collection: string;
	locale: string;
	translation_group_id: string;
	status: Entry["status"];
	version: number;
	folder_id: string | null;
	created_at: Date;
	entry_updated_at: Date;
	published_at: Date | null;
	trashed_at: Date | null;
	working_slug: string | null;
	current_slug: string | null;
	state: "working" | "published" | null;
	metadata: EntryMetadata | null;
	mdx: string | null;
	schema_version: number | null;
	content_hash: string | null;
	body_updated_at: Date | null;
	translation: TranslationState | null;
}

export async function loadEntry(client: Queryable, id: string, qSchema: string): Promise<Entry> {
	const res = await client.query<EntryRow>(
		`SELECT
			e.id, e.collection, e.locale, COALESCE(e.translation_group_id, e.id) AS translation_group_id,
			e.status, e.version, e.folder_id, e.created_at, e.updated_at as entry_updated_at,
			e.published_at, e.trashed_at, e.working_slug,
			(SELECT slug FROM "${qSchema}".content_addresses WHERE entry_id = e.id AND type = 'current') as current_slug,
			b.state, b.metadata, b.mdx, b.schema_version, b.content_hash, b.updated_at as body_updated_at, b.translation
		 FROM "${qSchema}".entries e
		 LEFT JOIN "${qSchema}".entry_bodies b ON e.id = b.entry_id
		 WHERE e.id = $1`,
		[id],
	);
	const first = res.rows[0];
	if (!first) throw new CmsError("Entry not found", "not_found");

	let working: EntryBody | undefined;
	let published: EntryBody | undefined;
	for (const row of res.rows) {
		if (row.state === null || row.metadata === null || row.mdx === null) continue;
		if (row.schema_version === null || row.content_hash === null || row.body_updated_at === null) continue;
		const body: EntryBody = {
			metadata: row.metadata,
			mdx: row.mdx,
			schemaVersion: row.schema_version,
			contentHash: row.content_hash,
			updatedAt: row.body_updated_at,
			translation: row.translation ?? null,
		};
		if (row.state === "working") working = body;
		else published = body;
	}
	if (!working) throw new CmsError("Entry missing working state", "invalid_state");

	return {
		id: first.id,
		collection: first.collection,
		locale: first.locale,
		translationGroupId: first.translation_group_id,
		status: first.status || "draft",
		version: first.version,
		folderId: first.folder_id,
		createdAt: first.created_at,
		updatedAt: first.entry_updated_at,
		publishedAt: first.published_at ?? undefined,
		trashedAt: first.trashed_at ?? undefined,
		workingSlug: first.working_slug,
		publishedSlug: first.current_slug ?? null,
		working,
		published,
	};
}

export interface LockedEntryRow {
	version: number;
	collection: string;
	locale: string;
	/** 번역 묶음 ID. 원문이면 자기 ID다. */
	translation_group_id: string;
	status: Entry["status"];
	updated_at: Date;
	working_slug: string | null;
}

/** 버전 검사와 함께 항목 행을 잠근다. 없으면 404, 버전이 다르면 409다. */
export async function lockEntryForUpdate(
	client: PoolClient,
	qSchema: string,
	id: string,
	expectedVersion?: number,
): Promise<LockedEntryRow> {
	const res = await client.query<LockedEntryRow>(
		`SELECT version, collection, locale, COALESCE(translation_group_id, id) AS translation_group_id,
		        status, updated_at, working_slug
		 FROM "${qSchema}".entries WHERE id = $1 FOR UPDATE`,
		[id],
	);
	const row = res.rows[0];
	if (!row) throw new CmsError("Entry not found", "not_found");
	if (expectedVersion !== undefined && row.version !== expectedVersion) {
		throw new CmsError("Conflict", "conflict", row.version);
	}
	return row;
}
