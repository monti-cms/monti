import { z } from "zod";
import { cmsConfig } from "../config/resolved";
import { COLLECTIONS } from "./collections";
import { LOCALES } from "./locales";
import {
	type AllowedFileMime,
	type AllowedImageMimeType,
	DEFAULT_MEDIA_LIMITS,
	SUPPORTED_FILE_MIME_TYPES,
	SUPPORTED_IMAGE_MIME_TYPES,
} from "./media-types";

export * from "./media-types";

/**
 * `/api/cms/v1` 요청 계약. 라우트와 관리자 UI가 같은 정의를 본다.
 */

export const collectionSchema = z.enum(COLLECTIONS);

export const ENTRY_STATUSES = ["draft", "published", "archived", "trashed"] as const;
export const entryStatusSchema = z.enum(ENTRY_STATUSES);

export const LIST_SORT_FIELDS = ["updatedAt", "createdAt", "publishedAt", "title", "slug"] as const;
export type ListSortField = (typeof LIST_SORT_FIELDS)[number];
export const listSortFieldSchema = z.enum(LIST_SORT_FIELDS);
export const sortDirectionSchema = z.enum(["asc", "desc"]);

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
const pageSizeSchema = z.coerce
	.number()
	.int()
	.refine((v): v is PageSize => (PAGE_SIZES as readonly number[]).includes(v), {
		message: "pageSize must be 25, 50, or 100",
	});

const booleanQuery = z
	.enum(["true", "false", "1", "0"])
	.optional()
	.transform((val) => (val === undefined ? undefined : val === "true" || val === "1"));
const dateQuery = z.iso
	.datetime({ offset: true })
	.optional()
	.transform((val) => (val ? new Date(val) : undefined));

/** 같은 키를 여러 번 쓸 수 있는 목록 질의 키. 라우트는 이 키만 `getAll`로 읽는다. */
export const LIST_ARRAY_QUERY_KEYS = ["status", "relation", "locale"] as const;

/** 필드·컬럼 이름. 메타데이터 키와 같은 모양만 받는다. */
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,59}$/;
export const fieldNameSchema = z.string().regex(FIELD_NAME);

/**
 * 관계 필터(`relation=필드:ID`, 여러 번). 필드별 ID 목록으로 모은다.
 * 같은 필드의 여러 값은 OR, 다른 필드끼리는 AND다(§3.2).
 */
const relationFiltersSchema = z
	.array(z.string().max(120))
	.optional()
	.transform((values, ctx) => {
		if (!values) return undefined;
		const filters: Record<string, string[]> = {};
		for (const value of values) {
			const [field = "", id = "", ...rest] = value.split(":");
			if (rest.length > 0 || !FIELD_NAME.test(field) || !z.uuid().safeParse(id).success) {
				ctx.addIssue({ code: "custom", message: `Invalid relation filter: ${value}` });
				return z.NEVER;
			}
			filters[field] = [...(filters[field] ?? []), id];
		}
		return filters;
	});

export const listEntriesQuerySchema = z.object({
	collection: collectionSchema,
	search: z.string().optional(),
	includeBody: booleanQuery,
	titleContains: z.string().optional(),
	slugContains: z.string().optional(),
	status: z.array(entryStatusSchema).optional(),
	/** 콘텐츠 언어(v2 B4). 여러 번 쓸 수 있고 없으면 모든 언어다. */
	locale: z.array(z.enum(LOCALES)).optional(),
	/** `translation`이면 번역 묶음마다 원문 한 줄로 보인다(v3 번역 화면). */
	group: z.enum(["translation"]).optional(),
	folderId: z
		.string()
		.optional()
		.transform((val) => (val === undefined ? undefined : val === "null" || val === "" ? null : val))
		.pipe(z.union([z.uuid(), z.null(), z.undefined()])),
	includeDescendants: booleanQuery,
	relation: relationFiltersSchema,
	hasChanges: booleanQuery,
	createdFrom: dateQuery,
	createdTo: dateQuery,
	updatedFrom: dateQuery,
	updatedTo: dateQuery,
	publishedFrom: dateQuery,
	publishedTo: dateQuery,
	sortField: listSortFieldSchema.optional(),
	sortDirection: sortDirectionSchema.optional(),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: pageSizeSchema.default(25),
});
export type ListEntriesQuery = z.infer<typeof listEntriesQuerySchema>;

const expectedVersionSchema = z.number().int().positive();

export const createEntryBodySchema = z.object({
	collection: collectionSchema,
	slug: z.string().nullable().optional().default(null),
	metadata: z.record(z.string(), z.unknown()).default({}),
	mdx: z.string().default(""),
	folderId: z.uuid().nullable().optional(),
});
export type CreateEntryBody = z.infer<typeof createEntryBodySchema>;

export const patchEntryBodySchema = z.object({
	expectedVersion: expectedVersionSchema,
	slug: z.string().nullable().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	mdx: z.string().optional(),
	folderId: z.uuid().nullable().optional(),
	/** 번역본의 번역 상태(v3). 모양은 서비스가 검증한다. 생략하면 저장된 값을 그대로 둔다. */
	translation: z.unknown().optional(),
});
export type PatchEntryBody = z.infer<typeof patchEntryBodySchema>;

/** 버전만 받는 상태 전환(보관·보관 해제·휴지통·복원). */
export const versionBodySchema = z.object({ expectedVersion: expectedVersionSchema });

/** 발행. `resetPublishedAt`이면 이미 발행한 글의 발행일을 지금으로 바꾼다. */
export const publishBodySchema = versionBodySchema.extend({ resetPublishedAt: z.boolean().optional() });

export const BULK_OPS = [
	"relation.add",
	"relation.remove",
	"relation.set",
	"folder.move",
	"archive",
	"unarchive",
	"trash",
	"publish",
	"permanentDelete",
] as const;
export type BulkOp = (typeof BULK_OPS)[number];

export const bulkBodySchema = z.object({
	op: z.enum(BULK_OPS),
	items: z.array(z.object({ id: z.uuid(), expectedVersion: expectedVersionSchema })).max(100),
	/** `relation.*`이 바꾸는 관계 필드. */
	field: fieldNameSchema.optional(),
	/** `relation.add`·`relation.remove`의 ID. */
	ids: z.array(z.uuid()).max(100).optional(),
	/** `relation.set`의 새 값. `null`이면 비운다. */
	id: z.uuid().nullable().optional(),
	folderId: z.uuid().nullable().optional(),
});
export type BulkBody = z.infer<typeof bulkBodySchema>;

/** 목록 컬럼 수의 상한. 컬럼 이름은 관리자 화면이 정한다(시스템 컬럼·필드 이름). */
const MAX_LIST_COLUMNS = 60;

export const adminColumnSettingsSchema = z
	.object({
		order: z.array(fieldNameSchema).max(MAX_LIST_COLUMNS).optional(),
		visibility: z.record(z.string(), z.boolean()).optional(),
		/** 사용자가 끌어서 바꾼 열 너비(px). 없는 컬럼은 기본 너비를 쓴다. */
		sizes: z.record(z.string(), z.number().int().min(48).max(960)).optional(),
	})
	.superRefine((settings, ctx) => {
		if (settings.order && new Set(settings.order).size !== settings.order.length) {
			ctx.addIssue({ code: "custom", message: "Column order cannot contain duplicates", path: ["order"] });
		}
		const keys = [...Object.keys(settings.visibility ?? {}), ...Object.keys(settings.sizes ?? {})];
		if (keys.length > MAX_LIST_COLUMNS * 2) {
			ctx.addIssue({ code: "custom", message: "Too many columns", path: ["visibility"] });
		}
		for (const key of keys) {
			if (!FIELD_NAME.test(key)) {
				ctx.addIssue({ code: "custom", message: `Unknown column: ${key}`, path: ["visibility", key] });
			}
		}
	});
export type AdminColumnSettings = z.infer<typeof adminColumnSettingsSchema>;

/** 컬렉션별 목록 설정(§3.2 "컬럼 설정·페이지 크기는 컬렉션별 사용자 설정에 저장"). */
export const collectionPreferencesSchema = z.object({
	columns: adminColumnSettingsSchema.optional(),
	pageSize: pageSizeSchema.optional(),
	sort: z.object({ field: listSortFieldSchema, direction: sortDirectionSchema }).optional(),
});
export type CollectionPreferences = z.infer<typeof collectionPreferencesSchema>;

export const preferencesBodySchema = z.object({
	collections: z.partialRecord(collectionSchema, collectionPreferencesSchema).optional(),
	/** 편집 화면의 패널 접힘 상태. */
	editor: z.object({ inspectorOpen: z.boolean().optional() }).optional(),
});
export type PreferencesBody = z.infer<typeof preferencesBodySchema>;

export const exportScopeSchema = z.object({
	scope: z.enum(["admin", "public"]).default("admin"),
});
export type ExportScopeInput = z.infer<typeof exportScopeSchema>;

export const createTemplateBodySchema = z.object({
	name: z.string().trim().min(1).max(100),
	mdx: z.string().default(""),
});
export type CreateTemplateBody = z.infer<typeof createTemplateBodySchema>;

export const patchTemplateBodySchema = z.object({
	expectedVersion: expectedVersionSchema,
	name: z.string().trim().min(1).max(100).optional(),
	mdx: z.string().optional(),
});
export type PatchTemplateBody = z.infer<typeof patchTemplateBodySchema>;

const folderNameSchema = z.string().trim().min(1).max(100);

export const createFolderBodySchema = z.object({
	collection: collectionSchema,
	name: folderNameSchema,
	parentId: z.uuid().nullable().optional().default(null),
	position: z.number().int().min(0).optional().default(0),
});

export const updateFolderBodySchema = z.object({
	expectedVersion: expectedVersionSchema,
	name: folderNameSchema.optional(),
	parentId: z.uuid().nullable().optional(),
	position: z.number().int().min(0).optional(),
});

const MEDIA = cmsConfig.media;

/** 올릴 수 있는 이미지 형식(사이트 설정 `media.imageTypes`, 기본 지원 형식 전부). */
export const ALLOWED_IMAGE_MIME_TYPES: readonly AllowedImageMimeType[] =
	MEDIA?.imageTypes ?? SUPPORTED_IMAGE_MIME_TYPES;
export const MAX_MEDIA_BYTES = MEDIA?.maxImageBytes ?? DEFAULT_MEDIA_LIMITS.maxImageBytes;
export const MAX_MEDIA_PIXELS = MEDIA?.maxPixels ?? DEFAULT_MEDIA_LIMITS.maxPixels;

/** 올릴 수 있는 첨부 파일 형식(사이트 설정 `media.fileTypes`, 기본 지원 형식 전부). 본문에는 `::file` 카드로 들어간다. */
export const ALLOWED_FILE_MIME_TYPES: readonly AllowedFileMime[] = MEDIA?.fileTypes ?? SUPPORTED_FILE_MIME_TYPES;
export type { AllowedFileMime } from "./media-types";
export const MAX_FILE_BYTES = MEDIA?.maxFileBytes ?? DEFAULT_MEDIA_LIMITS.maxFileBytes;

const CODE_EXTENSIONS = [
	"js",
	"mjs",
	"cjs",
	"jsx",
	"ts",
	"tsx",
	"py",
	"java",
	"kt",
	"c",
	"h",
	"cpp",
	"hpp",
	"cs",
	"go",
	"rs",
	"rb",
	"php",
	"swift",
	"dart",
	"scala",
	"css",
	"scss",
	"sass",
	"less",
	"vue",
	"svelte",
	"sql",
	"yml",
	"yaml",
	"toml",
	"ini",
	"env",
	"log",
	"diff",
	"patch",
	"gradle",
	"dockerfile",
] as const;

/** 확장자 → 저장 형식. 소스 코드는 글자 파일로 저장한다(브라우저가 코드 파일 MIME을 제각각 준다). */
const FILE_TYPE_BY_EXTENSION: Readonly<Record<string, AllowedFileMime>> = {
	pdf: "application/pdf",
	zip: "application/zip",
	txt: "text/plain",
	md: "text/markdown",
	markdown: "text/markdown",
	csv: "text/csv",
	json: "application/json",
	...Object.fromEntries(CODE_EXTENSIONS.map((extension) => [extension, "text/plain" as const])),
};

/** 파일 이름으로 정한 첨부 파일 형식. 받지 않는 형식(설정 `media.fileTypes` 밖 포함)이면 `null`. */
export function fileTypeFor(filename: string): AllowedFileMime | null {
	const extension = filename.toLowerCase().split(".").pop() ?? "";
	const type = filename.includes(".") ? (FILE_TYPE_BY_EXTENSION[extension] ?? null) : null;
	return type && ALLOWED_FILE_MIME_TYPES.includes(type) ? type : null;
}

/** 파일 선택 창의 `accept`. */
export const FILE_ACCEPT = Object.keys(FILE_TYPE_BY_EXTENSION)
	.filter((extension) => ALLOWED_FILE_MIME_TYPES.includes(FILE_TYPE_BY_EXTENSION[extension] as AllowedFileMime))
	.map((extension) => `.${extension}`)
	.join(",");

export const isImageMime = (mimeType: string | null | undefined): boolean =>
	typeof mimeType === "string" && (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);

const uploadFileSchema = z.object({
	mimeType: z
		.enum(SUPPORTED_IMAGE_MIME_TYPES)
		.refine((type) => ALLOWED_IMAGE_MIME_TYPES.includes(type), "Image type is not allowed"),
	byteSize: z.number().int().positive(),
});

/**
 * 업로드 준비(§7.2). 웹용 최적화를 고르면 브라우저가 만든 공개용 파일(`mimeType`·`byteSize`)과
 * 원본 파일(`original`)을 같은 미디어 레코드로 함께 올린다.
 */
export const mediaUploadBodySchema = z.union([
	uploadFileSchema.extend({
		filename: z.string().trim().min(1).max(255),
		original: uploadFileSchema.optional(),
	}),
	// 첨부 파일. 형식은 파일 이름의 확장자와 맞아야 한다(라우트가 확인한다).
	z.object({
		mimeType: z
			.enum(SUPPORTED_FILE_MIME_TYPES)
			.refine((type) => ALLOWED_FILE_MIME_TYPES.includes(type), "File type is not allowed"),
		byteSize: z.number().int().positive(),
		filename: z.string().trim().min(1).max(255),
	}),
]);
export type MediaUploadBody = z.infer<typeof mediaUploadBodySchema>;

export const mediaPatchBodySchema = z.object({
	/** 보이는 이름·내려받을 때 이름. 저장 주소에는 들어가지 않는다. */
	filename: z.string().trim().min(1).max(255).optional(),
	defaultAlt: z.string().max(1000).optional(),
	defaultCaption: z.string().max(1000).optional(),
});

export const mediaListQuerySchema = z.object({
	search: z.string().optional(),
	mimeType: z.string().optional(),
	kind: z.enum(["all", "image", "file"]).default("all"),
	used: z.enum(["all", "used", "unused"]).default("all"),
	uploadedFrom: dateQuery,
	uploadedTo: dateQuery,
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
