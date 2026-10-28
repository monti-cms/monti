import { z } from "zod";
import type {
	BodyTemplate,
	ExportSnapshotAddress,
	ExportSnapshotBody,
	ExportSnapshotEntry,
	ExportSnapshotReference,
	Folder,
	MediaAssetRecord,
	RestorePlan,
} from "../../core/store/types";
import { parseTranslationState } from "../../core/translation/state";
import { readReferenceOccurrences } from "../../core/types";
import { readStoredDocument } from "../../doc/stored-document";
import { importNotice } from "../entry-import/notice";
import { MAX_IMPORT_INFLATED_BYTES } from "../entry-import/read-archive";
import { readZipArchive } from "../zip";
import type { BackupRead, NotRestored, RestoreProblem } from "./types";

const decoder = new TextDecoder();

const date = z
	.string()
	.refine((value) => !Number.isNaN(Date.parse(value)), "not a date")
	.transform((value) => new Date(value));

const manifestSchema = z.object({
	scope: z.enum(["admin", "public"]),
	selection: z.object({ ids: z.array(z.string()) }).nullable(),
	entries: z.array(z.unknown()),
});

const manifestEntrySchema = z.object({
	id: z.string(),
	collection: z.string(),
	locale: z.string(),
	translationGroupId: z.string(),
	status: z.enum(["draft", "published", "archived", "trashed"]),
	version: z.number().int(),
	workingSlug: z.string().nullable(),
	publishedSlug: z.string().nullable(),
	folderId: z.string().nullable(),
	createdAt: date,
	updatedAt: date,
	publishedAt: date.nullable(),
	deletedAt: date.nullable(),
	changedBy: z.string().nullable(),
	changedAt: date.nullable(),
	hasWorking: z.literal(true),
	hasPublished: z.boolean(),
});

/** The header file of a body (`working.json`, `published.json`): the part of the body that is not the document. */
const bodyHeaderSchema = z.object({
	metadata: z.record(z.string(), z.unknown()),
	contentHash: z.string(),
	updatedAt: date,
	translation: z.unknown().optional(),
});

const referencesSchema = z.array(
	z.object({
		state: z.enum(["working", "published"]),
		kind: z.enum(["entry", "media"]),
		targetId: z.string(),
		isStale: z.boolean(),
		occurrences: z.unknown(),
	}),
);

const foldersSchema = z.array(
	z.object({
		id: z.string(),
		collection: z.string(),
		parentId: z.string().nullable(),
		name: z.string(),
		position: z.number().int(),
		version: z.number().int(),
		deletedAt: date.nullable().optional(),
	}),
);

const addressesSchema = z.array(
	z.object({
		collection: z.string(),
		locale: z.string(),
		slug: z.string(),
		entryId: z.string().nullable(),
		type: z.enum(["reservation", "current", "alias", "deleted"]),
	}),
);

const nullableNumber = z.number().nullable();
const mediaSchema = z.array(
	z.object({
		id: z.string(),
		folderId: z.string().nullable(),
		status: z.enum(["pending", "ready", "failed", "deleting", "trashed"]),
		filename: z.string(),
		mimeType: z.string().nullable(),
		byteSize: nullableNumber,
		width: nullableNumber,
		height: nullableNumber,
		storageKey: z.string().nullable(),
		stagingKey: z.string().nullable(),
		original: z
			.object({
				storageKey: z.string().nullable(),
				stagingKey: z.string().nullable(),
				mimeType: z.string().nullable(),
				byteSize: nullableNumber,
				width: nullableNumber,
				height: nullableNumber,
			})
			.nullable(),
		defaultAlt: z.string(),
		defaultCaption: z.string(),
		createdAt: date,
		updatedAt: date,
		readyAt: date.nullable(),
		deletedAt: date.nullable().optional(),
	}),
);

const templatesSchema = z.array(
	z.object({
		id: z.string(),
		name: z.string(),
		doc: z.unknown(),
		version: z.number().int(),
		createdAt: date,
		updatedAt: date,
	}),
);

const preferencesSchema = z.array(z.unknown());

const NO_PLAN: RestorePlan = { entries: [], references: [], folders: [], addresses: [], media: [], templates: [] };

/** Parses a JSON file of the archive against a schema. `undefined` when it is missing, is not JSON, or does not have the shape. */
function readFile<T extends z.ZodType>(
	files: ReadonlyMap<string, Uint8Array>,
	path: string,
	schema: T,
): z.infer<T> | undefined {
	const data = files.get(path);
	if (!data) return undefined;
	try {
		const parsed = schema.safeParse(JSON.parse(decoder.decode(data)));
		return parsed.success ? parsed.data : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Reads an uploaded zip as a full backup, by the layout the export of this version writes (`EXPORT_FORMAT_VERSION`): `manifest.json`, `entries/<collection>/<id>/…`,
 * `folders.json`, `addresses.json`, `templates.json`, `media.json` and `preferences.json`. Nothing is written. A file that is not a zip, or has no readable manifest, is
 * refused. An archive that is not a full backup (a public export, or a selection) is returned with `isBackup: false` and nothing read from it. A file of one entry that
 * cannot be read becomes a problem of that entry, and the entry is left out of the plan, so the restore is refused with everything listed.
 */
export function readBackupArchive(bytes: Uint8Array): BackupRead {
	let files: Map<string, Uint8Array>;
	try {
		files = new Map(
			readZipArchive(bytes, { maxTotalBytes: MAX_IMPORT_INFLATED_BYTES }).map((file) => [file.path, file.data]),
		);
	} catch {
		throw importNotice("import.archive.unreadable");
	}
	const manifest = readFile(files, "manifest.json", manifestSchema);
	if (!manifest) throw importNotice("restore.archive.invalid");
	if (manifest.scope !== "admin" || manifest.selection !== null) {
		return { isBackup: false, plan: NO_PLAN, notRestored: [], problems: [] };
	}

	const problems: RestoreProblem[] = [];
	const unreadable = (subject: RestoreProblem["subject"], id: string | null, label: string | null): void => {
		problems.push({ subject, id, label, code: "files_unreadable" });
	};

	const entries: ExportSnapshotEntry[] = [];
	const references: ExportSnapshotReference[] = [];
	for (const item of manifest.entries) {
		const listed = manifestEntrySchema.safeParse(item);
		if (!listed.success) {
			const id =
				typeof item === "object" && item !== null && "id" in item ? String((item as { id: unknown }).id) : null;
			unreadable("entry", id, null);
			continue;
		}
		const entry = listed.data;
		const base = `entries/${entry.collection}/${entry.id}`;
		const body = (state: "working" | "published"): ExportSnapshotBody | undefined => {
			const header = readFile(files, `${base}/${state}.json`, bodyHeaderSchema);
			const doc = readStoredDocument(parseJson(files.get(`${base}/${state}.doc.json`)));
			const translation = header ? parseTranslationState(header.translation ?? null) : undefined;
			if (!header || !doc || translation === undefined) return undefined;
			return {
				metadata: header.metadata as ExportSnapshotBody["metadata"],
				doc,
				contentHash: header.contentHash,
				updatedAt: header.updatedAt,
				translation,
			};
		};
		const working = body("working");
		const published = entry.hasPublished ? body("published") : undefined;
		const refs = readFile(files, `${base}/references.json`, referencesSchema);
		if (!working || (entry.hasPublished && !published) || !refs) {
			unreadable("entry", entry.id, entry.workingSlug ?? entry.publishedSlug);
			continue;
		}
		entries.push({
			id: entry.id,
			collection: entry.collection,
			locale: entry.locale,
			translationGroupId: entry.translationGroupId,
			status: entry.status,
			version: entry.version,
			folderId: entry.folderId,
			workingSlug: entry.workingSlug,
			publishedSlug: entry.publishedSlug,
			createdAt: entry.createdAt,
			updatedAt: entry.updatedAt,
			publishedAt: entry.publishedAt,
			deletedAt: entry.deletedAt,
			changedBy: entry.changedBy,
			changedAt: entry.changedAt,
			working,
			...(published ? { published } : {}),
		});
		for (const reference of refs) {
			references.push({
				entryId: entry.id,
				state: reference.state,
				kind: reference.kind,
				targetId: reference.targetId,
				isStale: reference.isStale,
				occurrences: readReferenceOccurrences(reference.occurrences),
			});
		}
	}

	const folders: Folder[] | undefined = readFile(files, "folders.json", foldersSchema);
	const addresses: ExportSnapshotAddress[] | undefined = readFile(files, "addresses.json", addressesSchema);
	const media: MediaAssetRecord[] | undefined = readFile(files, "media.json", mediaSchema);
	const templateRows = readFile(files, "templates.json", templatesSchema);
	if (!folders) unreadable("archive", null, "folders.json");
	if (!addresses) unreadable("archive", null, "addresses.json");
	if (!media) unreadable("archive", null, "media.json");
	if (!templateRows) unreadable("archive", null, "templates.json");
	const templates: BodyTemplate[] = [];
	for (const row of templateRows ?? []) {
		const doc = readStoredDocument(row.doc);
		if (!doc) {
			unreadable("template", row.id, row.name);
			continue;
		}
		templates.push({
			id: row.id,
			name: row.name,
			doc,
			version: row.version,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		});
	}

	const preferences = readFile(files, "preferences.json", preferencesSchema);
	const notRestored: NotRestored[] = [
		{ code: "preferences", ...(preferences && preferences.length > 0 ? { count: preferences.length } : {}) },
		{ code: "accounts" },
		{ code: "api_keys" },
		{ code: "ai_connections" },
		{ code: "event_logs" },
		{ code: "plugins" },
	];

	return {
		isBackup: true,
		plan: { entries, references, folders: folders ?? [], addresses: addresses ?? [], media: media ?? [], templates },
		notRestored,
		problems,
	};
}

function parseJson(data: Uint8Array | undefined): unknown {
	if (!data) return undefined;
	try {
		return JSON.parse(decoder.decode(data));
	} catch {
		return undefined;
	}
}
