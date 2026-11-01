/**
 * Writes `src/adapters/postgres/db/database.ts`, the Kysely types of the content store's tables, from a schema the core migrations just built.
 *
 *   pnpm gen:db-types            # writes the file
 *   pnpm gen:db-types --check    # writes nothing; fails naming each table and column where the file and the migrations disagree (CI)
 *
 * It migrates a throwaway schema in the test database (`CMS_TEST_DATABASE_URL`) and drops it again. Tables, columns, base types, nullability, defaults
 * and the string union of a `CHECK (column IN (...))` come from that schema; a named type and a column's note come from `db-columns.ts`.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { migrateContentStore } from "../src/adapters/postgres/content-store";
import { defineSite } from "../src/config/define";
import { defineCollection } from "../src/schema/collection";
import { fields } from "../src/schema/fields";
import { createSite } from "../src/site";
import { COLUMN_NOTES, TYPE_IMPORTS } from "./db-columns";

const FILE = path.resolve(import.meta.dirname, "../src/adapters/postgres/db/database.ts");
const RELATIVE_FILE = path.relative(process.cwd(), FILE);

interface Column {
	readonly name: string;
	readonly dataType: string;
	readonly nullable: boolean;
	/** A default or an identity: an insert may leave the column out. */
	readonly hasDefault: boolean;
	/** A `bigserial`: filled from a sequence and never written. */
	readonly serial: boolean;
	/** The values of a `CHECK (column IN (...))`, in their order. */
	readonly allowed: readonly string[] | null;
}

type Schema = Map<string, Column[]>;

/** Any site will do: the migrations only take the default locale from it, as a column default the types do not show. */
const site = createSite(
	defineSite({
		collections: {
			page: defineCollection({
				label: "Page",
				kind: "document",
				path: "/:slug",
				fields: {
					title: fields.text({ label: "Title", required: true }),
					slug: fields.slug({ label: "Slug", from: "title", required: true }),
				},
			}),
		},
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
	}),
);

async function readMigratedSchema(url: string): Promise<Schema> {
	const pool = new Pool({ connectionString: url, max: 2 });
	const schema = `monti_db_types_${randomBytes(4).toString("hex")}`;
	try {
		await migrateContentStore(pool, { site, schema });
		const columns = await pool.query<{
			table_name: string;
			column_name: string;
			data_type: string;
			is_nullable: "YES" | "NO";
			column_default: string | null;
			is_identity: "YES" | "NO";
		}>(
			`SELECT c.table_name, c.column_name, c.data_type, c.is_nullable, c.column_default, c.is_identity
			 FROM information_schema.columns c
			 JOIN information_schema.tables t
			   ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
			 WHERE c.table_schema = $1
			 ORDER BY format('%I.%I', c.table_schema, c.table_name)::regclass::oid, c.ordinal_position`,
			[schema],
		);
		const checks = await pool.query<{ table_name: string; column_name: string; definition: string }>(
			`SELECT rel.relname AS table_name, att.attname AS column_name, pg_get_constraintdef(con.oid) AS definition
			 FROM pg_constraint con
			 JOIN pg_class rel ON rel.oid = con.conrelid
			 JOIN pg_namespace ns ON ns.oid = rel.relnamespace
			 JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
			 WHERE con.contype = 'c' AND ns.nspname = $1 AND array_length(con.conkey, 1) = 1`,
			[schema],
		);
		const allowed = new Map<string, string[]>();
		for (const row of checks.rows) {
			const values = inListValues(row.column_name, row.definition);
			if (!values) continue;
			const key = `${row.table_name}.${row.column_name}`;
			if (allowed.has(key)) throw new Error(`${key} has two CHECK (... IN ...) constraints; the generator reads one`);
			allowed.set(key, values);
		}
		// In the order the migrations created the tables and their columns.
		const tables: Schema = new Map();
		for (const row of columns.rows) {
			const list = tables.get(row.table_name) ?? [];
			list.push({
				name: row.column_name,
				dataType: row.data_type,
				nullable: row.is_nullable === "YES",
				hasDefault: row.column_default !== null || row.is_identity === "YES",
				serial: row.column_default?.startsWith("nextval(") === true,
				allowed: allowed.get(`${row.table_name}.${row.column_name}`) ?? null,
			});
			tables.set(row.table_name, list);
		}
		return tables;
	} finally {
		await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
		await pool.end();
	}
}

/** The values of `CHECK ((column = ANY (ARRAY['a'::text, 'b'::text])))`, the form Postgres gives `column IN ('a', 'b')` back in; `null` for any other check. */
function inListValues(column: string, definition: string): string[] | null {
	const match = /^CHECK \(\((\w+) = ANY \(ARRAY\[(.+)\]\)\)\)$/.exec(definition);
	if (!match || match[1] !== column) return null;
	const values: string[] = [];
	for (const item of (match[2] as string).split(", ")) {
		const literal = /^'((?:[^']|'')*)'::text$/.exec(item);
		if (!literal) return null;
		values.push((literal[1] as string).replaceAll("''", "'"));
	}
	return values;
}

const interfaceName = (table: string) =>
	`${table
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("")}Table`;

/** The column's line in its interface, without the indent. */
function columnType(table: string, column: Column): string {
	const named = COLUMN_NOTES[table]?.[column.name]?.type;
	let value: string;
	switch (column.dataType) {
		case "text":
		case "uuid":
			value = named ?? (column.allowed ? column.allowed.map((v) => JSON.stringify(v)).join(" | ") : "string");
			break;
		case "jsonb":
			value = `Jsonb<${named ?? "unknown"}>`;
			break;
		case "integer":
		case "bigint":
		case "boolean":
		case "timestamp with time zone": {
			if (named) {
				throw new Error(
					`${table}.${column.name} is ${column.dataType}: a \`type\` in db-columns.ts is only for a text, uuid or jsonb column`,
				);
			}
			if (column.dataType === "bigint" && column.serial) return column.nullable ? "BigSerial | null" : "BigSerial";
			value = { integer: "number", bigint: "Int8", boolean: "boolean", "timestamp with time zone": "Date" }[
				column.dataType
			];
			break;
		}
		default:
			throw new Error(
				`${table}.${column.name} is ${column.dataType}, which the generator has no TypeScript type for: add it to columnType()`,
			);
	}
	if (column.hasDefault) return column.nullable ? `Generated<${value} | null>` : `Generated<${value}>`;
	return column.nullable ? `${value} | null` : value;
}

/** Each entry of `db-columns.ts` names a column the schema has. */
function checkNotes(schema: Schema): void {
	const problems: string[] = [];
	for (const [table, columns] of Object.entries(COLUMN_NOTES)) {
		const real = schema.get(table);
		if (!real) {
			problems.push(`db-columns.ts names table ${table}, which the migrated schema does not have`);
			continue;
		}
		for (const name of Object.keys(columns)) {
			if (!real.some((column) => column.name === name)) {
				problems.push(`db-columns.ts names ${table}.${name}, which the migrated schema does not have`);
			}
		}
	}
	if (problems.length) throw new Error(problems.join("\n"));
}

const HEADER = `// Generated by \`pnpm gen:db-types\` from a freshly migrated schema. Do not edit: change a migration (or \`scripts/db-columns.ts\`) and run it again.
// CI runs \`pnpm gen:db-types --check\`, which fails while this file and the migrations disagree.`;

const DOC = `/**
 * The tables of the content store as Kysely sees them: one interface per table, one line per column, in the state the core migrations leave a store
 * in. Nullability, defaults (\`Generated\`) and base types come from \`information_schema\`, and a string union from the column's \`CHECK (... IN ...)\`:
 * \`Date\` is \`timestamptz\`, \`number\` is \`integer\`, \`Int8\` is \`bigint\`, \`Jsonb<T>\` is \`jsonb\`, and \`string\` is \`text\` or \`uuid\`.
 * A named type and a column's note come from \`scripts/db-columns.ts\`; where the stored JSON shape is not trusted it is \`unknown\`, and the reader
 * that owns the column validates it (\`readDoc\`, \`readTranslation\`, \`readReferenceOccurrences\`).
 *
 * The schema name is not here: \`createDb\` puts it on every table with \`withSchema\`.
 */`;

/** The identifiers a type text names, leaving out string literals. */
const namesIn = (type: string) => type.replace(/"(?:[^"\\]|\\.)*"/g, "").match(/\b[A-Z]\w*/g) ?? [];

function render(schema: Schema): string {
	const tables = [...schema.keys()];
	const body: string[] = [];
	const used = new Set<string>();
	for (const table of tables) {
		body.push(`export interface ${interfaceName(table)} {`);
		for (const column of schema.get(table) ?? []) {
			const note = COLUMN_NOTES[table]?.[column.name]?.note;
			if (note) body.push(`\t/** ${note} */`);
			const type = columnType(table, column);
			for (const name of namesIn(type)) used.add(name);
			body.push(`\t${column.name}: ${type};`);
		}
		body.push("}", "");
	}
	body.push("/** Every table of a content store schema, by name. */", "export interface Database {");
	for (const table of tables) body.push(`\t${table}: ${interfaceName(table)};`);
	body.push("}");

	const imports: string[] = [];
	if (used.delete("Generated")) imports.push(`import type { Generated } from "kysely";`);
	used.delete("Date");
	for (const [from, names] of Object.entries(TYPE_IMPORTS)) {
		const taken = names.filter((name) => used.delete(name));
		if (taken.length) imports.push(`import type { ${taken.join(", ")} } from "${from}";`);
	}
	if (used.size) throw new Error(`db-columns.ts uses ${[...used].join(", ")}: add each to TYPE_IMPORTS`);

	return `${HEADER}\n${imports.join("\n")}\n\n${DOC}\n\n${body.join("\n")}\n`;
}

/** The tables of a rendered file and each column's type, read back from the format `render` writes; `null` when the text is not in that format. */
function readBack(text: string): Map<string, Map<string, string>> | null {
	const interfaces = new Map<string, Map<string, string>>();
	let current: Map<string, string> | null = null;
	for (const line of text.split("\n")) {
		const opens = /^export interface (\w+) \{$/.exec(line);
		if (opens) {
			current = new Map();
			interfaces.set(opens[1] as string, current);
			continue;
		}
		if (line === "}") current = null;
		const column = /^\t(\w+): (.+);$/.exec(line);
		if (current && column) current.set(column[1] as string, column[2] as string);
	}
	const database = interfaces.get("Database");
	if (!database) return null;
	const tables = new Map<string, Map<string, string>>();
	for (const [table, name] of database) tables.set(table, interfaces.get(name) ?? new Map());
	return tables;
}

/** Each table and column where the file on disk and the generated text disagree, as readable lines. */
function differences(expected: string, actual: string): string[] {
	if (expected === actual) return [];
	const want = readBack(expected);
	const have = readBack(actual);
	if (!want) throw new Error("the generated text cannot be read back");
	if (!have) return [`${RELATIVE_FILE} has no \`Database\` interface the generator can read`];
	const problems: string[] = [];
	for (const [table, columns] of want) {
		const found = have.get(table);
		if (!found) {
			problems.push(`table ${table}: the migrations create it, ${RELATIVE_FILE} does not declare it`);
			continue;
		}
		for (const [name, type] of columns) {
			const declared = found.get(name);
			if (declared === undefined)
				problems.push(`${table}.${name}: the migrations create it (\`${type}\`), the file does not declare it`);
			else if (declared !== type)
				problems.push(`${table}.${name}: the file says \`${declared}\`, the migrations give \`${type}\``);
		}
		for (const name of found.keys()) {
			if (!columns.has(name)) problems.push(`${table}.${name}: the file declares it, the migrations do not create it`);
		}
	}
	for (const table of have.keys()) {
		if (!want.has(table)) problems.push(`table ${table}: the file declares it, the migrations do not create it`);
	}
	if (!problems.length)
		problems.push("the tables and columns agree, but the text differs (a note, an import, the order or the header)");
	return problems;
}

async function main(): Promise<void> {
	const check = process.argv.includes("--check");
	const url = process.env.CMS_TEST_DATABASE_URL;
	if (!url) {
		throw new Error(
			"CMS_TEST_DATABASE_URL is not set: the generator migrates a throwaway schema in the test database (never CMS_DATABASE_URL)",
		);
	}
	const schema = await readMigratedSchema(url);
	checkNotes(schema);
	const text = render(schema);
	if (!check) {
		writeFileSync(FILE, text);
		console.log(`gen-db-types: wrote ${RELATIVE_FILE} (${schema.size} tables)`);
		return;
	}
	const problems = differences(text, existsSync(FILE) ? readFileSync(FILE, "utf8") : "");
	if (!problems.length) {
		console.log(`gen-db-types: ${RELATIVE_FILE} matches the migrations (${schema.size} tables)`);
		return;
	}
	console.error(`gen-db-types: ${RELATIVE_FILE} does not match the migrations:`);
	for (const line of problems) console.error(`  ${line}`);
	console.error("Run `pnpm gen:db-types` (with CMS_TEST_DATABASE_URL set) and commit the file.");
	process.exitCode = 1;
}

main().catch((error: unknown) => {
	console.error(`gen-db-types: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
});
