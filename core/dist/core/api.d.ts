import { z } from "zod";
import { type AllowedFileMime, type MediaConfig } from "./media-types.js";
export * from "./media-types.js";
/**
 * Request contract of `/api/cms/v1`. The routes and the admin UI see the same definitions.
 */
export declare const ENTRY_STATUSES: readonly ["draft", "published", "archived", "trashed"];
export declare const entryStatusSchema: z.ZodEnum<{
    archived: "archived";
    draft: "draft";
    published: "published";
    trashed: "trashed";
}>;
export declare const LIST_SORT_FIELDS: readonly ["updatedAt", "createdAt", "publishedAt", "title", "slug"];
export type ListSortField = (typeof LIST_SORT_FIELDS)[number];
export declare const listSortFieldSchema: z.ZodEnum<{
    createdAt: "createdAt";
    publishedAt: "publishedAt";
    slug: "slug";
    title: "title";
    updatedAt: "updatedAt";
}>;
export declare const sortDirectionSchema: z.ZodEnum<{
    asc: "asc";
    desc: "desc";
}>;
export declare const PAGE_SIZES: readonly [25, 50, 100];
export type PageSize = (typeof PAGE_SIZES)[number];
/** List query keys that may appear multiple times. The route reads only these keys with `getAll`. */
export declare const LIST_ARRAY_QUERY_KEYS: readonly ["status", "relation", "locale"];
/** Search query keys that may appear multiple times (`id`: entries to look up by id). */
export declare const SEARCH_ARRAY_QUERY_KEYS: readonly ["id"];
export declare const fieldNameSchema: z.ZodString;
/** The name of a format (the `format` option). Whether one is installed is decided when it is used. */
export declare const formatNameSchema: z.ZodString;
/** With neither `doc` nor `body`, the body of the current draft is kept. */
export declare const patchEntryBodySchema: z.ZodObject<{
    expectedVersion: z.ZodNumber;
    slug: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    doc: z.ZodOptional<z.ZodUnknown>;
    body: z.ZodOptional<z.ZodString>;
    format: z.ZodOptional<z.ZodString>;
    folderId: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
    translation: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export type PatchEntryBody = z.infer<typeof patchEntryBodySchema>;
/** State transitions that take only a version (archive, unarchive, trash, restore). */
export declare const versionBodySchema: z.ZodObject<{
    expectedVersion: z.ZodNumber;
}, z.core.$strip>;
/** Publish. With `resetPublishedAt`, an already published post's publish date is reset to now. */
export declare const publishBodySchema: z.ZodObject<{
    expectedVersion: z.ZodNumber;
    resetPublishedAt: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const BULK_OPS: readonly ["relation.add", "relation.remove", "relation.set", "folder.move", "archive", "unarchive", "trash", "publish", "permanentDelete"];
export type BulkOp = (typeof BULK_OPS)[number];
export declare const bulkBodySchema: z.ZodObject<{
    op: z.ZodEnum<{
        archive: "archive";
        "folder.move": "folder.move";
        permanentDelete: "permanentDelete";
        publish: "publish";
        "relation.add": "relation.add";
        "relation.remove": "relation.remove";
        "relation.set": "relation.set";
        trash: "trash";
        unarchive: "unarchive";
    }>;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        expectedVersion: z.ZodNumber;
    }, z.core.$strip>>;
    field: z.ZodOptional<z.ZodString>;
    ids: z.ZodOptional<z.ZodArray<z.ZodUUID>>;
    id: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
    folderId: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
}, z.core.$strip>;
export type BulkBody = z.infer<typeof bulkBodySchema>;
export declare const adminColumnSettingsSchema: z.ZodObject<{
    order: z.ZodOptional<z.ZodArray<z.ZodString>>;
    visibility: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
    sizes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, z.core.$strip>;
export type AdminColumnSettings = z.infer<typeof adminColumnSettingsSchema>;
/** Per-collection list settings. */
export declare const collectionPreferencesSchema: z.ZodObject<{
    columns: z.ZodOptional<z.ZodObject<{
        order: z.ZodOptional<z.ZodArray<z.ZodString>>;
        visibility: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
        sizes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, z.core.$strip>>;
    pageSize: z.ZodOptional<z.ZodCoercedNumber<unknown> & z.ZodType<25 | 50 | 100, unknown, z.core.$ZodTypeInternals<25 | 50 | 100, unknown>>>;
    sort: z.ZodOptional<z.ZodObject<{
        field: z.ZodEnum<{
            createdAt: "createdAt";
            publishedAt: "publishedAt";
            slug: "slug";
            title: "title";
            updatedAt: "updatedAt";
        }>;
        direction: z.ZodEnum<{
            asc: "asc";
            desc: "desc";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type CollectionPreferences = z.infer<typeof collectionPreferencesSchema>;
export declare const exportScopeSchema: z.ZodObject<{
    scope: z.ZodDefault<z.ZodEnum<{
        admin: "admin";
        public: "public";
    }>>;
    format: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ExportScopeInput = z.infer<typeof exportScopeSchema>;
/** A template body is a document (`doc`) or a text with its format, as an entry body is. With neither, the template is empty. */
export declare const createTemplateBodySchema: z.ZodObject<{
    name: z.ZodString;
    doc: z.ZodOptional<z.ZodUnknown>;
    body: z.ZodOptional<z.ZodString>;
    format: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CreateTemplateBody = z.infer<typeof createTemplateBodySchema>;
export declare const patchTemplateBodySchema: z.ZodObject<{
    expectedVersion: z.ZodNumber;
    name: z.ZodOptional<z.ZodString>;
    doc: z.ZodOptional<z.ZodUnknown>;
    body: z.ZodOptional<z.ZodString>;
    format: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PatchTemplateBody = z.infer<typeof patchTemplateBodySchema>;
export declare const updateFolderBodySchema: z.ZodObject<{
    expectedVersion: z.ZodNumber;
    name: z.ZodOptional<z.ZodString>;
    parentId: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
    position: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const mediaPatchBodySchema: z.ZodObject<{
    filename: z.ZodOptional<z.ZodString>;
    defaultAlt: z.ZodOptional<z.ZodString>;
    defaultCaption: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const mediaListQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    mimeType: z.ZodOptional<z.ZodString>;
    kind: z.ZodDefault<z.ZodEnum<{
        all: "all";
        file: "file";
        image: "image";
    }>>;
    used: z.ZodDefault<z.ZodEnum<{
        all: "all";
        unused: "unused";
        used: "used";
    }>>;
    uploadedFrom: z.ZodPipe<z.ZodOptional<z.ZodISODateTime>, z.ZodTransform<Date | undefined, string | undefined>>;
    uploadedTo: z.ZodPipe<z.ZodOptional<z.ZodISODateTime>, z.ZodTransform<Date | undefined, string | undefined>>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
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
/** Request schemas and upload rules of one site. A `Site` carries them (`site.api`). */
export declare function createApi({ COLLECTIONS, LOCALES, media: MEDIA }: ApiParts): {
    collectionSchema: z.ZodEnum<{
        [x: string]: string;
    }>;
    listEntriesQuerySchema: z.ZodObject<{
        collection: z.ZodEnum<{
            [x: string]: string;
        }>;
        search: z.ZodOptional<z.ZodString>;
        includeBody: z.ZodPipe<z.ZodOptional<z.ZodEnum<{
            0: "0";
            1: "1";
            false: "false";
            true: "true";
        }>>, z.ZodTransform<boolean | undefined, "0" | "1" | "false" | "true" | undefined>>;
        titleContains: z.ZodOptional<z.ZodString>;
        slugContains: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            archived: "archived";
            draft: "draft";
            published: "published";
            trashed: "trashed";
        }>>>;
        locale: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            [x: string]: string;
        }>>>;
        group: z.ZodOptional<z.ZodEnum<{
            translation: "translation";
        }>>;
        folderId: z.ZodPipe<z.ZodPipe<z.ZodOptional<z.ZodString>, z.ZodTransform<string | null | undefined, string | undefined>>, z.ZodUnion<readonly [z.ZodUUID, z.ZodNull, z.ZodUndefined]>>;
        includeDescendants: z.ZodPipe<z.ZodOptional<z.ZodEnum<{
            0: "0";
            1: "1";
            false: "false";
            true: "true";
        }>>, z.ZodTransform<boolean | undefined, "0" | "1" | "false" | "true" | undefined>>;
        relation: z.ZodPipe<z.ZodOptional<z.ZodArray<z.ZodString>>, z.ZodTransform<Record<string, string[]> | undefined, string[] | undefined>>;
        hasChanges: z.ZodPipe<z.ZodOptional<z.ZodEnum<{
            0: "0";
            1: "1";
            false: "false";
            true: "true";
        }>>, z.ZodTransform<boolean | undefined, "0" | "1" | "false" | "true" | undefined>>;
        createdFrom: z.ZodPipe<z.ZodOptional<z.ZodISODateTime>, z.ZodTransform<Date | undefined, string | undefined>>;
        createdTo: z.ZodPipe<z.ZodOptional<z.ZodISODateTime>, z.ZodTransform<Date | undefined, string | undefined>>;
        updatedFrom: z.ZodPipe<z.ZodOptional<z.ZodISODateTime>, z.ZodTransform<Date | undefined, string | undefined>>;
        updatedTo: z.ZodPipe<z.ZodOptional<z.ZodISODateTime>, z.ZodTransform<Date | undefined, string | undefined>>;
        publishedFrom: z.ZodPipe<z.ZodOptional<z.ZodISODateTime>, z.ZodTransform<Date | undefined, string | undefined>>;
        publishedTo: z.ZodPipe<z.ZodOptional<z.ZodISODateTime>, z.ZodTransform<Date | undefined, string | undefined>>;
        sortField: z.ZodOptional<z.ZodEnum<{
            createdAt: "createdAt";
            publishedAt: "publishedAt";
            slug: "slug";
            title: "title";
            updatedAt: "updatedAt";
        }>>;
        sortDirection: z.ZodOptional<z.ZodEnum<{
            asc: "asc";
            desc: "desc";
        }>>;
        page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
        pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown> & z.ZodType<25 | 50 | 100, unknown, z.core.$ZodTypeInternals<25 | 50 | 100, unknown>>>;
    }, z.core.$strip>;
    searchEntriesQuerySchema: z.ZodObject<{
        collection: z.ZodEnum<{
            [x: string]: string;
        }>;
        query: z.ZodOptional<z.ZodString>;
        locale: z.ZodOptional<z.ZodEnum<{
            [x: string]: string;
        }>>;
        publishedOnly: z.ZodPipe<z.ZodOptional<z.ZodEnum<{
            0: "0";
            1: "1";
            false: "false";
            true: "true";
        }>>, z.ZodTransform<boolean | undefined, "0" | "1" | "false" | "true" | undefined>>;
        limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
        id: z.ZodOptional<z.ZodArray<z.ZodUUID>>;
    }, z.core.$strip>;
    createEntryBodySchema: z.ZodObject<{
        collection: z.ZodEnum<{
            [x: string]: string;
        }>;
        slug: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
        metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        doc: z.ZodOptional<z.ZodUnknown>;
        body: z.ZodOptional<z.ZodString>;
        format: z.ZodOptional<z.ZodString>;
        folderId: z.ZodOptional<z.ZodNullable<z.ZodUUID>>;
    }, z.core.$strip>;
    createFolderBodySchema: z.ZodObject<{
        collection: z.ZodEnum<{
            [x: string]: string;
        }>;
        name: z.ZodString;
        parentId: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodUUID>>>;
        position: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>;
    preferencesBodySchema: z.ZodObject<{
        collections: z.ZodOptional<z.ZodRecord<z.ZodEnum<{
            [x: string]: string;
        }> & z.core.$partial, z.ZodObject<{
            columns: z.ZodOptional<z.ZodObject<{
                order: z.ZodOptional<z.ZodArray<z.ZodString>>;
                visibility: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>;
                sizes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
            }, z.core.$strip>>;
            pageSize: z.ZodOptional<z.ZodCoercedNumber<unknown> & z.ZodType<25 | 50 | 100, unknown, z.core.$ZodTypeInternals<25 | 50 | 100, unknown>>>;
            sort: z.ZodOptional<z.ZodObject<{
                field: z.ZodEnum<{
                    createdAt: "createdAt";
                    publishedAt: "publishedAt";
                    slug: "slug";
                    title: "title";
                    updatedAt: "updatedAt";
                }>;
                direction: z.ZodEnum<{
                    asc: "asc";
                    desc: "desc";
                }>;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
        editor: z.ZodOptional<z.ZodObject<{
            inspectorOpen: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    ALLOWED_IMAGE_MIME_TYPES: readonly ("image/avif" | "image/gif" | "image/jpeg" | "image/png" | "image/webp")[];
    MAX_MEDIA_BYTES: number;
    MAX_MEDIA_PIXELS: number;
    ALLOWED_FILE_MIME_TYPES: readonly ("application/json" | "application/pdf" | "application/zip" | "text/csv" | "text/markdown" | "text/plain")[];
    MAX_FILE_BYTES: number;
    fileTypeFor: (filename: string) => AllowedFileMime | null;
    FILE_ACCEPT: string;
    isImageMime: (mimeType: string | null | undefined) => boolean;
    mediaUploadBodySchema: z.ZodUnion<readonly [z.ZodObject<{
        mimeType: z.ZodEnum<{
            "image/avif": "image/avif";
            "image/gif": "image/gif";
            "image/jpeg": "image/jpeg";
            "image/png": "image/png";
            "image/webp": "image/webp";
        }>;
        byteSize: z.ZodNumber;
        filename: z.ZodString;
        original: z.ZodOptional<z.ZodObject<{
            mimeType: z.ZodEnum<{
                "image/avif": "image/avif";
                "image/gif": "image/gif";
                "image/jpeg": "image/jpeg";
                "image/png": "image/png";
                "image/webp": "image/webp";
            }>;
            byteSize: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        mimeType: z.ZodEnum<{
            "application/json": "application/json";
            "application/pdf": "application/pdf";
            "application/zip": "application/zip";
            "text/csv": "text/csv";
            "text/markdown": "text/markdown";
            "text/plain": "text/plain";
        }>;
        byteSize: z.ZodNumber;
        filename: z.ZodString;
    }, z.core.$strip>]>;
};
export type ListEntriesQuery = z.infer<SiteApi["listEntriesQuerySchema"]>;
export type CreateEntryBody = z.infer<SiteApi["createEntryBodySchema"]>;
export type PreferencesBody = z.infer<SiteApi["preferencesBodySchema"]>;
export type MediaUploadBody = z.infer<SiteApi["mediaUploadBodySchema"]>;
