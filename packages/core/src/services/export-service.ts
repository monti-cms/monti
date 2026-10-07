import { createHash } from "node:crypto";
import { z } from "zod";
import type { ExportSnapshot, ExportSnapshotEntry, ExportSnapshotReference } from "../core/store";
import type { Site } from "../site";
import { perSite } from "../site/per-site";
import { createZipArchive, type ZipEntry } from "./zip";

export const exportScopeSchema = z.enum(["admin", "public"]);
export type ExportScope = z.infer<typeof exportScopeSchema>;

/**
 * Public projection schema. It has no `working` field at all and is `.strict()`, so if a draft body or an
 * admin-only key is mixed into the top level of an item, parsing fails (fail-closed).
 * Inside `metadata`, collection fields are too free-form for a recursive allowlist (a non-blocking follow-up).
 */
export const publicExportEntrySchema = z
	.object({
		id: z.string().uuid(),
		collection: z.string(),
		slug: z.string().nullable(),
		publishedAt: z.string().nullable(),
		updatedAt: z.string(),
		metadata: z.record(z.string(), z.unknown()),
		/** The stored document: the body. (A text of the body in a format is a file of its own, written only when the export asks for a `format`.) */
		doc: z.record(z.string(), z.unknown()),
		schemaVersion: z.number().int(),
		contentHash: z.string(),
	})
	.strict();

export type PublicExportEntry = z.infer<typeof publicExportEntrySchema>;

/**
 * Public metadata allowlist. Only stored fields of the collection definition are exported, so
 * admin-only keys (storageKey etc.) or values not in the definition mixed into metadata do not go out in the public archive.
 * Per-language names of record collections (`translations`) are not fields and do not go out.
 */
export const publicMetadataKeys = perSite(
	(site: PublicSite): Readonly<Record<string, readonly string[]>> =>
		Object.fromEntries(
			site.COLLECTIONS.map((collection) => [collection, site.storedFields(collection).map((stored) => stored.name)]),
		),
);

export function pickPublicMetadata(
	site: PublicSite,
	collection: string,
	metadata: Record<string, unknown>,
): Record<string, unknown> {
	const allowed = publicMetadataKeys(site)[collection];
	if (!allowed) throw new Error(`No public metadata allowlist for collection: ${collection}`);
	const picked: Record<string, unknown> = {};
	for (const key of allowed) {
		if (metadata[key] !== undefined) picked[key] = metadata[key];
	}
	return picked;
}

/**
 * Format version of the archive, in the manifest and in the body JSON files. Version 2 added `working.doc.json` / `published.doc.json` and the
 * `doc` of templates to the admin archive. Version 3: the public archive's `published.json` carries the stored document as `doc` (the same document as
 * `published.doc.json` in the admin archive), next to the MDX text. Version 4: the document is the only body. Text files (`working.<ext>`, `published.<ext>`)
 * and the `body` of a template are written only when the export asked for a `format` (the manifest names it), and the `mdx` of an item and a template is gone.
 */
export const EXPORT_FORMAT_VERSION = 4;

/** The bodies of an export written as text in one format, produced before the archive is built (formats are asynchronous, the archive is not). */
export interface ExportTexts {
	readonly format: { readonly name: string; readonly extension: string };
	/** The text of each body, by `exportTextKey`. A body that has none (an entry without a published copy) is not in it. */
	readonly bodies: ReadonlyMap<string, string>;
}

/** The key of a body in `ExportTexts.bodies`: an entry's `working` or `published` body, or a template. */
export const exportTextKey = (id: string, state: "working" | "published" | "template"): string => `${state}:${id}`;

export interface ExportManifestEntry {
	id: string;
	collection: string;
	/** Content language and translation group ID. For a source, the group ID is its own ID. */
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
	/** Canonical digest of one state. */
	workingDigest: string | null;
	publishedDigest: string | null;
	/** Digest of the whole item (working copy + published copy). For comparing sameness between archives and for auditing. */
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
	/** The format the text files of the archive are written in. `null`: the archive holds documents only. */
	format: ExportTexts["format"] | null;
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

/** Canonical JSON that does not depend on key order. Used for digests and snapshot comparison. */
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

/**
 * Canonical digest of one state. Includes content (the stored document), slug, status, folder and references so skip/conflict decisions stay stable.
 */
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
			doc: (state === "working" ? entry.working.doc : entry.published?.doc) ?? null,
			references: references
				.filter((reference) => reference.entryId === entry.id && reference.state === state)
				.map((reference) => ({ kind: reference.kind, targetId: reference.targetId, isStale: reference.isStale }))
				.sort((left, right) =>
					`${left.kind}\u0000${left.targetId}` < `${right.kind}\u0000${right.targetId}` ? -1 : 1,
				),
		}),
	);

/** Digest of the whole item (working copy + published copy). It must differ if only one side changes. */
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

const bodyFile = (entry: ExportSnapshotEntry, state: "working" | "published"): { json: string; doc: string } => {
	const body = state === "working" ? entry.working : entry.published;
	if (!body) throw new Error(`Entry ${entry.id} has no ${state} body`);
	return {
		json: `${canonicalJson({
			formatVersion: EXPORT_FORMAT_VERSION,
			collection: entry.collection,
			id: entry.id,
			state,
			status: entry.status,
			slug: state === "working" ? entry.workingSlug : entry.publishedSlug,
			metadata: body.metadata,
			schemaVersion: body.schemaVersion,
			contentHash: body.contentHash,
			// Only translated entries have this; the source file shape is unchanged.
			...(body.translation ? { translation: body.translation } : {}),
			updatedAt: iso(body.updatedAt),
			createdAt: iso(entry.createdAt),
			updatedEntryAt: iso(entry.updatedAt),
			publishedAt: iso(entry.publishedAt),
			folderId: entry.folderId,
		})}\n`,
		doc: `${canonicalJson(body.doc)}\n`,
	};
};

/** The public archive includes only the published copy of items that are currently public. Drafts, archived and trashed items are excluded even if a published copy remains. */
const publicEntry = (site: PublicSite, entry: ExportSnapshotEntry): PublicExportEntry | null => {
	if (entry.status !== "published") return null;
	if (!entry.published) return null;
	return publicExportEntrySchema.parse({
		id: entry.id,
		collection: entry.collection,
		slug: entry.publishedSlug,
		publishedAt: iso(entry.publishedAt),
		updatedAt: iso(entry.published.updatedAt) ?? iso(entry.updatedAt) ?? "",
		metadata: pickPublicMetadata(site, entry.collection, entry.published.metadata),
		doc: entry.published.doc,
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

/** What the public archive needs of a site: the stored fields of its collections. */
type PublicSite = Pick<Site, "COLLECTIONS" | "storedFields">;

export interface BuildExportOptions {
	/** The site the archive is built for (the public archive lists only the fields its collections define). */
	site: PublicSite;
	scope: ExportScope;
	exportedAt: Date;
	/** The bodies as text in a format. Without it the archive holds the documents only. */
	texts?: ExportTexts;
	/** File timestamp inside the archive. A fixed value can be used for snapshot tests. */
	archiveModifiedAt?: Date;
}

export function buildExportArchive(snapshot: ExportSnapshot, options: BuildExportOptions): ExportArchive {
	const { scope, exportedAt, texts, site } = options;
	const textFile = (base: string, state: "working" | "published", id: string): ZipEntry | undefined => {
		const text = texts?.bodies.get(exportTextKey(id, state));
		return texts && text !== undefined
			? { path: `${base}/${state}.${texts.format.extension}`, data: new TextEncoder().encode(text) }
			: undefined;
	};
	const entries = sortEntries(snapshot.entries);
	const files: ZipEntry[] = [];
	const manifestEntries: ExportManifestEntry[] = [];

	for (const entry of entries) {
		const base = `entries/${entry.collection}/${entry.id}`;
		const entryFiles: string[] = [];

		if (scope === "admin") {
			const working = bodyFile(entry, "working");
			files.push({ path: `${base}/working.json`, data: new TextEncoder().encode(working.json) });
			entryFiles.push(`${base}/working.json`);
			files.push({ path: `${base}/working.doc.json`, data: new TextEncoder().encode(working.doc) });
			entryFiles.push(`${base}/working.doc.json`);
			const workingText = textFile(base, "working", entry.id);
			if (workingText) {
				files.push(workingText);
				entryFiles.push(workingText.path);
			}

			if (entry.published) {
				const published = bodyFile(entry, "published");
				files.push({ path: `${base}/published.json`, data: new TextEncoder().encode(published.json) });
				entryFiles.push(`${base}/published.json`);
				files.push({ path: `${base}/published.doc.json`, data: new TextEncoder().encode(published.doc) });
				entryFiles.push(`${base}/published.doc.json`);
				const publishedText = textFile(base, "published", entry.id);
				if (publishedText) {
					files.push(publishedText);
					entryFiles.push(publishedText.path);
				}
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

		const projected = publicEntry(site, entry);
		if (!projected) continue;
		files.push({ path: `${base}/published.json`, data: new TextEncoder().encode(`${canonicalJson(projected)}\n`) });
		entryFiles.push(`${base}/published.json`);
		const publicText = textFile(base, "published", entry.id);
		if (publicText) {
			files.push(publicText);
			entryFiles.push(publicText.path);
		}

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
					doc: template.doc,
					...(texts?.bodies.has(exportTextKey(template.id, "template"))
						? { body: texts.bodies.get(exportTextKey(template.id, "template")) }
						: {}),
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

	// The digest covers every payload file that actually goes into the archive (manifest.json and exportedAt are excluded).
	// So the digest changes even when non-item data such as settings, the media list or addresses changes.
	const digest = sha256(files.map((file) => `${file.path}\u0000${sha256Bytes(file.data)}`).join("\n"));

	const manifest: ExportManifest = {
		formatVersion: EXPORT_FORMAT_VERSION,
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
		format: texts ? texts.format : null,
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
