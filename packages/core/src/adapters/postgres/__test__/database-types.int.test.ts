import { readFileSync } from "node:fs";
import path from "node:path";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testSite } from "../../../../test/site";
import { migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * `db/database.ts` is written by hand, so this test is what keeps it true: it reads the declared tables and columns from the source of that file and compares them
 * with `information_schema` of a schema the core migrations just created. A migration that adds, drops, renames or changes a column fails here until the file follows.
 */
const DATABASE_FILE = path.resolve(__dirname, "../db/database.ts");

interface DeclaredColumn {
	/** The column's type as written, without its `| null`. */
	readonly type: string;
	readonly nullable: boolean;
	/** `Generated<T>` (an insert may leave it out) or `GeneratedAlways<T>` (never inserted). */
	readonly generated: boolean;
	/** The `information_schema` data types the declared type can be. */
	readonly dataTypes: readonly string[];
}

type DeclaredTables = Map<string, Map<string, DeclaredColumn>>;

const COLUMN_LINE = /^(\w+): (.+);$/;

/** What a declared type says about the column behind it. */
function declare(typeText: string): DeclaredColumn {
	let type = typeText.trim();
	const nullable = / \| null$/.test(type);
	if (nullable) type = type.replace(/ \| null$/, "");
	let generated = false;
	const wrapped = /^(?:Generated|GeneratedAlways)<(.+)>$/.exec(type);
	if (wrapped) {
		generated = true;
		type = wrapped[1] as string;
	}
	if (type === "BigSerial") return { type, nullable, generated: true, dataTypes: ["bigint"] };
	if (type === "Date") return { type, nullable, generated, dataTypes: ["timestamp with time zone"] };
	if (type === "number") return { type, nullable, generated, dataTypes: ["integer"] };
	if (type === "boolean") return { type, nullable, generated, dataTypes: ["boolean"] };
	if (type === "Int8") return { type, nullable, generated, dataTypes: ["bigint"] };
	if (type.startsWith("Jsonb<")) return { type, nullable, generated, dataTypes: ["jsonb"] };
	// `string`, a string union, or a named union of strings.
	return { type, nullable, generated, dataTypes: ["text", "uuid"] };
}

/** The tables `Database` lists and the columns of each table's interface, read from the source text. Fails on a line it cannot read, so nothing is skipped silently. */
function readDeclaredTables(source: string): DeclaredTables {
	const interfaces = new Map<string, string[]>();
	for (const match of source.matchAll(/export interface (\w+) \{\n([\s\S]*?)\n\}/g)) {
		interfaces.set(match[1] as string, (match[2] as string).split("\n"));
	}
	const database = interfaces.get("Database");
	if (!database) throw new Error("database.ts has no `Database` interface");

	const tables: DeclaredTables = new Map();
	for (const line of database) {
		const entry = COLUMN_LINE.exec(line.trim());
		if (!entry) throw new Error(`Cannot read this line of Database: ${line}`);
		const body = interfaces.get(entry[2] as string);
		if (!body) throw new Error(`Database.${entry[1]} names ${entry[2]}, which is not an interface of the file`);
		const columns = new Map<string, DeclaredColumn>();
		for (const raw of body) {
			const text = raw.trim();
			// Documentation lines are comments; every other line is a column.
			if (text === "" || text.startsWith("/**") || text.startsWith("*") || text.startsWith("//")) continue;
			const column = COLUMN_LINE.exec(text);
			if (!column) throw new Error(`Cannot read this line of ${entry[2]}: ${raw}`);
			columns.set(column[1] as string, declare(column[2] as string));
		}
		tables.set(entry[1] as string, columns);
	}
	return tables;
}

interface ActualColumn {
	readonly dataType: string;
	readonly nullable: boolean;
	/** A default or a sequence: the database fills the column when an insert leaves it out. */
	readonly hasDefault: boolean;
}

type ActualTables = Map<string, Map<string, ActualColumn>>;

async function readActualTables(pool: Pool, schema: string): Promise<ActualTables> {
	const res = await pool.query<{
		table_name: string;
		column_name: string;
		data_type: string;
		is_nullable: "YES" | "NO";
		column_default: string | null;
		is_identity: "YES" | "NO";
	}>(
		`SELECT c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default, c.is_identity
		 FROM information_schema.columns c
		 JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
		 WHERE c.table_schema = $1`,
		[schema],
	);
	const tables: ActualTables = new Map();
	for (const row of res.rows) {
		const columns = tables.get(row.table_name) ?? new Map<string, ActualColumn>();
		columns.set(row.column_name, {
			dataType: row.data_type,
			nullable: row.is_nullable === "YES",
			hasDefault: row.column_default !== null || row.is_identity === "YES",
		});
		tables.set(row.table_name, columns);
	}
	return tables;
}

/** Everything where the declared tables and the real ones disagree, as readable lines. Empty when they agree. */
function differences(declared: DeclaredTables, actual: ActualTables): string[] {
	const problems: string[] = [];
	for (const table of declared.keys())
		if (!actual.has(table)) problems.push(`table ${table} is declared but does not exist`);
	for (const table of actual.keys())
		if (!declared.has(table)) problems.push(`table ${table} exists but is not declared`);
	for (const [table, columns] of declared) {
		const real = actual.get(table);
		if (!real) continue;
		for (const [name, column] of columns) {
			const found = real.get(name);
			if (!found) {
				problems.push(`${table}.${name} is declared but does not exist`);
				continue;
			}
			if (!column.dataTypes.includes(found.dataType)) {
				problems.push(`${table}.${name} is ${column.type} but the column is ${found.dataType}`);
			}
			if (column.nullable !== found.nullable) {
				problems.push(
					`${table}.${name} is ${column.nullable ? "nullable" : "not nullable"} here and ${found.nullable ? "nullable" : "NOT NULL"} in the database`,
				);
			}
			if (column.generated !== found.hasDefault) {
				problems.push(
					`${table}.${name} ${found.hasDefault ? "has a default but is not Generated" : "is Generated but has no default"}`,
				);
			}
		}
		for (const name of real.keys())
			if (!columns.has(name)) problems.push(`${table}.${name} exists but is not declared`);
	}
	return problems.sort();
}

describe("db/database.ts", () => {
	let pool: Pool;
	let schemaName: string;
	let actual: ActualTables;
	const source = readFileSync(DATABASE_FILE, "utf8");

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		actual = await readActualTables(pool, schemaName);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it("declares every table and column of a freshly migrated schema, with its type, nullability and default, and nothing else", () => {
		expect(differences(readDeclaredTables(source), actual)).toEqual([]);
	});

	it("reads a real number of tables and columns, so an empty read cannot pass", () => {
		const declared = readDeclaredTables(source);
		expect(declared.size).toBeGreaterThanOrEqual(13);
		expect(declared.get("entries")?.size).toBeGreaterThanOrEqual(16);
		expect(declared.get("entry_bodies")?.get("metadata")).toMatchObject({ nullable: false, dataTypes: ["jsonb"] });
		expect(declared.get("entry_bodies")?.get("doc")).toMatchObject({ nullable: true, dataTypes: ["jsonb"] });
		expect(declared.get("cms_events")?.get("seq")).toMatchObject({ generated: true, dataTypes: ["bigint"] });
	});

	describe("notices a declaration that drifted", () => {
		const edited = (edit: (text: string) => string) => differences(readDeclaredTables(edit(source)), actual);

		it("a column that was added to the database", () => {
			expect(edited((text) => text.replace("\tchanged_by: string | null;\n", ""))).toEqual([
				"entries.changed_by exists but is not declared",
			]);
		});

		it("a column the database does not have", () => {
			expect(
				edited((text) =>
					text.replace("\tfolder_id: string | null;\n", "\tfolder_id: string | null;\n\tsubtitle: string | null;\n"),
				),
			).toEqual(["entries.subtitle is declared but does not exist"]);
		});

		it("a column that became nullable, or stopped being", () => {
			expect(
				edited((text) =>
					text.replace("\tcollection: string;\n\tversion: number;", "\tcollection: string | null;\n\tversion: number;"),
				),
			).toEqual(["entries.collection is nullable here and NOT NULL in the database"]);
			expect(edited((text) => text.replace("\tworking_slug: string | null;", "\tworking_slug: string;"))).toEqual([
				"entries.working_slug is not nullable here and nullable in the database",
			]);
		});

		it("a column whose type changed", () => {
			expect(
				edited((text) =>
					text.replace(
						"\tversion: number;\n\tcreated_at: Date;\n\tupdated_at: Date;\n\tfirst_published_at",
						"\tversion: string;\n\tcreated_at: Date;\n\tupdated_at: Date;\n\tfirst_published_at",
					),
				),
			).toEqual(["entries.version is string but the column is integer"]);
		});

		it("a column that gained or lost a default", () => {
			expect(edited((text) => text.replace("status: Generated<EntryStatus>;", "status: EntryStatus;"))).toEqual([
				"entries.status has a default but is not Generated",
			]);
			expect(
				edited((text) =>
					text.replace(
						"\tid: string;\n\tcollection: string;\n\tversion: number;",
						"\tid: Generated<string>;\n\tcollection: string;\n\tversion: number;",
					),
				),
			).toEqual(["entries.id is Generated but has no default"]);
		});

		it("a table that is missing, or one that does not exist", () => {
			expect(edited((text) => text.replace("\tfolders: FoldersTable;\n", ""))).toEqual([
				"table folders exists but is not declared",
			]);
			expect(
				edited((text) =>
					text.replace("\tfolders: FoldersTable;\n", "\tfolders: FoldersTable;\n\ttags: FoldersTable;\n"),
				),
			).toEqual(expect.arrayContaining(["table tags is declared but does not exist"]));
		});
	});
});
