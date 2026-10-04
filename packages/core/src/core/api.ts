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
 * Request contract of `/api/cms/v1`. The routes and the admin UI see the same definitions.
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

/** List query keys that may appear multiple times. The route reads only these keys with `getAll`. */
export const LIST_ARRAY_QUERY_KEYS = ["status", "relation", "locale"] as const;

/** Field/column names. Accepts only the same shape as metadata keys. */
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,59}$/;
export const fieldNameSchema = z.string().regex(FIELD_NAME);

/**
 * Relation filter (`relation=field:ID`, repeatable). Collected into per-field ID lists.
 * Multiple values of the same field are OR, different fields are AND.
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
	/** Content locales. Can be repeated; if absent, all locales. */
	locale: z.array(z.enum(LOCALES)).optional(),
	/** With `translation`, each translation group appears as one row of its source. */
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
	/** Translation state of a translation. The service validates the shape. If omitted, the stored value is kept. */
	translation: z.unknown().optional(),
});
export type PatchEntryBody = z.infer<typeof patchEntryBodySchema>;

/** State transitions that take only a version (archive, unarchive, trash, restore). */
export const versionBodySchema = z.object({ expectedVersion: expectedVersionSchema });

/** Publish. With `resetPublishedAt`, an already published post's publish date is reset to now. */
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
	/** The relation field changed by `relation.*`. */
	field: fieldNameSchema.optional(),
	/** IDs for `relation.add` and `relation.remove`. */
	ids: z.array(z.uuid()).max(100).optional(),
	/** New value for `relation.set`. `null` clears it. */
	id: z.uuid().nullable().optional(),
	folderId: z.uuid().nullable().optional(),
});
export type BulkBody = z.infer<typeof bulkBodySchema>;

/** Upper limit on the number of list columns. Column names are decided by the admin screen (system columns and field names). */
const MAX_LIST_COLUMNS = 60;

export const adminColumnSettingsSchema = z
	.object({
		order: z.array(fieldNameSchema).max(MAX_LIST_COLUMNS).optional(),
		visibility: z.record(z.string(), z.boolean()).optional(),
		/** Column width (px) the user dragged to. Columns without one use the default width. */
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

/** Per-collection list settings. */
export const collectionPreferencesSchema = z.object({
	columns: adminColumnSettingsSchema.optional(),
	pageSize: pageSizeSchema.optional(),
	sort: z.object({ field: listSortFieldSchema, direction: sortDirectionSchema }).optional(),
});
export type CollectionPreferences = z.infer<typeof collectionPreferencesSchema>;

export const preferencesBodySchema = z.object({
	collections: z.partialRecord(collectionSchema, collectionPreferencesSchema).optional(),
	/** Collapsed state of the edit screen's panels. */
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

/** Uploadable image formats (site config `media.imageTypes`, default all supported formats). */
export const ALLOWED_IMAGE_MIME_TYPES: readonly AllowedImageMimeType[] =
	MEDIA?.imageTypes ?? SUPPORTED_IMAGE_MIME_TYPES;
export const MAX_MEDIA_BYTES = MEDIA?.maxImageBytes ?? DEFAULT_MEDIA_LIMITS.maxImageBytes;
export const MAX_MEDIA_PIXELS = MEDIA?.maxPixels ?? DEFAULT_MEDIA_LIMITS.maxPixels;

/** Uploadable attached file formats (site config `media.fileTypes`, default all supported formats). They enter the body as `::file` cards. */
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

/** Extension → storage format. Source code is stored as a text file (browsers report code file MIME types inconsistently). */
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

/** Attached file format decided by the file name. `null` for an unaccepted format (including those outside the config `media.fileTypes`). */
export function fileTypeFor(filename: string): AllowedFileMime | null {
	const extension = filename.toLowerCase().split(".").pop() ?? "";
	const type = filename.includes(".") ? (FILE_TYPE_BY_EXTENSION[extension] ?? null) : null;
	return type && ALLOWED_FILE_MIME_TYPES.includes(type) ? type : null;
}

/** `accept` of the file picker. */
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
 * Upload preparation. If web optimization is chosen, the browser-made public file (`mimeType`, `byteSize`) and
 * the original file (`original`) are uploaded together as the same media record.
 */
export const mediaUploadBodySchema = z.union([
	uploadFileSchema.extend({
		filename: z.string().trim().min(1).max(255),
		original: uploadFileSchema.optional(),
	}),
	// Attached file. The format must match the file name's extension (the route checks).
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
	/** Display name and download name. Not included in the storage address. */
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
