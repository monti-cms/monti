import { type Kysely, sql, type Transaction } from "kysely";
import type { Database } from "../db/schema";
import type { Storage } from "../media/storage";
import { rewriteAllUses } from "../media/uses";
import { type Schema, storedFields } from "../schema/define";
import { schemaHash } from "../schema/plan";

type Db = Kysely<Database> | Transaction<Database>;
type Row = Record<string, unknown>;

/** The backup's format (doc 14). A file of a later format than this is not read. */
export const BACKUP_FORMAT = 1;

/** The text files of a backup or an export, by name: what the zip holds besides the media files. */
export type BackupFiles = Record<string, string>;

export type BackupManifest = {
	format: number;
	/** `backup`: the whole site. `export`: the entries someone picked, with what they point at. */
	kind: "backup" | "export";
	createdAt: string;
	schemaHash: string;
	/** An export's picked entries, by translation group: what it was asked for, apart from what those point at. */
	picked?: string[];
	counts: { entries: number; published: number; folders: number; media: number; templates: number };
};

/** One line of `entries.jsonl`: an entry's working copy, what the site shows of it, and its group's relations. */
export type EntryLine = {
	entry: Row & {
		id: string;
		collection: string;
		translation_group: string;
		locale: string;
		slug: string;
		title: string;
		folder_id: string | null;
		values: Record<string, unknown>;
		doc: unknown;
	};
	published: Row | null;
	links: { from_group: string; field: string; to_group: string; position: number }[];
};

/** A media file of the backup: its row's keys in the storage, each stored in the zip as `media/<key>`. */
export type BackupMedia = { key: string; size: number };

export type Backup = { files: BackupFiles; media: BackupMedia[]; manifest: BackupManifest };

/** A table's rows as JSON, each exactly as `jsonb_populate_record` takes it back. Rows a table makes itself (a generated column) are left out by name. */
async function rowsOf(db: Db, table: string, where = sql<boolean>`true`, without: string[] = []): Promise<Row[]> {
	const columns = without.reduce((row, column) => sql`${row} - ${column}::text`, sql`to_jsonb(t)`);
	const { rows } = await sql<{ row: Row }>`select ${columns} as row from ${sql.id(table)} t where ${where}`.execute(db);
	return rows.map((each) => each.row);
}

const lines = (rows: readonly unknown[]) => rows.map((row) => JSON.stringify(row)).join("\n");

/**
 * The text files of a backup (doc 14): the whole site as it is, without the trash, the activity log, the conversations and the keys. With
 * `groups`, an export: the entries of those translation groups, the entries their relations point at (so an import elsewhere finds them by
 * address), their folders and the files they use, and none of the site-wide files.
 */
export async function readBackup(db: Db, schema: Schema, now: Date, groups?: readonly string[]): Promise<Backup> {
	const picked = groups === undefined ? null : [...groups];
	const entryRows = (await rowsOf(
		db,
		"entries",
		picked === null
			? sql<boolean>`t.trashed_at is null`
			: picked.length === 0
				? sql<boolean>`false`
				: sql<boolean>`t.trashed_at is null and (t.translation_group in (${sql.join(picked)})
					or t.translation_group in (select to_group from entry_links where from_group in (${sql.join(picked)})))`,
		["body_text"],
	)) as EntryLine["entry"][];
	const ids = new Set(entryRows.map((row) => row.id));
	const groupIds = new Set(entryRows.map((row) => row.translation_group));
	const published = new Map(
		(await rowsOf(db, "entry_published"))
			.filter((row) => ids.has(String(row.entry_id)))
			.map((row) => [row.entry_id, row]),
	);
	const links = (await rowsOf(db, "entry_links")).filter(
		(row) => groupIds.has(String(row.from_group)) && groupIds.has(String(row.to_group)),
	) as EntryLine["links"];
	const entries: EntryLine[] = entryRows
		.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id))
		.map((entry) => ({
			entry,
			published: published.get(entry.id) ?? null,
			links: links.filter((link) => link.from_group === entry.translation_group),
		}));

	const allFolders = await rowsOf(db, "folders", sql<boolean>`t.trashed_at is null`);
	const mediaRows = await rowsOf(db, "media", sql<boolean>`t.trashed_at is null`);
	let folders = allFolders;
	let media = mediaRows;
	if (picked !== null) {
		const used = new Set(
			(await rowsOf(db, "media_uses"))
				.filter((row) => ids.has(String(row.entry_id)))
				.map((row) => String(row.media_id)),
		);
		media = mediaRows.filter((row) => used.has(String(row.id)));
		// The picked entries' folders and the files' folders, each with the folders it stands in.
		const byId = new Map(allFolders.map((row) => [String(row.id), row]));
		const kept = new Set<string>();
		for (const start of [
			...entryRows.map((row) => row.folder_id),
			...media.map((row) => row.folder_id as string | null),
		])
			for (let at = start; at && byId.has(at) && !kept.has(at); at = (byId.get(at)?.parent_id as string | null) ?? null)
				kept.add(at);
		folders = allFolders.filter((row) => kept.has(String(row.id)));
	}
	const whole = picked === null;
	const paths = whole
		? [
				...(await rowsOf(db, "old_paths"))
					.filter((row) => ids.has(String(row.entry_id)))
					.map((row) => ({ kind: "old", ...row })),
				...(await rowsOf(db, "reserved_paths")).map((row) => ({ kind: "reserved", ...row })),
			]
		: [];
	const templates = whole ? await rowsOf(db, "templates") : [];
	// What a translation saw of its source, by hash: for an export, only the blocks the entries here still name.
	const named = whole ? "" : JSON.stringify(entries);
	const sourceBlocks = (await rowsOf(db, "source_blocks")).filter((row) => whole || named.includes(String(row.hash)));
	const adminValues = whole
		? {
				collections: await rowsOf(db, "collection_admin_values"),
				settings: await rowsOf(db, "monti_settings"),
			}
		: { collections: [], settings: [] };

	const manifest: BackupManifest = {
		format: BACKUP_FORMAT,
		kind: whole ? "backup" : "export",
		createdAt: now.toISOString(),
		schemaHash: schemaHash(schema),
		...(picked === null ? {} : { picked }),
		counts: {
			entries: entries.length,
			published: published.size,
			folders: folders.length,
			media: media.length,
			templates: templates.length,
		},
	};
	return {
		manifest,
		files: {
			"manifest.json": JSON.stringify(manifest, null, "\t"),
			"schema.json": JSON.stringify(schema, null, "\t"),
			"entries.jsonl": lines(entries),
			"folders.jsonl": lines(folders),
			"media.jsonl": lines(media),
			"paths.jsonl": lines(paths),
			"templates.jsonl": lines(templates),
			"source-blocks.jsonl": lines(sourceBlocks),
			"admin-values.json": JSON.stringify(adminValues, null, "\t"),
		},
		media: media.flatMap((row) =>
			[row.original_key, row.web_key]
				.filter((key): key is string => typeof key === "string" && key !== "")
				.map((key) => ({ key, size: Number(row.size) })),
		),
	};
}

/** The lines of a `.jsonl` file as values; `null` when a line is no JSON. */
export function readLines<Line>(text: string | undefined): Line[] | null {
	try {
		return (text ?? "")
			.split("\n")
			.filter((line) => line.trim() !== "")
			.map((line) => JSON.parse(line) as Line);
	} catch {
		return null;
	}
}

/** A backup's manifest, when the text is one this version reads. */
export function readManifest(text: string | undefined): BackupManifest | null {
	try {
		const manifest = JSON.parse(text ?? "") as Partial<BackupManifest>;
		return typeof manifest.format === "number" && manifest.format <= BACKUP_FORMAT && manifest.counts
			? (manifest as BackupManifest)
			: null;
	} catch {
		return null;
	}
}

/** What stops a restore (doc 14): nothing is written while one is left. */
export type RestoreProblem =
	| { problem: "notEmpty" }
	| { problem: "unreadable"; file: string }
	| { problem: "unknownCollection"; collection: string; entries: number }
	| { problem: "unknownField"; collection: string; field: string; entries: number }
	| { problem: "sameAddress"; collection: string; locale: string; slug: string; entries: number };

export type Restored = { entries: number; folders: number; media: number; files: number; templates: number };

/** Puts rows back as they were read: every column from the row's JSON, by the table's own types. */
async function insertRows(db: Db, table: string, rows: readonly Row[]): Promise<void> {
	for (const row of rows) {
		const columns = sql.join(Object.keys(row).map((column) => sql.id(column)));
		await sql`insert into ${sql.id(table)} (${columns})
			select ${columns} from jsonb_populate_record(null::${sql.id(table)}, ${JSON.stringify(row)}::jsonb)`.execute(db);
	}
}

/**
 * Restores a backup into an empty database (doc 14, `monti restore`): states, dates, addresses, old addresses, folders and media as they were.
 * The whole file is checked first; with one problem nothing is written and the problems are the answer. `file` reads a file of the backup
 * (its text files, and `media/<key>` for a backup that carries the files); the files go up to the storage before the rows are written, so a
 * row never names a file that is not there.
 */
export async function restoreBackup(
	db: Kysely<Database>,
	schema: Schema,
	storage: Storage | null,
	file: (name: string) => Promise<Uint8Array | null>,
): Promise<{ problems: RestoreProblem[] } | { restored: Restored }> {
	const text = async (name: string) => {
		const bytes = await file(name);
		return bytes ? new TextDecoder().decode(bytes) : undefined;
	};
	const problems: RestoreProblem[] = [];
	const any = await db.selectFrom("entries").select("id").limit(1).executeTakeFirst();
	if (any) problems.push({ problem: "notEmpty" });
	if (!readManifest(await text("manifest.json")))
		return { problems: [...problems, { problem: "unreadable", file: "manifest.json" }] };
	const read = async <Line>(name: string) => {
		const found = readLines<Line>(await text(name));
		if (found === null) problems.push({ problem: "unreadable", file: name });
		return found ?? [];
	};
	const entries = await read<EntryLine>("entries.jsonl");
	const folders = await read<Row>("folders.jsonl");
	const media = await read<Row>("media.jsonl");
	const paths = await read<Row & { kind: string }>("paths.jsonl");
	const templates = await read<Row>("templates.jsonl");
	const sourceBlocks = await read<Row>("source-blocks.jsonl");
	let adminValues: { collections: Row[]; settings: Row[] } = { collections: [], settings: [] };
	try {
		adminValues = JSON.parse((await text("admin-values.json")) ?? '{"collections":[],"settings":[]}');
	} catch {
		problems.push({ problem: "unreadable", file: "admin-values.json" });
	}

	// A field the site does not have, a collection it does not have, two entries at one address: each with how many entries.
	const count = new Map<string, RestoreProblem & { entries: number }>();
	const add = (key: string, problem: RestoreProblem & { entries: number }) => {
		const found = count.get(key);
		if (found) found.entries += 1;
		else count.set(key, problem);
	};
	const addresses = new Map<string, number>();
	for (const { entry } of entries) {
		const collection = schema.collections[entry.collection];
		if (!collection) {
			add(`c:${entry.collection}`, { problem: "unknownCollection", collection: entry.collection, entries: 1 });
			continue;
		}
		const fields = storedFields(collection);
		for (const field of Object.keys(entry.values ?? {}))
			if (!fields[field])
				add(`f:${entry.collection}:${field}`, {
					problem: "unknownField",
					collection: entry.collection,
					field,
					entries: 1,
				});
		if (entry.slug !== "") {
			const address = `${entry.collection}\n${entry.locale}\n${entry.slug}`;
			addresses.set(address, (addresses.get(address) ?? 0) + 1);
		}
	}
	for (const [address, entriesAt] of addresses)
		if (entriesAt > 1) {
			const [collection = "", locale = "", slug = ""] = address.split("\n");
			count.set(`a:${address}`, { problem: "sameAddress", collection, locale, slug, entries: entriesAt });
		}
	problems.push(...count.values());
	if (problems.length > 0) return { problems };

	// The files first: a backup taken with them carries each under `media/<key>`.
	let files = 0;
	if (storage)
		for (const row of media)
			for (const key of [row.original_key, row.web_key]) {
				if (typeof key !== "string" || key === "") continue;
				const bytes = await file(`media/${key}`);
				if (!bytes) continue;
				await storage.put(key, bytes, { mime: String(row.mime) });
				files += 1;
			}

	await db.transaction().execute(async (trx) => {
		// A folder after the folder it stands in.
		const placed = new Set<string>();
		let left = folders;
		while (left.length > 0) {
			const now = left.filter((row) => row.parent_id === null || placed.has(String(row.parent_id)));
			// A folder whose parent is not in the file (it was in the trash) stands at the top.
			const batch: Row[] = now.length > 0 ? now : left.map((row) => ({ ...row, parent_id: null }));
			await insertRows(trx, "folders", batch);
			for (const row of batch) placed.add(String(row.id));
			left = left.filter((row) => !placed.has(String(row.id)));
		}
		await insertRows(trx, "media", media);
		await insertRows(trx, "source_blocks", sourceBlocks);
		await insertRows(
			trx,
			"entries",
			entries.map((line) => line.entry),
		);
		await insertRows(
			trx,
			"entry_published",
			entries.flatMap((line) => (line.published ? [line.published] : [])),
		);
		const seen = new Set<string>();
		await insertRows(
			trx,
			"entry_links",
			entries
				.flatMap((line) => line.links)
				.filter((link) => {
					const key = `${link.from_group}\n${link.field}\n${link.to_group}`;
					return seen.has(key) ? false : Boolean(seen.add(key));
				}),
		);
		const withoutKind = ({ kind: _kind, ...row }: Row & { kind: string }) => row;
		await insertRows(trx, "old_paths", paths.filter((row) => row.kind === "old").map(withoutKind));
		await insertRows(trx, "reserved_paths", paths.filter((row) => row.kind === "reserved").map(withoutKind));
		await insertRows(trx, "templates", templates);
		// The admin's values the database already has (a row the site's first start made) give way to the backup's.
		for (const row of adminValues.collections) {
			await trx.deleteFrom("collection_admin_values").where("collection", "=", String(row.collection)).execute();
			await insertRows(trx, "collection_admin_values", [row]);
		}
		for (const row of adminValues.settings) {
			await trx.deleteFrom("monti_settings").where("id", "=", String(row.id)).execute();
			await insertRows(trx, "monti_settings", [row]);
		}
		// Which entry uses which file is worked out from the entries, as after any change of the schema.
		await rewriteAllUses(trx, schema);
	});
	return {
		restored: {
			entries: entries.length,
			folders: folders.length,
			media: media.length,
			files,
			templates: templates.length,
		},
	};
}
