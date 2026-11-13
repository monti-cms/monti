import { checkDoc } from "../body/blocks";
import { type Block, type Doc, DocShape, newBlockId } from "../body/doc";
import { randomUUID } from "../bytes";
import { slugify } from "../entries/paths";
import { CheckError } from "../errors";
import { isEmptyValue } from "../json";
import { mediaValueOf } from "../media/value";
import type { AnyOperation, Message, OperationContext } from "../operation";
import type { Importer } from "../plugins/define";
import { findOrCreateItem, generateUniqueSlug } from "../relations/sync";
import { type StoredField, storedFields } from "../schema/define";
import { type EntryLine, readLines, readManifest } from "./backup";

/** A text file of an upload, as the browser read it out of the zip (or the one file that was chosen). */
export type ImportFile = { name: string; text: string };

export type ImportInput = {
	collection: string;
	files: ImportFile[];
	/** The names of the upload's other files (pictures): what a body or a value may point at. */
	has: string[];
	/** A key of the files (a front matter key, a field of the file's site) → the field it goes to here; `null` leaves it out. */
	mapping?: Record<string, string | null>;
	/** A picture of the upload (its name in it, or its id in the site the file came from) → the file it became in this site's library. */
	media?: Record<string, string>;
};

/** One entry found in the upload, before it is fitted to this site. */
type Candidate = {
	/** Where it came from: the file's name, or for a Monti file the entry's title. */
	source: string;
	locale: string;
	/** Entries of one group are each other's translations. */
	group: string;
	title: string;
	slug: string;
	/** Its values by the upload's own keys. */
	raw: Record<string, unknown>;
	doc: Doc | null;
	/** The names of the folders it stood in, outermost first. */
	folder: string[];
	/** Components the importer did not know, by name. */
	unknown: string[];
	/** For a Monti file: the entry as it was. */
	line?: EntryLine;
};

type Upload =
	| { kind: "unreadable"; reason: Message }
	| {
			kind: "monti" | "files";
			candidates: Candidate[];
			/** A Monti file's every entry, for what the relations point at. */
			lines: EntryLine[];
			/** The file's own name for a file of the site it came from, by id. */
			mediaNames: Map<string, string>;
	  };

const extension = (name: string) => /\.[^./]+$/.exec(name)?.[0].toLowerCase() ?? "";
const baseName = (name: string) => (name.split("/").at(-1) ?? name).replace(/\.[^.]+$/, "");

/** The text of a body, block after block: what "the same body" is told by. */
function docText(doc: Doc | null): string {
	const out: string[] = [];
	const visit = (blocks: Block[]) => {
		for (const block of blocks) {
			const words = (block.content ?? []).map((inline) => (inline.type === "text" ? inline.text : "")).join("");
			if (words) out.push(words);
			const rows = block.attrs?.rows;
			if (Array.isArray(rows)) out.push(JSON.stringify(rows));
			if (block.children) visit(block.children);
		}
	};
	visit(doc?.blocks ?? []);
	return out.join("\n").trim();
}

const firstHeading = (doc: Doc | null) =>
	(doc?.blocks.find((block) => block.type === "heading")?.content ?? [])
		.map((inline) => (inline.type === "text" ? inline.text : ""))
		.join("")
		.trim();

/** Reads the upload: a Monti backup or export, or files a plugin's importer reads. Nothing is written. */
async function readUpload(ctx: OperationContext, input: ImportInput): Promise<Upload> {
	const schema = ctx.site.schema();
	const byName = new Map(input.files.map((file) => [file.name, file.text]));
	if (byName.has("manifest.json") || byName.has("entries.jsonl")) {
		const lines = readManifest(byName.get("manifest.json")) ? readLines<EntryLine>(byName.get("entries.jsonl")) : null;
		if (lines === null) return { kind: "unreadable", reason: { key: "data.unreadable" } };
		const folders = new Map(
			(readLines<{ id: string; parent_id: string | null; name: string }>(byName.get("folders.jsonl")) ?? []).map(
				(row) => [row.id, row],
			),
		);
		const pathOf = (id: string | null) => {
			const names: string[] = [];
			for (
				let at = id ? folders.get(id) : undefined;
				at && names.length < 32;
				at = at.parent_id ? folders.get(at.parent_id) : undefined
			)
				names.unshift(at.name);
			return names;
		};
		const locales = new Set(schema.locales.list.map((locale) => locale.code));
		const mediaNames = new Map(
			(readLines<{ id: string; original_key: string }>(byName.get("media.jsonl")) ?? []).map((row) => [
				row.id,
				`media/${row.original_key}`,
			]),
		);
		return {
			kind: "monti",
			lines,
			mediaNames,
			candidates: lines
				.filter((line) => line.entry.collection === input.collection && locales.has(line.entry.locale))
				.map((line) => ({
					source: line.entry.title || line.entry.slug || line.entry.id,
					locale: line.entry.locale,
					group: line.entry.translation_group,
					title: line.entry.title,
					slug: line.entry.slug,
					raw: line.entry.values ?? {},
					doc: DocShape.safeParse(line.entry.doc).success ? (line.entry.doc as Doc) : null,
					folder: pathOf(line.entry.folder_id),
					unknown: [],
					line,
				})),
		};
	}
	const importers = ctx.site.plugins.flatMap((plugin) => plugin.importers);
	const readerOf = (name: string): Importer | undefined =>
		importers.find((importer) => importer.extensions.some((each) => each.toLowerCase() === extension(name)));
	const readable = input.files.filter((file) => readerOf(file.name));
	if (readable.length === 0) {
		// The one format everyone brings is the one a plugin reads (doc 14, principle 2): it is named.
		const markdown = [...input.files.map((file) => file.name), ...input.has].some((name) =>
			[".md", ".mdx"].includes(extension(name)),
		);
		return { kind: "unreadable", reason: { key: markdown ? "data.needsMdx" : "data.unreadable" } };
	}
	const candidates: Candidate[] = [];
	for (const file of readable) {
		let read: Awaited<ReturnType<Importer["read"]>>;
		try {
			read = await (readerOf(file.name) as Importer).read(file);
		} catch {
			continue;
		}
		const doc = DocShape.safeParse(read.doc).success ? (read.doc as Doc) : null;
		const title = typeof read.values.title === "string" ? read.values.title.trim() : "";
		candidates.push({
			source: file.name,
			locale: schema.locales.source,
			group: randomUUID(),
			title: title || firstHeading(doc) || baseName(file.name),
			slug: typeof read.values.slug === "string" ? read.values.slug : baseName(file.name),
			raw: read.values,
			doc,
			folder: [],
			unknown: read.unknown ?? [],
		});
	}
	if (candidates.length === 0) return { kind: "unreadable", reason: { key: "data.unreadable" } };
	return { kind: "files", candidates, lines: [], mediaNames: new Map() };
}

/** The keys of the upload that can go to a field, each with a value to show and where it goes unless a person says otherwise. */
function keysOf(
	upload: Extract<Upload, { kind: "monti" | "files" }>,
	fields: Record<string, StoredField>,
	labels: Record<string, string>,
) {
	const keys = new Map<string, unknown>();
	for (const candidate of upload.candidates)
		for (const [key, value] of Object.entries(candidate.raw))
			if (!keys.has(key) && !isEmptyValue(value)) keys.set(key, value);
	const byLabel = new Map(Object.entries(labels).map(([field, label]) => [label.toLowerCase(), field]));
	const suggested = (key: string): string | null => {
		const lower = key.toLowerCase();
		const field = Object.keys(fields).find((name) => name.toLowerCase() === lower) ?? byLabel.get(lower);
		return field ?? null;
	};
	const example = (value: unknown) => {
		const text = typeof value === "string" ? value : Array.isArray(value) ? value.join(", ") : JSON.stringify(value);
		return text.length > 60 ? `${text.slice(0, 59)}…` : text;
	};
	return [...keys].map(([key, value]) => ({ key, example: example(value), field: suggested(key) }));
}

type Fitted = {
	candidate: Candidate;
	title: string;
	slug: string;
	values: Record<string, unknown>;
	doc: Doc | null;
	/** Pictures the body or a value pointed at that the library does not have: each is left out. */
	missingImages: number;
};

/**
 * Finds the item a relation value means, or says it would be new. `inspect` only counts; `import` makes it. `null`: there is no such item and
 * none can be made (the collection it points at holds documents, which are written, not made from a name).
 */
type ItemOf = (collection: string, item: { title: string; slug?: string }) => Promise<string | null>;

/** What the library has of the pictures an upload names: by the name or old id they were given under, the id here. */
type MediaOf = (name: string) => string | null;

/** A body with its pictures and files pointed at this site's library; what the library does not have is taken out, a picture as its words. */
function fitDoc(doc: Doc | null, mediaOf: MediaOf, count: { missing: number }): Doc | null {
	if (!doc) return null;
	const fitBlocks = (blocks: Block[]): Block[] =>
		blocks.flatMap((block): Block[] => {
			if (block.type === "image" || block.type === "file") {
				const { src, ...attrs } = (block.attrs ?? {}) as Record<string, unknown>;
				const named = typeof src === "string" ? src : typeof attrs.media === "string" ? attrs.media : "";
				const media = named ? mediaOf(named) : null;
				if (media) return [{ ...block, attrs: { ...attrs, media } }];
				count.missing += 1;
				// What the picture said stays as a line of words; an address of its own stays as a link.
				const words = [attrs.alt, attrs.caption, typeof src === "string" ? src : ""].find(
					(each): each is string => typeof each === "string" && each !== "",
				);
				if (!words) return [];
				const link = typeof src === "string" && /^https?:\/\//.test(src) ? [{ type: "link", href: src }] : undefined;
				return [
					{
						id: newBlockId(),
						type: "paragraph",
						content: [{ type: "text", text: words, ...(link ? { marks: link } : {}) }],
					},
				];
			}
			return [block.children ? { ...block, children: fitBlocks(block.children) } : block];
		});
	return { type: "doc", blocks: fitBlocks(doc.blocks) };
}

/** Fits a found entry to this collection: its mapped values in the shapes the fields hold. */
async function fitEntry(
	ctx: OperationContext,
	collection: string,
	upload: Extract<Upload, { kind: "monti" | "files" }>,
	candidate: Candidate,
	mapping: Record<string, string | null>,
	itemOf: ItemOf,
	mediaOf: MediaOf,
): Promise<Fitted> {
	const fields = storedFields(ctx.site.schema().collections[collection]);
	const count = { missing: 0 };
	const values: Record<string, unknown> = {};
	let { title, slug } = candidate;
	const words = (value: unknown) =>
		typeof value === "string"
			? value
			: Array.isArray(value)
				? value.map(String).join(", ")
				: value == null
					? ""
					: String(value);
	const list = (value: unknown): unknown[] =>
		Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
	for (const [key, raw] of Object.entries(candidate.raw)) {
		const field = mapping[key];
		if (!field || isEmptyValue(raw)) continue;
		if (field === "title") {
			title = words(raw).trim() || title;
			continue;
		}
		if (field === "slug") {
			slug = words(raw);
			continue;
		}
		const definition = fields[field];
		if (!definition) continue;
		if (definition.kind === "text") values[field] = words(raw);
		else if (definition.kind === "select") {
			const picked = list(raw)
				.map(String)
				.filter((option) => definition.options.includes(option));
			if (definition.many && picked.length > 0) values[field] = picked;
			else if (!definition.many && picked[0] !== undefined) values[field] = picked[0];
		} else if (definition.kind === "media") {
			// A file by its name in the upload (a front matter path), or by the id it had in the site the file came from.
			const named = typeof raw === "string" ? raw : (mediaValueOf(raw)?.media ?? "");
			const media = named ? mediaOf(named) : null;
			if (media) values[field] = typeof raw === "object" && raw !== null ? { ...(raw as object), media } : { media };
			else count.missing += 1;
		} else if (definition.kind === "relation" && definition.via === undefined) {
			const groups: string[] = [];
			for (const each of list(raw)) {
				// A Monti file names the item by its group there: its line in the same file says what it is called and where it is.
				const line = upload.lines.find((other) => other.entry.translation_group === each);
				const item = line ? { title: line.entry.title, slug: line.entry.slug } : { title: words(each).trim() };
				if (upload.kind === "monti" && !line) continue;
				if (item.title === "") continue;
				const group = await itemOf(definition.to, item);
				if (group) groups.push(group);
			}
			if (definition.many && groups.length > 0) values[field] = [...new Set(groups)];
			else if (!definition.many && groups[0] !== undefined) values[field] = groups[0];
		}
	}
	return { candidate, title, slug, values, doc: fitDoc(candidate.doc, mediaOf, count), missingImages: count.missing };
}

/** The pictures a body and the mapped values name by a path of the upload: what the browser sends up before the import. */
function namedPictures(
	upload: Extract<Upload, { kind: "monti" | "files" }>,
	mapping: Record<string, string | null>,
	fields: Record<string, StoredField>,
	leftOut: (candidate: Candidate) => boolean,
) {
	const names = new Set<string>();
	const visit = (blocks: Block[]) => {
		for (const block of blocks) {
			if (block.type === "image" || block.type === "file") {
				const named = block.attrs?.src ?? block.attrs?.media;
				if (typeof named === "string" && named !== "") names.add(named);
			}
			if (block.children) visit(block.children);
		}
	};
	for (const candidate of upload.candidates) {
		if (leftOut(candidate)) continue;
		visit(candidate.doc?.blocks ?? []);
		for (const [key, raw] of Object.entries(candidate.raw)) {
			const field = mapping[key];
			if (!field || fields[field]?.kind !== "media") continue;
			const named = typeof raw === "string" ? raw : (mediaValueOf(raw)?.media ?? "");
			if (named) names.add(named);
		}
	}
	return [...names];
}

/** A path as a body writes it (`./images/a.png`, `/images/a.png`) against the upload's file names: the file it means, when the upload has it. */
function inUpload(name: string, has: readonly string[], from: string): string | null {
	if (/^[a-z]+:\/\//i.test(name)) return null;
	const clean = decodeURIComponent(name.split(/[?#]/)[0] ?? "").replace(/^\.?\//, "");
	const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
	const parts: string[] = [];
	for (const part of `${dir}${clean}`.split("/")) {
		if (part === "..") parts.pop();
		else if (part !== "." && part !== "") parts.push(part);
	}
	const exact = parts.join("/");
	return has.find((each) => each === exact) ?? has.find((each) => each.endsWith(`/${clean}`) || each === clean) ?? null;
}

export type Inspected =
	| { kind: "unreadable"; reason: Message }
	| {
			kind: "monti" | "files";
			/** How many entries the upload has for this collection. */
			found: number;
			/** Of them, the ones whose body the collection already has: they are left out. */
			same: number;
			/** The ones that cannot be imported: a body this site cannot hold, or a translation whose source is not in the upload. */
			unfit: number;
			keys: { key: string; example: string; field: string | null; creates: number; createsIn: string | null }[];
			/** The collection's fields a key can go to. */
			/** `role` marks the two every collection has (the entry's title and its address): a screen calls them by its own words. */
			fields: { name: string; label: string; kind: string; role?: "title" | "slug" }[];
			/** Pictures the upload carries that the entries name: sent up first, each then given to the import by this name. */
			pictures: { name: string; file: string }[];
			/** Pictures named that are neither in the upload nor in the library. */
			missingPictures: number;
			/** Components no block is known for, with how many entries have each: kept as written, a to-do on those entries. */
			unknown: { name: string; entries: number }[];
			/** Required fields the entries would not fill, with how many entries. */
			emptyRequired: { field: string; label: string; entries: number }[];
	  };

export type Imported = {
	imported: number;
	skipped: number;
	/** New items made for relation values, and pictures taken into the library's use. */
	items: number;
	/** Entries whose address was taken, with the one each got. */
	renamed: { id: string; title: string; from: string; to: string }[];
	ids: string[];
};

/** Whether an entry is one the collection already has: the same title over the same body (with no body, the same title alone is not enough). */
const sameAs = (bodies: ReadonlySet<string>, candidate: Candidate) => {
	const text = docText(candidate.doc);
	return text !== "" && bodies.has(`${candidate.title}\n${text}`);
};

async function prepare(ctx: OperationContext, input: ImportInput) {
	const schema = ctx.site.schema();
	const collection = schema.collections[input.collection];
	if (!collection) throw new CheckError({ key: "collections.unknown", values: { collection: input.collection } });
	const upload = await readUpload(ctx, input);
	if (upload.kind === "unreadable") return { unreadable: upload.reason } as const;
	const fields = storedFields(collection);
	const adminValues = await ctx.db
		.selectFrom("collection_admin_values")
		.select("values")
		.where("collection", "=", input.collection)
		.executeTakeFirst();
	const labels = Object.fromEntries(
		Object.entries(
			((adminValues?.values as { fields?: Record<string, { label?: string }> } | undefined)?.fields ?? {}) as Record<
				string,
				{ label?: string }
			>,
		).flatMap(([field, each]) => (each.label ? [[field, each.label]] : [])),
	);
	const keys = keysOf(upload, fields, labels);
	// A Monti file's keys are fields already: each goes to the field of its name, unless a person says otherwise.
	const mapping: Record<string, string | null> = Object.fromEntries(keys.map((key) => [key.key, key.field]));
	for (const [key, field] of Object.entries(input.mapping ?? {}))
		if (field === null || field === "title" || field === "slug" || fields[field]) mapping[key] = field;
	const existing = await ctx.db
		.selectFrom("entries")
		.select(["title", "slug", "doc"])
		.where("collection", "=", input.collection)
		.where("trashed_at", "is", null)
		.execute();
	const bodies = new Set(existing.map((row) => `${row.title}\n${docText(row.doc as Doc | null)}`));
	const sourceOf = new Map(
		upload.candidates
			.filter((candidate) => candidate.locale === schema.locales.source)
			.map((candidate) => [candidate.group, candidate]),
	);
	/**
	 * Whether an entry of the upload stays out, and why: a translation whose source is not in the upload has nothing to be a translation of
	 * and a body this site cannot hold is not an entry (`unfit`); one the collection already has is skipped (`same`). A translation goes
	 * the way of its source.
	 */
	const outOf = (candidate: Candidate): "unfit" | "same" | null => {
		const first = sourceOf.get(candidate.group);
		if (!first || (first.doc && checkDoc(first.doc, ctx.site.kit, first.doc).length > 0)) return "unfit";
		return sameAs(bodies, first) ? "same" : null;
	};
	// The pictures the entries that go in name; among them the library's own files, when the upload came from this site.
	const named = namedPictures(upload, mapping, fields, (candidate) => outOf(candidate) !== null);
	const here = new Set(
		named.length === 0
			? []
			: (
					await ctx.db
						.selectFrom("media")
						.select("id")
						.where("id", "in", named)
						.where("trashed_at", "is", null)
						.execute()
				).map((row) => row.id),
	);
	const given = input.media ?? {};
	const mediaOf: MediaOf = (name) => given[name] ?? (here.has(name) ? name : null);
	return { unreadable: null, upload, fields, labels, keys, mapping, named, mediaOf, outOf, given, here } as const;
}

/** What the upload holds for a collection and what importing it would do (doc 14, `data.inspect`). Nothing is written. */
export async function inspectUpload(ctx: OperationContext, input: ImportInput): Promise<Inspected> {
	const ready = await prepare(ctx, input);
	if (ready.unreadable !== null) return { kind: "unreadable", reason: ready.unreadable };
	const { upload, fields, labels, keys, mapping, named, mediaOf, outOf, given, here } = ready;
	const creates = new Map<string, Set<string>>();
	const itemOf: ItemOf = async (collection, item) => {
		const target = ctx.site.schema().collections[collection];
		const found = await ctx.db
			.selectFrom("entries")
			.select("translation_group")
			.where("collection", "=", collection)
			.where("locale", "=", ctx.site.schema().locales.source)
			.where((eb) =>
				item.slug ? eb.or([eb("slug", "=", item.slug), eb("title", "=", item.title)]) : eb("title", "=", item.title),
			)
			.where("trashed_at", "is", null)
			.executeTakeFirst();
		if (found) return found.translation_group;
		if (target?.kind !== "item") return null;
		creates.set(collection, (creates.get(collection) ?? new Set()).add(item.title));
		return `new:${item.title}`;
	};
	let same = 0;
	let unfit = 0;
	const unknown = new Map<string, number>();
	const empty = new Map<string, number>();
	for (const candidate of upload.candidates) {
		const out = outOf(candidate);
		if (out === "unfit") unfit += 1;
		if (out === "same") same += 1;
		if (out !== null) continue;
		const fitted = await fitEntry(ctx, input.collection, upload, candidate, mapping, itemOf, mediaOf);
		for (const name of new Set(candidate.unknown)) unknown.set(name, (unknown.get(name) ?? 0) + 1);
		if (candidate.locale === ctx.site.schema().locales.source)
			for (const [field, definition] of Object.entries(fields))
				if (
					definition.required &&
					field !== "title" &&
					field !== "slug" &&
					!definition.under &&
					isEmptyValue(fitted.values[field])
				)
					empty.set(field, (empty.get(field) ?? 0) + 1);
	}
	const pictures = named.flatMap((name) => {
		if (given[name] || here.has(name)) return [];
		// A Monti file carries a picture under its key; other files name it by a path beside themselves.
		const key = upload.mediaNames.get(name);
		const from =
			upload.candidates.find((candidate) => JSON.stringify([candidate.doc, candidate.raw]).includes(name))?.source ??
			"";
		const file = key ? (input.has.includes(key) ? key : null) : inUpload(name, input.has, from);
		return file ? [{ name, file }] : [];
	});
	const sent = new Set(pictures.map((picture) => picture.name));
	return {
		kind: upload.kind,
		found: upload.candidates.length,
		same,
		unfit,
		keys: keys.map((key) => {
			const field = mapping[key.key] ?? null;
			const definition = field ? fields[field] : undefined;
			const to = definition?.kind === "relation" ? definition.to : null;
			return { ...key, field, creates: to ? (creates.get(to)?.size ?? 0) : 0, createsIn: to };
		}),
		fields: [
			{ name: "title", label: labels.title ?? "title", kind: "text", role: "title" as const },
			{ name: "slug", label: labels.slug ?? "slug", kind: "slug", role: "slug" as const },
			...Object.entries(fields)
				.filter(
					([name, definition]) =>
						name !== "title" && name !== "slug" && !(definition.kind === "relation" && definition.via),
				)
				.map(([name, definition]) => ({ name, label: labels[name] ?? name, kind: definition.kind })),
		],
		pictures,
		missingPictures: named.filter((name) => !given[name] && !here.has(name) && !sent.has(name)).length,
		unknown: [...unknown].map(([name, entries]) => ({ name, entries })),
		emptyRequired: [...empty].map(([field, entries]) => ({ field, label: labels[field] ?? field, entries })),
	};
}

/**
 * Imports the upload's entries into a collection as new drafts (doc 14, `data.import`): an entry whose body the collection has is left out,
 * a taken address gets `-2`, a relation value with no item makes one, folders are made by name. `create` is the entry operation that makes
 * an entry, so an imported entry passes what a written one does.
 */
export async function importUpload(ctx: OperationContext, input: ImportInput, create: AnyOperation): Promise<Imported> {
	const ready = await prepare(ctx, input);
	if (ready.unreadable !== null) throw new CheckError(ready.unreadable);
	const { upload, mapping, mediaOf, outOf } = ready;
	const schema = ctx.site.schema();
	const source = schema.locales.source;
	let items = 0;
	const itemOf: ItemOf = async (collection, item) => {
		const found = await ctx.db
			.selectFrom("entries")
			.select("translation_group")
			.where("collection", "=", collection)
			.where("locale", "=", source)
			.where((eb) =>
				item.slug ? eb.or([eb("slug", "=", item.slug), eb("title", "=", item.title)]) : eb("title", "=", item.title),
			)
			.where("trashed_at", "is", null)
			.executeTakeFirst();
		if (found) return found.translation_group;
		if (schema.collections[collection]?.kind !== "item") return null;
		items += 1;
		return findOrCreateItem(ctx, collection, item.title);
	};
	/** The folder a path of names means in this collection, made where it is missing. */
	const folderIds = new Map<string, string>();
	const folderOf = async (names: string[]): Promise<string | null> => {
		let parent: string | null = null;
		for (const [index, name] of names.entries()) {
			const key = names.slice(0, index + 1).join("\n");
			let id: string | undefined = folderIds.get(key);
			if (!id) {
				const found: { id: string } | undefined = await ctx.db
					.selectFrom("folders")
					.select("id")
					.where("collection", "=", input.collection)
					.where("name", "=", name)
					.where("trashed_at", "is", null)
					.where((eb) => (parent === null ? eb("parent_id", "is", null) : eb("parent_id", "=", parent)))
					.executeTakeFirst();
				id = found?.id;
				if (!id) {
					id = randomUUID();
					const last = await ctx.db
						.selectFrom("folders")
						.select((eb) => eb.fn.max("position").as("position"))
						.where("collection", "=", input.collection)
						.executeTakeFirst();
					await ctx.db
						.insertInto("folders")
						.values({
							id,
							collection: input.collection,
							parent_id: parent,
							name,
							position: Number(last?.position ?? -1) + 1,
						})
						.execute();
					ctx.created({ kind: "folder", id });
				}
				folderIds.set(key, id);
			}
			parent = id;
		}
		return parent;
	};

	const out: Imported = { imported: 0, skipped: 0, items: 0, renamed: [], ids: [] };
	const groups = new Map<string, Candidate[]>();
	for (const candidate of upload.candidates)
		groups.set(candidate.group, [...(groups.get(candidate.group) ?? []), candidate]);
	for (const members of groups.values()) {
		const first = members.find((candidate) => candidate.locale === source);
		if (!first || outOf(first) !== null) {
			out.skipped += members.length;
			continue;
		}
		const fitted = await fitEntry(ctx, input.collection, upload, first, mapping, itemOf, mediaOf);
		const wanted = slugify(fitted.slug) || slugify(fitted.title);
		const slug = await generateUniqueSlug(
			ctx.db,
			input.collection,
			source,
			wanted || fitted.title,
			undefined,
			randomUUID(),
		);
		const made = {
			collection: input.collection,
			title: fitted.title,
			slug,
			values: fitted.values,
			...(fitted.doc ? { doc: fitted.doc } : {}),
		};
		await create.check?.(made, ctx, undefined);
		const { id } = (await create.run(made, ctx, undefined)) as { id: string };
		const folder = await folderOf(first.folder);
		if (folder) await ctx.db.updateTable("entries").set({ folder_id: folder }).where("id", "=", id).execute();
		out.imported += 1;
		out.ids.push(id);
		if (wanted !== "" && slug !== wanted) out.renamed.push({ id, title: fitted.title, from: wanted, to: slug });
		const row = await ctx.db
			.selectFrom("entries")
			.select("translation_group")
			.where("id", "=", id)
			.executeTakeFirstOrThrow();
		// Its translations, as they were: the same group, each a draft in its language.
		for (const member of members) {
			if (
				member === first ||
				!member.line ||
				(member.doc && checkDoc(member.doc, ctx.site.kit, member.doc).length > 0)
			) {
				if (member !== first) out.skipped += 1;
				continue;
			}
			const translated = await fitEntry(ctx, input.collection, upload, member, mapping, itemOf, mediaOf);
			const translationId = randomUUID();
			const translationSlug = await generateUniqueSlug(
				ctx.db,
				input.collection,
				member.locale,
				slugify(translated.slug) || translated.title,
				undefined,
				translationId,
			);
			await ctx.db
				.insertInto("entries")
				.values({
					id: translationId,
					collection: input.collection,
					translation_group: row.translation_group,
					locale: member.locale,
					title: translated.title,
					slug: translationSlug,
					folder_id: folder,
					values: JSON.stringify(translated.values),
					doc: translated.doc === null ? null : JSON.stringify(translated.doc),
					translation_seen: JSON.stringify(member.line.entry.translation_seen ?? {}),
					translation_skips: JSON.stringify(member.line.entry.translation_skips ?? []),
				})
				.execute();
			ctx.created({ kind: "entry", id: translationId });
			ctx.emit({
				type: "entry.saved",
				ids: [translationId],
				collection: input.collection,
				locale: member.locale,
				version: 1,
			});
			out.imported += 1;
			out.ids.push(translationId);
		}
	}
	out.items = items;
	return out;
}
