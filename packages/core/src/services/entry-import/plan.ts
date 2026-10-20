import { isUuid } from "../../core/ids";
import { entryLinkIds } from "../../doc/entry-links";
import type { StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { importText } from "../../format/convert";
import { mediaUrlResolver } from "../media-urls";
import type { Issue } from "../types";
import { importNotice } from "./notice";
import { heldFieldNames } from "./read-archive";
import type { ImportHost, ImportReason, ImportSource, SourceEntry } from "./types";

/** An archive collection and where its entries go. */
export interface PlannedCollection {
	/** The folder name in the archive (empty for text files at the top of the archive). */
	readonly name: string;
	readonly entries: number;
	/** The document collection the entries go to, or `null` when they are skipped. */
	readonly target: string | null;
	/** Why the collection is skipped, when it is. */
	readonly skipped: ImportReason | null;
}

/** A value the archive holds that the import does not read, per collection. */
export interface FieldsNotImported {
	readonly collection: string;
	readonly target: string;
	readonly fields: readonly string[];
	/** Required fields of the target that the import does not fill: an entry needs them before it can be published. */
	readonly required: readonly string[];
}

export interface PlannedEntry {
	readonly source: SourceEntry;
	/** The target collection, `null` when skipped before one was chosen. */
	readonly target: string | null;
	readonly title: string | null;
	readonly slug: string | null;
	/** Why the entry is not imported. `null`: it will be. */
	readonly skip: ImportReason | null;
	/** Findings about an entry that is imported. */
	readonly notes: readonly ImportReason[];
	/** The body as a document, read once for the preview and the run. `null` for a skipped entry. */
	readonly doc: StoredDocument | null;
	/** What reading the text said, which the saved draft will carry as warnings too. */
	readonly readIssues: readonly Issue[];
	/** How many images of the body point outside this site's media. */
	readonly outsideImages: number;
	/** How many links by id point to an entry that is not imported. */
	readonly keptLinks: number;
	/** The metadata key the title was read from; it is not a field that goes unread. */
	readonly titleKey: string | null;
}

export interface ImportPlan {
	readonly kind: ImportSource["kind"];
	readonly collections: readonly PlannedCollection[];
	/** The document collections of the site an archive collection can go to. */
	readonly targets: readonly { name: string; label: string }[];
	readonly entries: readonly PlannedEntry[];
	readonly fieldsNotImported: readonly FieldsNotImported[];
	readonly otherFiles: number;
}

/** The archive collection → document collection choices of a request. A name that is not a document collection of this site is refused. */
export type ImportMapping = Readonly<Record<string, string | null>>;

const walk = (nodes: readonly CmsNode[] | undefined, visit: (node: CmsNode) => void): void => {
	for (const node of nodes ?? []) {
		visit(node);
		walk(node.content, visit);
	}
};

/** The nodes that name a media file of the site's library by id. */
const isMediaNode = (node: CmsNode): boolean =>
	(node.type === "image" || node.type === "file") &&
	typeof node.attrs?.mediaId === "string" &&
	node.attrs.mediaId !== "";

const withoutNodes = (nodes: readonly CmsNode[], drop: (node: CmsNode) => boolean): CmsNode[] =>
	nodes
		.filter((node) => !drop(node))
		.map((node) => (node.content ? { ...node, content: withoutNodes(node.content, drop) } : node));

/**
 * The images of a body that are not in this site's media. A media file is not brought in, so an image or file that names one by id (from the site the archive
 * was made on) has nothing to show here and the store would refuse it: it is left out of the body, and counted. An image with a URL stays as written;
 * it is counted when the URL is not one of this site's registered media files.
 */
async function checkMedia(
	host: ImportHost,
	doc: StoredDocument,
): Promise<{ doc: StoredDocument; leftOut: number; outside: number }> {
	const ids: string[] = [];
	const urls: string[] = [];
	walk(doc.content, (node) => {
		if (isMediaNode(node)) ids.push(node.attrs?.mediaId as string);
		else if (node.type === "image" && typeof node.attrs?.src === "string" && node.attrs.src !== "")
			urls.push(node.attrs.src);
	});
	if (ids.length === 0 && urls.length === 0) return { doc, leftOut: 0, outside: 0 };
	const known = new Set<string>();
	for (const id of new Set(ids)) {
		if (isUuid(id) && (await host.store().getMediaAsset(id))) known.add(id);
	}
	const registered = host.isMediaConfigured
		? await mediaUrlResolver(host.store, host.mediaStore)([...new Set(urls)])
		: new Map<string, string>();
	const leftOut = ids.filter((id) => !known.has(id)).length;
	const outside = urls.filter((url) => !registered.has(url)).length;
	const cleaned =
		leftOut === 0
			? doc
			: {
					...doc,
					content: withoutNodes(doc.content, (node) => isMediaNode(node) && !known.has(node.attrs?.mediaId as string)),
				};
	return { doc: cleaned, leftOut, outside };
}

/** The title of an entry and the metadata key it was read from (`null` for a text file's `title`, which is not in the metadata). */
const titleOf = (entry: SourceEntry, names: readonly string[]): { title: string; key: string | null } | null => {
	if (entry.title?.trim()) return { title: entry.title.trim(), key: null };
	for (const name of names) {
		const value = entry.metadata[name];
		if (typeof value === "string" && value.trim()) return { title: value.trim(), key: name };
	}
	return null;
};

/**
 * Decides, for every entry of an archive, whether it is imported and where it goes. Nothing is written. An entry is skipped, each with its reason, when
 * its collection has no target (an item collection, a name this site lacks, or the person's choice), its language is not one of the site's, it has no body
 * or title, its slug is taken (in the site, or by another entry of the archive), or it is a translation whose source is not imported.
 */
export async function planImport(
	host: ImportHost,
	source: ImportSource,
	mapping: ImportMapping = {},
): Promise<ImportPlan> {
	const { site } = host;
	const targets = site.DOCUMENT_COLLECTIONS.map((name) => ({
		name,
		label: site.COLLECTION_DEFINITIONS[name]?.label ?? name,
	}));
	for (const [name, target] of Object.entries(mapping)) {
		if (target !== null && !site.isDocumentCollection(target))
			throw importNotice("import.mapping.invalid", { collection: name });
	}

	// Archive collections and their targets.
	const names = [...new Set(source.entries.map((entry) => entry.collection))].sort();
	const collections: PlannedCollection[] = names.map((name) => {
		const entries = source.entries.filter((entry) => entry.collection === name).length;
		if (Object.hasOwn(mapping, name)) {
			const chosen = mapping[name] ?? null;
			return chosen === null
				? { name, entries, target: null, skipped: { code: "skipped_by_choice" } }
				: { name, entries, target: chosen, skipped: null };
		}
		if (site.isDocumentCollection(name)) return { name, entries, target: name, skipped: null };
		return {
			name,
			entries,
			target: null,
			skipped: site.isItemCollection(name)
				? { code: "item_collection", params: { collection: name } }
				: { code: "no_collection", params: { collection: name } },
		};
	});
	const targetOf = (collection: string) => collections.find((item) => item.name === collection);

	const registry = await host.formats();
	const slugsInPlan = new Set<string>();
	const planned = new Map<string, PlannedEntry>();
	const skipped = (entry: SourceEntry, skip: ImportReason, target: string | null = null): PlannedEntry => ({
		source: entry,
		target,
		// A skipped entry still shows its title, as far as the archive says it.
		title: titleOf(entry, ["title", "name"])?.title ?? null,
		slug: entry.slug,
		skip,
		notes: [],
		doc: null,
		readIssues: [],
		outsideImages: 0,
		keptLinks: 0,
		titleKey: null,
	});

	/** Is a slug free in a collection and language, in the site and among the entries already accepted? Records the ones asked about. */
	const slugCheck = async (target: string, locale: string, slug: string): Promise<ImportReason | null> => {
		const key = `${target}|${locale}|${slug}`;
		if (slugsInPlan.has(key)) return { code: "slug_repeated", params: { slug } };
		if ((await host.store().slugsInUse({ collection: target, locale, slugs: [slug] })).has(slug))
			return { code: "slug_exists", params: { slug } };
		slugsInPlan.add(key);
		return null;
	};

	const accept = async (entry: SourceEntry, target: string, sourceOf?: PlannedEntry): Promise<PlannedEntry> => {
		const notes: ImportReason[] = [];
		const titleName = site.titleField(target).name;
		const found = titleOf(entry, [titleName, "title", "name"]);
		if (!found && !entry.slug) return skipped(entry, { code: "no_title" }, target);
		const title = found?.title ?? (entry.slug as string);
		if (!found) notes.push({ code: "title_from_slug" });
		// A translation without a slug of its own takes its source's.
		const slug = entry.slug ?? sourceOf?.slug ?? null;
		if (slug) {
			const conflict = await slugCheck(target, entry.locale, slug);
			if (conflict) return skipped(entry, conflict, target);
		}
		let doc: StoredDocument;
		let readIssues: readonly Issue[] = [];
		const body = entry.body;
		if (!body) return skipped(entry, { code: "no_body" }, target);
		if (body.kind === "doc") doc = body.doc;
		else {
			const read = await importText(site, registry, body.format, body.text, { locale: entry.locale });
			doc = read.doc;
			readIssues = [...read.issues, ...read.warnings];
			if (read.issues.length > 0) notes.push({ code: "body_unparsed", params: { format: body.format } });
		}
		const media = await checkMedia(host, doc);
		if (media.leftOut > 0) notes.push({ code: "images_left_out", params: { count: media.leftOut } });
		return {
			source: entry,
			target,
			title,
			slug,
			skip: null,
			notes,
			doc: media.doc,
			readIssues,
			outsideImages: media.leftOut + media.outside,
			keptLinks: 0,
			titleKey: found?.key ?? null,
		};
	};

	const reasonFor = (entry: SourceEntry): ImportReason | null => {
		if (entry.problem) return entry.problem;
		const collection = targetOf(entry.collection);
		if (collection?.skipped) return collection.skipped;
		if (!site.isLocale(entry.locale)) return { code: "locale_unknown", params: { locale: entry.locale } };
		return null;
	};

	// Sources first: a translation is imported only when its source is.
	for (const entry of source.entries.filter((item) => item.isSource)) {
		const reason = reasonFor(entry);
		const target = targetOf(entry.collection)?.target ?? null;
		if (reason || !target) {
			planned.set(
				entry.key,
				skipped(entry, reason ?? { code: "no_collection", params: { collection: entry.collection } }, target),
			);
			continue;
		}
		if (entry.locale !== site.DEFAULT_LOCALE) {
			planned.set(entry.key, skipped(entry, { code: "locale_not_default", params: { locale: entry.locale } }, target));
			continue;
		}
		planned.set(entry.key, await accept(entry, target));
	}
	const sourceOfGroup = (group: string) =>
		source.entries.filter((item) => item.group === group && item.isSource).map((item) => planned.get(item.key));
	for (const entry of source.entries.filter((item) => !item.isSource)) {
		const reason = reasonFor(entry);
		const origin = sourceOfGroup(entry.group).find((item) => item?.skip === null);
		if (reason) {
			planned.set(entry.key, skipped(entry, reason, targetOf(entry.collection)?.target ?? null));
		} else if (!origin?.target) {
			const missing = sourceOfGroup(entry.group).length === 0;
			planned.set(entry.key, skipped(entry, { code: missing ? "source_missing" : "source_skipped" }));
		} else {
			planned.set(entry.key, await accept(entry, origin.target, origin));
		}
	}

	// Links by id that point outside what is imported stay as they are; the preview says how many.
	const imported = new Set(
		[...planned.values()].filter((item) => item.skip === null && item.source.isSource).map((item) => item.source.group),
	);
	const entries = source.entries.map((entry): PlannedEntry => {
		const item = planned.get(entry.key) as PlannedEntry;
		if (!item.doc || item.skip) return item;
		const kept = entryLinkIds(item.doc.content).filter((id) => !imported.has(id)).length;
		return kept === 0
			? item
			: { ...item, keptLinks: kept, notes: [...item.notes, { code: "links_kept", params: { count: kept } }] };
	});

	// What the archive holds that is not read, per collection that has a target.
	const fieldsNotImported: FieldsNotImported[] = [];
	for (const collection of collections) {
		if (!collection.target) continue;
		const titleName = site.titleField(collection.target).name;
		const held = new Set<string>();
		for (const item of entries) {
			if (item.source.collection !== collection.name || item.skip) continue;
			for (const name of heldFieldNames(item.source.metadata, item.titleKey)) held.add(name);
		}
		if (held.size === 0) continue;
		const required = site
			.storedFields(collection.target)
			.filter(({ name, field }) => field.required === true && name !== titleName)
			.map(({ name }) => name);
		fieldsNotImported.push({
			collection: collection.name,
			target: collection.target,
			fields: [...held].sort(),
			required,
		});
	}

	return { kind: source.kind, collections, targets, entries, fieldsNotImported, otherFiles: source.otherFiles };
}
