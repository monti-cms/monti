import { z } from "zod";
import {
	type AllowedFileMime,
	type AllowedImageMimeType,
	DEFAULT_MEDIA_LIMITS,
	fileTypeByExtension,
	isImageType,
	MEDIA_TYPES,
	type MediaConfig,
	SUPPORTED_FILE_MIME_TYPES,
	SUPPORTED_IMAGE_MIME_TYPES,
} from "./media-types";
import { type FieldCondition, MAX_ENTRY_SEARCH_LIMIT } from "./store/types";

export * from "./media-types";

/**
 * Request contract of `/api/monti/v1`. The routes and the admin UI see the same definitions.
 */

/**
 * What the list's `status` filter can name: the four states of the status column, and the trash. `published` has no unpublished changes; `editing` is
 * published with changes not yet published. Several are OR.
 */
export const LIST_STATUSES = ["draft", "published", "editing", "archived", "trashed"] as const;
export type ListStatus = (typeof LIST_STATUSES)[number];
export const listStatusSchema = z.enum(LIST_STATUSES);

/** What a list can be sorted by. `trashedAt` is the day an entry was moved to the trash: the trash is sorted by it. */
export const LIST_SORT_FIELDS = ["updatedAt", "createdAt", "publishedAt", "trashedAt", "title", "slug"] as const;
export type ListSortField = (typeof LIST_SORT_FIELDS)[number];
export const listSortFieldSchema = z.enum(LIST_SORT_FIELDS);
export const sortDirectionSchema = z.enum(["asc", "desc"]);

/** Where a translation group stands, for the translation filter of the list (`translation=none|changed|current`). */
export const TRANSLATION_FILTERS = ["none", "changed", "current"] as const;

export const PAGE_SIZES = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
const pageSizeSchema = z.coerce
	.number()
	.int()
	.refine((v): v is PageSize => (PAGE_SIZES as readonly number[]).includes(v), {
		message: "pageSize must be 25, 50, or 100",
	});

/** A flag: a query string sends `true`, `false`, `1` or `0`, and a JSON caller (the agent) sends a boolean. */
const booleanQuery = z
	.union([z.boolean(), z.enum(["true", "false", "1", "0"])])
	.optional()
	.transform((val) => (val === undefined ? undefined : val === true || val === "true" || val === "1"));
const dateQuery = z.iso
	.datetime({ offset: true })
	.optional()
	.transform((val) => (val ? new Date(val) : undefined));

/** List query keys that may appear multiple times. The route reads only these keys with `getAll`. */
export const LIST_ARRAY_QUERY_KEYS = ["status", "field", "locale", "translation"] as const;

/** Search query keys that may appear multiple times (`id`: entries to look up by id). */
export const SEARCH_ARRAY_QUERY_KEYS = ["id"] as const;

/** Field/column names. Accepts only the same shape as metadata keys. */
const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,59}$/;
export const fieldNameSchema = z.string().regex(FIELD_NAME);

/**
 * Field conditions (`field=<name>:empty`, `<name>:filled`, `<name>:is:<value>`, repeatable). Collected into conditions per field name. Several
 * conditions on one field are OR, different fields are AND. The value of `is` is everything after the second colon, so it may hold colons itself and
 * may be a word like `empty`. Whether the field exists and takes the condition is checked against the schema, where the list is read.
 */
const fieldConditionsSchema = z
	.array(z.string().max(300))
	.optional()
	.transform((values, ctx) => {
		if (!values) return undefined;
		const conditions: Record<string, FieldCondition[]> = {};
		for (const value of values) {
			const [name = "", kind = "", ...rest] = value.split(":");
			const argument = rest.join(":");
			const condition: FieldCondition | null =
				(kind === "empty" || kind === "filled") && rest.length === 0
					? { kind }
					: kind === "is" && argument !== ""
						? { kind, value: argument }
						: null;
			if (!FIELD_NAME.test(name) || !condition) {
				ctx.addIssue({ code: "custom", message: `Invalid field condition: ${value}` });
				return z.NEVER;
			}
			conditions[name] = [...(conditions[name] ?? []), condition];
		}
		return conditions;
	});

const expectedVersionSchema = z.number().int().positive();

/** The name of a format (the `format` option). Whether one is installed is decided when it is used. */
export const formatNameSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);

/**
 * A body is given as a stored document (`doc`, validated by the service) or as text (`body`) with the `format` that reads it; never both, and a text
 * always names its format.
 */
const bodyIsDocOrText = (body: { body?: string; format?: string; doc?: unknown }) =>
	body.doc === undefined
		? (body.body === undefined) === (body.format === undefined)
		: body.body === undefined && body.format === undefined;
const BODY_IS_DOC_OR_TEXT = { message: "Send either doc, or body together with its format", path: ["doc"] };

/** With neither `doc` nor `body`, the body of the current draft is kept. */
export const patchEntryBodySchema = z
	.object({
		expectedVersion: expectedVersionSchema,
		slug: z.string().nullable().optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
		doc: z.unknown().optional(),
		body: z.string().optional(),
		format: formatNameSchema.optional(),
		folderId: z.uuid().nullable().optional(),
		/** Translation state of a translation. The service validates the shape. If omitted, the stored value is kept. */
		translation: z.unknown().optional(),
	})
	.refine(bodyIsDocOrText, BODY_IS_DOC_OR_TEXT);

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

/** Upper limit on the number of list columns. Column names are decided by the admin screen (system columns and field names). */
const MAX_LIST_COLUMNS = 60;

export const adminColumnSettingsSchema = z
	.object({
		order: z.array(fieldNameSchema).max(MAX_LIST_COLUMNS).optional(),
		visibility: z.record(z.string(), z.boolean()).optional(),
	})
	.superRefine((settings, ctx) => {
		if (settings.order && new Set(settings.order).size !== settings.order.length) {
			ctx.addIssue({ code: "custom", message: "Column order cannot contain duplicates", path: ["order"] });
		}
		const keys = Object.keys(settings.visibility ?? {});
		if (keys.length > MAX_LIST_COLUMNS) {
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

/** The most entries one export can be limited to by id. */
export const MAX_EXPORT_IDS = 1000;

export const exportOptionsSchema = z.object({
	scope: z.enum(["admin", "public"]).default("admin"),
	/** Also write every body as a text file in this format (`working.<ext>`, `published.<ext>`). Without it the archive holds the documents only. */
	format: formatNameSchema.optional(),
	/**
	 * Limits the export to these entries (a comma list in the query, an array in a `POST` body). The export always holds their whole translation groups.
	 * Without it the export is the whole site.
	 */
	ids: z
		.preprocess(
			(value) => (typeof value === "string" ? value.split(",") : value),
			z.array(z.string().uuid()).min(1).max(MAX_EXPORT_IDS),
		)
		.optional(),
});

/** A template body is a document (`doc`) or a text with its format, as an entry body is. With neither, the template is empty. */
export const createTemplateBodySchema = z
	.object({
		name: z.string().trim().min(1).max(100),
		doc: z.unknown().optional(),
		body: z.string().optional(),
		format: formatNameSchema.optional(),
	})
	.refine(bodyIsDocOrText, BODY_IS_DOC_OR_TEXT);

export const patchTemplateBodySchema = z
	.object({
		expectedVersion: expectedVersionSchema,
		name: z.string().trim().min(1).max(100).optional(),
		doc: z.unknown().optional(),
		body: z.string().optional(),
		format: formatNameSchema.optional(),
	})
	.refine(bodyIsDocOrText, BODY_IS_DOC_OR_TEXT);

const folderNameSchema = z.string().trim().min(1).max(100);

export const updateFolderBodySchema = z.object({
	expectedVersion: expectedVersionSchema,
	name: folderNameSchema.optional(),
	parentId: z.uuid().nullable().optional(),
	position: z.number().int().min(0).optional(),
});

export const mediaPatchBodySchema = z.object({
	/** Display name and download name. Not included in the storage address. */
	filename: z.string().trim().min(1).max(255).optional(),
	defaultAlt: z.string().max(1000).optional(),
	defaultCaption: z.string().max(1000).optional(),
	folderId: z.uuid().nullable().optional(),
});

export const mediaListQuerySchema = z.object({
	search: z.string().optional(),
	mimeType: z.string().optional(),
	kind: z.enum(["all", "image", "file"]).default("all"),
	used: z.enum(["all", "used", "unused"]).default("all"),
	folderId: z
		.union([z.string(), z.null()])
		.optional()
		.transform((val) => (val === undefined ? undefined : val === "null" || val === "" ? null : val))
		.pipe(z.union([z.uuid(), z.null(), z.undefined()])),
	includeDescendants: booleanQuery,
	uploadedFrom: dateQuery,
	uploadedTo: dateQuery,
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** The request contract that depends on one site's config: its collections and locales, and its upload limits (`media`). */
export type SiteApi = ReturnType<typeof createApi>;

/** The values of a site config the request contract is built from. */
export interface ApiParts {
	/** Collection names (`site.COLLECTIONS`). */
	readonly COLLECTIONS: readonly string[];
	/** Content locale codes (`site.LOCALES`). */
	readonly LOCALES: readonly string[];
	/** The site config's `media`. */
	readonly media?: MediaConfig;
}

const oneOf = (values: readonly string[]) => z.enum(values as [string, ...string[]]);

/** Request schemas and upload rules of one site. A `Site` carries them (`site.api`). */
export function createApi({ COLLECTIONS, LOCALES, media: MEDIA }: ApiParts) {
	const collectionSchema = oneOf(COLLECTIONS);
	const folderCollectionSchema = z.union([collectionSchema, z.literal("media")]);

	/** Uploadable image formats (site config `media.imageTypes`, default all supported formats). */
	const ALLOWED_IMAGE_MIME_TYPES: readonly AllowedImageMimeType[] = MEDIA?.imageTypes ?? SUPPORTED_IMAGE_MIME_TYPES;
	const MAX_MEDIA_BYTES = MEDIA?.maxImageBytes ?? DEFAULT_MEDIA_LIMITS.maxImageBytes;
	const MAX_MEDIA_PIXELS = MEDIA?.maxPixels ?? DEFAULT_MEDIA_LIMITS.maxPixels;

	/** Uploadable attached file formats (site config `media.fileTypes`, default all supported formats). They enter the body as `::file` cards. */
	const ALLOWED_FILE_MIME_TYPES: readonly AllowedFileMime[] = MEDIA?.fileTypes ?? SUPPORTED_FILE_MIME_TYPES;
	const MAX_FILE_BYTES = MEDIA?.maxFileBytes ?? DEFAULT_MEDIA_LIMITS.maxFileBytes;

	const listEntriesQuerySchema = z.object({
		collection: collectionSchema,
		search: z.string().optional(),
		includeBody: booleanQuery,
		status: z.array(listStatusSchema).optional(),
		/** Content locales. Can be repeated; if absent, all locales. */
		locale: z.array(oneOf(LOCALES)).optional(),
		/** With `translation`, each translation group appears as one row of its source. */
		group: z.enum(["translation"]).optional(),
		folderId: z
			.union([z.string(), z.null()])
			.optional()
			.transform((val) => (val === undefined ? undefined : val === "null" || val === "" ? null : val))
			.pipe(z.union([z.uuid(), z.null(), z.undefined()])),
		includeDescendants: booleanQuery,
		field: fieldConditionsSchema,
		/** Where the translation group stands. Can be repeated (OR). */
		translation: z.array(z.enum(TRANSLATION_FILTERS)).optional(),
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

	/**
	 * How many rows of the list each value of one field (`field=<name>`), of the translation filter (`facet=translation`) or of the status (`facet=status`)
	 * has, for a column's menu. It counts the rows of the folder (`folderId`, `includeDescendants`), before any filter.
	 */
	const listCountsQuerySchema = z
		.object({
			collection: collectionSchema,
			field: fieldNameSchema.optional(),
			facet: z.enum(["translation", "status"]).optional(),
			group: z.enum(["translation"]).optional(),
			folderId: z
				.union([z.string(), z.null()])
				.optional()
				.transform((val) => (val === undefined ? undefined : val === "null" || val === "" ? null : val))
				.pipe(z.union([z.uuid(), z.null(), z.undefined()])),
			includeDescendants: booleanQuery,
		})
		.refine((query) => (query.field !== undefined) !== (query.facet !== undefined), {
			message: "Ask for one field, or for a facet (translation, status)",
			path: ["field"],
		});

	/** The entry search of a picker (`/v1/entries/search`): `query`, and at most `limit` hits (1 to 50, default 20). */
	const searchEntriesQuerySchema = z.object({
		collection: collectionSchema,
		query: z.string().max(200).optional(),
		locale: oneOf(LOCALES).optional(),
		publishedOnly: booleanQuery,
		limit: z.coerce.number().int().min(1).max(MAX_ENTRY_SEARCH_LIMIT).optional(),
		/** Entries to look up by id (repeat `id`) instead of searching. */
		id: z.array(z.uuid()).max(500).optional(),
	});

	const createEntryBodySchema = z
		.object({
			collection: collectionSchema,
			slug: z.string().nullable().optional().default(null),
			metadata: z.record(z.string(), z.unknown()).default({}),
			doc: z.unknown().optional(),
			body: z.string().optional(),
			format: formatNameSchema.optional(),
			folderId: z.uuid().nullable().optional(),
		})
		.refine(bodyIsDocOrText, BODY_IS_DOC_OR_TEXT);

	const createFolderBodySchema = z.object({
		collection: folderCollectionSchema,
		name: folderNameSchema,
		parentId: z.uuid().nullable().optional().default(null),
		position: z.number().int().min(0).optional().default(0),
	});

	const preferencesBodySchema = z.object({
		collections: z.partialRecord(collectionSchema, collectionPreferencesSchema).optional(),
		/** Collapsed state of the edit screen's panels. */
		editor: z.object({ inspectorOpen: z.boolean().optional() }).optional(),
	});

	/** Attached file format decided by the file name. `null` for an unaccepted format (including those outside the config `media.fileTypes`). */
	function fileTypeFor(filename: string): AllowedFileMime | null {
		const type = fileTypeByExtension(filename);
		return type && ALLOWED_FILE_MIME_TYPES.includes(type) ? type : null;
	}

	/** `accept` of the file picker. */
	const FILE_ACCEPT = ALLOWED_FILE_MIME_TYPES.flatMap((mime) =>
		MEDIA_TYPES[mime].extensions.map((extension) => `.${extension}`),
	).join(",");

	/** Policy: does this site accept the image type for upload (it is in `media.imageTypes`)? Rendering uses `isImageType` instead. */
	const isAllowedImage = (mimeType: string | null | undefined): boolean =>
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
	const mediaUploadBodySchema = z.union([
		uploadFileSchema.extend({
			filename: z.string().trim().min(1).max(255),
			original: uploadFileSchema.optional(),
			folderId: z.uuid().nullable().optional(),
		}),
		// Attached file. The format must match the file name's extension (the route checks).
		z.object({
			mimeType: z
				.enum(SUPPORTED_FILE_MIME_TYPES)
				.refine((type) => ALLOWED_FILE_MIME_TYPES.includes(type), "File type is not allowed"),
			byteSize: z.number().int().positive(),
			filename: z.string().trim().min(1).max(255),
			folderId: z.uuid().nullable().optional(),
		}),
	]);

	return {
		collectionSchema,
		folderCollectionSchema,
		listEntriesQuerySchema,
		listCountsQuerySchema,
		searchEntriesQuerySchema,
		createEntryBodySchema,
		createFolderBodySchema,
		preferencesBodySchema,
		ALLOWED_IMAGE_MIME_TYPES,
		MAX_MEDIA_BYTES,
		MAX_MEDIA_PIXELS,
		ALLOWED_FILE_MIME_TYPES,
		MAX_FILE_BYTES,
		fileTypeFor,
		FILE_ACCEPT,
		isImageType,
		isAllowedImage,
		mediaUploadBodySchema,
	};
}

export type PreferencesBody = z.infer<SiteApi["preferencesBodySchema"]>;
